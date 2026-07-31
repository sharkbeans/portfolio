const base = import.meta.env.BASE_URL;

export type WorldInteractable = {
  id: string;
  title: string;
  description: string;
  href: string;
  ctaLabel: string;
  promptLabel: string;
};

/**
 * Content for the homepage world's proximity-interaction previews.
 * Each id must match a `data-world-interactable` attribute in
 * src/pages/index.astro. Position is derived from the DOM at runtime —
 * nothing here is a coordinate.
 */
export const worldInteractables: WorldInteractable[] = [
  {
    id: "objekt-tools",
    title: "objekt.my",
    description:
      "A collector-focused toolset for Cosmo Objekt trading, lists, collection tracking, proofshots, and custom card generation.",
    href: `${base}projects/objekt-tools`,
    ctaLabel: "Open project page",
    promptLabel: "open objekt.my",
  },
  {
    id: "mybeli",
    title: "MyBeli",
    description:
      "A public-first catalog and inventory workflow for small shops that have outgrown constantly edited PDF catalogs.",
    href: `${base}projects/mybeli`,
    ctaLabel: "Open project page",
    promptLabel: "inspect MyBeli",
  },
  {
    id: "writing",
    title: "Blog archive",
    description:
      "Development notes, project write-ups, and placeholder drafts for posts that still need to be written.",
    href: `${base}blog`,
    ctaLabel: "Open blog",
    promptLabel: "read latest posts",
  },
  {
    id: "uses",
    title: "Uses",
    description: "An editable list of software, development tools, desktop setup, and hardware notes.",
    href: `${base}uses`,
    ctaLabel: "Open uses page",
    promptLabel: "view uses",
  },
  {
    id: "about",
    title: "About",
    description: "A short personal page with a first-name introduction and links to public profiles.",
    href: `${base}about`,
    ctaLabel: "Open about page",
    promptLabel: "open about",
  },
];

export function findWorldInteractable(id: string) {
  return worldInteractables.find((target) => target.id === id);
}
