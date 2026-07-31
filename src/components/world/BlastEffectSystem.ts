const BLAST_LIFETIME = 0.35;

export type BlastEffect = {
  x: number;
  y: number;
  age: number;
};

/**
 * One-shot blast marks spawned where a bullet detonates (its second wall
 * hit, once BulletSystem's single ricochet is used up). Rendering (which
 * sprite frame) is left to the caller — this class only owns spawn timing
 * and lifetime, same split as FootEffectSystem.
 */
export class BlastEffectSystem {
  #effects: BlastEffect[] = [];

  spawn(x: number, y: number) {
    this.#effects.push({ x, y, age: 0 });
  }

  tick(dt: number) {
    for (const effect of this.#effects) {
      effect.age += dt;
    }
    this.#effects = this.#effects.filter((effect) => effect.age < BLAST_LIFETIME);
  }

  /** 0 at spawn, 1 at expiry — lets the renderer pick a sprite frame without knowing the lifetime constant. */
  progress(effect: BlastEffect): number {
    return Math.min(1, effect.age / BLAST_LIFETIME);
  }

  get all(): readonly BlastEffect[] {
    return this.#effects;
  }
}
