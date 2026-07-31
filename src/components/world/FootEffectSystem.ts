import type { WeatherCondition } from "./WeatherState";

const WALK_STRIDE_INTERVAL = 0.32; // seconds between footfalls at walk speed
const RUN_STRIDE_INTERVAL = 0.2;
const FREQUENCY_MULTIPLIER = 3; // splashes spawn 3x more often than the raw stride cadence
const SPLASH_LIFETIME = 0.45;

export type FootEffect = {
  x: number;
  y: number;
  age: number;
};

/**
 * Spawns a small, short-lived splash mark at the player's foot point in step
 * with their stride, only while it's raining in Penang. Nothing spawns while
 * idle, crouched, or the weather is clear — the point is to read weather
 * from what happens underfoot, not to run an ambient overlay. Rendering
 * (which sprite frame, how it fades) is left to the caller — this class
 * only owns spawn timing and lifetime.
 */
export class FootEffectSystem {
  #effects: FootEffect[] = [];
  #strideClock = 0;

  spawnIfDue(dt: number, x: number, y: number, isMoving: boolean, isRunning: boolean, condition: WeatherCondition) {
    if (!isMoving || condition !== "rain") {
      this.#strideClock = 0;
      return;
    }

    this.#strideClock += dt;
    const baseInterval = isRunning ? RUN_STRIDE_INTERVAL : WALK_STRIDE_INTERVAL;
    const interval = baseInterval / FREQUENCY_MULTIPLIER;
    if (this.#strideClock < interval) return;
    this.#strideClock -= interval;

    this.#effects.push({ x, y, age: 0 });
  }

  tick(dt: number) {
    for (const effect of this.#effects) {
      effect.age += dt;
    }
    this.#effects = this.#effects.filter((effect) => effect.age < SPLASH_LIFETIME);
  }

  /** 0 at spawn, 1 at expiry — lets the renderer pick a sprite frame/fade without knowing the lifetime constant. */
  progress(effect: FootEffect): number {
    return Math.min(1, effect.age / SPLASH_LIFETIME);
  }

  get all(): readonly FootEffect[] {
    return this.#effects;
  }
}
