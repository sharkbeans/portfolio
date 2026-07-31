import type { Axes, Direction, PlayerSnapshot, SolidRect, WorldRect } from "./world-types";

const BASE_SPEED = 150; // document px/sec
const RUN_SPEED = 260;
const HITBOX_HALF_WIDTH = 10;
const HITBOX_HEIGHT = 12;

function overlaps(a: WorldRect, b: WorldRect) {
  return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
}

function footRect(x: number, y: number): WorldRect {
  return {
    left: x - HITBOX_HALF_WIDTH,
    right: x + HITBOX_HALF_WIDTH,
    top: y - HITBOX_HEIGHT,
    bottom: y,
  };
}

/**
 * Owns the player's real 2D position in document (world) coordinates and
 * resolves movement against cached DOM-derived solid rects. Movement is
 * frame-rate independent (dt-scaled) and axis-separated so the player
 * slides along walls instead of sticking.
 */
export class PlayerController {
  x = 0;
  y = 0;
  facing: Direction = "down";
  isMoving = false;
  isRunning = false;

  teleport(x: number, y: number) {
    this.x = x;
    this.y = y;
  }

  #resolveAxis(axis: "x" | "y", delta: number, solids: readonly SolidRect[]) {
    if (delta === 0) return;

    let next = axis === "x" ? this.x + delta : this.y + delta;

    for (const solid of solids) {
      const candidateRect = axis === "x" ? footRect(next, this.y) : footRect(this.x, next);
      if (!overlaps(candidateRect, solid)) continue;

      if (axis === "x") {
        next = delta > 0 ? Math.min(next, solid.left - HITBOX_HALF_WIDTH) : Math.max(next, solid.right + HITBOX_HALF_WIDTH);
      } else {
        next = delta > 0 ? Math.min(next, solid.top) : Math.max(next, solid.bottom + HITBOX_HEIGHT);
      }
    }

    if (axis === "x") {
      this.x = next;
    } else {
      this.y = next;
    }
  }

  tick(dt: number, axes: Axes, running: boolean, solids: readonly SolidRect[], bounds: WorldRect) {
    const magnitude = Math.hypot(axes.horizontal, axes.vertical);
    this.isMoving = magnitude > 0;
    this.isRunning = running;

    if (this.isMoving) {
      const speed = running ? RUN_SPEED : BASE_SPEED;
      const nx = axes.horizontal / magnitude;
      const ny = axes.vertical / magnitude;

      this.#resolveAxis("x", nx * speed * dt, solids);
      this.#resolveAxis("y", ny * speed * dt, solids);

      if (axes.horizontal < 0) this.facing = "left";
      else if (axes.horizontal > 0) this.facing = "right";
      else if (axes.vertical < 0) this.facing = "up";
      else if (axes.vertical > 0) this.facing = "down";
    }

    const minX = bounds.left + HITBOX_HALF_WIDTH;
    const maxX = bounds.right - HITBOX_HALF_WIDTH;
    this.x = minX > maxX ? (bounds.left + bounds.right) / 2 : Math.min(maxX, Math.max(minX, this.x));

    const minY = bounds.top + HITBOX_HEIGHT;
    const maxY = bounds.bottom;
    this.y = minY > maxY ? bounds.bottom : Math.min(maxY, Math.max(minY, this.y));
  }

  getSnapshot(): PlayerSnapshot {
    return { x: this.x, y: this.y, facing: this.facing, isMoving: this.isMoving };
  }
}
