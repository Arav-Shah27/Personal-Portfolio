// A distant bolt for a sky backdrop. The bolt shape and inking come from ./_lib.js (adapted from Sprite Fusion's
// open-source lightning, https://www.spritefusion.com/pixel-art-vfx/lightning, MIT License, Copyright (c) 2026 Hugo Duprez).
import { Rng, fit, clamp, seg } from "../../core/index.js";
import { zigzag, stroke, crackle, trace } from "./_lib.js";

/** Warm storm gold, dark to bright: lightning that matches a gold-on-black page. */
export const STORM_GOLD = ["#140d04", "#3a2709", "#6e4b14", "#a87a2a", "#d9b45a", "#f0cf7a", "#fff3cf", "#ffffff"];

export const meta = {
  name: "Sky bolt",
  desc: "A distant bolt from the top of the sky: a faint leader feels its way down, the stroke cracks white, re-strikes twice and leaves a cooling afterimage.",
  tags: ["lightning", "electric", "weather", "sky", "ambient", "background", "one-shot"],
  size: [180, 200],
  origin: [90, 10],
  duration: 1.15,
  loop: false,
  fps: 30,
  bg: "dark",
  options: { palette: STORM_GOLD, seed: 7, length: 170, lean: 0.25, thickness: 1, aim: null },
};

// the beats: leader, return stroke, two re-strikes
const LEAD = 0.14, STRIKE = LEAD, RE1 = 0.3, RE2 = 0.5;
const PULSES = [
  [STRIKE, 1, 0.09],
  [RE1, 0.8, 0.07],
  [RE2, 0.55, 0.06],
];

/** How bright the sky is at time t (0..1): the host can flash its own backdrop in step. */
export function flash(t) {
  let k = 0;
  for (const [t0, a, d] of PULSES) if (t >= t0) k = Math.max(k, a * Math.exp(-(t - t0) / d));
  return t >= meta.duration ? 0 : clamp(k);
}

export function create(o) {
  const C = fit(o.palette, 8), R = new Rng(o.seed), L = o.length, s = o.thickness;
  // aim: where the bolt lands, in px across from its top (null: wherever it leans)
  const side = (R.chance(0.5) ? 1 : -1) * L * o.lean * R.range(0.4, 1);
  const ex = typeof o.aim === "number" ? o.aim : side;
  const main = zigzag(R, 0, 0, ex, L, 0.3, 0.9);
  // each re-strike takes the same channel but grows its own forks; the last one only reaches part way
  const re1 = zigzag(new Rng(o.seed + 11), 0, 0, ex, L, 0.3, 0.45);
  const alt = [main, { paths: [main.paths[0], ...re1.paths.slice(1, 3)] }, { paths: [main.paths[0]] }];
  const reach = [1, 1, 0.7];
  const pts = main.paths[0].pts;
  let t = 0;
  return {
    update(dt) {
      t += dt;
    },
    draw(p) {
      if (t >= meta.duration) return;
      // the stepped leader: a dim thread creeping down in jerks, with feelers
      if (t < STRIKE) {
        const u = Math.floor(seg(t, 0.02, LEAD) * 6) / 6;
        if (u > 0) {
          const n = Math.max(2, Math.ceil(pts.length * u));
          trace(p, pts, C[3], 0.85, 0, n);
          const [hx, hy] = pts[n - 1];
          p.px(hx, hy, C[6]);
          p.glow(hx, hy, 6, C[4], 0.35);
          for (const q of main.paths.slice(1)) if (q.pts[0][1] < hy) trace(p, q.pts, C[2], 0.6, 0, 3);
        }
        p.glow(0, -2, 26, C[4], 0.12 * u);
        return;
      }
      // strikes: white on the first frame of each, then the bolt dims and flickers
      let drawn = false;
      for (let i = PULSES.length - 1; i >= 0; i--) {
        const [t0, a] = PULSES[i], age = t - t0;
        if (age < 0 || age > 0.12) continue;
        const k = a * (age < 1 / 30 ? 1 : 0.85 - age * 4);
        if (k <= 0.05) continue;
        stroke(p, alt[i], k, C, s, { hero: age < 1 / 30 && i === 0, light: 0.55 * a, upTo: reach[i] });
        drawn = true;
        break;
      }
      // between strikes and after the last: the channel's afterimage, flickering, then cooling
      if (!drawn) {
        const after = clamp(1 - (t - RE2 - 0.1) / 0.45);
        const flick = (Math.floor(t * 30) * 7919) % 5 === 0 ? 0.4 : 1;
        if (after > 0) {
          const c = after > 0.66 ? C[5] : after > 0.33 ? C[4] : C[3];
          trace(p, pts, c, Math.min(1, after * 1.2) * flick);
          if (after > 0.5) crackle(p, { paths: main.paths.slice(1, 3) }, (after - 0.5) * 0.8, C, 0.25, flick);
          for (let i = 0; i < pts.length; i += 6) p.glow(pts[i][0], pts[i][1], 8, C[4], 0.12 * after * flick);
        }
      }
      // the cloud base lit from inside, at the top of the channel
      const f = flash(t);
      if (f > 0.02) {
        p.glow(0, 0, 40, C[4], 0.35 * f);
        p.glow(ex * 0.15, 2, 18, C[6], 0.3 * f);
      }
    },
  };
}
