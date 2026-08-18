import { navigate } from "astro:transitions/client";

/**
 * "down" — the next page is lowered over the page being left.
 * "cut"  — no animation at all, for swapping in a page that is already on screen.
 */
export type GarageDirection = "down" | "cut";

/** Must match --garage-duration in global.css. */
export const GARAGE_MS = 720;

/**
 * The scroll offset at which a detail page's door is exactly shut: the end of
 * the page proper, with the whole runway still below. Measured rather than
 * hardcoded so it tracks the runway height at the current viewport size.
 */
export function doorClosedScrollY() {
  const runway = document.querySelector<HTMLElement>(".door-runway")?.offsetHeight ?? 0;
  return Math.max(0, document.documentElement.scrollHeight - window.innerHeight - runway);
}

declare global {
  interface Window {
    /** Identifies the most recent garage navigation so a stale one can't clean up after a newer one. */
    __garageSeq?: number;
    /** Set once the door lifecycle listener is registered for this document. */
    __doorsWired?: boolean;
  }
}

/**
 * Navigate with the garage-door page transition instead of the default
 * cross-fade. The direction is published as `data-garage` on <html>, which is
 * what global.css keys the ::view-transition animations off; every other
 * navigation leaves the attribute unset and keeps the default look.
 *
 * `onSwap` runs after the new DOM is in place but still inside the view
 * transition's update callback, so scroll positioning done there is already
 * correct on the first animated frame.
 */
export function garageNavigate(href: string, direction: GarageDirection, onSwap?: () => void) {
  const root = document.documentElement;
  const seq = (window.__garageSeq = (window.__garageSeq ?? 0) + 1);

  root.dataset.garage = direction;

  document.addEventListener(
    "astro:after-swap",
    () => {
      if (window.__garageSeq !== seq) return;
      // Astro's swap copies the incoming document's <html> attributes over the
      // current ones, so the marker has to be reapplied here — the animation
      // starts as soon as this callback returns.
      root.dataset.garage = direction;
      onSwap?.();
      window.setTimeout(() => {
        if (window.__garageSeq === seq) delete root.dataset.garage;
      }, GARAGE_MS + 150);
    },
    { once: true },
  );

  navigate(href);
}

/**
 * Where the door last opened from, so the matching archive page knows which
 * detail page its reverse gesture should bring back. Holding the full href
 * rather than a slug keeps this branch-agnostic — projects and blog posts use
 * the same machinery without either needing to know the other's URL shape.
 */
const RETURN_KEY = "doorReturn";
/** Set while navigating back through a door, so the detail page lands shut. */
const ENTRY_KEY = "doorEntry";

type DoorReturn = { from: string; to: string };

/**
 * The page selector (src/scripts/navSelector.ts) takes over wheel input while
 * it is open, and the door's pull-up gesture reads the same wheel-up. Without
 * this, scrolling the selector at the top of an archive page you arrived at
 * through a door would cycle the selector and fire the door return at once.
 */
const pageSelectorOpen = () => document.documentElement.dataset.pageSelector === "open";

const samePath = (a: string, b: string) =>
  a.replace(/\/+$/, "").toLowerCase() === b.replace(/\/+$/, "").toLowerCase();

function readReturn(): DoorReturn | null {
  try {
    const raw = sessionStorage.getItem(RETURN_KEY);
    const parsed = raw ? (JSON.parse(raw) as DoorReturn) : null;
    return parsed?.from && parsed?.to ? parsed : null;
  } catch {
    return null;
  }
}

/**
 * Detail-page half of the door. Everything it needs comes off the panel's
 * `data-door-archive`, so a layout only has to render the door layers.
 * Returns a teardown for the next `astro:page-load`.
 */
export function initDoor(): (() => void) | undefined {
  const panel = document.querySelector<HTMLElement>(".door-panel");
  const archiveHref = panel?.dataset.doorArchive;
  if (!panel || !archiveHref) return;

  // Arriving back through the door: land exactly where it is shut, so the next
  // downward scroll starts opening it from zero.
  if (sessionStorage.getItem(ENTRY_KEY) === "shut") {
    sessionStorage.removeItem(ENTRY_KEY);
    requestAnimationFrame(() => window.scrollTo(0, doorClosedScrollY()));
  }

  let committed = false;

  const onScroll = () => {
    // Nothing here drives the door — it is an ordinary element scrolling with
    // the page, so its bottom edge already is the door's position. All this
    // watches for is that edge clearing the top of the viewport, at which point
    // the archive is the only thing on screen and the real navigation can be
    // swapped in underneath without anything visibly changing.
    if (committed || panel.getBoundingClientRect().bottom > 0) return;
    committed = true;
    window.removeEventListener("scroll", onScroll);
    sessionStorage.setItem(
      RETURN_KEY,
      JSON.stringify({ from: window.location.pathname, to: archiveHref } satisfies DoorReturn),
    );
    garageNavigate(archiveHref, "cut");
  };

  window.addEventListener("scroll", onScroll, { passive: true });
  return () => window.removeEventListener("scroll", onScroll);
}

/**
 * Archive-page half: pulling up past the top brings the door back down over
 * this page. Only armed when you actually arrived through the door, so it never
 * hijacks scroll for someone who navigated here directly.
 *
 * Unlike the forward direction this is a timed animation — there is no scroll
 * runway above the top of a page to scrub against.
 */
export function initDoorReturn(): (() => void) | undefined {
  const pending = readReturn();
  if (!pending || !samePath(pending.to, window.location.pathname)) return;

  const target = pending.from;
  let triggered = false;
  let pull = 0;
  let touchStartY: number | null = null;

  function go() {
    if (triggered) return;
    triggered = true;
    sessionStorage.removeItem(RETURN_KEY);
    sessionStorage.setItem(ENTRY_KEY, "shut");
    teardown();
    garageNavigate(target, "down", () => window.scrollTo(0, doorClosedScrollY()));
  }

  function onWheel(e: WheelEvent) {
    if (triggered || pageSelectorOpen()) return;
    if (window.scrollY > 0) {
      pull = 0;
      return;
    }
    if (e.deltaY < 0) {
      pull += -e.deltaY;
      if (pull > 60) go();
    } else {
      pull = 0;
    }
  }

  function onTouchStart(e: TouchEvent) {
    touchStartY = e.touches[0]?.clientY ?? null;
  }

  function onTouchMove(e: TouchEvent) {
    if (triggered || touchStartY === null || pageSelectorOpen()) return;
    if (window.scrollY > 0) {
      pull = 0;
      return;
    }
    const delta = (e.touches[0]?.clientY ?? touchStartY) - touchStartY;
    if (delta > 60) go();
    else if (delta <= 0) pull = 0;
  }

  // Leaving the archive any other way (a nav link, say) breaks the cycle, so
  // forget the pending return instead of leaving it armed for a later visit.
  function onBeforePreparation() {
    if (!triggered) sessionStorage.removeItem(RETURN_KEY);
  }

  function teardown() {
    window.removeEventListener("wheel", onWheel);
    window.removeEventListener("touchstart", onTouchStart);
    window.removeEventListener("touchmove", onTouchMove);
    document.removeEventListener("astro:before-preparation", onBeforePreparation);
  }

  window.addEventListener("wheel", onWheel, { passive: true });
  window.addEventListener("touchstart", onTouchStart, { passive: true });
  window.addEventListener("touchmove", onTouchMove, { passive: true });
  document.addEventListener("astro:before-preparation", onBeforePreparation, { once: true });

  return teardown;
}

/**
 * Wire both halves of the door to Astro's page lifecycle. Every participating
 * page calls this; it registers once per document no matter how many layouts
 * ask, because a second `astro:page-load` listener would arm a second set of
 * scroll handlers and commit the same navigation twice.
 *
 * Both halves run on every page load and each no-ops where it does not apply:
 * initDoor needs a door panel in the DOM, initDoorReturn needs a stored return
 * pointing at the current path.
 */
export function wireDoors() {
  if (window.__doorsWired) return;
  window.__doorsWired = true;

  let cleanups: Array<(() => void) | undefined> = [];

  document.addEventListener("astro:page-load", () => {
    cleanups.forEach((fn) => fn?.());
    cleanups = [initDoor(), initDoorReturn()];
  });
}
