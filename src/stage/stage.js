/* ==========================================================================
   The stage: one fixed canvas behind the whole page.

   Every scene (the storm over the painting, the circuit board, the brain,
   the tree) draws into the same small render target, one texel per art
   pixel, and the dither pass turns that into gold pixel art on the canvas.
   CSS scales the canvas back up with hard edges. One canvas and one palette
   is what makes the page feel like a single world rather than a set of
   widgets.

   Layers are drawn in order. Each one says whether it's on screen and
   whether it's moving; when nothing is moving the stage stops drawing
   altogether, and it never draws while the tab is hidden.
   ========================================================================== */
import * as THREE from "three";
import { gsap, reduceMotion } from "../lib/motion.js";
import { createDitherPass } from "./dither.js";
import { pixelSize } from "./palette.js";

export function createStage() {
  const canvas = document.createElement("canvas");
  canvas.className = "stage";
  canvas.setAttribute("aria-hidden", "true");

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false, powerPreference: "high-performance" });
  } catch {
    return null;
  }
  if (!renderer.capabilities.isWebGL2) {
    renderer.dispose();
    return null;
  }
  document.body.prepend(canvas);
  renderer.setPixelRatio(1);
  renderer.autoClear = false;
  renderer.outputColorSpace = THREE.LinearSRGBColorSpace;   /* the shaders work in raw sRGB numbers */
  renderer.setClearColor(0x0a0806, 1);

  const target = new THREE.WebGLRenderTarget(1, 1, {
    minFilter: THREE.NearestFilter,
    magFilter: THREE.NearestFilter,
    depthBuffer: true,
  });
  const dither = createDitherPass();
  dither.material.uniforms.uScene.value = target.texture;

  const layers = [];
  const frame = { w: 1, h: 1, px: 3, t: 0, dt: 0, cssW: 1, cssH: 1 };
  let dirty = true;
  let paused = false;   /* a dev hook for holding a frame still to look at it */

  function resize() {
    const cssW = canvas.clientWidth || window.innerWidth;
    const cssH = canvas.clientHeight || window.innerHeight;
    const px = pixelSize();
    const w = Math.ceil(cssW / px), h = Math.ceil(cssH / px);
    if (w === frame.w && h === frame.h && px === frame.px) return;
    Object.assign(frame, { w, h, px, cssW, cssH });
    renderer.setSize(w, h, false);
    target.setSize(w, h);
    for (const l of layers) l.resize?.(frame);
    dirty = true;
  }
  new ResizeObserver(resize).observe(canvas);
  resize();

  function render(time, dt) {
    frame.t = time;
    frame.dt = dt;
    renderer.setRenderTarget(target);
    renderer.setScissorTest(false);
    renderer.setViewport(0, 0, frame.w, frame.h);
    renderer.clear(true, true, true);
    for (const l of layers) if (l.active()) l.draw(renderer, target, frame);
    renderer.setRenderTarget(null);
    renderer.setScissorTest(false);
    renderer.setViewport(0, 0, frame.w, frame.h);
    renderer.render(dither.scene, dither.camera);
  }

  /* under reduced motion the clock stands still: the stage only redraws when
     something asks it to (a scroll, a resize), so nothing drifts on its own */
  let clock = 0;
  gsap.ticker.add((time, deltaMs) => {
    const dt = Math.min(0.05, deltaMs / 1000);
    const moving = !reduceMotion && layers.some((l) => l.active() && l.animating());
    if (paused || (!moving && !dirty)) return;
    if (!reduceMotion) clock += dt;
    dirty = false;
    render(clock, dt);
  });

  return {
    canvas,
    renderer,
    frame,
    add(layer) {
      layers.push(layer);
      layer.resize?.(frame);
      dirty = true;
      return layer;
    },
    invalidate() { dirty = true; },
    set paused(v) { paused = v; },
  };
}
