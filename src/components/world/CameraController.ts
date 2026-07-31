const TOP_THRESHOLD_RATIO = 0.28;
const BOTTOM_THRESHOLD_RATIO = 0.72;
const FOLLOW_RATE = 10; // lerp factor per second

/**
 * Keeps the player visible by scrolling the page when it nears the top or
 * bottom of the viewport — never replaces normal wheel/touch scrolling,
 * only nudges it while the player is actively walking near an edge.
 */
export class CameraController {
  #reducedMotion: boolean;

  constructor(reducedMotion: boolean) {
    this.#reducedMotion = reducedMotion;
  }

  setReducedMotion(value: boolean) {
    this.#reducedMotion = value;
  }

  tick(dt: number, playerWorldY: number) {
    const viewportHeight = window.innerHeight;
    const topThreshold = viewportHeight * TOP_THRESHOLD_RATIO;
    const bottomThreshold = viewportHeight * BOTTOM_THRESHOLD_RATIO;
    const scrollY = window.scrollY;
    const screenY = playerWorldY - scrollY;

    let desiredScrollY: number | undefined;
    if (screenY < topThreshold) {
      desiredScrollY = playerWorldY - topThreshold;
    } else if (screenY > bottomThreshold) {
      desiredScrollY = playerWorldY - bottomThreshold;
    }

    if (desiredScrollY === undefined) return;

    const maxScroll = Math.max(0, document.documentElement.scrollHeight - viewportHeight);
    desiredScrollY = Math.max(0, Math.min(maxScroll, desiredScrollY));

    if (this.#reducedMotion) {
      window.scrollTo({ left: window.scrollX, top: desiredScrollY });
      return;
    }

    const next = scrollY + (desiredScrollY - scrollY) * Math.min(1, FOLLOW_RATE * dt);
    window.scrollTo({ left: window.scrollX, top: next });
  }
}
