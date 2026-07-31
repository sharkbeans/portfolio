import kaplay from "kaplay";

import { CharacterController } from "./CharacterController";
import { InputController } from "./InputController";
import { InteractionController } from "./InteractionController";
import {
  MAP_HEIGHT,
  MAP_WIDTH,
  PATH_BOTTOM,
  PATH_TOP,
  PATH_X,
  findNearestInteractable,
  getCharacterPoint,
  getInteractablePoint,
  journeyInteractables,
  journeySections,
} from "./JourneyMap";
import { ScrollController } from "./ScrollController";

function detectReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function toCanvasPoint(canvas: HTMLCanvasElement, clientX: number, clientY: number) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: ((clientX - rect.left) / rect.width) * MAP_WIDTH,
    y: ((clientY - rect.top) / rect.height) * MAP_HEIGHT,
  };
}

export function initHomeJourney(root: HTMLElement) {
  const canvas = root.querySelector<HTMLCanvasElement>("#journey-canvas");
  const dialog = root.querySelector<HTMLDialogElement>("#journey-dialog");
  const content = document.querySelector<HTMLElement>("#journey-content");
  const hint = root.querySelector<HTMLElement>("[data-journey-hint]");

  if (!canvas || !dialog || !content) {
    return;
  }

  const reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
  const character = new CharacterController(detectReducedMotion());
  let interactionOpen = false;
  let hoveredId: string | undefined;

  const interactionController = new InteractionController(dialog, {
    onOpenChange(open) {
      interactionOpen = open;
      root.dataset.dialogOpen = open ? "true" : "false";
    },
  });

  const inputController = new InputController({
    isPaused: () => interactionOpen,
    onInteract() {
      const snapshot = character.getSnapshot();
      interactionController.openNearest(snapshot.progress, snapshot.localX);
    },
    onEscape() {
      interactionController.close();
    },
  });

  const scrollController = new ScrollController(content, {
    onProgress(progress) {
      character.setInteractionFromScroll(progress);
      markInteracted();
    },
  });

  const markInteracted = () => {
    character.markInteracted();
    if (hint) {
      hint.hidden = true;
    }
  };

  const k = kaplay({
    global: false,
    canvas,
    width: MAP_WIDTH,
    height: MAP_HEIGHT,
    crisp: true,
    pixelDensity: 1,
    background: [0, 0, 0, 0],
    loadingScreen: false,
    debug: false,
    focus: false,
  });

  reducedMotionQuery.addEventListener("change", (event) => {
    character.setReducedMotion(event.matches);
  });

  canvas.addEventListener("mousemove", (event) => {
    const point = toCanvasPoint(canvas, event.clientX, event.clientY);
    hoveredId = journeyInteractables.find((target) => {
      const targetPoint = getInteractablePoint(target);
      return Math.abs(point.x - targetPoint.x) <= 28 && Math.abs(point.y - targetPoint.y) <= 24;
    })?.id;
    canvas.style.cursor = hoveredId ? "pointer" : "default";
  });

  canvas.addEventListener("mouseleave", () => {
    hoveredId = undefined;
    canvas.style.cursor = "default";
  });

  const openHovered = (clientX: number, clientY: number) => {
    const point = toCanvasPoint(canvas, clientX, clientY);
    const hit = journeyInteractables.find((target) => {
      const targetPoint = getInteractablePoint(target);
      return Math.abs(point.x - targetPoint.x) <= 28 && Math.abs(point.y - targetPoint.y) <= 24;
    });

    if (hit) {
      interactionController.open(hit.id, canvas);
      markInteracted();
    }
  };

  canvas.addEventListener("click", (event) => openHovered(event.clientX, event.clientY));
  canvas.addEventListener(
    "touchend",
    (event) => {
      const touch = event.changedTouches[0];
      if (!touch) {
        return;
      }
      openHovered(touch.clientX, touch.clientY);
    },
    { passive: true },
  );

  root
    .querySelectorAll<HTMLElement>("[data-open-preview]")
    .forEach((button) =>
      button.addEventListener("click", () => {
        const id = button.dataset.openPreview;
        if (id) {
          interactionController.open(id, button);
          markInteracted();
        }
      }),
    );

  root.dataset.enhanced = "true";
  scrollController.recalculate();
  character.setInteractionFromScroll(
    Math.min(1, Math.max(0, window.scrollY === 0 ? 0 : window.scrollY / Math.max(1, document.body.scrollHeight))),
  );

  k.onUpdate(() => {
    const axes = inputController.getAxes();
    const before = character.getSnapshot().progress;
    character.tick(k.dt(), axes, interactionOpen);
    const afterSnapshot = character.getSnapshot();

    if (!interactionOpen && before !== afterSnapshot.progress) {
      scrollController.scrollToProgress(afterSnapshot.progress);
      markInteracted();
    }
  });

  k.onDraw(() => {
    const snapshot = character.getSnapshot();

    k.drawRect({
      width: MAP_WIDTH,
      height: MAP_HEIGHT,
      color: k.rgb(detectReducedMotion() ? "#ece4d3" : "#efe7d8"),
    });

    k.drawRect({
      pos: k.vec2(8, 8),
      width: MAP_WIDTH - 16,
      height: MAP_HEIGHT - 16,
      color: k.rgb("#f8f4ea"),
      outline: {
        color: k.rgb("#b8ab98"),
        width: 1,
      },
    });

    k.drawLine({
      p1: k.vec2(PATH_X, PATH_TOP),
      p2: k.vec2(PATH_X, PATH_BOTTOM),
      width: 3,
      color: k.rgb("#6b5f4f"),
    });

    for (const section of journeySections) {
      const point = getCharacterPoint(section.progress, 0);
      k.drawCircle({
        pos: k.vec2(point.x, point.y),
        radius: 4,
        color: k.rgb("#0d675a"),
      });
      k.drawText({
        text: section.label,
        pos: k.vec2(point.x + 12, point.y - 8),
        size: 11,
        color: k.rgb("#6b5f4f"),
        font: "monospace",
      });
    }

    for (const target of journeyInteractables) {
      const point = getInteractablePoint(target);
      const isActive =
        target.id === hoveredId || target.id === snapshot.nearestTargetId || interactionOpen;
      const fill = target.id === hoveredId ? "#79c9b6" : isActive ? "#d8efe8" : "#ece4d3";

      k.drawLine({
        p1: k.vec2(PATH_X, point.y),
        p2: k.vec2(point.x, point.y),
        width: 2,
        color: k.rgb("#9e917f"),
      });

      k.drawRect({
        pos: k.vec2(point.x - 22, point.y - 16),
        width: 44,
        height: 32,
        color: k.rgb(fill),
        outline: {
          color: k.rgb("#6b5f4f"),
          width: 1,
        },
        radius: 3,
      });

      k.drawText({
        text: target.label,
        pos: k.vec2(point.x - 22, point.y + 24),
        size: 9,
        width: 52,
        align: "center",
        color: k.rgb("#6b5f4f"),
        font: "monospace",
      });
    }

    const characterPoint = getCharacterPoint(snapshot.progress, snapshot.localX);
    const lift = snapshot.bob;
    const step = snapshot.step;

    k.drawCircle({
      pos: k.vec2(characterPoint.x, characterPoint.y - 10 + lift),
      radius: 5,
      color: k.rgb("#f6d8b8"),
    });
    k.drawRect({
      pos: k.vec2(characterPoint.x - 6, characterPoint.y - 6 + lift),
      width: 12,
      height: 15,
      color: k.rgb("#0d675a"),
      radius: 2,
    });
    k.drawRect({
      pos: k.vec2(characterPoint.x - 5, characterPoint.y + 10 + lift),
      width: 3,
      height: 7 + Math.max(0, step),
      color: k.rgb("#3b3025"),
    });
    k.drawRect({
      pos: k.vec2(characterPoint.x + 2, characterPoint.y + 10 + lift),
      width: 3,
      height: 7 + Math.max(0, -step),
      color: k.rgb("#3b3025"),
    });

    const nearby = findNearestInteractable(snapshot.progress, snapshot.localX);
    if (nearby && !interactionOpen) {
      const bubblePoint = getInteractablePoint(nearby);
      const bubbleWidth = 136;
      const bubbleHeight = 34;

      k.drawRect({
        pos: k.vec2(bubblePoint.x - bubbleWidth / 2, bubblePoint.y - 58),
        width: bubbleWidth,
        height: bubbleHeight,
        color: k.rgb("#f8f4ea"),
        outline: {
          color: k.rgb("#6b5f4f"),
          width: 1,
        },
        radius: 3,
      });

      k.drawText({
        text: nearby.prompt,
        pos: k.vec2(bubblePoint.x - bubbleWidth / 2 + 8, bubblePoint.y - 50),
        width: bubbleWidth - 16,
        size: 10,
        color: k.rgb("#1f1a14"),
        font: "monospace",
      });
    }
  });

  return () => {
    inputController.destroy();
    scrollController.destroy();
    interactionController.close();
  };
}
