/* ==========================================================================
   Die windows: a tiny pixel animation inside each project chip, showing
   what the project actually does. Drawn as brightness into a small buffer,
   then dithered into the same storm-gold ramp as the stage, so they look
   like part of the same world.

     hb     HomeBeacon: a beacon pinging, and the heartbeat it watches
     socet  the matrix accelerator: data flowing through a systolic array
     mfs    Midtown Family Services: a hub reaching out to its volunteers
     sf     ShowFlow: an ultrasonic sensor pinging a moving water line
   ========================================================================== */
import { reduceMotion } from "./lib/motion.js";
import { RAMP } from "./stage/palette.js";

const PX = 3;
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16);
const RGB = RAMP.map((h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)));
const TAU = Math.PI * 2;
const fract = (x) => x - Math.floor(x);

function painter(buf, w, h) {
  const set = (x, y, v) => {
    x |= 0; y |= 0;
    if (x < 0 || y < 0 || x >= w || y >= h) return;
    const i = y * w + x;
    if (v > buf[i]) buf[i] = v;
  };
  return {
    set,
    line(x0, y0, x1, y1, v) {
      x0 |= 0; y0 |= 0; x1 |= 0; y1 |= 0;
      const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
      let err = dx + dy;
      for (;;) {
        set(x0, y0, v);
        if (x0 === x1 && y0 === y1) break;
        const e2 = 2 * err;
        if (e2 >= dy) { err += dy; x0 += sx; }
        if (e2 <= dx) { err += dx; y0 += sy; }
      }
    },
    ring(cx, cy, r, v) {
      const n = Math.max(12, (r * 7) | 0);
      for (let i = 0; i < n; i++) set(cx + Math.cos((i / n) * TAU) * r, cy + Math.sin((i / n) * TAU) * r, v);
    },
    rect(x, y, rw, rh, v) {
      for (let j = 0; j < rh; j++) for (let i = 0; i < rw; i++) set(x + i, y + j, v);
    },
    glow(cx, cy, r, v) {
      for (let y = Math.floor(cy - r); y <= cy + r; y++)
        for (let x = Math.floor(cx - r); x <= cx + r; x++) {
          const d = Math.hypot(x - cx, y - cy) / r;
          if (d < 1) set(x, y, v * (1 - d) * (1 - d));
        }
    },
  };
}

const SCENES = {
  /* a beacon on a little house, pinging, over the heartbeat it reports */
  hb(p, w, h, t) {
    const bx = Math.round(w * 0.24), by = Math.round(h * 0.42);
    /* the house */
    p.line(bx - 9, by + 6, bx, by - 2, 0.55); p.line(bx, by - 2, bx + 9, by + 6, 0.55);
    p.line(bx - 7, by + 5, bx - 7, by + 15, 0.45); p.line(bx + 7, by + 5, bx + 7, by + 15, 0.45);
    p.line(bx - 7, by + 15, bx + 7, by + 15, 0.45);
    p.rect(bx - 1, by + 10, 3, 5, 0.35);
    /* the beacon and its rings */
    const beat = fract(t * 0.9);
    p.glow(bx, by - 5, 4, 0.7 + 0.3 * (1 - beat));
    for (let k = 0; k < 3; k++) {
      const f = fract(t * 0.45 + k / 3);
      p.ring(bx, by - 5, 3 + f * 26, (1 - f) * 0.75);
    }
    /* the heartbeat, scrolling: every fourth beat is missed, and the alert
       climbs while it waits */
    const y0 = Math.round(h * 0.6), x0 = Math.round(w * 0.46), x1 = w - 6;
    let prev = null;
    for (let x = x0; x <= x1; x++) {
      const u = (x - x0) / 14 + t * 2.2;
      const k = Math.floor(u / 4), ph = fract(u / 4) * 4;
      const missed = k % 4 === 3;
      let y = y0;
      if (!missed && ph > 1.6 && ph < 2.4) {
        const q = (ph - 1.6) / 0.8;
        y = y0 - Math.round(Math.sin(q * Math.PI) * 9 * (q < 0.5 ? 1 : -0.45));
      }
      const v = 0.25 + 0.55 * ((x - x0) / (x1 - x0));
      if (prev) p.line(x - 1, prev, x, y, v); else p.set(x, y, v);
      prev = y;
    }
    const alarm = Math.floor(t * 0.55) % 3;
    for (let i = 0; i < 3; i++) p.rect(x1 - 22 + i * 8, 7, 5, 3, i <= alarm ? 0.35 + i * 0.25 : 0.12);
  },

  /* a systolic array: operands march in from the left and the top, and each
     cell flashes as the two meet and it multiplies */
  socet(p, w, h, t) {
    const rows = 3, gap = 4;
    const cell = Math.max(5, Math.floor((h - 12 - (rows - 1) * gap) / rows));
    const cols = Math.min(8, Math.floor((w - 60) / (cell + gap)));
    const gw = cols * cell + (cols - 1) * gap, gh = rows * cell + (rows - 1) * gap;
    const ox = Math.round((w - gw) / 2) + 6, oy = Math.round((h - gh) / 2) + 2;
    for (let j = 0; j < rows; j++)
      for (let i = 0; i < cols; i++) {
        const x = ox + i * (cell + gap), y = oy + j * (cell + gap);
        const wave = fract(t * 0.55 - (i + j) * 0.075);
        const hit = Math.pow(1 - wave, 6);
        const m = cell >> 1;
        p.rect(x, y, cell, cell, 0.1 + hit * 0.85);
        p.line(x, y, x + cell - 1, y, 0.3); p.line(x, y, x, y + cell - 1, 0.3);
        if (i < cols - 1) p.line(x + cell, y + m, x + cell + gap - 1, y + m, 0.18);
        if (j < rows - 1) p.line(x + m, y + cell, x + m, y + cell + gap - 1, 0.18);
      }
    /* the operand streams feeding in */
    for (let j = 0; j < rows; j++) {
      const y = oy + j * (cell + gap) + (cell >> 1);
      for (let s = 0; s < 3; s++) {
        const f = fract(t * 0.55 - j * 0.075 + s / 3);
        p.rect(ox - 26 + Math.round(f * 20), y - 1, 2, 2, 0.6 * f);
      }
    }
    for (let i = 0; i < cols; i++) {
      const x = ox + i * (cell + gap) + (cell >> 1);
      const f = fract(t * 0.55 - i * 0.075);
      p.rect(x - 1, oy - 9 + Math.round(f * 6), 2, 2, 0.6 * f);
    }
  },

  /* a hub reaching out to everyone around it, one after another */
  mfs(p, w, h, t) {
    const cx = w / 2, cy = h / 2 + 1, n = 9;
    p.glow(cx, cy, 6, 0.9);
    p.ring(cx, cy, 4, 0.7);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU + t * 0.08;
      const rx = w * 0.36, ry = h * 0.34;
      const x = cx + Math.cos(a) * rx, y = cy + Math.sin(a) * ry;
      const f = fract(t * 0.32 - i / n);
      const reached = f < 0.35 ? f / 0.35 : 1;
      p.line(cx, cy, x, y, 0.12);
      if (f < 0.35) {                                /* a pulse on its way out */
        p.glow(cx + (x - cx) * reached, cy + (y - cy) * reached, 2.2, 0.85);
      }
      const lit = f < 0.35 ? 0 : Math.max(0, 1 - (f - 0.35) * 1.6);
      p.ring(x, y, 2.5, 0.35 + lit * 0.6);
      if (lit > 0) p.glow(x, y, 4, lit * 0.6);
    }
  },
};

export function startDies() {
  const items = [...document.querySelectorAll(".chip-die canvas")].map((canvas) => {
    const scene = SCENES[canvas.dataset.die];
    if (!scene) return null;
    const card = canvas.closest(".project");
    const it = { canvas, scene, ctx: canvas.getContext("2d"), t: 1.5 + Math.random() * 3, w: 0, h: 0, buf: null, img: null, on: false, hot: 0, hover: false };
    card?.addEventListener("pointerenter", () => { it.hover = true; });
    card?.addEventListener("pointerleave", () => { it.hover = false; });
    return it;
  }).filter(Boolean);
  if (!items.length) return;

  const size = (it) => {
    const r = it.canvas.getBoundingClientRect();
    const w = Math.max(1, Math.round(r.width / PX)), h = Math.max(1, Math.round(r.height / PX));
    if (w === it.w && h === it.h) return;
    it.w = w; it.h = h;
    it.canvas.width = w; it.canvas.height = h;
    it.buf = new Float32Array(w * h);
    it.img = it.ctx.createImageData(w, h);
  };

  const draw = (it) => {
    const { w, h, buf, img } = it;
    buf.fill(0);
    it.scene(painter(buf, w, h), w, h, it.t);
    const lift = it.hot * 0.12, steps = RGB.length - 1, d = img.data;
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const i = y * w + x;
        const L = Math.min(1, buf[i] * (1 + it.hot * 0.35) + (buf[i] > 0 ? lift : 0)) * steps;
        let s = Math.floor(L);
        if (L - s > BAYER[(y & 3) * 4 + (x & 3)]) s++;
        const c = RGB[Math.min(steps, s)], j = i * 4;
        d[j] = c[0]; d[j + 1] = c[1]; d[j + 2] = c[2]; d[j + 3] = 255;
      }
    it.ctx.putImageData(img, 0, 0);
  };

  items.forEach((it) => { size(it); draw(it); });
  window.addEventListener("resize", () => items.forEach((it) => { size(it); draw(it); }));
  if (reduceMotion) return;

  const io = new IntersectionObserver((entries) => {
    for (const e of entries) {
      const it = items.find((i) => i.canvas === e.target);
      if (it) it.on = e.isIntersecting;
    }
    if (items.some((i) => i.on) && !raf) raf = requestAnimationFrame(loop);
  }, { rootMargin: "80px 0px" });
  items.forEach((it) => io.observe(it.canvas));

  /* 30 frames a second is plenty for pixel art, and half the work */
  let raf = 0, last = 0, acc = 0;
  function loop(now) {
    raf = 0;
    const dt = last ? Math.min(0.1, (now - last) / 1000) : 0;
    last = now;
    acc += dt;
    if (acc >= 1 / 30) {
      for (const it of items) {
        if (!it.on) continue;
        it.hot += ((it.hover ? 1 : 0) - it.hot) * Math.min(1, acc * 6);
        it.t += acc * (1 + it.hot * 0.8);
        draw(it);
      }
      acc = 0;
    }
    if (items.some((i) => i.on)) raf = requestAnimationFrame(loop);
    else last = 0;
  }
}
