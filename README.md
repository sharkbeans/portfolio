# sharkbeans-site

A static personal developer website built with Astro, TypeScript, and a small KAPLAY-powered homepage map. It is intentionally not a resume or CV site. The main identity is a public handle, not a full legal name.

## Purpose

This project is a personal home on the web for:

- projects and case studies
- blog posts and development notes
- software and hardware notes
- a short personal About page
- public profile links
- a light RPG-style navigation layer on the homepage

The design target is mostly a normal personal site with a small playful navigation system layered on top.

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

## Custom-domain setup

This project expects to live at the root of a custom domain, not under a permanent repository subpath.

Before deploying:

1. Replace `site: "https://example.com"` in [src/data/profile.ts](/home/jytan/Documents/Git/portfolio/src/data/profile.ts:1) with the real domain.
2. Add a `CNAME` file in `public/` containing only the final domain, for example `sharkbeans.dev`, once the real domain is known.
3. Configure your DNS records to point at GitHub Pages.
4. Rebuild and redeploy.

Do not leave the placeholder domain in place if you want canonical URLs, Open Graph metadata, RSS, sitemap, and `robots.txt` to point to the right host.

## Project structure

```text
src/
├── components/
│   ├── game/
│   │   ├── GameCanvas.astro
│   │   ├── game.ts
│   │   ├── CharacterController.ts
│   │   ├── InputController.ts
│   │   ├── ScrollController.ts
│   │   ├── InteractionController.ts
│   │   └── JourneyMap.ts
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
│   └── uses.ts
├── layouts/
│   ├── ArticleLayout.astro
│   ├── BaseLayout.astro
│   └── ProjectLayout.astro
├── pages/
│   ├── 404.astro
│   ├── about.astro
│   ├── index.astro
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
    └── tokens.css

public/
├── assets/
│   └── screenshots/
├── favicon.svg
└── social-card.svg
```

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

Edit [src/data/uses.ts](/home/jytan/Documents/Git/portfolio/src/data/uses.ts:1). The page is data-driven, so you usually do not need to touch the Astro template unless you want to change layout.

## Scroll and keyboard synchronization

The homepage map uses one journey state centered on a normalized progress value from `0` to `1`.

- Scroll updates the progress value through [ScrollController.ts](/home/jytan/Documents/Git/portfolio/src/components/game/ScrollController.ts:1).
- Vertical keyboard movement updates the same progress value through [CharacterController.ts](/home/jytan/Documents/Git/portfolio/src/components/game/CharacterController.ts:1).
- Programmatic scroll updates are guarded so scroll events do not immediately loop back into themselves.
- Character position is derived from that progress value plus a small temporary horizontal offset for local exploration.
- Interaction prompts depend on the same state, so scrolling, clicking, and keyboard use stay aligned.

This is intentionally a guided path, not a large open world.

## Replacing character assets

The current homepage character is drawn procedurally in [src/components/game/game.ts](/home/jytan/Documents/Git/portfolio/src/components/game/game.ts:1) using KAPLAY draw calls instead of imported sprite sheets.

If you want to replace it later:

1. Keep the same `CharacterController` state shape.
2. Swap the drawing code in `game.ts` for sprite rendering or atlas-based animation.
3. Keep the canvas supplementary so the HTML content remains the primary source of information.
4. Preserve reduced-motion behavior and no-JavaScript fallbacks.

## Accessibility behavior

The site includes:

- semantic page structure
- proper heading order
- a skip link
- visible focus styles
- a normal navigation header
- ordinary HTML links for all real destinations
- canvas treated as decorative enhancement
- a dialog preview for map interactions
- no audio
- no content hidden exclusively inside the canvas

The homepage still works as a normal website if JavaScript fails or if the visitor ignores the map entirely.

## Reduced-motion behavior

When `prefers-reduced-motion: reduce` is enabled:

- global animation and transition timing is minimized
- the character bob and walk motion are heavily reduced
- scrolling remains direct
- the navigation still works through normal links and content structure

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

## Accessibility and content rules already followed

- no full legal name is displayed
- no resume or CV page exists
- no employment timeline exists
- no copyrighted game assets are used
- all current data is local and static

## Known limitations

- Several links and content fields are still visible placeholders until public values are supplied.
- The homepage RPG layer currently exists only on the homepage, by design.
- The map is intentionally compact and guided instead of being a full world.
- The Open Graph image is an SVG placeholder; you may want a custom PNG later for wider crawler compatibility.
- The current project pages for private work stay intentionally high-level to avoid exposing sensitive internals.
