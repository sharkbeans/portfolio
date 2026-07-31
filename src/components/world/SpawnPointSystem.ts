import type { DomCollisionSystem } from "./DomCollisionSystem";

const SEARCH_DISTANCES = [16, 32, 48, 72, 96];
const SEARCH_ANGLES_DEG = [0, 45, 90, 135, 180, 225, 270, 315];

/**
 * Resolves data-world-spawn markers (and arbitrary points, e.g. the
 * player's current position after a layout change) to safe document
 * coordinates, nudging outward in a small spiral if the point falls
 * inside a solid rect.
 */
export class SpawnPointSystem {
  constructor(private collisionSystem: DomCollisionSystem) {}

  findSafePosition(id: string): { x: number; y: number } | undefined {
    const point = this.collisionSystem.getSpawnPoint(id);
    if (!point) return undefined;
    return this.findSafeNear(point.x, point.y);
  }

  findSafeNear(x: number, y: number): { x: number; y: number } {
    if (!this.collisionSystem.isInsideAnySolid(x, y)) {
      return { x, y };
    }

    for (const distance of SEARCH_DISTANCES) {
      for (const angleDeg of SEARCH_ANGLES_DEG) {
        const angle = (angleDeg * Math.PI) / 180;
        const candidateX = x + Math.cos(angle) * distance;
        const candidateY = y + Math.sin(angle) * distance;
        if (!this.collisionSystem.isInsideAnySolid(candidateX, candidateY)) {
          return { x: candidateX, y: candidateY };
        }
      }
    }

    return { x, y };
  }
}
