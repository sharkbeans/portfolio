import type { SolidRect, WorldRect } from "./world-types";

const BULLET_SPEED = 1400; // world px/sec
const BULLET_MAX_DISTANCE = 960; // world px travelled before despawn
const BULLET_NO_RICOCHET_DISTANCE = BULLET_MAX_DISTANCE / 2; // an impact past this much travel detonates instead of ricocheting, so the blast is reliably on-screen
const BULLET_MAX_BOUNCES = 1; // one ricochet, then the next wall hit detonates instead of bouncing again
const SURFACE_NUDGE = 0.5; // pushes the bullet clear of a wall after a bounce so it can't re-hit the same face next step
const MAX_STEPS_PER_FRAME = 6; // safety cap on bounces resolved within a single frame

export type Bullet = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  distanceLeft: number;
  bouncesLeft: number;
};

type RayHit = { t: number; nx: number; ny: number };

// Ray-vs-AABB "slab method": for each axis, find the interval of t where the
// ray is within the rect's [min, max] on that axis, then intersect the two
// intervals. This is the standard technique for ray/segment-vs-box hit
// testing and surface-normal recovery (see e.g. the widely-referenced
// "N Tutorial A - Collision Detection and Response" swept-AABB writeup) —
// reused here instead of a bespoke intersection test.
function segmentVsRect(ox: number, oy: number, dx: number, dy: number, rect: WorldRect): RayHit | null {
  const invDx = dx !== 0 ? 1 / dx : Infinity;
  const invDy = dy !== 0 ? 1 / dy : Infinity;

  let tx1 = (rect.left - ox) * invDx;
  let tx2 = (rect.right - ox) * invDx;
  let nx1 = -1;
  let nx2 = 1;
  if (tx1 > tx2) {
    [tx1, tx2] = [tx2, tx1];
    [nx1, nx2] = [nx2, nx1];
  }

  let ty1 = (rect.top - oy) * invDy;
  let ty2 = (rect.bottom - oy) * invDy;
  let ny1 = -1;
  let ny2 = 1;
  if (ty1 > ty2) {
    [ty1, ty2] = [ty2, ty1];
    [ny1, ny2] = [ny2, ny1];
  }

  const tEnter = Math.max(tx1, ty1);
  const tExit = Math.min(tx2, ty2);

  if (tEnter > tExit || tExit < 0 || tEnter > 1 || tEnter < 0) {
    return null;
  }

  // Whichever axis produced the later (max) entry time is the face the ray
  // actually crossed first — that axis' precomputed normal is the hit normal.
  return tx1 > ty1 ? { t: tEnter, nx: nx1, ny: 0 } : { t: tEnter, nx: 0, ny: ny1 };
}

function nearestSolidHit(ox: number, oy: number, dx: number, dy: number, solids: readonly SolidRect[]): RayHit | null {
  let nearest: RayHit | null = null;
  for (const rect of solids) {
    const hit = segmentVsRect(ox, oy, dx, dy, rect);
    if (hit && (!nearest || hit.t < nearest.t)) {
      nearest = hit;
    }
  }
  return nearest;
}

// Ray vs the *inside* of the page bounds: unlike segmentVsRect (which hits a
// box from outside), the bullet starts inside `bounds` and we want the first
// t where it would cross out through whichever edge it's heading toward.
function boundsExitHit(ox: number, oy: number, dx: number, dy: number, bounds: WorldRect): RayHit | null {
  let nearest: RayHit | null = null;

  if (dx > 0) {
    const t = (bounds.right - ox) / dx;
    if (t >= 0 && t <= 1) nearest = { t, nx: -1, ny: 0 };
  } else if (dx < 0) {
    const t = (bounds.left - ox) / dx;
    if (t >= 0 && t <= 1) nearest = { t, nx: 1, ny: 0 };
  }

  if (dy > 0) {
    const t = (bounds.bottom - oy) / dy;
    if (t >= 0 && t <= 1 && (!nearest || t < nearest.t)) nearest = { t, nx: 0, ny: -1 };
  } else if (dy < 0) {
    const t = (bounds.top - oy) / dy;
    if (t >= 0 && t <= 1 && (!nearest || t < nearest.t)) nearest = { t, nx: 0, ny: 1 };
  }

  return nearest;
}

/**
 * Fired bullets travel in a straight line and ricochet off solid DOM rects
 * (the same geometry PlayerController collides with) using reflection
 * across the impact surface normal, up to a limited number of bounces
 * before the wall hit that exhausts the budget detonates instead of
 * ricocheting again. Bullets also bounce off the page edges (`bounds`),
 * a separate budget-free bounce so a bullet can keep skipping along the
 * edges of the page. Either kind of impact instead detonates outright,
 * with no ricochet, once the bullet has already travelled past
 * `BULLET_NO_RICOCHET_DISTANCE` — that keeps the blast effect from firing
 * mostly off-screen at the tail end of a long, multi-bounce flight.
 */
export class BulletSystem {
  #bullets: Bullet[] = [];

  spawn(x: number, y: number, targetX: number, targetY: number) {
    const dx = targetX - x;
    const dy = targetY - y;
    const len = Math.hypot(dx, dy) || 1;
    this.#bullets.push({
      x,
      y,
      vx: (dx / len) * BULLET_SPEED,
      vy: (dy / len) * BULLET_SPEED,
      distanceLeft: BULLET_MAX_DISTANCE,
      bouncesLeft: BULLET_MAX_BOUNCES,
    });
  }

  get all(): readonly Bullet[] {
    return this.#bullets;
  }

  tick(dt: number, solids: readonly SolidRect[], bounds: WorldRect, onImpact?: (x: number, y: number) => void) {
    this.#bullets = this.#bullets.filter((bullet) => this.#step(bullet, dt, solids, bounds, onImpact));
  }

  #step(
    bullet: Bullet,
    dt: number,
    solids: readonly SolidRect[],
    bounds: WorldRect,
    onImpact?: (x: number, y: number) => void,
  ): boolean {
    let remaining = BULLET_SPEED * dt;
    let steps = 0;

    while (remaining > 0.0001 && steps < MAX_STEPS_PER_FRAME) {
      steps++;

      const dirLen = Math.hypot(bullet.vx, bullet.vy) || 1;
      const dx = (bullet.vx / dirLen) * remaining;
      const dy = (bullet.vy / dirLen) * remaining;

      const solidHit = nearestSolidHit(bullet.x, bullet.y, dx, dy, solids);
      const edgeHit = boundsExitHit(bullet.x, bullet.y, dx, dy, bounds);
      const isEdge = !solidHit || (edgeHit !== null && edgeHit.t < solidHit.t);
      const hit = isEdge ? edgeHit : solidHit;

      if (!hit) {
        bullet.x += dx;
        bullet.y += dy;
        bullet.distanceLeft -= remaining;
        remaining = 0;
        break;
      }

      const consumed = hit.t * remaining;
      bullet.x += dx * hit.t;
      bullet.y += dy * hit.t;
      bullet.distanceLeft -= consumed;
      remaining -= consumed;

      const travelled = BULLET_MAX_DISTANCE - bullet.distanceLeft;
      const pastRicochetRange = travelled > BULLET_NO_RICOCHET_DISTANCE;

      if (pastRicochetRange || (!isEdge && bullet.bouncesLeft <= 0)) {
        onImpact?.(bullet.x, bullet.y);
        return false;
      }
      if (!isEdge) bullet.bouncesLeft--;

      // Reflect velocity across the impact normal: r = d - 2(d·n)n.
      const dot = bullet.vx * hit.nx + bullet.vy * hit.ny;
      bullet.vx -= 2 * dot * hit.nx;
      bullet.vy -= 2 * dot * hit.ny;

      bullet.x += hit.nx * SURFACE_NUDGE;
      bullet.y += hit.ny * SURFACE_NUDGE;
    }

    return bullet.distanceLeft > 0;
  }
}
