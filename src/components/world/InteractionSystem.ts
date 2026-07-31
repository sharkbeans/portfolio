import { findWorldInteractable } from "../../data/world";
import type { InteractableRect } from "./world-types";

const PROXIMITY_RADIUS = 90;

type InteractionCallbacks = {
  onOpenChange: (open: boolean) => void;
};

/**
 * Finds the nearest data-world-interactable element to the player, applies
 * a subtle (non-color-only) highlight to the real DOM element, and opens a
 * short preview dialog on E/Enter or a direct click on the element's link.
 */
export class InteractionSystem {
  #dialog: HTMLDialogElement;
  #callbacks: InteractionCallbacks;
  #lastTrigger?: HTMLElement;
  #highlightedEl?: HTMLElement;

  constructor(dialog: HTMLDialogElement, callbacks: InteractionCallbacks) {
    this.#dialog = dialog;
    this.#callbacks = callbacks;

    this.#dialog.addEventListener("close", () => {
      this.#hideAllPanels();
      this.#callbacks.onOpenChange(false);
      this.#lastTrigger?.focus();
    });

    this.#dialog.addEventListener("cancel", () => {
      this.#callbacks.onOpenChange(false);
    });

    this.#dialog
      .querySelectorAll<HTMLElement>("[data-world-dialog-close]")
      .forEach((button) => button.addEventListener("click", () => this.close()));
  }

  get isOpen() {
    return this.#dialog.open;
  }

  findNearest(
    playerX: number,
    playerY: number,
    interactables: readonly InteractableRect[],
  ): InteractableRect | undefined {
    let best: InteractableRect | undefined;
    let bestDistance = Number.POSITIVE_INFINITY;

    for (const rect of interactables) {
      // Distance to the rect's nearest edge, not its center — large
      // interactable landmarks (e.g. a whole project card) are also solid,
      // so the player can only ever stand next to the edge, never at the
      // centroid.
      const dx = Math.max(rect.left - playerX, 0, playerX - rect.right);
      const dy = Math.max(rect.top - playerY, 0, playerY - rect.bottom);
      const distance = Math.hypot(dx, dy);
      if (distance < bestDistance) {
        bestDistance = distance;
        best = rect;
      }
    }

    return best && bestDistance <= PROXIMITY_RADIUS ? best : undefined;
  }

  updateHighlight(nearest: InteractableRect | undefined) {
    const nextEl = nearest?.el;
    if (this.#highlightedEl === nextEl) return;

    if (this.#highlightedEl) {
      delete this.#highlightedEl.dataset.worldHighlight;
    }

    this.#highlightedEl = nextEl;

    if (this.#highlightedEl) {
      this.#highlightedEl.dataset.worldHighlight = "true";
    }
  }

  open(id: string, trigger?: HTMLElement) {
    const target = findWorldInteractable(id);
    if (!target) return;

    this.#lastTrigger = trigger;
    this.#hideAllPanels();

    const panel = this.#dialog.querySelector<HTMLElement>(`[data-world-preview="${id}"]`);
    if (!panel) return;

    panel.hidden = false;

    if (!this.#dialog.open) {
      this.#dialog.showModal();
    }

    this.#callbacks.onOpenChange(true);
    panel.querySelector<HTMLElement>("a, button")?.focus();
  }

  close() {
    if (this.#dialog.open) {
      this.#dialog.close();
    }
  }

  #hideAllPanels() {
    this.#dialog
      .querySelectorAll<HTMLElement>("[data-world-preview]")
      .forEach((panel) => (panel.hidden = true));
  }

  destroy() {
    if (this.#highlightedEl) {
      delete this.#highlightedEl.dataset.worldHighlight;
    }
  }
}
