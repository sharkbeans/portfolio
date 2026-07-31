import { clampProgress } from "./JourneyMap";

type ScrollCallbacks = {
  onProgress: (progress: number) => void;
};

export class ScrollController {
  #rangeStart = 0;
  #rangeDistance = 1;
  #isSyncing = false;
  #resizeObserver?: ResizeObserver;
  #handleScroll: () => void;
  #handleResize: () => void;

  constructor(private root: HTMLElement, private callbacks: ScrollCallbacks) {
    this.#handleScroll = () => {
      if (this.#isSyncing) {
        return;
      }

      const progress = clampProgress((window.scrollY - this.#rangeStart) / this.#rangeDistance);
      this.callbacks.onProgress(progress);
    };

    this.#handleResize = () => {
      this.recalculate();
      this.#handleScroll();
    };

    this.recalculate();

    window.addEventListener("scroll", this.#handleScroll, { passive: true });
    window.addEventListener("resize", this.#handleResize);

    if ("ResizeObserver" in window) {
      this.#resizeObserver = new ResizeObserver(() => this.#handleResize());
      this.#resizeObserver.observe(this.root);
    }
  }

  destroy() {
    window.removeEventListener("scroll", this.#handleScroll);
    window.removeEventListener("resize", this.#handleResize);
    this.#resizeObserver?.disconnect();
  }

  recalculate() {
    const rect = this.root.getBoundingClientRect();
    const pageTop = window.scrollY + rect.top;
    const viewportHeight = window.innerHeight;
    const startOffset = Math.min(120, viewportHeight * 0.15);
    const endOffset = Math.min(180, viewportHeight * 0.2);

    this.#rangeStart = Math.max(0, pageTop - startOffset);
    const rangeEnd = Math.max(
      this.#rangeStart + 1,
      pageTop + this.root.offsetHeight - viewportHeight + endOffset,
    );
    this.#rangeDistance = Math.max(1, rangeEnd - this.#rangeStart);
  }

  scrollToProgress(progress: number) {
    const nextY = this.#rangeStart + clampProgress(progress) * this.#rangeDistance;
    this.#isSyncing = true;
    window.scrollTo({
      top: nextY,
      behavior: "auto",
    });
    requestAnimationFrame(() => {
      this.#isSyncing = false;
    });
  }
}
