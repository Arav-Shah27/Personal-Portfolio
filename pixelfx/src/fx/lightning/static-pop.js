// A tiny static discharge for a click or tap. Arc inking from ./_lib.js (adapted from Sprite Fusion's open-source
// lightning, https://www.spritefusion.com/pixel-art-vfx/lightning, MIT License, Copyright (c) 2026 Hugo Duprez).
import { Particles, Lights, P, Rng, fit, clamp, TAU, sparkle } from "../../core/index.js";
import { zigzag, trace } from "./_lib.js";
import { STORM_GOLD } from "./sky-bolt.js";

export const meta = {
  name: "Static pop",
  desc: "A click-sized static discharge: a white pinpoint, three or four hair-thin arcs that snap out and re-crackle, a few sparks that jink away and a glint that winks out.",
  tags: ["lightning", "electric", "ui", "click", "hit", "small", "one-shot"],
  size: [72, 80],
  origin: [36, 36],
  duration: 0.6,
  loop: false,
  fps: 30,
  bg: "dark",
  options: { palette: STORM_GOLD, seed: 5, arcs: 4, reach: 18 },
};

export function create(o) {
  const C = fit(o.palette, 8), R = new Rng(o.seed), ps = new Particles({ rng: R, sparks: [C[7], C[6], C[5], C[3]] }), lights = new Lights();
  const n = Math.round(o.arcs), base = R.range(0, TAU);
  const dirs = Array.from({ length: n }, (_, i) => base + (i / n) * TAU + R.range(-0.35, 0.35));
  // three takes on the arcs: they re-crackle twice as they die
  const takes = [0, 1, 2].map((k) => {
    const r = new Rng(o.seed * 31 + k);
    return dirs.map((a, i) => {
      const L = o.reach * r.range(0.6, 1) * (1 - k * 0.22);
      return zigzag(r, Math.cos(a) * 2, Math.sin(a) * 2, Math.cos(a + r.range(-0.3, 0.3)) * L, Math.sin(a + r.range(-0.3, 0.3)) * L, 0.35, i === 0 ? 0.5 : 0.2);
    });
  });
  lights.add(0, 0, 18, C[5], 0.7, 0.25);
  for (let i = 0; i < 7; i++) {
    const a = R.range(0, TAU), sp = R.range(60, 150);
    ps.spawn(P.SPARK, 0, 0, Math.cos(a) * sp, Math.sin(a) * sp - 30, R.range(0.15, 0.35), C[6], 1, R.range(0, 0.06));
  }
  let t = 0;
  return {
    update(dt) {
      t += dt;
      ps.update(dt);
      lights.update(dt);
    },
    draw(p) {
      if (t >= meta.duration) return;
      // the pinpoint: white for two frames, then a glint that shrinks
      if (t < 0.07) {
        p.circle(0, 0, 1.6, C[7]);
        p.glow(0, 0, 9, C[6], 0.55);
      } else if (t < 0.32) sparkle(p, 0, 0, 5 * (1 - (t - 0.07) / 0.25), C[7], C[5]);
      // arcs: full, re-crackle, last flicker
      const k = t < 0.1 ? 1 - t * 2 : t < 0.2 ? 0.7 - (t - 0.1) * 2 : t < 0.3 ? 0.45 - (t - 0.2) * 2 : 0;
      const take = t < 0.1 ? 0 : t < 0.2 ? 1 : 2;
      if (k > 0.05 && Math.floor(t * 30) % 4 !== 3)
        for (const b of takes[take])
          b.paths.forEach((q, j) => {
            // hair-thin: a 1 px line, white on the trunk while hot, gold on forks and as it cools
            trace(p, q.pts, j === 0 ? (k > 0.5 ? C[7] : C[5]) : C[4], j === 0 ? 1 : clamp(k * 1.4));
            const e = q.pts[q.pts.length - 1];
            if (j === 0) (p.glowLine ? p.glowLine(q.pts[0][0], q.pts[0][1], e[0], e[1], 3, C[5], 0.35 * k) : p.glow(e[0], e[1], 4, C[5], 0.3 * k));
          });
      ps.draw(p);
      lights.draw(p);
    },
  };
}
