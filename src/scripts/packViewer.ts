import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";

/**
 * Vanilla-three.js port of the objekt-tcg pack-opening scene. The original is
 * React Three Fiber; this site has no React, so the same scene graph is built
 * by hand and driven by one rAF loop.
 *
 * The model is scrubbed rather than played: dragging (or the range slider)
 * sets a normalised progress, which is mapped onto the GLB's single animation
 * clip. See setProgress() for why the mixer is poked the way it is.
 */

/** Normalised pack height in world units after auto-fit, so a differently
    scaled GLB still renders at the same size. */
const TARGET_HEIGHT = 2;
/** Resting pitch. Yaw has no resting value: the pack turns all the way round. */
const BASE_PITCH = 0.15;

/** Where the app clamps the pack to a +/-10 degree tilt, this spins it freely -
    a full drag across the canvas is one complete revolution. */
const DRAG_RADIANS_PER_WIDTH = Math.PI * 2;
/** Pitch stays clamped: past this the pack reads as tumbling, not turning. */
const MAX_PITCH_RADIANS = (55 * Math.PI) / 180;
/** Per-second share of a flick's spin that survives, so a fast drag keeps
    turning after release and coasts to a stop. */
const SPIN_DECAY_PER_SECOND = 0.06;
/** Below this the coast is over and the idle drift is allowed back in. */
const SPIN_REST_THRESHOLD = 0.05;
/** A hard flick can otherwise hand off tens of radians per second and spin the
    pack for several revolutions before it settles. Two turns a second is still
    a throw, but stays readable. */
const MAX_SPIN_RADIANS_PER_SECOND = Math.PI * 4;

/** Idle drift, active only while nobody is dragging. */
const IDLE_SPIN_RADIANS_PER_SECOND = (18 * Math.PI) / 180;
const IDLE_FADE_SMOOTHING = 0.08;
/** How fast pitch eases back to rest once the pointer lets go. */
const PITCH_RETURN_SMOOTHING = 0.02;

/** Material presets lifted from the project's PACK_VARIANT_PRESETS. FOIL is
    the pack shell. LABEL is the flat plane embedded in the pack's front face:
    the app covers it with generated sticker art, and with no stickers here its
    untextured black material renders as a hole in the pack - so it gets the
    "black" variant instead, which at least reads as a matte pack front. */
const FOIL = {
  color: "#dde3ea",
  metalness: 1,
  roughness: 0.16,
  envMapIntensity: 1.6,
};
const LABEL = {
  color: "#16161a",
  metalness: 0.85,
  roughness: 0.32,
  envMapIntensity: 1.1,
};

/**
 * The source GLB ships no texture maps at all: a high-metalness shell (the
 * foil body) and a low-metalness plane (a label surface). Neither is named
 * usefully, so trust a name hint first and otherwise treat an already-metallic
 * mesh as the shell.
 */
function isLikelyFoilMesh(mesh: THREE.Mesh): boolean {
  if (/pack|foil|body|shell|cube/i.test(mesh.name)) return true;
  const material = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
  return material instanceof THREE.MeshStandardMaterial ? material.metalness >= 0.4 : false;
}

function selectAnimationClip(animations: THREE.AnimationClip[]): THREE.AnimationClip | null {
  if (animations.length === 0) return null;
  return animations.find((clip) => /(Action|Open|Pack)/i.test(clip.name)) ?? animations[0] ?? null;
}

/**
 * Studio reflections without a network request. The R3F original renders
 * drei <Lightformer> panels into an <Environment>; this builds the same four
 * emissive panels in a throwaway scene and bakes them with PMREM. An HDR
 * preset would be a cold fetch from a CDN, which is the one thing a 50 KB
 * model is trying to avoid.
 */
function buildEnvironment(renderer: THREE.WebGLRenderer): THREE.Texture {
  const panels: Array<{
    intensity: number;
    position: [number, number, number];
    scale: [number, number];
    color: string;
  }> = [
    { intensity: 2, position: [0, 3, 2], scale: [6, 6], color: "#ffffff" },
    { intensity: 1, position: [-4, 1, 3], scale: [4, 4], color: "#dce8ff" },
    { intensity: 1, position: [4, -1, 3], scale: [4, 4], color: "#ffe9d6" },
    { intensity: 0.6, position: [0, -3, -2], scale: [8, 8], color: "#ffffff" },
    // Not in the R3F original's rig. The pack's front face is flat metal, so
    // it mirrors whatever sits behind the camera - which in the app is hidden
    // under sticker art, and here would be empty space reading as a black
    // hole. This panel is what that face reflects.
    { intensity: 0.62, position: [0, 0, 8], scale: [16, 16], color: "#dfe6f0" },
    { intensity: 1.6, position: [2.5, 2.5, 5.5], scale: [5, 5], color: "#ffffff" },
    // Same again behind the pack, since it now turns all the way round and the
    // rear face is just as flat and just as mirror-like. Kept dimmer than the
    // front so the back still reads as the back.
    { intensity: 0.4, position: [0, 0, -8], scale: [16, 16], color: "#c9d2e0" },
    { intensity: 1, position: [-2.5, 2, -5.5], scale: [5, 5], color: "#eaf0f8" },
  ];

  const envScene = new THREE.Scene();
  const geometry = new THREE.PlaneGeometry(1, 1);

  for (const panel of panels) {
    const material = new THREE.MeshBasicMaterial({
      color: new THREE.Color(panel.color).multiplyScalar(panel.intensity),
      side: THREE.DoubleSide,
      toneMapped: false,
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(...panel.position);
    mesh.scale.set(panel.scale[0], panel.scale[1], 1);
    mesh.lookAt(0, 0, 0);
    envScene.add(mesh);
  }

  const pmrem = new THREE.PMREMGenerator(renderer);
  const target = pmrem.fromScene(envScene, 0, 0.1, 100);

  pmrem.dispose();
  geometry.dispose();
  for (const child of envScene.children) {
    if (child instanceof THREE.Mesh) (child.material as THREE.Material).dispose();
  }

  return target.texture;
}

export type PackViewer = { dispose: () => void };

export async function createPackViewer({
  canvas,
  modelUrl,
  progressInput,
  reducedMotion,
  onLoad,
}: {
  canvas: HTMLCanvasElement;
  modelUrl: string;
  /** Drives progress from keyboard/touch, and is kept in sync by dragging. */
  progressInput: HTMLInputElement;
  reducedMotion: boolean;
  onLoad: () => void;
}): Promise<PackViewer> {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;

  const scene = new THREE.Scene();
  scene.environment = buildEnvironment(renderer);

  const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
  camera.position.set(0, 0, 5);

  scene.add(new THREE.AmbientLight(0xffffff, 0.7));
  const keyLight = new THREE.DirectionalLight(0xffffff, 1.4);
  keyLight.position.set(3, 4, 5);
  const fillLight = new THREE.DirectionalLight(0xffffff, 0.45);
  fillLight.position.set(-3, -2, -4);
  scene.add(keyLight, fillLight);

  // The spin group is what the pointer turns; the fitted pack hangs under it,
  // recentred on its own bounding box so rotation happens about the pack's
  // middle rather than the GLB's arbitrary origin.
  const spinGroup = new THREE.Group();
  spinGroup.rotation.set(BASE_PITCH, 0, 0);
  spinGroup.scale.setScalar(1.05);
  scene.add(spinGroup);

  const loader = new GLTFLoader();
  loader.setMeshoptDecoder(MeshoptDecoder);
  const gltf = await loader.loadAsync(modelUrl);

  const root = gltf.scene;
  root.updateMatrixWorld(true);

  const box = new THREE.Box3().setFromObject(root);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());

  const fitGroup = new THREE.Group();
  fitGroup.scale.setScalar(TARGET_HEIGHT / (size.y || 1));
  const centerGroup = new THREE.Group();
  centerGroup.position.set(-center.x, -center.y, -center.z);
  centerGroup.add(root);
  fitGroup.add(centerGroup);
  spinGroup.add(fitGroup);

  root.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) return;
    const preset = isLikelyFoilMesh(child) ? FOIL : LABEL;
    const materials = Array.isArray(child.material) ? child.material : [child.material];
    for (const material of materials) {
      if (!(material instanceof THREE.MeshStandardMaterial)) continue;
      material.color = new THREE.Color(preset.color);
      material.metalness = preset.metalness;
      material.roughness = preset.roughness;
      material.envMapIntensity = preset.envMapIntensity;
    }
  });

  const clip = selectAnimationClip(gltf.animations);
  const mixer = clip ? new THREE.AnimationMixer(root) : null;
  const action = clip && mixer ? mixer.clipAction(clip) : null;

  if (action) {
    action.enabled = true;
    action.clampWhenFinished = true;
    action.setLoop(THREE.LoopOnce, 1);
    // Activate the action once, then keep it paused so progress owns time.
    action.play();
    action.paused = true;
  }

  function setProgress(progress: number) {
    if (!clip || !mixer || !action) return;
    // mixer.setTime() resets action.time to 0 and re-advances it by delta, but
    // AnimationAction forces effective timeScale to 0 while paused - so the
    // advance is always a no-op and the head stays at 0. Setting action.time
    // directly bypasses that.
    action.paused = true;
    action.enabled = true;
    action.time = THREE.MathUtils.clamp(progress, 0, 1) * clip.duration;
    mixer.update(0);
    root.updateMatrixWorld(true);
  }

  setProgress(Number(progressInput.value));

  // --- pointer state -------------------------------------------------------

  /** Unbounded: the pack is never wound back to a "front". */
  let yaw = 0;
  let pitch = BASE_PITCH;
  /** Radians per second carried over from the last drag sample. */
  let spinVelocity = 0;
  let idleWeight = 0;
  let dragPointerId: number | null = null;
  let lastDragX = 0;
  let lastDragY = 0;
  let lastDragTime = 0;

  const onPointerDown = (event: PointerEvent) => {
    dragPointerId = event.pointerId;
    lastDragX = event.clientX;
    lastDragY = event.clientY;
    lastDragTime = event.timeStamp;
    spinVelocity = 0;
    idleWeight = 0;
    canvas.setPointerCapture(event.pointerId);
  };

  const onPointerMove = (event: PointerEvent) => {
    if (dragPointerId !== event.pointerId) return;

    const rect = canvas.getBoundingClientRect();
    const deltaYaw = ((event.clientX - lastDragX) / rect.width) * DRAG_RADIANS_PER_WIDTH;
    const deltaPitch = ((event.clientY - lastDragY) / rect.height) * DRAG_RADIANS_PER_WIDTH;

    yaw += deltaYaw;
    pitch = THREE.MathUtils.clamp(pitch + deltaPitch, -MAX_PITCH_RADIANS, MAX_PITCH_RADIANS);

    // Sampled per event rather than per frame: pointermove can outpace rAF,
    // and the throw should reflect the last flick, not an average of the drag.
    const elapsed = (event.timeStamp - lastDragTime) / 1000;
    if (elapsed > 0) {
      spinVelocity = THREE.MathUtils.clamp(
        deltaYaw / elapsed,
        -MAX_SPIN_RADIANS_PER_SECOND,
        MAX_SPIN_RADIANS_PER_SECOND,
      );
    }

    lastDragX = event.clientX;
    lastDragY = event.clientY;
    lastDragTime = event.timeStamp;
  };

  const endDrag = (event: PointerEvent) => {
    if (dragPointerId !== event.pointerId) return;
    dragPointerId = null;
    if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
  };

  const onInput = () => setProgress(Number(progressInput.value));

  canvas.addEventListener("pointerdown", onPointerDown);
  canvas.addEventListener("pointermove", onPointerMove);
  canvas.addEventListener("pointerup", endDrag);
  canvas.addEventListener("pointercancel", endDrag);
  progressInput.addEventListener("input", onInput);

  // --- sizing --------------------------------------------------------------

  function resize() {
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    if (width === 0 || height === 0) return;
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  }

  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(canvas);
  resize();

  // --- loop ----------------------------------------------------------------

  let frame = 0;
  let lastTime = 0;
  let revealed = false;

  function tick(now: number) {
    frame = requestAnimationFrame(tick);
    // Clamped so a backgrounded tab doesn't resume with one enormous step
    // through the idle sweep.
    const delta = lastTime === 0 ? 0 : Math.min((now - lastTime) / 1000, 0.1);
    lastTime = now;

    if (dragPointerId === null) {
      // Frame-rate independent decay, so a 144Hz screen coasts for as long as
      // a 60Hz one rather than stopping more than twice as fast.
      spinVelocity *= SPIN_DECAY_PER_SECOND ** delta;
      if (Math.abs(spinVelocity) < SPIN_REST_THRESHOLD) spinVelocity = 0;
      yaw += spinVelocity * delta;

      // The idle drift only fades in once the throw has died out, otherwise it
      // fights a flick thrown the other way.
      const wantsIdle = !reducedMotion && spinVelocity === 0;
      idleWeight = THREE.MathUtils.lerp(idleWeight, wantsIdle ? 1 : 0, IDLE_FADE_SMOOTHING);
      yaw += IDLE_SPIN_RADIANS_PER_SECOND * idleWeight * delta;

      pitch = THREE.MathUtils.lerp(pitch, BASE_PITCH, PITCH_RETURN_SMOOTHING);
    }

    spinGroup.rotation.x = pitch;
    spinGroup.rotation.y = yaw;

    renderer.render(scene, camera);

    // Reveal only once there is something on the canvas, so the poster never
    // cross-fades into an empty frame.
    if (lastTime !== 0 && !revealed) {
      revealed = true;
      onLoad();
    }
  }

  frame = requestAnimationFrame(tick);

  return {
    dispose() {
      cancelAnimationFrame(frame);
      resizeObserver.disconnect();
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("pointerup", endDrag);
      canvas.removeEventListener("pointercancel", endDrag);
      progressInput.removeEventListener("input", onInput);

      mixer?.stopAllAction();
      if (mixer) mixer.uncacheRoot(root);
      scene.environment?.dispose();
      root.traverse((child) => {
        if (!(child instanceof THREE.Mesh)) return;
        child.geometry.dispose();
        const materials = Array.isArray(child.material) ? child.material : [child.material];
        for (const material of materials) material.dispose();
      });
      // Frees the WebGL context outright. Without this, every garage-door
      // navigation away from this page leaks one, and browsers cap the number
      // of live contexts per document.
      renderer.dispose();
      renderer.forceContextLoss();
    },
  };
}
