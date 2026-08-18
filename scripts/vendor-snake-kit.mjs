#!/usr/bin/env node
/**
 * Regenerates src/styles/snake-kit.css from the installed snake-eater-ui
 * package. Run after bumping the dependency; the file is committed so a normal
 * build never needs this.
 *
 * The published `snake-eater-ui/styles` is not safe to import as-is. Roughly
 * 9KB of its 194KB is an unscoped reset — `*{margin:0;padding:0}`,
 * `html{font-size:16px}`, `body{...}`, bare `h1`-`h6`/`p`/`a`/`code`/`pre`/
 * `ol,ul`/`li`, and an unprefixed `.card`/`.elevated` — which would flatten
 * global.css and prose.css everywhere, not just on the page that imports it.
 * The remaining ~185KB is cleanly `.snake-*` prefixed and safe to keep.
 *
 * So this strips the reset rules and the library's bundled @font-face blocks
 * (the site already loads its own faces), keeps every `.snake-*` rule plus the
 * keyframes and media queries they depend on, and re-emits the result under
 * the hand-written token header in HEADER_FILE — which re-declares the
 * library's `:root` variables on `.snake-kit` instead, remapped to this site's
 * palette. Custom properties inherit, so scoping the tokens is enough to
 * retheme every component without touching a single component rule.
 *
 * Run: node scripts/vendor-snake-kit.mjs
 * Output: src/styles/snake-kit.css
 */
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const SOURCE = join(root, "node_modules", "snake-eater-ui", "dist", "snake-eater-ui.css");
const OUTPUT = join(root, "src", "styles", "snake-kit.css");
const MARKER = "/* ---- generated:";

/**
 * About 450 colour literals in the published stylesheet never go through the
 * library's own custom properties — roughly a third of its palette is written
 * straight into the rules. Scoping the tokens therefore reblanks only part of
 * the kit; the rest would stay monochrome grey, React cyan (#61dafb is React's
 * brand colour, used as the accent throughout), and Dracula purple/pink from
 * the `cyber` gradients.
 *
 * So the generator rewrites those literals to the site's tokens on the way
 * through. The mapping is by design intent, not by nearest colour: #61dafb is
 * the kit's accent and becomes the site's cyan rather than its amber, which
 * keeps "info" visually distinct from "warning" and leaves amber to arrive via
 * --color-primary. The semantic status colours (success green, warning yellow,
 * danger red) are deliberately absent and pass through untouched.
 */
const PALETTE = [
  ["#61dafb", "var(--accent-cyan)"],   // kit accent (React brand cyan)
  ["#8be9fd", "var(--accent-cyan)"],   // cyber gradient stop
  ["#bd93f9", "var(--accent)"],        // cyber gradient stop
  ["#ff79c6", "var(--accent-strong)"], // cyber gradient stop
  ["#3a3a3a", "var(--border)"],        // default border / bar fill
  ["#4a4a4a", "#3f4a5c"],              // raised border
  ["#8e8e90", "var(--muted)"],         // muted text
  ["#5a5a5a", "#5d6875"],              // dimmest text
  ["#bdbdbd", "var(--text)"],          // primary text
  ["#e0e0e0", "var(--text)"],          // bright text
  ["#101010", "var(--bg)"],            // base surface
  ["#0b0b0d", "var(--bg)"],            // base surface
  ["#1a1a1a", "#182130"],              // surface one step up
  ["#1a1a1c", "#182130"],
  ["#1f1d20", "var(--bg-strong)"],     // card surface
  ["#2a2a2a", "#2b3648"],              // elevated surface
  ["#2a2a2c", "#2b3648"],
  ["#2a2a2d", "#2b3648"],
  ["#2a282b", "#2b3648"],
  // The kit hardcodes a mono stack here instead of using its own token.
  ["Consolas,Monaco,Courier New,monospace", "var(--font-family-mono)"],
];

/** Case-insensitive literal swap; hex in the source appears in both cases. */
function applyPalette(css) {
  let out = css;
  for (const [from, to] of PALETTE) {
    out = out.split(new RegExp(from.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi")).join(to);
  }
  return out;
}

/**
 * Bare-element and unprefixed selectors that must not escape the wrapper.
 * Anything else is kept, so a new component in a future release is picked up
 * automatically rather than being silently dropped.
 */
const GLOBAL_RESET = new Set([
  "*",
  "html",
  "body",
  "strong",
  "p",
  "a",
  "a:hover",
  "a:active",
  "code",
  "pre",
  "pre code",
  "code,pre",
  "li",
  "ol,ul",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "h1,h2,h3,h4,h5,h6",
  "h5,h6",
  ".card",
  ".elevated",
  ".card,.elevated",
]);

/**
 * Splits a stylesheet into top-level constructs, tracking brace depth so
 * nested at-rules (@media, @supports) come through whole. Returns the raw
 * prelude and body for each; `body` is null for a bare `@import`-style rule.
 */
function splitTopLevel(css) {
  const out = [];
  let depth = 0;
  let start = 0;
  let selEnd = 0;

  for (let i = 0; i < css.length; i++) {
    const c = css[i];
    if (c === "{") {
      if (depth === 0) selEnd = i;
      depth++;
    } else if (c === "}") {
      depth--;
      if (depth === 0) {
        out.push([css.slice(start, selEnd).trim(), css.slice(selEnd + 1, i)]);
        start = i + 1;
      }
    } else if (c === ";" && depth === 0) {
      out.push([css.slice(start, i).trim(), null]);
      start = i + 1;
    }
  }

  return out;
}

const source = readFileSync(SOURCE, "utf8");
const kept = [];
let dropped = 0;

for (const [selector, body] of splitTopLevel(source)) {
  // Bare at-rules, the library's own fonts, and its :root (re-declared scoped
  // in the header) all go.
  if (body === null || selector.startsWith("@font-face") || selector === ":root") {
    dropped++;
    continue;
  }

  if (/^@(keyframes|media|supports)/.test(selector)) {
    kept.push(`${selector}{${body}}`);
    continue;
  }

  // A comma list can mix a reset selector with a real one; keep the survivors.
  const survivors = selector.split(",").map((part) => part.trim()).filter((part) => !GLOBAL_RESET.has(part));

  if (survivors.length === 0) {
    dropped++;
    continue;
  }

  kept.push(`${survivors.join(",")}{${body}}`);
}

const existing = readFileSync(OUTPUT, "utf8");
const markerAt = existing.indexOf(MARKER);
if (markerAt === -1) {
  console.error(`Could not find the "${MARKER}" marker in ${OUTPUT}; refusing to overwrite.`);
  process.exit(1);
}

const version = JSON.parse(
  readFileSync(join(root, "node_modules", "snake-eater-ui", "package.json"), "utf8"),
).version;

const header = existing.slice(0, markerAt);
writeFileSync(
  OUTPUT,
  `${header}${MARKER} snake-eater-ui@${version} component rules ---- */\n${applyPalette(kept.join("\n"))}\n`,
);

console.log(`snake-eater-ui@${version}: kept ${kept.length} rules, dropped ${dropped}.`);
