const base = import.meta.env.BASE_URL;

export type NavWheelEntry = {
  id: string;
  /** Shown in the readout when this entry reaches the elbow. */
  label: string;
  href: string;
  /** One short line of context, also shown in the readout. */
  caption: string;
  /**
   * 12x12 pixel-art silhouette, one string per row, `#` = filled. Kept as art
   * rather than an SVG path so the icons stay editable at the pixel level and
   * match the rest of the site's pixel HUD.
   */
  icon: string[];
};

/**
 * The 1-D list the L-shaped selector runs through. Order is the order you
 * scroll in, so it reads as a site map rather than alphabetically: the two
 * archive pages sit next to the case studies they contain.
 *
 * The list wraps, so scrolling past the last entry returns to the first. That
 * only stays free of duplicate cards while there are more entries than visible
 * slots — see VISIBLE_RADIUS in src/scripts/navSelector.ts.
 */
export const navWheelEntries: NavWheelEntry[] = [
  {
    id: "home",
    label: "home",
    href: base,
    caption: "the world, the sprite, everything else",
    icon: [
      "............",
      "............",
      ".....##.....",
      "....####....",
      "...######...",
      "..########..",
      ".##########.",
      "..#......#..",
      "..#.##...#..",
      "..#.##...#..",
      "..########..",
      "............",
    ],
  },
  {
    id: "projects",
    label: "projects",
    href: `${base}projects`,
    caption: "full archive and case studies",
    icon: [
      "............",
      "............",
      ".####.......",
      ".#..#.......",
      ".##########.",
      ".#........#.",
      ".#........#.",
      ".#........#.",
      ".#........#.",
      ".##########.",
      "............",
      "............",
    ],
  },
  {
    id: "objekt-tools",
    label: "objekt.my",
    href: `${base}projects/objekt-tools`,
    caption: "collector tooling for Cosmo objekts",
    icon: [
      "............",
      "...########.",
      "...#......#.",
      "...#......#.",
      ".########.#.",
      ".#......#.#.",
      ".#......#.#.",
      ".#......#...",
      ".#......#...",
      ".########...",
      "............",
      "............",
    ],
  },
  {
    id: "objekt-tcg",
    label: "objekt tcg",
    href: `${base}projects/objekt-tcg`,
    caption: "pack opening and card generation",
    icon: [
      "............",
      "............",
      "..########..",
      "..#......#..",
      "..#..##..#..",
      "..#.####.#..",
      "..#.####.#..",
      "..#..##..#..",
      "..#......#..",
      "..########..",
      "............",
      "............",
    ],
  },
  {
    id: "mybeli",
    label: "mybeli",
    href: `${base}projects/mybeli`,
    caption: "multi-tenant catalog for small shops",
    icon: [
      "............",
      "............",
      ".##########.",
      ".##########.",
      ".#........#.",
      ".#........#.",
      ".#..####..#.",
      ".#..#..#..#.",
      ".#..#..#..#.",
      ".##########.",
      "............",
      "............",
    ],
  },
  {
    id: "blog",
    label: "blog",
    href: `${base}blog`,
    caption: "notes on things that broke and got fixed",
    icon: [
      "............",
      "..########..",
      "..#......#..",
      "..#.####.#..",
      "..#......#..",
      "..#.###..#..",
      "..#......#..",
      "..#.####.#..",
      "..#......#..",
      "..#.##...#..",
      "..########..",
      "............",
    ],
  },
  {
    id: "stats",
    label: "stats",
    href: `${base}stats`,
    caption: "contribution graph, languages, commit clock",
    icon: [
      "............",
      "............",
      "............",
      ".....##.....",
      ".....##.....",
      ".....##.....",
      ".##..##.....",
      ".##..##.....",
      ".##..##..##.",
      ".##..##..##.",
      ".##########.",
      "............",
    ],
  },
  {
    id: "uses",
    label: "uses",
    href: `${base}uses`,
    caption: "software, editors, desk and hardware",
    icon: [
      "....####....",
      "....####....",
      ".#.######.#.",
      ".##########.",
      "..########..",
      "..###..###..",
      "..###..###..",
      "..########..",
      ".##########.",
      ".#.######.#.",
      "....####....",
      "....####....",
    ],
  },
  {
    id: "about",
    label: "about",
    href: `${base}about`,
    caption: "first name only, and where else to find me",
    icon: [
      "............",
      "....####....",
      "...######...",
      "...######...",
      "....####....",
      ".....##.....",
      "..########..",
      ".##########.",
      ".##########.",
      ".##########.",
      ".##########.",
      "............",
    ],
  },
];

/**
 * Collapses an icon grid into one `<rect>` per horizontal run of filled
 * pixels, so a 12x12 silhouette costs a handful of nodes instead of ~70.
 * Rendered at build time from the component's frontmatter.
 */
export function iconToSvgRects(icon: string[]): string {
  const rects: string[] = [];

  icon.forEach((row, y) => {
    let runStart = -1;

    for (let x = 0; x <= row.length; x++) {
      const filled = row[x] === "#";
      if (filled && runStart === -1) {
        runStart = x;
      } else if (!filled && runStart !== -1) {
        rects.push(`<rect x="${runStart}" y="${y}" width="${x - runStart}" height="1"/>`);
        runStart = -1;
      }
    }
  });

  return rects.join("");
}

/**
 * Longest-prefix match of a pathname against the entry list, so
 * /projects/mybeli resolves to the case study rather than the archive.
 * Falls back to the first entry (home) for pages that are not in the list.
 */
export function findNavWheelIndex(pathname: string): number {
  const normalized = pathname.replace(/\/+$/, "") || "/";
  let bestIndex = 0;
  let bestLength = -1;

  navWheelEntries.forEach((entry, index) => {
    const href = entry.href.replace(/\/+$/, "") || "/";
    const matches = normalized === href || normalized.startsWith(`${href}/`);
    if (matches && href.length > bestLength) {
      bestIndex = index;
      bestLength = href.length;
    }
  });

  return bestIndex;
}
