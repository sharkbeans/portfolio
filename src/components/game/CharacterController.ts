import {
  approach,
  clampProgress,
  findNearestInteractable,
  getHorizontalLimit,
} from "./JourneyMap";

type Axes = {
  vertical: number;
  horizontal: number;
};

export type CharacterSnapshot = {
  progress: number;
  localX: number;
  facing: "left" | "right" | "up" | "down";
  bob: number;
  step: number;
  isMoving: boolean;
  interacted: boolean;
  nearestTargetId?: string;
};

export class CharacterController {
  #progress = 0;
  #localX = 0;
  #facing: CharacterSnapshot["facing"] = "down";
  #walkClock = 0;
  #recentHorizontalTime = 0;
  #interacted = false;

  constructor(private reducedMotion: boolean) {}

  setReducedMotion(value: boolean) {
    this.reducedMotion = value;
  }

  setProgress(progress: number) {
    this.#progress = clampProgress(progress);
    const limit = getHorizontalLimit(this.#progress);
    this.#localX = limit === 0 ? approach(this.#localX, 0, 0.14) : Math.max(-limit, Math.min(limit, this.#localX));
  }

  setInteractionFromScroll(progress: number) {
    this.setProgress(progress);
    this.#localX = approach(this.#localX, 0, 0.06);
  }

  markInteracted() {
    this.#interacted = true;
  }

  tick(dt: number, axes: Axes, paused: boolean) {
    if (paused) {
      this.#walkClock += dt * 0.3;
      return;
    }

    const verticalSpeed = 0.34;
    const horizontalSpeed = 1.75;
    const limit = getHorizontalLimit(this.#progress);
    const isMoving = axes.vertical !== 0 || axes.horizontal !== 0;

    if (axes.vertical !== 0) {
      this.#progress = clampProgress(this.#progress + axes.vertical * verticalSpeed * dt);
      this.#interacted = true;
    }

    if (limit > 0 && axes.horizontal !== 0) {
      this.#localX = Math.max(-limit, Math.min(limit, this.#localX + axes.horizontal * horizontalSpeed * dt));
      this.#recentHorizontalTime = 0.55;
      this.#interacted = true;
    } else {
      this.#recentHorizontalTime = Math.max(0, this.#recentHorizontalTime - dt);
      const recenterRate = limit === 0 || axes.vertical !== 0 ? 2.4 : 1.2;
      this.#localX = approach(this.#localX, 0, recenterRate * dt);
    }

    if (limit === 0) {
      this.#localX = approach(this.#localX, 0, 3 * dt);
    }

    if (axes.horizontal < 0) {
      this.#facing = "left";
    } else if (axes.horizontal > 0) {
      this.#facing = "right";
    } else if (axes.vertical < 0) {
      this.#facing = "up";
    } else if (axes.vertical > 0) {
      this.#facing = "down";
    }

    this.#walkClock += this.reducedMotion ? dt * 0.2 : isMoving ? dt * 8 : dt * 0.4;
  }

  getSnapshot(): CharacterSnapshot {
    const nearest = findNearestInteractable(this.#progress, this.#localX);

    return {
      progress: this.#progress,
      localX: this.#localX,
      facing: this.#facing,
      isMoving: this.reducedMotion ? false : Math.abs(Math.sin(this.#walkClock)) > 0.35,
      bob: this.reducedMotion ? 0 : Math.sin(this.#walkClock * 0.5) * 1.6,
      step: this.reducedMotion ? 0 : Math.sin(this.#walkClock),
      interacted: this.#interacted,
      nearestTargetId: nearest?.id,
    };
  }
}
