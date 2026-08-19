import { prefetch } from "astro:prefetch";
import { navigate } from "astro:transitions/client";

import { findNavWheelIndex, navWheelEntries } from "../data/navWheel";

/** Distance between two adjacent slots on either arm of the L, in px. Must match --navsel-step. */
const STEP = 68;

/**
 * How many slots are drawn along each arm. The list wraps, so this has to stay
 * below half the entry count or a single entry would occupy two slots at once.
 */
const VISIBLE_RADIUS = Math.min(3, Math.floor((navWheelEntries.length - 1) / 2));

/** Exponential-smoothing rates (per second). Higher settles faster. */
const SLOT_SMOOTHING = 18;
const OPEN_SMOOTHING = 30;

/**
 * One step per this much accumulated wheel delta. Each event is clamped to the
 * same value so one detent of a mouse wheel (typically 100-120) advances
 * exactly one entry, while a trackpad's many small deltas still add up.
 */
const WHEEL_NOTCH = 60;

/**
 * Drag distance that advances one entry. Equal to STEP so the conveyor tracks
 * the finger one to one: drag by the gap between two tiles and the list moves
 * by exactly one tile.
 */
const DRAG_NOTCH = STEP;

/** Travel before a touch counts as a spin rather than a tap. */
const DRAG_THRESHOLD = 6;

const SETTLED = 0.0005;

type Card = {
  el: HTMLElement;
  index: number;
  /** Animated position along the L, in slots: 0 = elbow, negative = left arm, positive = up the column. */
  u: number;
  /** Last frame's target, used to tell a wrap-around jump apart from a normal step. */
  target: number;
};

const clamp01 = (value: number) => (value < 0 ? 0 : value > 1 ? 1 : value);
const smoothstep = (t: number) => t * t * (3 - 2 * t);
const normalizePath = (path: string) => path.replace(/\/+$/, "") || "/";

function isTypingTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  if (target.closest("[data-world-ignore-keys='true']")) return true;
  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target.getAttribute("role") === "textbox";
}

/**
 * The shortest signed distance from `cursor` to `index` around a list of
 * `length` entries — the wrapping equivalent of `index - cursor`. This is what
 * makes the conveyor endless: the entry three before the selection and the
 * entry three after are both three slots away, whichever side of the wrap
 * point they happen to sit on.
 */
function signedOffset(index: number, cursor: number, length: number) {
  let offset = (index - cursor) % length;
  if (offset > length / 2) offset -= length;
  if (offset < -length / 2) offset += length;
  return offset;
}

/**
 * The L-shaped track, as a function of one continuous parameter. Everything
 * about the selector's motion falls out of this: because cards interpolate
 * their position *along the path* rather than between two screen points, a
 * card crossing the elbow travels down the column and then left along the row
 * instead of cutting the corner diagonally — even when several steps of
 * scrolling are collapsed into one movement.
 */
function pathPosition(u: number) {
  return u >= 0 ? { x: 0, y: -u * STEP } : { x: u * STEP, y: 0 };
}

/**
 * Published on <html> as `data-page-selector` — deliberately a different
 * name from the element's own `data-nav-selector` hook, so a document-wide
 * query for the selector root can never resolve to <html> itself.
 *
 * MGS3-Delta-style quick selector: the site's pages as one ordered list
 * running through an L-shaped track, with the elbow acting as a stationary
 * selection slot that the list slides through. Releasing the key commits
 * whatever is sitting in the elbow and navigates there.
 */
export function initNavSelector(root: HTMLElement): () => void {
  const cardEls = Array.from(root.querySelectorAll<HTMLElement>("[data-nav-card]"));
  const labelEl = root.querySelector<HTMLElement>("[data-nav-label]");
  const pathEl = root.querySelector<HTMLElement>("[data-nav-path]");
  const captionEl = root.querySelector<HTMLElement>("[data-nav-caption]");
  const statusEl = root.querySelector<HTMLElement>("[data-nav-status]");
  const count = navWheelEntries.length;

  if (cardEls.length !== count) return () => {};

  // The cards are buttons, not <a> links, so Astro's viewport-prefetch scan
  // never sees them. Warming every destination as soon as the selector boots
  // means a fast open-scroll-release never outruns the fetch — by the time
  // `commit()` calls navigate(), the page is already cached.
  for (const entry of navWheelEntries) prefetch(entry.href);

  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const homeIndex = findNavWheelIndex(window.location.pathname);

  let cursor = homeIndex;
  let open = false;
  /** True when the selector was opened by holding the key, so releasing it commits. */
  let heldOpen = false;
  let openness = 0;
  let wheelAccumulator = 0;
  let frame = 0;
  let lastTime = 0;
  let committed = false;

  /** The pointer currently spinning the wheel, or null when nothing is dragging. */
  let dragPointer: number | null = null;
  let dragOriginX = 0;
  let dragOriginY = 0;
  /** Travel already turned into steps, measured from the drag origin. */
  let dragConsumed = 0;
  let dragMoved = false;
  /** True when this gesture is what opened the selector, so a tap can stop there. */
  let dragOpened = false;
  /** Set when a gesture has already decided what the interaction meant. */
  let swallowClick = false;

  const cards: Card[] = cardEls.map((el, index) => {
    const target = signedOffset(index, cursor, count);
    return { el, index, u: target, target };
  });

  function setReadout(index: number) {
    const entry = navWheelEntries[index];
    if (labelEl) labelEl.textContent = entry.label;
    if (pathEl) pathEl.textContent = normalizePath(new URL(entry.href, window.location.origin).pathname);
    if (captionEl) captionEl.textContent = entry.caption;
    cardEls.forEach((el, i) => el.setAttribute("aria-current", i === index ? "true" : "false"));
  }

  function announce() {
    if (statusEl) statusEl.textContent = `${navWheelEntries[cursor].label} selected`;
  }

  function render() {
    for (const card of cards) {
      const distance = Math.abs(card.u);
      // Selection is a function of *position*, not of index: whichever card is
      // sitting in the elbow lights up, and it brightens over exactly the same
      // frames it spends sliding into place.
      const selected = smoothstep(clamp01(1 - distance));
      const inWindow = clamp01(VISIBLE_RADIUS + 1 - distance);
      // Closed, only the elbow card survives this; open, everything does.
      const revealed = selected + (1 - selected) * openness;
      const depth = 1 - 0.22 * clamp01(distance / (VISIBLE_RADIUS || 1));
      // The elbow tile is permanent page furniture, so it sits back a little
      // until the selector is opened.
      const resting = 0.72 + 0.28 * openness;
      const spread = 0.82 + 0.18 * openness;
      const { x, y } = pathPosition(card.u);

      const style = card.el.style;
      style.setProperty("--sel", selected.toFixed(4));
      style.setProperty("--vis", (inWindow * revealed * depth * resting).toFixed(4));
      style.transform = `translate3d(${(x * spread).toFixed(2)}px, ${(y * spread).toFixed(2)}px, 0)`;
      style.zIndex = String(100 - Math.round(distance * 10));
      card.el.style.pointerEvents = openness > 0.5 || selected > 0.5 ? "auto" : "none";
    }

    root.style.setProperty("--open", openness.toFixed(4));
  }

  function tick(time: number) {
    const dt = lastTime ? Math.min(0.05, (time - lastTime) / 1000) : 1 / 60;
    lastTime = time;

    const openTarget = open ? 1 : 0;
    const slotBlend = reducedMotion.matches ? 1 : 1 - Math.exp(-SLOT_SMOOTHING * dt);
    const openBlend = reducedMotion.matches ? 1 : 1 - Math.exp(-OPEN_SMOOTHING * dt);

    openness += (openTarget - openness) * openBlend;
    let busy = Math.abs(openTarget - openness) > SETTLED;
    if (!busy) openness = openTarget;

    for (const card of cards) {
      const target = signedOffset(card.index, cursor, count);
      // A card that just wrapped from one end of the list to the other has to
      // jump rather than animate. It is parked outside the visible window when
      // that happens, so the jump is never on screen.
      if (Math.abs(target - card.target) > count / 2) {
        card.u = target;
      }
      card.target = target;

      card.u += (target - card.u) * slotBlend;
      if (Math.abs(target - card.u) > SETTLED) {
        busy = true;
      } else {
        card.u = target;
      }
    }

    render();

    if (busy) {
      frame = requestAnimationFrame(tick);
    } else {
      frame = 0;
      lastTime = 0;
    }
  }

  function start() {
    if (frame) return;
    lastTime = 0;
    frame = requestAnimationFrame(tick);
  }

  function setOpen(next: boolean) {
    if (open === next) return;
    open = next;
    root.dataset.open = String(next);
    document.documentElement.dataset.pageSelector = next ? "open" : "closed";
    wheelAccumulator = 0;

    if (next) {
      window.addEventListener("wheel", onWheel, { passive: false });
      window.addEventListener("pointerdown", onPointerDown);
      announce();
    } else {
      window.removeEventListener("wheel", onWheel);
      window.removeEventListener("pointerdown", onPointerDown);
    }

    start();
  }

  function step(delta: number) {
    cursor = (cursor + delta + count) % count;
    setReadout(cursor);
    announce();
    start();
  }

  function openSelector(held: boolean) {
    if (open) return;
    heldOpen = held;
    setOpen(true);
  }

  /** Close without going anywhere, snapping the elbow back to the page you are on. */
  function cancel() {
    if (!open) return;
    heldOpen = false;
    setOpen(false);
    if (cursor !== homeIndex) {
      cursor = homeIndex;
      setReadout(cursor);
      announce();
    }
  }

  /** Close and navigate to whatever is currently in the elbow. */
  function commit(index = cursor) {
    if (!open || committed) return;
    cursor = index;
    setReadout(cursor);
    heldOpen = false;
    setOpen(false);

    const entry = navWheelEntries[cursor];
    const target = new URL(entry.href, window.location.origin);
    if (normalizePath(target.pathname) === normalizePath(window.location.pathname)) return;

    committed = true;
    navigate(entry.href);
  }

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    const key = event.key.toLowerCase();

    if (!open) {
      if (key === "q" && !event.repeat && !isTypingTarget(event.target)) {
        event.preventDefault();
        openSelector(true);
      }
      return;
    }

    if (key === "escape") {
      event.preventDefault();
      cancel();
      return;
    }

    if (key === "arrowup" || key === "arrowright") {
      event.preventDefault();
      if (!event.repeat) step(1);
      return;
    }

    if (key === "arrowdown" || key === "arrowleft") {
      event.preventDefault();
      if (!event.repeat) step(-1);
      return;
    }

    if (key === "enter" || key === " ") {
      event.preventDefault();
      if (!event.repeat) commit();
      return;
    }

    const digit = Number.parseInt(key, 10);
    if (Number.isInteger(digit) && digit >= 1 && digit <= count) {
      event.preventDefault();
      if (!event.repeat) step(signedOffset(digit - 1, cursor, count));
    }
  };

  const onKeyUp = (event: KeyboardEvent) => {
    if (event.key.toLowerCase() !== "q") return;
    if (open && heldOpen) commit();
  };

  function onWheel(event: WheelEvent) {
    if (!open) return;
    event.preventDefault();

    const raw = event.deltaMode === 1 ? event.deltaY * 16 : event.deltaMode === 2 ? event.deltaY * 400 : event.deltaY;
    wheelAccumulator += Math.max(-WHEEL_NOTCH, Math.min(WHEEL_NOTCH, raw));

    // Wheel up runs forward through the list, in the direction the column
    // above the elbow is pointing.
    while (wheelAccumulator <= -WHEEL_NOTCH) {
      wheelAccumulator += WHEEL_NOTCH;
      step(1);
    }
    while (wheelAccumulator >= WHEEL_NOTCH) {
      wheelAccumulator -= WHEEL_NOTCH;
      step(-1);
    }
  }

  function onPointerDown(event: PointerEvent) {
    if (!open) return;
    if (event.target instanceof Node && root.contains(event.target)) return;
    cancel();
  }

  /**
   * Touch has no wheel, so a drag along the L drives the same conveyor. Both
   * axes are summed into one number rather than picked between, so a drag up
   * the column, along the row, or diagonally across the crook all work without
   * the gesture having to guess which arm you meant.
   *
   * The sign is deliberately the opposite of the wheel's: a wheel scrolled up
   * pushes the tiles down, the way a wheel moves a document, while a finger
   * drags the tiles with it. Both end up feeling like the same conveyor.
   */
  function onDragStart(event: PointerEvent) {
    // Any fresh press starts from a clean slate, so a gesture that ended
    // somewhere no click could follow cannot leave the flag set for the next
    // one — including the mouse's, which is why this runs before the guard.
    swallowClick = false;

    // A mouse keeps its click-to-open, wheel-to-spin contract.
    if (event.pointerType === "mouse" || dragPointer !== null) return;

    dragPointer = event.pointerId;
    dragOriginX = event.clientX;
    dragOriginY = event.clientY;
    dragConsumed = 0;
    dragMoved = false;
    dragOpened = !open;

    // Captured to the root rather than the tile the finger landed on, which
    // stops being a pointer target as soon as the list slides it out of the
    // window.
    root.setPointerCapture(event.pointerId);
    window.addEventListener("pointermove", onDragMove);
    window.addEventListener("pointerup", onDragEnd);
    window.addEventListener("pointercancel", onDragCancel);

    if (!open) openSelector(false);
  }

  function onDragMove(event: PointerEvent) {
    if (event.pointerId !== dragPointer) return;

    const dx = event.clientX - dragOriginX;
    const dy = event.clientY - dragOriginY;

    if (!dragMoved) {
      if (Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
      dragMoved = true;
      // Re-anchor so the first step is a full notch from where the gesture was
      // recognised, not from where the finger first landed.
      dragOriginX = event.clientX;
      dragOriginY = event.clientY;
      return;
    }

    // Down and left both run the list forward, matching the direction the
    // tiles themselves travel for step(1).
    const advance = dy - dx;

    while (advance - dragConsumed >= DRAG_NOTCH) {
      dragConsumed += DRAG_NOTCH;
      step(1);
    }
    while (advance - dragConsumed <= -DRAG_NOTCH) {
      dragConsumed -= DRAG_NOTCH;
      step(-1);
    }
  }

  function endDrag() {
    if (dragPointer === null) return;
    window.removeEventListener("pointermove", onDragMove);
    window.removeEventListener("pointerup", onDragEnd);
    window.removeEventListener("pointercancel", onDragCancel);
    if (root.hasPointerCapture(dragPointer)) root.releasePointerCapture(dragPointer);
    dragPointer = null;
  }

  function onDragEnd(event: PointerEvent) {
    if (event.pointerId !== dragPointer) return;
    const spun = dragMoved;
    const opened = dragOpened;
    endDrag();

    // A drag commits whatever it spun into the elbow, the way releasing Q
    // does. A tap that only unfolded the selector leaves it open to pick from.
    // Either way the click that follows must not count as a second choice.
    if (spun) {
      swallowClick = true;
      commit();
    } else if (opened) {
      swallowClick = true;
    }
  }

  function onDragCancel(event: PointerEvent) {
    if (event.pointerId !== dragPointer) return;
    swallowClick = dragMoved || dragOpened;
    endDrag();
  }

  // A key release that never arrives (alt-tab mid-hold) should not strand the
  // selector open, and must not navigate on its own either.
  const onBlur = () => cancel();

  const cardHandlers = cardEls.map((el, index) => {
    const handler = (event: MouseEvent) => {
      event.preventDefault();
      // The gesture that produced this click has already acted on it.
      if (swallowClick) {
        swallowClick = false;
        return;
      }
      if (!open) {
        openSelector(false);
        return;
      }
      commit(index);
    };
    el.addEventListener("click", handler);
    return handler;
  });

  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);
  window.addEventListener("blur", onBlur);
  root.addEventListener("pointerdown", onDragStart);

  document.documentElement.dataset.pageSelector = "closed";
  setReadout(cursor);
  render();
  root.dataset.ready = "true";

  return () => {
    window.removeEventListener("keydown", onKeyDown);
    window.removeEventListener("keyup", onKeyUp);
    window.removeEventListener("wheel", onWheel);
    window.removeEventListener("pointerdown", onPointerDown);
    window.removeEventListener("blur", onBlur);
    root.removeEventListener("pointerdown", onDragStart);
    endDrag();
    cardEls.forEach((el, index) => el.removeEventListener("click", cardHandlers[index]));
    if (frame) cancelAnimationFrame(frame);
    delete document.documentElement.dataset.pageSelector;
  };
}
