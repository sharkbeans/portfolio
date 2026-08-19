I built <a href="https://objekt.my" target="_blank" rel="noreferrer">objekt.my</a> as a set
of focused collector utilities rather than a single giant feature. The current public README is
short, but it clearly defines the project as fan-made tools for collectors using MODHAUS
Cosmo: the Gate.

## What it is

The README currently confirms six public tools: Trades, Lists, Collection, Objekt Maker,
Proofshot, and Spin. That makes the project feel less like one app with one workflow and more
like a toolbox built around the real habits collectors already have.

- **Trades** for browsing, posting, and matching Cosmo Objekt trades.
- **Lists** for clean have / want trade lists.
- **Collection** for tracking progress by member and season.
- **Objekt Maker** for generating custom cards.
- **Proofshot** for generating proofshot images.
- **Spin** for random draw simulations.

## Why it exists

The through-line here is convenience for a very specific community. Instead of making
collectors bounce between spreadsheets, chat threads, mockup tools, and manual image edits, the
project keeps those workflows in one place and makes them feel native to the hobby.

## Public implementation notes

The repository README is intentionally concise, so I only used confirmed public details here.
The repo itself currently exposes a TypeScript codebase with Next.js, Drizzle, PostgreSQL,
Playwright, and Vitest visible in the checked-in configuration, plus Redis for caching and
Better Auth for sign-in, using Discord's device authorization flow in place of an earlier
custom login-code system. CI runs the automated test suite alongside Trivy vulnerability
scanning before anything ships.

The README also credits two concrete external references:
<a href="https://github.com/izrin96/objekt-explorer" target="_blank" rel="noreferrer">objekt-explorer</a>
for the Subsquid-based Objekt indexer used for collection progress and transfer verification,
and <a href="https://apollo.cafe" target="_blank" rel="noreferrer">cosmo-web</a> for the image
proxying approach around CloudFront CORS behavior.

## Current limits

The public README does not currently document setup, deployment, or deeper architectural
tradeoffs, so I kept this page anchored to the confirmed feature list and the public repo
structure instead of inventing details that are not published.

<figure>
  <img class="frame-image" src="/assets/screenshots/objekt-tools-overview.png" alt="Screenshot of the objekt.my homepage showing the Trades, Lists, Collection, Objektify, Proofshot, and Spin tool cards.">
  <figcaption>The objekt.my homepage, live as of this writing.</figcaption>
</figure>
