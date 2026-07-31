export type Direction = "down" | "left" | "right" | "up";

/** Axis-aligned rectangle in document (world) coordinates. */
export type WorldRect = {
  left: number;
  top: number;
  right: number;
  bottom: number;
};

export type SolidRect = WorldRect & { el: HTMLElement };

export type InteractableRect = WorldRect & {
  id: string;
  el: HTMLElement;
  centerX: number;
  centerY: number;
};

export type SpawnPoint = {
  id: string;
  x: number;
  y: number;
};

export type Axes = {
  horizontal: -1 | 0 | 1;
  vertical: -1 | 0 | 1;
};

export type PlayerSnapshot = {
  x: number;
  y: number;
  facing: Direction;
  isMoving: boolean;
};
