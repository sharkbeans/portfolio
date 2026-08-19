---
title: "using github as a free database"
description: "lets squish the entire db into a painfully long json file"
pubDate: 2026-08-19
tags:
  - sql
draft: true
---

The editor that publishes this site is already a database client. It asks GitHub for a file, hands me a form, and writes the file back as a commit. No server, no database, no hosting bill. Once you've done that once, the obvious thought arrives: if this works for blog posts, what stops it from working for anything else?

Mostly nothing. But the thing I got wrong was *which half* was going to be difficult.

## what i assumed

My mental model was that writes would be the fragile part. Two people editing at once, last-write-wins, someone's order silently vanishing. And that reads would be trivial, because it's a public file on a CDN — of course you can read a public file.

Both of those are wrong, and they're wrong in opposite directions.

## writes are already solved, and i didn't notice

GitHub's contents API won't let you update a file unless you tell it the blob SHA you think you're replacing. Get it right and the commit lands. Get it wrong — because someone else committed in between — and you get a `409 Conflict` instead of a commit.

That's compare-and-swap. It's the same primitive a real database gives you for optimistic concurrency, and it's on by default. You cannot silently clobber someone else's write, because the API refuses to accept a write built on a stale read. The failure mode isn't lost data, it's a rejected request you can retry against fresh state.

I'd been writing that in my own editor for weeks — `putFile(path, sha, ...)` — and had filed the `sha` argument under "annoying ceremony" rather than "this is the entire consistency story."

## reads are where it actually gets expensive

Here's where the free lunch gets itemised. There are three ways to read a file back out, and I measured all three against this site's own repo.

The unauthenticated contents API is rate limited to **60 requests per hour, per IP**. That's a hard ceiling of one poll per minute, shared across every tab that visitor has open. It is not "live" by any definition.

`raw.githubusercontent.com` isn't rate limited the same way, because it's a CDN rather than the API — but it comes back with `cache-control: max-age=300`. Five minutes stale. Fine for a config file, useless for anything that's supposed to feel current.

The authenticated contents API gets **5,000 requests per hour**, which sounds generous but still only buys you a poll every 0.72 seconds if you spend it naively. Except you don't have to spend it. Conditional requests — send the `ETag` you already have as `If-None-Match` — come back `304 Not Modified`, and GitHub's own docs are explicit that a 304 doesn't count against your primary rate limit when you're correctly authorized.

So the polling budget isn't 5,000 requests. It's 5,000 *changes*. Nothing happening costs nothing. You can sit there checking every two seconds forever, and only pay when there's actually news.

## the websocket thing

I'd been describing this to myself as "use websockets to keep it live," which turns out to be a sentence with no implementation behind it. GitHub does not push. There's no subscribe endpoint, no socket to open, nothing that will tell your browser a file changed. Webhooks exist and they push properly — to a server, which is the exact thing this whole idea was built to avoid.

So "live" here means polling that's cheap enough to be indistinguishable from live, which the 304 trick genuinely gets you to. It just has to be honest about what it is.

The sting in that: cheap polling requires authentication, and authentication in a static page means a token in the browser. Which is fine when the only person holding it is me, and completely unacceptable the moment I imagine handing this to strangers. That single constraint decides the shape of the whole thing — v1 is a tool for authenticated people, not a public app, and pretending otherwise just means shipping my write access to everyone.

## what it still can't do

There's a 2016 post, [Git as a NoSQL Database](https://news.ycombinator.com/item?id=26703808), whose comment section is worth more than the post. The objection that lands hardest: git gives you key-based lookup and nothing else. No indexes, no queries, no `WHERE`. Any question more interesting than "give me this path" is a full recursive scan.

For what I'm building that's survivable, because the entire dataset is one JSON file small enough to load whole and filter in memory. Git isn't the query engine; the client is. That stops being true somewhere around a few megabytes, and when it does, the answer isn't to get cleverer — it's to leave. The thread points at [Dolt](https://github.com/dolthub/dolt) for an actual SQL database with git semantics, and Irmin and Fossil for adjacent takes on the same idea.

The other real objection is that commits are a coarse audit log. If you snapshot on a schedule, everything that happened between snapshots collapses into one commit with one author. That's a genuine problem for the "free audit trail" pitch — though less so here, since every write is a discrete user action producing its own commit, rather than a periodic dump.

## v1 plans

One JSON file that will eventually go painfully long as the table. Optimistic concurrency for free, courtesy of the SHA check I'd been ignoring. ETag polling every couple of seconds for reads, which costs nothing until something actually changes. Authenticated users only, because the token has to live somewhere and a public page is not that somewhere.

That's a real CRUD app with no server and no bill, and a very specific ceiling that I now know the shape of before building into it rather than after.

## then i built it, and the bottleneck was somewhere else entirely

Everything above was reasoning. Here's what happened when I actually wrote the thing.

The plan was: GitHub is the write-ahead log, an in-memory index is the materialized view, queries never touch the network. So the first thing to measure was whether querying in memory is actually worth the complexity, against a network floor of ~45ms per conditional request.

```
100,000 records (9.2 MB)
  get by id                             0.000 ms
  selective filter (indexed)            0.021 ms
  selective filter (full scan)         14.29  ms
  network conditional request          45     ms
  rebuild whole view (parse + index)   85     ms
  apply 1 change incrementally          0.005 ms
```

Queries are microseconds. The network is 45 milliseconds. And **rebuilding the view costs 85ms — nearly twice a network round trip.**

That reorders the whole problem. I'd been thinking about read latency, and read latency isn't the constraint. If a single JSON file holds everything, then *every* change forces a full reparse and reindex, on the main thread, and no amount of GitHub being fast helps. Applying one changed record instead costs 0.005ms — seventeen thousand times cheaper.

So the argument for sharding the data across files isn't elegance, and it isn't the 1MB ceiling where the contents API stops serving cleanly. It's that one file forces you to rebuild everything on every change, which is the single most expensive operation in the system. I had the right conclusion earlier for entirely the wrong reason.

## the index that was worse than no index

First version of the query engine, benchmarked at 10k records:

```
where status (indexed)     0.0733 ms
where status (no index)    0.0001 ms   ← 700x faster WITHOUT the index
```

An index that loses to a linear scan is not an index, it's a memory leak with extra steps.

The bug: my `query()` materialised the whole bucket of matching ids and sorted it *before* applying `LIMIT`. So fetching 50 rows did O(n log n) work over 2,500 ids, while the unindexed path just walked the already-sorted array and stopped at 50. Keeping index buckets sorted on insert makes the query lazy — walk 50 candidates, stop — and it goes to 677× *faster* than the scan on selective queries.

The benchmark was also lying to me. I'd been filtering on a value that matched 25% of rows, where a scan finds its 50 matches almost immediately. Indexes only earn their keep when the filter is selective. A benchmark that flatters your code is worse than no benchmark.

## the concurrency test passes, and that's the bad news

The one test that can't be faked with a mock: N writers race from identical state, and every row must survive.

```
writers            5
rows landed        5      ← all of them
409s resolved      10
failures           0
PASS - no lost updates
```

Compare-and-swap works. Nobody's write vanished. But:

```
wall clock   8886 ms  for 5 rows
per write    1777 ms
```

Nine seconds to insert five rows. And look at the conflict count — 10 for 5 writers. That's exactly *N(N−1)/2*. **Conflicts grow quadratically with concurrency.**

Extrapolate: 20 concurrent writers means 190 conflicts plus 20 commits — 210 content-generating requests to insert 20 rows. GitHub allows 500 of those *per hour*. So twenty rows would burn 42% of the daily-scale write budget and take minutes.

The retry loop is correct and doesn't scale. Those are compatible statements, and I'd only checked the first one.

## the fix is to stop treating a row as a unit of work

One commit per row is the wrong granularity. The client now stages changes locally — inserts and deletes apply to the view instantly, cost nothing, and touch no network — and commits them together.

```
7 deletes staged (0 network calls)
committed in 721ms
commits used: 1    conflicts: 0
```

Seven rows deleted in one commit. The old path was seven commits, nine seconds, and a retry storm. Same for inserts: five staged rows, 993ms, one commit, zero conflicts.

This is the thing that actually makes it usable, and it isn't a latency optimisation. It's a change to what counts as a transaction. Batching removes the quadratic conflict term entirely, because there's only one commit to conflict.

It also fixed a bug I'd built in: two writes from the same tab were racing each other over a shared blob SHA and generating 409s *against themselves*. Writes within one client aren't meaningfully concurrent. Queuing them is correct, and it means the only remaining conflicts are between real, separate users — which is where conflicts should come from.

## the tests passed and the browser didn't

Three bugs in a row that my Node benchmarks were structurally incapable of catching:

**`fetch` bound to the wrong receiver.** I stored `globalThis.fetch` as a class field and called it as `this.#fetch(...)`, which passes the client as `this`. Node doesn't care. Browsers throw `'fetch' called on an object that does not implement interface Window`.

**The browser's HTTP cache serving a stale SHA.** The contents endpoint replies `cache-control: max-age=60`. My blob-SHA lookup sent no `If-None-Match`, so the browser could hand back a minute-old response — and writing with a stale SHA is a guaranteed 409, repeatedly, since each retry re-read the same cached value. Node has no HTTP cache. `cache: "no-store"` fixes it; the freshness check is the ETag I send myself, not the browser's.

**Form-state restoration.** I cleared a bad value out of localStorage but didn't reset the input, and browsers restore form contents across a soft reload — overriding the HTML `value` attribute. The bad value kept reappearing from the browser's own form cache with localStorage already innocent.

Every one of these passed in Node. The bench harness validates *GitHub's* semantics, which is language-independent and genuinely useful. It cannot validate the client, because the two runtimes disagree about details neither documents loudly.

## the security model is one line

The token needs exactly one permission: **Contents: Read and write**. That's broader than it sounds — it covers the file endpoints *and* the entire Git database API, blobs and trees and commits and refs. Metadata read-only gets added automatically and can't be removed.

The shape that falls out:

- **App repo: public.** GitHub Pages on the free tier only serves public repositories. Fine — it's HTML and JavaScript, no data, no token.
- **Data repo: private.** Never touched by Pages. It returns `404` to anyone without a token — not `403`; GitHub won't even confirm it exists.

Your app's source being public is not a leak. Nothing secret is ever committed; each user pastes their own token into their own browser. If publishing the source would compromise you, the design was wrong regardless of repo visibility.

The honest limit: tokens are scoped per *repository*, never per file. Everyone you give access to can read every row, and can bypass the app entirely with `git clone`. Per-user permissions inside the UI are an affordance, not security. That's fine for a trusted group and disqualifying for anything else — and it's a property of GitHub, not something I can engineer around.

## what i'd tell myself at the start

Writes are compare-and-swap and were never the hard part. Reads are free if you never make them. The expensive operation was the one I wasn't looking at — rebuilding state — and the fix was changing what counts as a transaction, not making anything faster.
