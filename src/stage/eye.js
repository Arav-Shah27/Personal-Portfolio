/* ==========================================================================
   The roaming eye: the eye from the dark tower, loose on the page. A burning
   almond with a black slit, drawn pixel by pixel into its own small canvas
   with the stage's own ramp and 4x4 Bayer dither, on the stage's pixel grid,
   so it looks like part of the same world.

   It lives above the page rather than on the stage, so cards and panels
   can't hide it, and it's blended with "screen": the fire lights up what's
   under it and the black pupil lets it show through, so text beneath it
   stays readable.

   This file only draws it; src/eye.js decides where it perches, where it
   looks, and when it goes home to the tower.
   ========================================================================== */
import { RAMP, pixelSize } from "./palette.js";

/* the canvas is this many eye half-widths across and tall, leaving room for
   the flames round the edge */
const SPAN_X = 3.0, SPAN_Y = 2.2;
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
const RGB = RAMP.map((h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)));
const STEPS = RAMP.length - 1;

const fract = (v) => v - Math.floor(v);
const hash = (x, y) => fract(Math.sin(x * 127.1 + y * 311.7) * 43758.5453);
function noise(x, y) {
  const ix = Math.floor(x), iy = Math.floor(y);
  let fx = x - ix, fy = y - iy;
  fx = fx * fx * (3 - 2 * fx); fy = fy * fy * (3 - 2 * fy);
  const a = hash(ix, iy), b = hash(ix + 1, iy), c = hash(ix, iy + 1), d = hash(ix + 1, iy + 1);
  return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
}

/* brightness at a point of the eye (x -1..1 across it, y up), or -1 where
   there's nothing to draw */
function shade(qx, qy, t, open, heat, lx, ly) {
  const hh = 0.5 * open * Math.pow(Math.max(0, 1 - qx * qx), 0.95);
  const flick = noise(qx * 4, qy * 4 - t * 3);
  const edge = hh + (flick - 0.5) * 0.1 * open;
  if (Math.abs(qy) < edge && Math.abs(qx) < 1) {
    /* the slit, tapered top and bottom, turned toward you */
    const pdx = qx - lx * 0.5, pdy = qy + ly * 0.18;
    const slit = 0.13 * (1 - Math.min(1, Math.abs(pdy) / Math.max(hh, 0.001))) + 0.03;
    if (Math.abs(pdx) < slit && Math.abs(pdy) < hh * 0.92) return 0;
    /* fire, hottest round the pupil and darkening to the rim */
    const rp = Math.hypot(pdx * 1.3, pdy * 1.8), rc = Math.hypot(qx, qy * 1.7);
    return 0.5 + 0.34 * (1 - rp) + 0.2 * (1 - rc) + (flick - 0.5) * 0.3 + heat * 0.25;
  }
  /* flames licking off the rim */
  const d = Math.abs(qy) - edge;
  const n = noise(qx * 5 + 3, qy * 3 - t * 4);
  const reach = (0.14 + 0.36 * n) * (0.7 + heat) * open;
  if (d > reach || Math.abs(qx) > 1.2 - d) return -1;
  const L = (1 - d / Math.max(reach, 0.001)) * (0.4 + 0.55 * n);
  return L < 0.12 ? -1 : L;
}

export function createEye() {
  const canvas = document.createElement("canvas");
  canvas.className = "eye-sprite";
  canvas.setAttribute("aria-hidden", "true");
  document.body.append(canvas);
  const ctx = canvas.getContext("2d");
  let img = null, shown = false;

  /* everything in CSS pixels; src/eye.js writes these */
  /* sq squashes it (below 1) and stretches it (above 1) as it hops */
  const state = { x: -200, y: -200, w: 56, open: 0, blink: 1, sq: 1, heat: 0, hidden: false, look: { x: 0, y: 0 } };

  function render(t) {
    const o = state.open * state.blink;
    if (o < 0.02 || state.hidden) {
      if (shown) { canvas.style.visibility = "hidden"; shown = false; }
      return;
    }
    if (!shown) { canvas.style.visibility = "visible"; shown = true; }

    const px = pixelSize();
    const R = Math.max(4, (state.w / px / 2) * (1 + (1 - state.sq) * 0.35));
    const qw = 2 * Math.round((R * SPAN_X) / 2), qh = 2 * Math.round((R * SPAN_Y) / 2);
    if (canvas.width !== qw || canvas.height !== qh || !img) {
      canvas.width = qw; canvas.height = qh;
      img = ctx.createImageData(qw, qh);
    }
    canvas.style.width = `${qw * px}px`;
    canvas.style.height = `${qh * px}px`;
    /* snapped to the stage's pixel grid */
    const ax = Math.round(state.x / px) - qw / 2, ay = Math.round(state.y / px) - qh / 2;
    canvas.style.transform = `translate3d(${ax * px}px, ${ay * px}px, 0)`;

    const sx = qw / R, sy = qh / R, d = img.data;
    for (let j = 0; j < qh; j++) {
      const qy = (0.5 - (j + 0.5) / qh) * sy;
      for (let i = 0; i < qw; i++) {
        const k = (j * qw + i) * 4;
        const L = shade(((i + 0.5) / qw - 0.5) * sx, qy, t, o * state.sq, state.heat, state.look.x, state.look.y);
        if (L < 0) { d[k + 3] = 0; continue; }
        const b = (BAYER[((ax + i) & 3) + ((ay + j) & 3) * 4] + 0.5) / 16;
        const lv = Math.min(1, L) * STEPS;
        let s = Math.floor(lv);
        s = Math.min(STEPS, s + (lv - s >= b ? 1 : 0));
        const c = RGB[s];
        d[k] = c[0]; d[k + 1] = c[1]; d[k + 2] = c[2]; d[k + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
  }

  return { state, render, canvas };
}
