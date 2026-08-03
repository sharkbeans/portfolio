import { navigate } from "astro:transitions/client";

/**
 * "down" — the next page is lowered over the page being left.
 * "cut"  — no animation at all, for swapping in a page that is already on screen.
 */
export type GarageDirection = "down" | "cut";

/** Must match --garage-duration in global.css. */
export const GARAGE_MS = 720;

/**
 * The scroll offset at which a project page's door is exactly shut: the end of
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
