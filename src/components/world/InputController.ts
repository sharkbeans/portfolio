import type { Axes } from "./world-types";

export type WorldPoint = { x: number; y: number };

const MOVEMENT_KEYS = new Set(["w", "a", "s", "d", "arrowup", "arrowleft", "arrowdown", "arrowright"]);

type InputCallbacks = {
  onInteract: () => void;
  onEscape: () => void;
  onFire: (point: WorldPoint) => void;
  isPaused: () => boolean;
  isDialogOpen: () => boolean;
};

function isTypingTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  if (target.closest("[data-world-ignore-keys='true']")) {
    return true;
  }

  if (target.isContentEditable) {
    return true;
  }

  const tag = target.tagName;
  return (
    tag === "INPUT" ||
    tag === "TEXTAREA" ||
    tag === "SELECT" ||
    tag === "OPTION" ||
    tag === "BUTTON" ||
    target.getAttribute("role") === "textbox"
  );
}

// The world canvas overlays real page content (links, buttons, the reading
// toggle), so mouse handlers are global — this keeps clicks on actual UI
// acting like normal clicks instead of also firing the player's gun.
function isInteractiveTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) {
    return false;
  }
  return target.closest("a,button,input,textarea,select,[role='button'],[role='link'],[data-world-ignore-keys='true']") !== null;
}

/**
 * Keyboard input for the world. Never intercepts keys while focus is on a
 * form control, contenteditable region, or dialog (isPaused covers the
 * open-dialog case), so normal accessible interaction is unaffected.
 */
export class InputController {
  #pressed = new Set<string>();
  #shiftDown = false;
  #ctrlDown = false;
  #rightMouseDown = false;
  #moveTarget: WorldPoint | null = null;
  #pendingPing: WorldPoint | null = null;
  #handleKeyDown: (event: KeyboardEvent) => void;
  #handleKeyUp: (event: KeyboardEvent) => void;
  #handleBlur: () => void;
  #handleMouseDown: (event: MouseEvent) => void;
  #handleMouseMove: (event: MouseEvent) => void;
  #handleMouseUp: (event: MouseEvent) => void;
  #handleContextMenu: (event: MouseEvent) => void;

  constructor(private callbacks: InputCallbacks) {
    this.#handleKeyDown = (event) => {
      const key = event.key.toLowerCase();

      if (key === "shift") {
        this.#shiftDown = true;
      }

      if (key === "control") {
        this.#ctrlDown = true;
      }

      if (key === "escape") {
        if (this.callbacks.isPaused()) {
          event.preventDefault();
          this.callbacks.onEscape();
        }
        return;
      }

      // Walking away is a more discoverable exit than Escape/close-button
      // alone: a movement key pressed while a project preview is open
      // closes it and immediately carries that same keypress into the
      // player's pressed-key set, so movement resumes in that direction
      // without waiting for a second, separate keypress.
      if (this.callbacks.isDialogOpen() && MOVEMENT_KEYS.has(key)) {
        event.preventDefault();
        this.callbacks.onEscape();
        this.#pressed.add(key);
        return;
      }

      if (this.callbacks.isPaused()) {
        return;
      }

      if (isTypingTarget(event.target)) {
        return;
      }

      if (MOVEMENT_KEYS.has(key)) {
        event.preventDefault();
        this.#pressed.add(key);
        return;
      }

      if (key === "e" || key === "enter") {
        event.preventDefault();
        this.callbacks.onInteract();
      }
    };

    this.#handleKeyUp = (event) => {
      const key = event.key.toLowerCase();
      if (key === "shift") {
        this.#shiftDown = false;
      }
      if (key === "control") {
        this.#ctrlDown = false;
      }
      this.#pressed.delete(key);
    };

    this.#handleBlur = () => {
      this.#pressed.clear();
      this.#shiftDown = false;
      this.#ctrlDown = false;
      this.#rightMouseDown = false;
      this.#moveTarget = null;
    };

    // LoL-style click-to-move: a right-click sets a world-space destination
    // that the player walks toward on its own (see world.ts), even after the
    // button is released. Holding the button and dragging re-issues that
    // destination every frame, which has the effect of the player following
    // the cursor for as long as it's held.
    this.#handleMouseDown = (event) => {
      if (this.callbacks.isPaused()) return;
      if (isInteractiveTarget(event.target)) return;

      if (event.button === 0) {
        event.preventDefault();
        this.callbacks.onFire({ x: event.clientX + window.scrollX, y: event.clientY + window.scrollY });
      } else if (event.button === 2) {
        event.preventDefault();
        this.#rightMouseDown = true;
        const point = { x: event.clientX + window.scrollX, y: event.clientY + window.scrollY };
        this.#moveTarget = point;
        this.#pendingPing = point;
      }
    };

    this.#handleMouseMove = (event) => {
      if (!this.#rightMouseDown) return;
      this.#moveTarget = { x: event.clientX + window.scrollX, y: event.clientY + window.scrollY };
    };

    this.#handleMouseUp = (event) => {
      if (event.button === 2) {
        this.#rightMouseDown = false;
      }
    };

    this.#handleContextMenu = (event) => {
      if (this.callbacks.isPaused()) return;
      if (isInteractiveTarget(event.target)) return;
      event.preventDefault();
    };

    window.addEventListener("keydown", this.#handleKeyDown);
    window.addEventListener("keyup", this.#handleKeyUp);
    window.addEventListener("blur", this.#handleBlur);
    window.addEventListener("mousedown", this.#handleMouseDown);
    window.addEventListener("mousemove", this.#handleMouseMove);
    window.addEventListener("mouseup", this.#handleMouseUp);
    window.addEventListener("contextmenu", this.#handleContextMenu);
  }

  destroy() {
    window.removeEventListener("keydown", this.#handleKeyDown);
    window.removeEventListener("keyup", this.#handleKeyUp);
    window.removeEventListener("blur", this.#handleBlur);
    window.removeEventListener("mousedown", this.#handleMouseDown);
    window.removeEventListener("mousemove", this.#handleMouseMove);
    window.removeEventListener("mouseup", this.#handleMouseUp);
    window.removeEventListener("contextmenu", this.#handleContextMenu);
  }

  getAxes(): Axes {
    const vertical =
      (this.#pressed.has("s") || this.#pressed.has("arrowdown") ? 1 : 0) +
      (this.#pressed.has("w") || this.#pressed.has("arrowup") ? -1 : 0);

    const horizontal =
      (this.#pressed.has("d") || this.#pressed.has("arrowright") ? 1 : 0) +
      (this.#pressed.has("a") || this.#pressed.has("arrowleft") ? -1 : 0);

    return {
      vertical: Math.max(-1, Math.min(1, vertical)) as Axes["vertical"],
      horizontal: Math.max(-1, Math.min(1, horizontal)) as Axes["horizontal"],
    };
  }

  isRunning() {
    return this.#shiftDown;
  }

  isCrouching() {
    return this.#ctrlDown;
  }

  getMoveTarget(): WorldPoint | null {
    return this.#moveTarget;
  }

  clearMoveTarget() {
    this.#moveTarget = null;
  }

  /** One-shot: returns the most recent click point once, then null until the next click. */
  consumePing(): WorldPoint | null {
    const point = this.#pendingPing;
    this.#pendingPing = null;
    return point;
  }
}
