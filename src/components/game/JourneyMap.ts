export type JourneySection = {
  id: string;
  label: string;
  progress: number;
  description: string;
};

export type JourneyInteractable = {
  id: string;
  label: string;
  title: string;
  description: string;
  href: string;
  ctaLabel: string;
  prompt: string;
  progress: number;
  x: number;
};

export const MAP_WIDTH = 320;
export const MAP_HEIGHT = 520;
export const PATH_X = MAP_WIDTH / 2;
export const PATH_TOP = 48;
export const PATH_BOTTOM = MAP_HEIGHT - 46;

export const journeySections: JourneySection[] = [
  {
    id: "home-intro",
    label: "intro",
    progress: 0.05,
    description: "Opening note and homepage overview.",
  },
  {
    id: "selected-projects",
    label: "projects",
    progress: 0.28,
    description: "Featured work and project links.",
  },
  {
    id: "recent-writing",
    label: "writing",
    progress: 0.58,
    description: "Recent blog posts and development notes.",
  },
  {
    id: "public-links",
    label: "links",
    progress: 0.77,
    description: "GitHub and other public profiles.",
  },
  {
    id: "continue-exploring",
    label: "continue",
    progress: 0.95,
    description: "Separate pages for the rest of the site.",
  },
];

const base = import.meta.env.BASE_URL;

export const journeyInteractables: JourneyInteractable[] = [
  {
    id: "objekt-tools",
    label: "computer terminal",
    title: "objekt.my",
    description:
      "A collector-focused toolset for Cosmo Objekt trading, lists, collection tracking, proofshots, and custom card generation.",
    href: `${base}projects/objekt-tools`,
    ctaLabel: "Open project page",
    prompt: "Press E to inspect objekt.my",
    progress: 0.29,
    x: -0.62,
  },
  {
    id: "mybeli",
    label: "storefront",
    title: "MyBeli",
    description:
      "A public-first catalog and inventory workflow for small shops that have outgrown constantly edited PDF catalogs.",
    href: `${base}projects/mybeli`,
    ctaLabel: "Open project page",
    prompt: "Press E to inspect MyBeli",
    progress: 0.33,
    x: 0.62,
  },
  {
    id: "blog",
    label: "bookshelf",
    title: "Blog archive",
    description:
      "Development notes, project write-ups, and placeholder drafts for posts that still need to be written.",
    href: `${base}blog`,
    ctaLabel: "Open blog",
    prompt: "Press E to open the blog archive",
    progress: 0.57,
    x: 0,
  },
  {
    id: "uses",
    label: "tool bench",
    title: "Uses",
    description:
      "An editable list of software, development tools, desktop setup, and hardware notes.",
    href: `${base}uses`,
    ctaLabel: "Open uses page",
    prompt: "Press E to inspect the tool bench",
    progress: 0.76,
    x: -0.44,
  },
  {
    id: "about",
    label: "notice board",
    title: "About",
    description:
      "A short personal page with a first-name introduction and links to public profiles.",
    href: `${base}about`,
    ctaLabel: "Open about page",
    prompt: "Press E to read the notice board",
    progress: 0.83,
    x: 0.44,
  },
];

export function clampProgress(value: number) {
  return Math.min(1, Math.max(0, value));
}

export function approach(current: number, target: number, delta: number) {
  if (current < target) {
    return Math.min(target, current + delta);
  }

  return Math.max(target, current - delta);
}

export function getHorizontalLimit(progress: number) {
  if (progress >= 0.2 && progress <= 0.4) {
    return 0.95;
  }

  for (const target of journeyInteractables) {
    if (Math.abs(progress - target.progress) < 0.06) {
      return 0.65;
    }
  }

  return 0;
}

export function getCharacterPoint(progress: number, localX: number) {
  return {
    x: PATH_X + localX * 92,
    y: PATH_TOP + clampProgress(progress) * (PATH_BOTTOM - PATH_TOP),
  };
}

export function getInteractablePoint(target: JourneyInteractable) {
  return getCharacterPoint(target.progress, target.x);
}

export function findNearestInteractable(progress: number, localX: number) {
  let bestTarget: JourneyInteractable | undefined;
  let bestScore = Number.POSITIVE_INFINITY;

  for (const target of journeyInteractables) {
    const verticalDistance = Math.abs(progress - target.progress);
    const horizontalDistance = Math.abs(localX - target.x);
    const score = verticalDistance * 1.4 + horizontalDistance * 0.55;

    if (score < bestScore) {
      bestScore = score;
      bestTarget = target;
    }
  }

  if (!bestTarget) {
    return undefined;
  }

  const isCloseEnough =
    Math.abs(progress - bestTarget.progress) <= 0.075 &&
    Math.abs(localX - bestTarget.x) <= 0.48;

  return isCloseEnough ? bestTarget : undefined;
}

export function findInteractableById(id: string) {
  return journeyInteractables.find((target) => target.id === id);
}
