import kaplay from "kaplay";

import { BulletSystem } from "./BulletSystem";
import { CameraController } from "./CameraController";
import { DomCollisionSystem } from "./DomCollisionSystem";
import { InputController } from "./InputController";
import { InteractionSystem } from "./InteractionSystem";
import { PlayerController } from "./PlayerController";
import { SpawnPointSystem } from "./SpawnPointSystem";
import { findWorldInteractable } from "../../data/world";
import type { Axes, InteractableRect } from "./world-types";

const SPRITE_SCALE = 0.77;
const READING_MODE_KEY = "world:reading-mode";
const MOBILE_GUTTER = 28;
const MOBILE_MIN_WIDTH = 420;

// Anims are keyed by facing *side* ("r"/"l") rather than by direction: the
// source sheet only has left/right profile art, so down/up alias whichever
// side they're closest to (down→right, up→left) — see `facingSide` below.
const ANIMS = {
  "idle-r": { from: 0, to: 6, loop: true, speed: 4 },
  "idle-l": { from: 8, to: 14, loop: true, speed: 4 },
  "walk-r": { from: 16, to: 20, loop: true, speed: 8 },
  "walk-l": { from: 24, to: 28, loop: true, speed: 8 },
  "crouch-r": 35,
  "crouch-l": 43,
  "fire-r": { from: 52, to: 54, loop: false, speed: 14 },
  "fire-l": { from: 60, to: 62, loop: false, speed: 14 },
} as const;

function facingSide(facing: "down" | "left" | "right" | "up"): "l" | "r" {
  return facing === "left" || facing === "up" ? "l" : "r";
}

// Click-to-move: greedily steps toward the target on whichever axes aren't
// already within the arrival threshold, then reuses the same axis-separated
// collision resolver as WASD (PlayerController#tick) — no pathfinding needed
// since it's the same "walk this way, slide off walls" logic either way.
const MOVE_ARRIVAL_THRESHOLD = 6;

function axesTowardPoint(fromX: number, fromY: number, toX: number, toY: number): Axes {
  const dx = toX - fromX;
  const dy = toY - fromY;
  const horizontal = Math.abs(dx) <= MOVE_ARRIVAL_THRESHOLD ? 0 : dx > 0 ? 1 : -1;
  const vertical = Math.abs(dy) <= MOVE_ARRIVAL_THRESHOLD ? 0 : dy > 0 ? 1 : -1;
  return { horizontal, vertical };
}

function isDebugEnabled() {
  try {
    return new URLSearchParams(window.location.search).has("debugWorld") || import.meta.env.DEV;
  } catch {
    return false;
  }
}

function supportsManualWorld() {
  return (
    window.matchMedia("(min-width: 64rem)").matches && window.matchMedia("(pointer: fine)").matches
  );
}

export function initWorld(root: HTMLElement) {
  const canvas = root.querySelector<HTMLCanvasElement>("#world-canvas");
  const dialog = root.querySelector<HTMLDialogElement>("#world-dialog");
  const readingToggle = root.querySelector<HTMLButtonElement>("[data-world-reading-toggle]");
  const debugEl = root.querySelector<HTMLElement>("[data-world-debug]");
  const worldContent = document.querySelector<HTMLElement>("#world-content");

  if (!canvas || !dialog || !worldContent) {
    return () => {};
  }

  const spriteUrl = `${import.meta.env.BASE_URL}assets/sprites/player.png`;
  const debugEnabled = isDebugEnabled();
  const reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
  const desktopQuery = window.matchMedia("(min-width: 64rem)");
  const pointerQuery = window.matchMedia("(pointer: fine)");

  let manualMode = supportsManualWorld();
  let readingMode = sessionStorage.getItem(READING_MODE_KEY) === "true";
  let dialogOpen = false;
  let currentNearest: InteractableRect | undefined;
  let pendingFire = false;
  let pendingFireTarget: { x: number; y: number } | null = null;

  // This callback only fires for recalcs *after* construction (resize,
  // font load, image load, content resize) — see DomCollisionSystem's
  // #isInitialRecalculation guard. That's what makes it safe to reference
  // `player`/`spawnSystem` here even though they're declared below: by the
  // time a real recalculation happens, this whole function has long since
  // finished its synchronous setup.
  const collisionSystem = new DomCollisionSystem(worldContent, () => {
    if (manualMode && collisionSystem.isInsideAnySolid(player.x, player.y)) {
      const safe = spawnSystem.findSafeNear(player.x, player.y);
      player.teleport(safe.x, safe.y);
    }
  });
  const spawnSystem = new SpawnPointSystem(collisionSystem);
  const player = new PlayerController();
  const camera = new CameraController(reducedMotionQuery.matches);
  const interactionSystem = new InteractionSystem(dialog, {
    onOpenChange(open) {
      dialogOpen = open;
    },
  });

  const inputController = new InputController({
    isPaused: () => dialogOpen || readingMode || !manualMode,
    isDialogOpen: () => dialogOpen,
    onInteract() {
      const nearest = interactionSystem.findNearest(
        player.x,
        player.y,
        collisionSystem.getInteractableRects(),
      );
      if (nearest) interactionSystem.open(nearest.id);
    },
    onEscape() {
      interactionSystem.close();
    },
    onFire(point) {
      pendingFire = true;
      pendingFireTarget = point;
    },
  });

  function placeAtSpawn(id: string) {
    const point = spawnSystem.findSafePosition(id);
    if (point) {
      player.teleport(point.x, point.y);
    }
  }

  placeAtSpawn("intro");

  // In-page anchor links (e.g. "selected projects") reposition the player
  // to the nearest spawn marker inside the target section after the
  // browser's normal jump — no forced walking sequence.
  worldContent.querySelectorAll<HTMLAnchorElement>('a[href^="#"]').forEach((anchor) => {
    anchor.addEventListener("click", () => {
      const targetId = anchor.getAttribute("href")?.slice(1);
      window.requestAnimationFrame(() => {
        const targetSection = targetId ? document.getElementById(targetId) : null;
        const marker = targetSection?.querySelector<HTMLElement>("[data-world-spawn]");
        const spawnId = marker?.dataset.worldSpawn;
        if (spawnId) placeAtSpawn(spawnId);
      });
    });
  });

  function setReadingMode(value: boolean) {
    readingMode = value;
    document.documentElement.dataset.worldReadingMode = value ? "true" : "false";
    sessionStorage.setItem(READING_MODE_KEY, String(value));
    readingToggle?.setAttribute("aria-pressed", String(value));
  }

  setReadingMode(readingMode);

  readingToggle?.addEventListener("click", () => {
    setReadingMode(!readingMode);
  });

  const handleModeQueryChange = () => {
    manualMode = desktopQuery.matches && pointerQuery.matches;
  };
  desktopQuery.addEventListener("change", handleModeQueryChange);
  pointerQuery.addEventListener("change", handleModeQueryChange);
  reducedMotionQuery.addEventListener("change", (event) => {
    camera.setReducedMotion(event.matches);
  });

  // KAPLAY sizes its drawing buffer from the canvas's *parent* element's
  // offsetWidth/offsetHeight when width/height aren't passed explicitly —
  // not the canvas's own size — so we always pass the real viewport size
  // ourselves. Because that buffer size is fixed at construction time (no
  // live internal resize), a real viewport resize is handled by fully
  // re-mounting the renderer rather than trying to mutate it in place.
  let mounted: ReturnType<typeof mountRenderer> | undefined;

  function mountRenderer() {
    const width = window.innerWidth;
    const height = window.innerHeight;

    const k = kaplay({
      canvas: canvas!,
      width,
      height,
      global: false,
      crisp: true,
      pixelDensity: Math.min(2, window.devicePixelRatio || 1),
      background: [0, 0, 0, 0],
      loadingScreen: false,
      debug: false,
      focus: false,
    });

    k.loadSprite("player", spriteUrl, {
      sliceX: 8,
      sliceY: 8,
      anims: ANIMS,
    });

    const sprite = k.add([
      k.sprite("player", { anim: "idle-r" }),
      k.pos(0, 0),
      k.anchor("bot"),
      k.scale(SPRITE_SCALE),
      k.z(10),
    ]);

    let currentAnim: keyof typeof ANIMS = "idle-r";
    function setAnim(name: keyof typeof ANIMS) {
      if (currentAnim === name) return;
      currentAnim = name;
      sprite.play(name);
    }

    // "fire" is a one-shot anim (flash + recoil); while it's playing we
    // leave the sprite alone instead of stomping it with the idle/walk pick
    // below, then fall back to whatever pose currently applies once it ends.
    let firing = false;
    sprite.onAnimEnd((anim) => {
      if (anim === "fire-l" || anim === "fire-r") {
        firing = false;
      }
    });

    // LoL-style click-to-move ping: a short fading ring at the last
    // right-click point, purely cosmetic.
    let pingMarker: { x: number; y: number; age: number } | null = null;
    const PING_DURATION = 0.35;

    const bulletSystem = new BulletSystem();

    k.onUpdate(() => {
      const dt = k.dt();

      if (manualMode && !readingMode) {
        const crouching = inputController.isCrouching();

        const newPing = inputController.consumePing();
        if (newPing) {
          pingMarker = { x: newPing.x, y: newPing.y, age: 0 };
        }
        if (pingMarker) {
          pingMarker.age += dt;
          if (pingMarker.age >= PING_DURATION) pingMarker = null;
        }

        bulletSystem.tick(dt, collisionSystem.getSolidRects(), collisionSystem.getBounds());

        if (!dialogOpen) {
          const keyboardAxes = inputController.getAxes();
          let axes = keyboardAxes;

          if (keyboardAxes.horizontal !== 0 || keyboardAxes.vertical !== 0) {
            // Keyboard always wins: pressing WASD hands control back and
            // drops whatever click-to-move destination was pending.
            inputController.clearMoveTarget();
          } else {
            const moveTarget = inputController.getMoveTarget();
            if (moveTarget) {
              if (Math.hypot(moveTarget.x - player.x, moveTarget.y - player.y) <= MOVE_ARRIVAL_THRESHOLD) {
                inputController.clearMoveTarget();
              } else {
                axes = axesTowardPoint(player.x, player.y, moveTarget.x, moveTarget.y);
              }
            }
          }

          player.tick(
            dt,
            axes,
            inputController.isRunning(),
            crouching,
            collisionSystem.getSolidRects(),
            collisionSystem.getBounds(),
          );
          if (player.isMoving) {
            camera.tick(dt, player.y);
          }
        }

        currentNearest = dialogOpen
          ? undefined
          : interactionSystem.findNearest(player.x, player.y, collisionSystem.getInteractableRects());
        interactionSystem.updateHighlight(currentNearest);

        // Firing snaps the sprite to face the cursor (left/right only — the
        // source sheet has no other aiming poses) before the anim side is
        // picked, so the gun points where the shot was actually aimed
        // instead of wherever the player was last walking.
        if (!dialogOpen && pendingFire && pendingFireTarget) {
          player.facing = pendingFireTarget.x < player.x ? "left" : "right";
        }

        const side = facingSide(player.facing);

        if (!dialogOpen && pendingFire) {
          const fireTarget = pendingFireTarget;
          pendingFire = false;
          pendingFireTarget = null;
          firing = true;
          currentAnim = `fire-${side}`;
          sprite.play(currentAnim);

          if (fireTarget) {
            const muzzleX = player.x + (side === "l" ? -9 : 9);
            const muzzleY = player.y - 9;
            bulletSystem.spawn(muzzleX, muzzleY, fireTarget.x, fireTarget.y);
          }
        } else if (firing) {
          // let the fire anim play out untouched
        } else if (crouching) {
          setAnim(`crouch-${side}`);
        } else {
          setAnim(`${player.isMoving ? "walk" : "idle"}-${side}`);
        }
        sprite.animSpeed = player.isRunning ? 1.4 : 1;

        sprite.pos.x = player.x - window.scrollX;
        sprite.pos.y = player.y - window.scrollY;
        sprite.hidden = false;
      } else if (!manualMode && !readingMode && window.innerWidth >= MOBILE_MIN_WIDTH) {
        // Decorative, scroll-linked companion: pinned to a slim side gutter,
        // no collision, not interactive.
        const laneX = window.innerWidth - MOBILE_GUTTER;
        const laneY = window.innerHeight * 0.55;
        setAnim("idle-r");
        sprite.pos.x = laneX;
        sprite.pos.y = laneY;
        sprite.hidden = false;
      } else {
        sprite.hidden = true;
      }
    });

    k.onDraw(() => {
      if (readingMode || sprite.hidden) return;

      if (manualMode && pingMarker) {
        const t = pingMarker.age / PING_DURATION;
        k.drawCircle({
          pos: k.vec2(pingMarker.x - window.scrollX, pingMarker.y - window.scrollY),
          radius: 4 + t * 10,
          fill: false,
          opacity: 1 - t,
          outline: { color: k.rgb(242, 184, 75), width: 2 },
        });
      }

      if (manualMode) {
        for (const bullet of bulletSystem.all) {
          const bx = bullet.x - window.scrollX;
          const by = bullet.y - window.scrollY;
          const dirLen = Math.hypot(bullet.vx, bullet.vy) || 1;
          const tailX = bx - (bullet.vx / dirLen) * 10;
          const tailY = by - (bullet.vy / dirLen) * 10;

          k.drawLine({
            p1: k.vec2(tailX, tailY),
            p2: k.vec2(bx, by),
            width: 2,
            color: k.rgb(255, 226, 140),
            opacity: 0.9,
          });
        }
      }

      // Shadow so the sprite stays legible over text-heavy backgrounds.
      k.drawEllipse({
        pos: k.vec2(sprite.pos.x, sprite.pos.y + 2),
        radiusX: 9 * SPRITE_SCALE * 0.4,
        radiusY: 3 * SPRITE_SCALE * 0.4,
        color: k.rgb(0, 0, 0),
        opacity: 0.35,
      });

      if (manualMode && !dialogOpen && currentNearest) {
        const target = findWorldInteractable(currentNearest.id)?.promptLabel ?? currentNearest.id;
        const bubbleWidth = 160;
        const bx = sprite.pos.x - bubbleWidth / 2;
        const by = sprite.pos.y - 62;

        k.drawRect({
          pos: k.vec2(bx, by),
          width: bubbleWidth,
          height: 28,
          color: k.rgb(29, 31, 33),
          opacity: 0.92,
          outline: { color: k.rgb(242, 184, 75), width: 1 },
        });

        k.drawText({
          // KAPLAY's drawText treats [brackets] as rich-text style tags, so an
          // unescaped "[E]" throws a "Styled text error: unclosed tags" that
          // kills the render loop the moment a player nears an interactable.
          text: `\\[E\\] ${target}`,
          pos: k.vec2(bx + 8, by + 7),
          size: 11,
          width: bubbleWidth - 16,
          color: k.rgb(242, 184, 75),
          font: "Geist Pixel",
        });
      }

      if (debugEnabled) {
        drawDebugOverlay();
      }
    });

    function drawDebugOverlay() {
      for (const rect of collisionSystem.getSolidRects()) {
        k.drawRect({
          pos: k.vec2(rect.left - window.scrollX, rect.top - window.scrollY),
          width: rect.right - rect.left,
          height: rect.bottom - rect.top,
          fill: false,
          outline: { color: k.rgb(107, 227, 255), width: 1 },
        });
      }

      for (const rect of collisionSystem.getInteractableRects()) {
        k.drawRect({
          pos: k.vec2(rect.left - window.scrollX, rect.top - window.scrollY),
          width: rect.right - rect.left,
          height: rect.bottom - rect.top,
          fill: false,
          outline: { color: k.rgb(242, 184, 75), width: 1 },
        });
      }

      k.drawRect({
        pos: k.vec2(sprite.pos.x - 10, sprite.pos.y - 12),
        width: 20,
        height: 12,
        fill: false,
        outline: { color: k.rgb(255, 255, 255), width: 1 },
      });

      k.drawCircle({
        pos: k.vec2(sprite.pos.x, sprite.pos.y),
        radius: 90,
        fill: false,
        outline: { color: k.rgb(242, 184, 75), width: 1 },
      });

      for (const point of collisionSystem.getSpawnPoints()) {
        k.drawCircle({
          pos: k.vec2(point.x - window.scrollX, point.y - window.scrollY),
          radius: 4,
          color: k.rgb(255, 212, 121),
        });
      }

      if (debugEl) {
        debugEl.hidden = false;
        debugEl.textContent = [
          `world  x:${player.x.toFixed(0)} y:${player.y.toFixed(0)}`,
          `scroll x:${window.scrollX.toFixed(0)} y:${window.scrollY.toFixed(0)}`,
          `solids:${collisionSystem.getSolidRects().length} interactables:${collisionSystem.getInteractableRects().length}`,
          `mode:${manualMode ? "manual" : "decorative"} reading:${readingMode}`,
        ].join("\n");
      }
    }

    return {
      width,
      height,
      dispose() {
        k.quit();
      },
    };
  }

  mounted = mountRenderer();

  let resizeTimer: number | undefined;
  const handleViewportResize = () => {
    window.clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(() => {
      if (mounted && mounted.width === window.innerWidth && mounted.height === window.innerHeight) {
        return;
      }
      mounted?.dispose();
      mounted = mountRenderer();
    }, 200);
  };
  window.addEventListener("resize", handleViewportResize);
  window.addEventListener("orientationchange", handleViewportResize);

  return () => {
    window.clearTimeout(resizeTimer);
    window.removeEventListener("resize", handleViewportResize);
    window.removeEventListener("orientationchange", handleViewportResize);
    inputController.destroy();
    collisionSystem.destroy();
    interactionSystem.destroy();
    desktopQuery.removeEventListener("change", handleModeQueryChange);
    pointerQuery.removeEventListener("change", handleModeQueryChange);
    mounted?.dispose();
  };
}
