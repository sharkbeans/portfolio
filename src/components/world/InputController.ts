import type { Axes } from "./world-types";

const MOVEMENT_KEYS = new Set(["w", "a", "s", "d", "arrowup", "arrowleft", "arrowdown", "arrowright"]);

type InputCallbacks = {
  onInteract: () => void;
  onEscape: () => void;
  isPaused: () => boolean;
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

/**
 * Keyboard input for the world. Never intercepts keys while focus is on a
 * form control, contenteditable region, or dialog (isPaused covers the
 * open-dialog case), so normal accessible interaction is unaffected.
 */
export class InputController {
  #pressed = new Set<string>();
  #shiftDown = false;
  #handleKeyDown: (event: KeyboardEvent) => void;
  #handleKeyUp: (event: KeyboardEvent) => void;
  #handleBlur: () => void;

  constructor(private callbacks: InputCallbacks) {
    this.#handleKeyDown = (event) => {
      const key = event.key.toLowerCase();

      if (key === "shift") {
        this.#shiftDown = true;
      }

      if (key === "escape") {
        if (this.callbacks.isPaused()) {
          event.preventDefault();
          this.callbacks.onEscape();
        }
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
      this.#pressed.delete(key);
    };

    this.#handleBlur = () => {
      this.#pressed.clear();
      this.#shiftDown = false;
    };

    window.addEventListener("keydown", this.#handleKeyDown);
    window.addEventListener("keyup", this.#handleKeyUp);
    window.addEventListener("blur", this.#handleBlur);
  }

  destroy() {
    window.removeEventListener("keydown", this.#handleKeyDown);
    window.removeEventListener("keyup", this.#handleKeyUp);
    window.removeEventListener("blur", this.#handleBlur);
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
}
