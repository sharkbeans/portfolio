import type { InteractableRect, SolidRect, SpawnPoint, WorldRect } from "./world-types";

const SOLID_PADDING = 5;
const RESIZE_DEBOUNCE_MS = 150;

function toDocumentRect(el: Element): WorldRect {
  const rect = el.getBoundingClientRect();
  const scrollX = window.scrollX;
  const scrollY = window.scrollY;

  return {
    left: rect.left + scrollX,
    top: rect.top + scrollY,
    right: rect.right + scrollX,
    bottom: rect.bottom + scrollY,
  };
}

function pad(rect: WorldRect, amount: number): WorldRect {
  return {
    left: rect.left - amount,
    top: rect.top - amount,
    right: rect.right + amount,
    bottom: rect.bottom + amount,
  };
}

/**
 * Derives KAPLAY-facing collision geometry from real DOM elements marked
 * with data-world-* attributes. All rects are cached in document
 * coordinates, so scrolling never invalidates them — only layout changes
 * (resize, font load, image load, content resize) trigger a recompute.
 */
export class DomCollisionSystem {
  #root: HTMLElement;
  #solidRects: SolidRect[] = [];
  #interactableRects: InteractableRect[] = [];
  #spawnPoints: SpawnPoint[] = [];
  #bounds: WorldRect = { left: 0, top: 0, right: 0, bottom: 0 };
  #resizeObserver?: ResizeObserver;
  #resizeTimer?: number;
  #onRecalculated?: () => void;
  #isInitialRecalculation = true;
  #handleResize = () => this.#scheduleDebounced();

  constructor(root: HTMLElement, onRecalculated?: () => void) {
    this.#root = root;
    this.#onRecalculated = onRecalculated;

    this.recalculate();

    window.addEventListener("resize", this.#handleResize);
    window.addEventListener("orientationchange", this.#handleResize);

    if ("ResizeObserver" in window) {
      this.#resizeObserver = new ResizeObserver(this.#handleResize);
      this.#resizeObserver.observe(this.#root);
    }

    if ("fonts" in document) {
      document.fonts.ready.then(() => this.recalculate()).catch(() => {});
    }

    const images = Array.from(this.#root.querySelectorAll("img"));
    for (const img of images) {
      if (img.complete) continue;
      img.addEventListener("load", this.#handleResize, { once: true });
    }
  }

  #scheduleDebounced() {
    window.clearTimeout(this.#resizeTimer);
    this.#resizeTimer = window.setTimeout(() => this.recalculate(), RESIZE_DEBOUNCE_MS);
  }

  recalculate() {
    const solidEls = Array.from(this.#root.querySelectorAll<HTMLElement>("[data-world-solid]"));
    const interactableEls = Array.from(
      this.#root.querySelectorAll<HTMLElement>("[data-world-interactable]"),
    );
    const spawnEls = Array.from(this.#root.querySelectorAll<HTMLElement>("[data-world-spawn]"));

    this.#solidRects = solidEls.map((el) => ({
      ...pad(toDocumentRect(el), SOLID_PADDING),
      el,
    }));

    this.#interactableRects = interactableEls.map((el) => {
      const rect = toDocumentRect(el);
      return {
        ...rect,
        id: el.dataset.worldInteractable ?? "",
        el,
        centerX: (rect.left + rect.right) / 2,
        centerY: (rect.top + rect.bottom) / 2,
      };
    });

    this.#spawnPoints = spawnEls.map((el) => {
      const rect = toDocumentRect(el);
      return {
        id: el.dataset.worldSpawn ?? "",
        x: (rect.left + rect.right) / 2,
        y: (rect.top + rect.bottom) / 2,
      };
    });

    const boundsEl = this.#root.querySelector<HTMLElement>("[data-world-bounds]");
    this.#bounds = toDocumentRect(boundsEl ?? this.#root);

    // The constructor's own initial call happens before the caller has
    // finished setting up (player/spawn systems may not exist yet), so it
    // never fires the callback — only later, genuinely async recalcs do.
    if (this.#isInitialRecalculation) {
      this.#isInitialRecalculation = false;
    } else {
      this.#onRecalculated?.();
    }
  }

  getBounds(): WorldRect {
    return this.#bounds;
  }

  getSolidRects(): readonly SolidRect[] {
    return this.#solidRects;
  }

  getInteractableRects(): readonly InteractableRect[] {
    return this.#interactableRects;
  }

  getSpawnPoint(id: string): SpawnPoint | undefined {
    return this.#spawnPoints.find((point) => point.id === id);
  }

  getSpawnPoints(): readonly SpawnPoint[] {
    return this.#spawnPoints;
  }

  isInsideAnySolid(x: number, y: number): boolean {
    return this.#solidRects.some(
      (rect) => x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom,
    );
  }

  destroy() {
    window.clearTimeout(this.#resizeTimer);
    window.removeEventListener("resize", this.#handleResize);
    window.removeEventListener("orientationchange", this.#handleResize);
    this.#resizeObserver?.disconnect();
  }
}
