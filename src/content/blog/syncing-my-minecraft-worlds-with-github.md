---
title: "Syncing my Minecraft worlds with github"
description: "trying to sync a vanilla Minecraft world between my work/home PC and laptop"
pubDate: 2026-08-21
tags:
  - git
draft: true
---

I play Minecraft on three machines: a work PC, my home desktop, and a ThinkPad. Same world, three copies, and the classic failure mode — I'd build something on one machine, forget to copy the folder, and then overwrite it from a two-week-old save on another.

The obvious answer is a cloud-synced folder. The obvious answer is also wrong: Dropbox-style sync happily corrupts a live world, region files are enormous, and there's no history when something goes bad.

So I forked [MineCommit](https://github.com/HairlessVillager/minecommit), which already solves the hard half of this problem, and built the half I actually needed.

## What MineCommit already did

MineCommit is a Rust tool that "flattens" a Minecraft Java save into a Git-friendly shape. Instead of committing a 60 MB `r.0.0.mca` blob every backup, it splits chunk NBT into small per-chunk files that Git can delta-compress properly. Region files, entities, POI, gzipped `.dat` files — each has a handler, and there's an object-database abstraction underneath so the same pipeline can write to a plain filesystem or straight into a Git ODB, in parallel via `rayon`.

The result is that an incremental backup of a huge world costs a fraction of the world's size. That's the genuinely clever part, and it's not mine — full credit upstream.

What it didn't have was the thing I wanted: **a remote**. Backups lived in a bare repo next to your save. Great for undo, useless for three computers.

## What I built

Five commits so far. The big one is a new `sync` module (~850 lines) plus the CLI and GUI surface on top of it.

### A sync model that refuses to be clever

The core is a small state machine comparing the local backup branch to the fetched remote tracking branch:

```rust
pub enum SyncState {
    NotConfigured,
    Empty,
    UpToDate,
    LocalAhead,
    RemoteAhead,
    Diverged,
}
```

Everything follows from that. `minecommit sync` is the *before you play* action: fetch, and restore **only** if the remote is a strict fast-forward. `minecommit push` is the *after you play* action: fetch again, and push only if local is strictly ahead — a normal, non-force push.

And if both sides moved since their common ancestor? It stops:

> cloud conflict detected: both local and remote Minecraft backups changed. MineCommit will not merge them; both histories have been preserved.

This was the single most important design decision. There is no sane automatic merge of two divergent Minecraft worlds. Half a base from Monday and half a base from Wednesday isn't a merge, it's a disaster. So the tool never merges, never force-pushes, and never resolves anything on my behalf. It tells me, and I decide.

The local branch only ever moves via a compare-and-swap `git update-ref <ref> <new> <expected-old>`, so a concurrent change can't be silently clobbered.

### Never write over a live world

Restores don't touch the real save directory until the very last moment. The commit is reconstructed into a sibling staging directory first; only after that succeeds *and* the result validates as a real Minecraft save does the old world get renamed to a timestamped `.snapshot`, and the staging dir moved into place. If the final rename fails, the snapshot is rolled back. If reconstruction fails mid-sync after a fast-forward, the branch is rolled back too — and if *that* rollback fails, you get an error that says so explicitly instead of pretending things are fine.

The staging directory itself is guarded by a `Drop` impl, so an early return cleans it up.

### Don't back up a world Minecraft is holding

`session.lock` is Minecraft's "I'm using this world" flag, and it's a real advisory lock, not just a marker file. Backing up or restoring underneath a running game is how saves get corrupted, so MineCommit now takes that lock itself and bails out if it can't.

This one had a genuine gotcha. Minecraft is Java, and Java's `FileChannel.lock()` on Unix uses the POSIX `fcntl` lock family. Rust's `std::fs::File::try_lock` uses `flock` there — a *different* lock family, which happily succeeds against a lock Java is holding. So the Unix path drops to `libc::fcntl` with `F_SETLK` directly, and `WouldBlock` becomes a friendly "close the world first" message. Windows keeps the `std` path.

```rust
let mut lock: libc::flock = unsafe { std::mem::zeroed() };
lock.l_type = libc::F_WRLCK as _;
lock.l_whence = libc::SEEK_SET as _;
let result = unsafe { libc::fcntl(file.as_raw_fd(), libc::F_SETLK, &lock) };
```

Two lock APIs on the same file, both "correct", one of them silently useless for this. Fun afternoon.

### Which machine made this backup?

Every backup commit gets a `MineCommit-Device:` trailer with the hostname. The GUI reads it back with `git show -s --format=%cI%n%B` and shows *when* and *from where* both the local and cloud backups were made. No extra service, no metadata file to keep in sync — the information rides along in the commit and shows up on every machine after a fetch. Exactly the thing I want to see before clicking restore: "cloud backup: yesterday 11pm, from THINKPAD."

## Making it non-dev-friendly (on purpose)

Here's the part I care about most. Upstream's README says "create a bare repository, set `gc.auto 0`, set `core.logAllRefUpdates`." That's fine for me. It is not fine for the version of me that just wants to play Minecraft at 1am, and it's certainly not fine for anyone I'd hand this to.

So the desktop app got a first-run wizard with four steps — `welcome`, `create-account`, `existing-account`, `repository`. It asks one question: do you already have a GitHub account? Then it walks you to `github.com/new?visibility=private`, tells you to hit **Code → HTTPS** and copy the address, takes the paste, and makes the first backup. No terminal, no Git vocabulary beyond "paste this address."

Auth deliberately stays boring: Git Credential Manager for HTTPS, or an SSH key. There's no OAuth flow to maintain, and HTTPS URLs with credentials embedded in them are rejected outright — I'd rather not help anyone push their token to a public repo.

Minecraft stays completely vanilla through all of this. No mod, no launcher patch, no custom directory. The world lives in `.minecraft/saves` where it always did.

### English UI, and worlds that live anywhere

Two more friendliness fixes. The GUI was Chinese-only, so I added an i18n layer (~420 lines of strings) and an English translation across the sidebar, home, save management, settings, hover cards, and the log view.

And world discovery used to *require* a recognisable `.minecraft/saves` path shape — anything else was a hard error. My ThinkPad doesn't keep worlds there. Now the path parser falls back to using the folder's own name, and validation switched to the thing that actually matters: is it a directory, and does it contain `level.dat`? Recognised launcher layouts still get their nicer `LAUNCHER / version / world` labels.

## The bug I'm most glad I caught

The last commit looks tiny — 15 lines — and it's the scariest thing I found.

MineCommit's flattening pipeline tracks files it doesn't have a handler for. On my machine, that was `*.dat_old*.gz` — some launchers and archive tools keep Minecraft's old NBT snapshots with an extra gzip suffix. Easy fix, one glob in the raw handler, preserved byte-for-byte.

The real problem was what happened *next*. Unhandled files were reported, but the commit went ahead anyway. So you'd get a green checkmark on a backup that had quietly dropped files. Now:

```rust
// Do not make a partial backup look successful. Flattening may have
// written loose Git objects, but without a commit or ref update they
// are unreachable and no backup history advances.
if !unprocessed.is_empty() {
    log::warn!(
        "Found {} unhandled files; leaving the backup branch unchanged",
        unprocessed.len()
    );
    return Ok(unprocessed);
}
```

A backup tool that lies about succeeding is worse than no backup tool. Loose objects from a partial run are unreachable and get garbage collected; nothing advances; you get told.

## Oh, and this was my first time writing Rust

Worth saying: before this, I had written zero Rust. I picked it up because the project I wanted to extend happened to be written in it, which is a slightly backwards reason to learn a language, and it turned out fine.

Rust has a reputation. You know the one — the borrow checker is a cruel gatekeeper, everything is `Arc<Mutex<>>`, the community will not shut up about it. I went in braced for a fight.

The fight mostly didn't happen, and I think the reason is that everything I was doing was *inherently* about ownership. Who owns this directory while it's being restored? Who's holding the lock on this file, and for how long? At what point does the old world stop being the real world? Those are the actual questions in this codebase, and Rust makes you answer them out loud instead of letting you find out later, on your own save file.

The `Drop` impl on the staging directory is the clearest example. In another language I'd have written cleanup at every early return and forgotten one. Here, cleanup is attached to the *lifetime* of the thing, and the compiler runs it for me. That's not the borrow checker being annoying, that's the borrow checker doing my job.

The one time it did bite was that release build break — I passed a `GitOutput` into an error check by value, then tried to read its stdout afterwards. In a language with garbage collection that's a nothing-burger; here it's a compile error, and the fix was to decide whether I wanted a copy or a reference. Which, fair enough. That was a real question I had been avoiding.

Things I have not yet had to think about: async, lifetimes with names, trait objects, any of the scary stuff. Ask me again in a month.

## Shipping it

A couple of release-pipeline fixes rounded things out. Debian packaging for Linux Mint Debian Edition and friends — a `.deb` that declares Git as a dependency, so installing it via the system package installer just works, with the portable `.tar.gz` still there for people who prefer it. That immediately collided with the CLI's tarball name, so the GUI artifact became `MineCommit-GUI-…tar.gz`.

Plus the ownership slip above: `#[derive(Clone)]` on `GitOutput` and a `.clone()` at the call site. The `Command` import also needed a `#[cfg(test)]` once the non-test path stopped using it.

## Where it's at

Working today: `remote add`, `remote status`, `push`, `sync`, staged restores with snapshots, session-lock safety, device metadata, the setup wizard, English UI.

Still WIP:

- Commit history browser in the GUI
- Save size analytics
- Actual multi-week testing across all three machines — a few days of "sync, play, push" is not a track record

But the loop I wanted works. Open the app, sync, play, back up, push. Three machines, one world, no lost afternoons.

If you want to try it, the upstream project is [MineCommit](https://github.com/HairlessVillager/minecommit) — the flattening engine is theirs and it's excellent. My fork adds the cloud-sync layer on top.
