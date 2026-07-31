import { findInteractableById, findNearestInteractable } from "./JourneyMap";

type InteractionCallbacks = {
  onOpenChange: (open: boolean) => void;
};

export class InteractionController {
  #lastTrigger?: HTMLElement;

  constructor(
    private dialog: HTMLDialogElement,
    private callbacks: InteractionCallbacks,
  ) {
    this.dialog.addEventListener("close", () => {
      this.#hideAll();
      this.callbacks.onOpenChange(false);
      this.#lastTrigger?.focus();
    });

    this.dialog.addEventListener("cancel", () => {
      this.callbacks.onOpenChange(false);
    });

    this.dialog
      .querySelectorAll<HTMLElement>("[data-dialog-close]")
      .forEach((button) => button.addEventListener("click", () => this.close()));
  }

  get isOpen() {
    return this.dialog.open;
  }

  open(id: string, trigger?: HTMLElement) {
    const target = findInteractableById(id);
    if (!target) {
      return;
    }

    this.#lastTrigger = trigger;
    this.#hideAll();
    const panel = this.dialog.querySelector<HTMLElement>(`[data-preview='${target.id}']`);

    if (!panel) {
      return;
    }

    panel.hidden = false;

    if (!this.dialog.open) {
      this.dialog.showModal();
    }

    this.callbacks.onOpenChange(true);
    const firstFocusable = panel.querySelector<HTMLElement>("a, button");
    firstFocusable?.focus();
  }

  close() {
    if (this.dialog.open) {
      this.dialog.close();
    }
  }

  openNearest(progress: number, localX: number, trigger?: HTMLElement) {
    const nearest = findNearestInteractable(progress, localX);
    if (nearest) {
      this.open(nearest.id, trigger);
    }
  }

  #hideAll() {
    this.dialog
      .querySelectorAll<HTMLElement>("[data-preview]")
      .forEach((panel) => (panel.hidden = true));
  }
}
