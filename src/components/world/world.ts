import kaplay from "kaplay";

import { CameraController } from "./CameraController";
import { DomCollisionSystem } from "./DomCollisionSystem";
import { InputController } from "./InputController";
import { InteractionSystem } from "./InteractionSystem";
import { PlayerController } from "./PlayerController";
import { SpawnPointSystem } from "./SpawnPointSystem";
import { findWorldInteractable } from "../../data/world";
import type { InteractableRect } from "./world-types";

const SPRITE_SCALE = 2.5;
const READING_MODE_KEY = "world:reading-mode";
const MOBILE_GUTTER = 28;
const MOBILE_MIN_WIDTH = 420;

const ANIMS = {
  "idle-down": 0,
  "walk-down": { from: 0, to: 3, loop: true, speed: 8 },
  "idle-left": 4,
  "walk-left": { from: 4, to: 7, loop: true, speed: 8 },
  "idle-right": 8,
  "walk-right": { from: 8, to: 11, loop: true, speed: 8 },
  "idle-up": 12,
  "walk-up": { from: 12, to: 15, loop: true, speed: 8 },
} as const;

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
      sliceX: 4,
      sliceY: 4,
      anims: ANIMS,
    });

    const sprite = k.add([
      k.sprite("player", { anim: "idle-down" }),
      k.pos(0, 0),
      k.anchor("bot"),
      k.scale(SPRITE_SCALE),
      k.z(10),
    ]);

    let currentAnim = "idle-down";
    function setAnim(name: keyof typeof ANIMS) {
      if (currentAnim === name) return;
      currentAnim = name;
      sprite.play(name);
    }

    k.onUpdate(() => {
      const dt = k.dt();

      if (manualMode && !readingMode) {
        if (!dialogOpen) {
          const axes = inputController.getAxes();
          player.tick(
            dt,
            axes,
            inputController.isRunning(),
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

        const animName = `${player.isMoving ? "walk" : "idle"}-${player.facing}` as keyof typeof ANIMS;
        setAnim(animName);
        sprite.animSpeed = player.isRunning ? 1.4 : 1;

        sprite.pos.x = player.x - window.scrollX;
        sprite.pos.y = player.y - window.scrollY;
        sprite.hidden = false;
      } else if (!manualMode && !readingMode && window.innerWidth >= MOBILE_MIN_WIDTH) {
        // Decorative, scroll-linked companion: pinned to a slim side gutter,
        // no collision, not interactive.
        const laneX = window.innerWidth - MOBILE_GUTTER;
        const laneY = window.innerHeight * 0.55;
        setAnim("idle-down");
        sprite.pos.x = laneX;
        sprite.pos.y = laneY;
        sprite.hidden = false;
      } else {
        sprite.hidden = true;
      }
    });

    k.onDraw(() => {
      if (readingMode || sprite.hidden) return;

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
          color: k.rgb(19, 21, 22),
          opacity: 0.92,
          outline: { color: k.rgb(124, 255, 107), width: 1 },
        });

        k.drawText({
          text: `[E] ${target}`,
          pos: k.vec2(bx + 8, by + 7),
          size: 11,
          width: bubbleWidth - 16,
          color: k.rgb(124, 255, 107),
          font: "monospace",
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
          outline: { color: k.rgb(124, 255, 107), width: 1 },
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
        outline: { color: k.rgb(124, 255, 107), width: 1 },
      });

      for (const point of collisionSystem.getSpawnPoints()) {
        k.drawCircle({
          pos: k.vec2(point.x - window.scrollX, point.y - window.scrollY),
          radius: 4,
          color: k.rgb(230, 255, 61),
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
