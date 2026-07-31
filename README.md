# sharkbeans-site

A static personal developer website built with Astro, TypeScript, and KAPLAY. The homepage is a
typographic world: a small sprite walks around the actual rendered content — headings, project
blocks, dividers — which double as the level geometry. It is intentionally not a resume or CV
site. The main identity is a public handle, not a full legal name.

## Purpose

This project is a personal home on the web for:

- projects and case studies
- blog posts and development notes
- software and hardware notes
- a short personal About page
- public profile links
- a homepage you can walk around in, without gating any of the above behind it

The design target is a normal, readable personal site first. The world system is an enhancement
layered on top, not a replacement for it.

## Tech stack

- Astro
- TypeScript
- KAPLAY
- Astro content collections
- MDX
- semantic HTML
- modern CSS
- GitHub Actions
- GitHub Pages

## Local development

Node `24.18.1` is pinned in [.nvmrc](/home/jytan/Documents/Git/portfolio/.nvmrc:1).

```bash
npm install
npm run dev
```

The Astro dev server defaults to `http://localhost:4321`.

## Production build

```bash
npm run check
npm run build
npm run preview
```

`npm run check` runs Astro diagnostics and TypeScript checks. `npm run build` outputs the fully static site to `dist/`.

## GitHub Pages deployment

The workflow lives at [.github/workflows/deploy.yml](/home/jytan/Documents/Git/portfolio/.github/workflows/deploy.yml:1) and does the following:

1. Checks out the repository.
2. Sets up Node from `.nvmrc`.
3. Installs dependencies with `npm ci`.
4. Builds the Astro site.
5. Uploads the `dist/` folder as the GitHub Pages artifact.
6. Deploys that artifact to GitHub Pages.

To enable deployment:

1. Push this repository to GitHub.
2. In GitHub, open `Settings -> Pages`.
3. Set the source to `GitHub Actions`.
4. Make sure your default deploy branch matches the workflow trigger, currently `main`.

### Base-path handling

The site is configured with `base: "/portfolio/"` in [astro.config.ts](/home/jytan/Documents/Git/portfolio/astro.config.ts:1) to match the current GitHub Pages project URL. Every internal link, asset path, and the sprite sheet URL is built from `import.meta.env.BASE_URL` rather than hardcoded root-relative paths — see `src/data/world.ts`, `src/components/world/world.ts`, and `Footer.astro` for examples. If you move to a custom domain at the root, change `base` to `"/"` and update `site` in `src/data/profile.ts`.

## Custom-domain setup

This project currently expects to live under a repository subpath (`/portfolio/`). To move to a root custom domain:

1. Replace `site` in [src/data/profile.ts](/home/jytan/Documents/Git/portfolio/src/data/profile.ts:1) with the real domain.
2. Change `base: "/portfolio/"` to `base: "/"` in `astro.config.ts`.
3. Add a `CNAME` file in `public/` containing only the final domain, for example `sharkbeans.dev`.
4. Configure your DNS records to point at GitHub Pages.
5. Rebuild and redeploy.

Do not leave the placeholder domain in place if you want canonical URLs, Open Graph metadata, RSS, sitemap, and `robots.txt` to point to the right host.

## Project structure

```text
src/
├── components/
│   ├── world/
│   │   ├── WorldCanvas.astro       full-viewport canvas + controls + dialog
│   │   ├── world.ts                boot/orchestration, KAPLAY instance, main loop
│   │   ├── world-types.ts          shared types (WorldRect, Axes, Direction, ...)
│   │   ├── DomCollisionSystem.ts   DOM -> collision-rect derivation & caching
│   │   ├── PlayerController.ts     position, velocity, facing, axis-separated collision
│   │   ├── InputController.ts      keyboard axes, run, interact, escape
│   │   ├── CameraController.ts     edge-follow page scrolling
│   │   ├── InteractionSystem.ts    proximity detection, highlight, preview dialog
│   │   └── SpawnPointSystem.ts     data-world-spawn -> safe placement
│   ├── Footer.astro
│   ├── Header.astro
│   ├── PostList.astro
│   ├── ProjectList.astro
│   └── SocialLinks.astro
├── content/
│   └── blog/
├── data/
│   ├── profile.ts
│   ├── projects.ts
│   ├── socials.ts
│   ├── uses.ts
│   └── world.ts                    interaction preview content (title/description/href)
├── layouts/
│   ├── ArticleLayout.astro
│   ├── BaseLayout.astro
│   └── ProjectLayout.astro
├── pages/
│   ├── 404.astro
│   ├── about.astro
│   ├── index.astro                 the only page that mounts the world system
│   ├── lab.astro
│   ├── robots.txt.ts
│   ├── rss.xml.ts
│   ├── uses.astro
│   ├── blog/
│   │   ├── [slug].astro
│   │   └── index.astro
│   └── projects/
│       ├── index.astro
│       ├── mybeli.astro
│       └── objekt-tools.astro
├── services/
│   └── api.ts
└── styles/
    ├── global.css
    ├── prose.css
    ├── tokens.css                  dark "game manual" palette + type stacks
    └── world.css                   canvas, controls, highlight, debug overlay styles

scripts/
└── generate-sprite.mjs             regenerates public/assets/sprites/player.png

public/
├── assets/
│   ├── screenshots/
│   └── sprites/
│       ├── player.png
│       └── player.json
├── favicon.svg
└── social-card.svg
```

## The typographic world

The homepage (`src/pages/index.astro`) is the level. There is no separate minimap, no hardcoded
coordinate table, and no second "game" living beside the real content. A sprite walks in free 2D
space over the rendered page, and the DOM itself supplies the collision geometry.

### How DOM elements become collision geometry

`DomCollisionSystem` (`src/components/world/DomCollisionSystem.ts`) queries elements marked with
`data-world-*` attributes, reads their `getBoundingClientRect()`, and converts each rect to
**document coordinates** (`rect + window.scrollX/scrollY`). Because everything is cached in
document space, scrolling never invalidates the cache — only real layout changes do. Rects are
recomputed on:

- initial load
- `document.fonts.ready`
- each image's `load` event (skipped if already complete)
- a debounced (~150ms) `resize` / `orientationchange`
- a `ResizeObserver` on the homepage's single content wrapper (`#world-content`)

This keeps `getBoundingClientRect()` calls batched and off the per-frame hot path. Rendering reads
the cached rects and just subtracts the *current* scroll position — no re-measurement per frame.

### `data-world-*` attributes

| Attribute | Effect |
| --- | --- |
| `data-world-solid` | Element becomes a padded collision rectangle. The player cannot walk through it and slides along its edges. |
| `data-world-interactable="id"` | Element becomes a proximity target. `id` must match an entry in `src/data/world.ts`. Can be combined with `data-world-solid` on the same element. |
| `data-world-spawn="id"` | A zero-size marker; its position is a named safe-placement point (see Spawn points below). |
| `data-world-bounds` | Optional. If present, its rect defines the player's movement bounds instead of the whole `#world-content` wrapper. |

**Adding a new solid element:** add `data-world-solid` to a heading, image, code block, or grouped
content block — not to individual body-text lines, inline links, tags, or list items. Prefer one
rectangle around a whole paragraph/group over many tiny ones; the system is built for "a few dozen
landmarks," not "one rect per word."

**Adding a new interactable:** add `data-world-interactable="my-id"` to the element, then add a
matching entry (`title`, `description`, `href`, `ctaLabel`, `promptLabel`) to
`worldInteractables` in [src/data/world.ts](/home/jytan/Documents/Git/portfolio/src/data/world.ts:1). Interactables don't need to be solid — see the `about` link in the "elsewhere on the site" list, which is interactable but walk-through so it doesn't block the exit corridor.

**Adding a spawn point:** drop `<span data-world-spawn="my-id" aria-hidden="true"></span>` next to
(not inside) the content it should spawn near.

### Spawn points

Spawn markers are resolved by `SpawnPointSystem`, never hardcoded as pixel coordinates. On
request, it looks up the marker's current document position and, if that point now falls inside a
solid rect (e.g. after a layout change), searches outward in a small spiral for the nearest free
spot. Placement only happens on explicit triggers: initial load (`"intro"`) and clicking an in-page
anchor link (`href="#section"`), which finds the `data-world-spawn` marker inside the target
section and repositions the player there — no forced walking sequence.

### Replacing the player sprite

The sprite sheet is generated, not hand-drawn or sourced from another game. Regenerate it with:

```bash
node scripts/generate-sprite.mjs
```

This writes `public/assets/sprites/player.png` (a 64×64, 4-column × 4-row sheet: one row per
direction — down, left, right, up — 4 walk frames each, frame 0 doubles as idle) and
`public/assets/sprites/player.json` (frame layout + anim map, for reference/regeneration tooling).
It's a hand-rolled RGBA PNG encoder using only `node:zlib` — no image dependency.

**License:** the sprite is original placeholder art generated for this project — public domain /
CC0, replace freely. No copyrighted or ripped game assets are used anywhere in this project.

To use different art, replace `public/assets/sprites/player.png` (and update the `sliceX`/`sliceY`
and `anims` in `ANIMS` inside `src/components/world/world.ts` if the frame layout changes).
`PlayerController`'s state shape (position, velocity, facing, `isMoving`) doesn't need to change —
only the rendering/anim-name mapping in `world.ts` does.

### Reading mode

The "Reading mode" button (always visible near the top of the homepage) hides the sprite, disables
collision-driven movement and the camera's edge-follow scrolling, and restores completely normal
page scrolling — nothing about the underlying content changes. The preference is remembered for
the current tab via `sessionStorage` (`world:reading-mode`).

### Mobile / responsive fallback

Manual movement requires both a wide viewport and a fine pointer:
`(min-width: 64rem) and (pointer: fine)`, re-evaluated live via `matchMedia` listeners. Below that:

- **≥420px wide:** the sprite becomes a small decorative, non-interactive companion pinned to a
  slim gutter on the right edge of the viewport, with its vertical position following scroll. It
  never overlaps the content column.
- **<420px wide:** the sprite is hidden entirely to guarantee there's no chance of covering text
  or causing overflow.

Manual keyboard movement, DOM collision, and camera follow are all inert in this mode — mobile
just gets normal scrolling, which is the point.

### Collision debug mode

Append `?debugWorld=1` to the URL (or run `astro dev`, which enables it automatically) to draw:
cached solid-rect outlines, the player hitbox, each interactable's outline, the current proximity
radius, spawn-point markers, and a small on-screen readout (world position, scroll position,
collision-body counts, current mode). It never renders unless explicitly requested in production.

### Performance notes

- `getBoundingClientRect()` is only called during a batched `recalculate()` pass, never per frame.
- Solid/interactable rects are cached in document coordinates, so scroll never triggers
  re-measurement.
- Resize handling is debounced (~150ms for collision geometry, ~200ms for the KAPLAY canvas
  remount described below).
- KAPLAY sizes its internal drawing buffer from the canvas's *parent* element's size unless you
  pass `width`/`height` explicitly — `world.ts` always passes the live viewport size and, because
  that internal buffer isn't resized in place by the engine, a real viewport resize is handled by
  disposing (`k.quit()`) and re-mounting the renderer rather than fighting a stale buffer.
- KAPLAY itself is loaded via a dynamic `import()` scheduled with `requestIdleCallback`, after the
  static HTML has already rendered; a failed import leaves the page as an ordinary static site.

## Accessibility

- All meaningful content is semantic HTML, fully present and readable without any JavaScript.
- The canvas is `pointer-events: none` at all times — it never intercepts clicks or touch
  scrolling. Every real interactive element (project links, nav, buttons) is a normal DOM node
  underneath it.
- Keyboard movement/interact keys are never intercepted while focus is inside an input, textarea,
  select, contenteditable region, or an open dialog (see `isTypingTarget`/`isPaused` in
  `InputController.ts`).
- Tab navigation and native focus outlines work exactly as on any other page.
- The proximity highlight never relies on color alone — it pairs an outline with a `›` marker.
- `prefers-reduced-motion: reduce` disables the smooth camera-follow easing (snaps instead) and
  the global reduced-motion rules in `global.css` still apply site-wide.
- No audio anywhere.
- Reading mode gives a persistent, one-click way to turn all of the above off completely.

## Other routes

`/projects`, `/blog`, `/uses`, `/about`, `/lab`, and individual project/post pages carry the same
dark theme but do not mount the world system — they're plain, fast, readable pages. `Footer.astro`
has a tiny purely-decorative CSS `steps()` sprite animation (same sheet, no KAPLAY) as the only
world-adjacent touch outside the homepage.

## Visual theme

- [src/styles/tokens.css](/home/jytan/Documents/Git/portfolio/src/styles/tokens.css:1) — the dark palette (near-black background, warm off-white text, phosphor-green accent, sparing cyan) and the three font stacks (condensed/grotesque display, sans body, mono metadata/nav).
- [src/styles/global.css](/home/jytan/Documents/Git/portfolio/src/styles/global.css:1) — base element styles, the subtle static scanline texture, shared layout primitives.
- [src/styles/world.css](/home/jytan/Documents/Git/portfolio/src/styles/world.css:1) — canvas positioning, reading-mode toggle, interactable highlight, debug overlay, preview dialog.
- [src/styles/prose.css](/home/jytan/Documents/Git/portfolio/src/styles/prose.css:1) — long-form article/MDX typography, unchanged in structure from before, just re-themed via CSS variables.

No `@font-face`/webfonts are loaded — every font stack falls back through system fonts, so there's
nothing extra to download.

## Changing the handle

Update the public identity in [src/data/profile.ts](/home/jytan/Documents/Git/portfolio/src/data/profile.ts:1):

- `handle`
- `siteLabel`
- `site`
- `firstName`
- `introHeading`
- `intro`
- `homeBlurb`

No `fullName` field is used anywhere in the site.

## Updating profile links

Edit:

- [src/data/profile.ts](/home/jytan/Documents/Git/portfolio/src/data/profile.ts:1) for global site metadata and public email label
- [src/data/socials.ts](/home/jytan/Documents/Git/portfolio/src/data/socials.ts:1) for GitHub and other public profiles

Placeholder values are intentionally visible until they are replaced.

## Adding or updating projects

Project summary data lives in [src/data/projects.ts](/home/jytan/Documents/Git/portfolio/src/data/projects.ts:1).

To add a project:

1. Add a typed entry to the `projects` array.
2. Create a matching project page in `src/pages/projects/`.
3. Add screenshots or diagrams in `public/assets/screenshots/` if needed.
4. Mark `featured: true` if it should appear on the homepage.
5. If it should be walkable/interactive on the homepage, add it to `src/pages/index.astro` with
   `data-world-solid data-world-interactable="your-slug"` and a matching entry in
   `src/data/world.ts`.

Current case-study pages:

- [src/pages/projects/objekt-tools.astro](/home/jytan/Documents/Git/portfolio/src/pages/projects/objekt-tools.astro:1)
- [src/pages/projects/mybeli.astro](/home/jytan/Documents/Git/portfolio/src/pages/projects/mybeli.astro:1)

## Adding blog posts

Blog content uses Astro content collections with MDX files in [src/content/blog](/home/jytan/Documents/Git/portfolio/src/content/blog).

Required frontmatter:

- `title`
- `description`
- `pubDate`
- `tags`
- `draft`

Optional frontmatter:

- `updatedDate`
- `heroImage`
- `canonicalUrl`

To add a new post:

1. Create a new `.md` or `.mdx` file in `src/content/blog/`.
2. Add frontmatter matching the schema in [src/content.config.ts](/home/jytan/Documents/Git/portfolio/src/content.config.ts:1).
3. Write the article body.
4. Set `draft: false` when the post is ready to be treated as published.

## Updating the Uses page

Edit [src/data/uses.ts](/home/jytan/Documents/Git/portfolio/src/data/uses.ts:1). The page is data-driven, so you usually do not need to touch the Astro template unless you want to change layout. A short teaser for this page also appears on the homepage as one of the walkable landmarks.

## Future API integration

[src/services/api.ts](/home/jytan/Documents/Git/portfolio/src/services/api.ts:1) is a small placeholder service layer for future public-data fetches.

Important constraints:

- GitHub Pages does not run server code.
- Safe public APIs may be fetched directly from the browser when CORS allows it.
- Secret-backed requests must not be embedded in client code.
- Secret-backed or rate-limited integrations need an external API, Worker, or build-time automation.

Possible later expansions:

- recent GitHub activity
- live project status
- a guestbook
- a contact endpoint backed by another service
- hidden homepage achievements
- a small terminal experiment

## Content rules already followed

- no full legal name is displayed
- no resume or CV page exists
- no employment timeline exists
- no copyrighted or ripped game assets are used anywhere
- all current data is local and static

## Known limitations

- Several links and content fields are still visible placeholders until public values are supplied.
- The world system currently exists only on the homepage, by design — other pages stay simple and fast.
- Axis-separated collision resolution is intentionally simple (no full physics/spatial-hash solver); in rare multi-rect-overlap cases the player can be nudged slightly further than the strictly nearest free point. This has not been an issue in testing at the current homepage density.
- The Open Graph image is an SVG placeholder; you may want a custom PNG later for wider crawler compatibility.
- The current project pages for private work stay intentionally high-level to avoid exposing sensitive internals.
