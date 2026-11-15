/* ==========================================================================
   Current in the type.

   1. The name is written in lightning. When the page opens a bolt comes
      down onto the first letter, and the current runs through the name
      letter by letter: a white-hot front sweeps through each stroke, leaves
      the outline glowing, then jumps across to the next letter. As each
      letter is finished it flashes and the real one is there underneath.
      The bolt, the jumps and the sparks are random, so no two visits write
      it the same way.

   2. Click a title and lightning hits it. The letters burst into gold
      pixels from where it struck, hang in the air, then fly back and snap
      into place.

   Both work from the letters themselves: every glyph is rasterised onto the
   stage's pixel grid (one cell per art pixel), so what flies apart is the
   title's real shape in the stage's own pixels and palette. It's drawn on
   one viewport-sized pixel canvas above the page that only exists while
   something is happening. Nothing here runs under reduced motion.
   ========================================================================== */
import { gsap, reduceMotion } from "./lib/motion.js";
import { createFrame, clearFrame, composite, painterFor, createFx, hex, Rng } from "../pixelfx/src/core/index.js";
import * as skyBolt from "../pixelfx/src/fx/lightning/sky-bolt.js";
import { zigzag, crackle } from "../pixelfx/src/fx/lightning/_lib.js";
import { pixelSize } from "./stage/palette.js";

/* the storm-gold ramp, dark to white-hot */
const C = skyBolt.STORM_GOLD.map(hex);
const TITLES = ".hero-name, .section-title, .entry-title, .project-title";
const seed = () => (Math.random() * 1e9) | 0;
const ease = (k) => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2);

/* ---- the letters, as cells on the art-pixel grid ------------------------ */
const scratch = document.createElement("canvas");
const sctx = scratch.getContext("2d", { willReadFrequently: true });
const range = document.createRange();

/* every visible character of an element, each as the art-pixel cells its
   glyph covers right now (in viewport art pixels), plus the element that
   holds it (a split-letter span, when there is one) */
function glyphs(el, px) {
  const out = [];
  const walk = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  for (let node; (node = walk.nextNode()); ) {
    const holder = node.parentElement;
    const cs = getComputedStyle(holder);
    const font = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
    const pad = Math.ceil(parseFloat(cs.fontSize) * 0.25);
    for (let i = 0; i < node.length; i++) {
      const ch = node.data[i];
      if (/\s/.test(ch)) continue;
      range.setStart(node, i);
      range.setEnd(node, i + 1);
      const r = range.getBoundingClientRect();
      if (r.width < 1 || r.bottom < 0 || r.top > innerHeight) continue;
      /* draw the glyph where the page has it, in a small canvas lined up
         with the art grid, then read one sample per cell */
      sctx.font = font;
      const m = sctx.measureText(ch);
      const asc = m.fontBoundingBoxAscent, desc = m.fontBoundingBoxDescent;
      const base = r.top + (r.height - (asc + desc)) / 2 + asc;
      const gx0 = Math.floor((r.left - pad) / px), gy0 = Math.floor((r.top - pad) / px);
      const gw = Math.ceil((r.width + pad * 2) / px) + 1, gh = Math.ceil((r.height + pad * 2) / px) + 1;
      const W = gw * px, H = gh * px;
      if (scratch.width < W) scratch.width = W;
      if (scratch.height < H) scratch.height = H;
      sctx.clearRect(0, 0, scratch.width, scratch.height);
      sctx.font = font;
      sctx.textBaseline = "alphabetic";
      sctx.fillStyle = "#fff";
      sctx.fillText(ch, r.left - gx0 * px, base - gy0 * px);
      const data = sctx.getImageData(0, 0, W, H).data;
      const xs = [], ys = [];
      const h = px >> 1;
      for (let cy = 0; cy < gh; cy++)
        for (let cx = 0; cx < gw; cx++)
          if (data[((cy * px + h) * W + cx * px + h) * 4 + 3] > 110) { xs.push(gx0 + cx); ys.push(gy0 + cy); }
      if (xs.length) out.push({ xs: Int32Array.from(xs), ys: Int32Array.from(ys), n: xs.length, holder });
    }
  }
  return out;
}

/* how far the current has to run to reach each cell of a letter, entering
   at its top: a walk through the strokes, so it follows the letter's shape */
function wire(g) {
  const { xs, ys, n } = g;
  const key = (x, y) => x * 65536 + y;
  const at = new Map();
  for (let i = 0; i < n; i++) at.set(key(xs[i], ys[i]), i);
  let entry = 0;
  for (let i = 1; i < n; i++) if (ys[i] < ys[entry] || (ys[i] === ys[entry] && xs[i] < xs[entry])) entry = i;
  const dist = new Float32Array(n).fill(-1), edge = new Uint8Array(n);
  for (let i = 0; i < n; i++)
    edge[i] = at.has(key(xs[i] + 1, ys[i])) && at.has(key(xs[i] - 1, ys[i])) && at.has(key(xs[i], ys[i] + 1)) && at.has(key(xs[i], ys[i] - 1)) ? 0 : 1;
  const queue = [entry];
  dist[entry] = 0;
  const spread = () => {
    for (let q = 0; q < queue.length; q++) {
      const i = queue[q];
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++) {
          const j = at.get(key(xs[i] + dx, ys[i] + dy));
          if (j === undefined || dist[j] >= 0) continue;
          dist[j] = dist[i] + (dx && dy ? 1.41 : 1);
          queue.push(j);
        }
    }
  };
  spread();
  /* a dot or a separate stroke: the current jumps the gap to it */
  for (;;) {
    let best = -1, bestD = Infinity, from = 0;
    for (let i = 0; i < n; i++) {
      if (dist[i] >= 0) continue;
      for (let j = 0; j < n; j += 3) {
        if (dist[j] < 0) continue;
        const d = Math.hypot(xs[i] - xs[j], ys[i] - ys[j]);
        if (d < bestD) { bestD = d; best = i; from = j; }
      }
    }
    if (best < 0) break;
    dist[best] = dist[from] + bestD;
    queue.length = 0;
    queue.push(best);
    spread();
  }
  let far = 0;
  for (let i = 0; i < n; i++) if (dist[i] > dist[far]) far = i;
  return { ...g, dist, edge, entry, far, maxD: dist[far] || 1 };
}

export function startZap() {
  if (reduceMotion) return null;
  const root = document.documentElement;
  root.classList.add("has-zap");

  const canvas = document.createElement("canvas");
  canvas.className = "zap-layer";
  canvas.setAttribute("aria-hidden", "true");
  document.body.append(canvas);
  const ctx = canvas.getContext("2d");
  let frame = null, img = null, px = 3;
  const jobs = new Set();
  let running = false;
  const api = { storm: null, write, shatter };

  function size() {
    px = pixelSize();
    const w = Math.ceil(innerWidth / px), h = Math.ceil(innerHeight / px);
    if (!frame || frame.w !== w || frame.h !== h) {
      frame = createFrame(w, h);
      img = ctx.createImageData(w, h);
      canvas.width = w;
      canvas.height = h;
    }
    canvas.style.width = `${w * px}px`;
    canvas.style.height = `${h * px}px`;
  }

  function tick(time, deltaMs) {
    const dt = api.hold ? 0 : Math.min(0.05, deltaMs / 1000);   /* hold: a dev hook to freeze a frame */
    clearFrame(frame);
    const p = painterFor(frame);
    p.place(0, 0);
    for (const job of jobs) if (job.step(dt, p) === false) jobs.delete(job);
    composite(frame, img.data, null);
    ctx.putImageData(img, 0, 0);
    if (!jobs.size) stop();
  }
  function run(job) {
    if (!running) {
      size();
      canvas.style.visibility = "visible";
      gsap.ticker.add(tick);
      running = true;
    }
    jobs.add(job);
  }
  function stop() {
    gsap.ticker.remove(tick);
    running = false;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    canvas.style.visibility = "hidden";
  }
  window.addEventListener("resize", () => { if (running) size(); });

  /* letters follow their element if the page moves under them */
  const tracker = (el) => {
    const r0 = el.getBoundingClientRect();
    return () => {
      const r = el.getBoundingClientRect();
      return [Math.round((r.left - r0.left) / px), Math.round((r.top - r0.top) / px)];
    };
  };

  /* a quick arc of current from one point to another */
  function arc(p, x0, y0, x1, y1, k, R) {
    crackle(p, zigzag(R, x0, y0, x1, y1, 0.28, 0.25), k, C, 0.45);
  }

  /* ---- 1. writing a name in lightning --------------------------------- */
  /* chars: the letter spans; they're hidden at once and handed back one by
     one as the current finishes each. Resolves when it's all written. */
  function write(el, chars, delay = 0) {
    chars.forEach((c) => c.classList.add("zap-hide"));
    const showAll = () => chars.forEach((c) => c.classList.remove("zap-hide"));
    const safety = setTimeout(showAll, (delay + 5) * 1000);

    return new Promise((resolve) => gsap.delayedCall(delay, () => {
      size();
      const letters = glyphs(el, px).map(wire);
      if (!letters.length) { clearTimeout(safety); showAll(); return resolve(); }

      /* the bolt comes down onto the top of the first letter */
      const first = letters[0];
      const hitX = first.xs[first.entry], hitY = first.ys[first.entry];
      const world = api.storm?.world;
      const stagePx = api.storm?.stage.frame.px ?? px;
      let bolt = null;
      if (world) world.strike((hitX * px) / stagePx, (hitY * px) / stagePx + 1, { aimed: true });
      else bolt = createFx(skyBolt, { x: hitX, y: -6, seed: seed(), palette: skyBolt.STORM_GOLD, length: hitY + 6, aim: 0, thickness: 1.2, light: 1 });

      /* when the current reaches each letter, and how long it takes to run
         through it (every letter takes the same time, whatever its size) */
      const LAND = 0.15, RUN = 0.42, STEP = 0.1;
      let t0 = LAND;
      letters.forEach((g, i) => {
        if (i) {
          const prev = letters[i - 1];
          /* a longer gap where it jumps down to the next line */
          t0 += STEP + (Math.abs(g.ys[g.entry] - prev.ys[prev.entry]) > 20 ? 0.12 : 0);
        }
        g.start = t0;
        g.speed = g.maxD / RUN;
        g.done = t0 + RUN + 0.04;
        g.shown = false;
        g.R = new Rng(seed());
      });
      const end = letters[letters.length - 1].done + 0.8;
      const follow = tracker(el);
      let T = 0;

      run({
        step(dt, p) {
          T += dt;
          const [ox, oy] = follow();
          if (bolt) { bolt.update(dt); if (!bolt.done()) bolt.draw(frame); }
          /* the impact on the first letter */
          if (T > LAND && T < LAND + 0.3) p.glow(hitX + ox, hitY + oy, 26, C[5], 0.9 * (1 - (T - LAND) / 0.3));

          letters.forEach((g, gi) => {
            if (T < g.start - 0.04) return;
            const { xs, ys, dist, edge, n, R } = g;
            /* the jump across from the letter before (a long one, down to
               the next line, stays lit a little longer so you catch it) */
            if (gi) {
              const prev = letters[gi - 1];
              const x0 = prev.xs[prev.far] + ox, y0 = prev.ys[prev.far] + oy, x1 = xs[g.entry] + ox, y1 = ys[g.entry] + oy;
              const life = Math.hypot(x1 - x0, y1 - y0) > 60 ? 0.16 : 0.07;
              if (T < g.start + life) {
                g.jump ??= zigzag(R, x0, y0, x1, y1, 0.28, 0.25);
                crackle(p, g.jump, 1 - Math.max(0, T - g.start) / life, C, 0.45);
              }
            }
            if (T >= g.done && !g.shown) {
              g.shown = true;
              const ch = chars.find((c) => c === g.holder || c.contains(g.holder));
              if (ch) {
                ch.classList.remove("zap-hide");
                gsap.fromTo(ch, { "--lit": 1 }, { "--lit": 0, duration: 0.9, ease: "power2.out" });
              }
            }
            if (!g.shown) {
              /* the current running through the strokes */
              let sparks = 0;
              for (let i = 0; i < n; i++) {
                const a = T - (g.start + dist[i] / g.speed);
                if (a < 0) continue;
                const x = xs[i] + ox, y = ys[i] + oy;
                if (a < 0.045) {
                  p.put(x, y, C[7]);
                  if ((i & 3) === 0) p.glow(x, y, 9, C[5], 0.2);
                  if (edge[i] && sparks < 2 && R.chance(0.025)) {
                    sparks++;
                    const ang = R.range(0, Math.PI * 2), l = R.range(3, 8);
                    arc(p, x, y, x + Math.cos(ang) * l, y + Math.sin(ang) * l, 0.8, R);
                  }
                } else if (edge[i]) p.put(x, y, a < 0.12 ? C[7] : a < 0.3 ? C[6] : C[5]);
                else if (a < 0.09) p.put(x, y, C[6]);
              }
            } else {
              /* finished: the whole letter flashes, then the outline cools
                 off the real letter underneath */
              const u = T - g.done;
              if (u > 0.7) return;
              for (let i = 0; i < n; i++) {
                const x = xs[i] + ox, y = ys[i] + oy;
                if (u < 0.05) p.put(x, y, C[7]);
                else if (u < 0.16) p.put(x, y, C[6], 1 - (u - 0.05) / 0.11);
                else if (edge[i]) p.put(x, y, u < 0.35 ? C[5] : C[4], 1 - u / 0.7);
              }
              if (u < 0.12) p.glow(xs[g.entry] + ox, ys[g.entry] + oy + 8, 18, C[5], 0.35 * (1 - u / 0.12));
            }
          });
          if (T > end && (!bolt || bolt.done())) {
            clearTimeout(safety);
            showAll();
            resolve();
            return false;
          }
        },
      });
    }));
  }

  /* ---- 2. a title blown apart and put back ---------------------------- */
  const busy = new WeakSet();
  function shatter(el, cx, cy) {
    if (busy.has(el)) return;
    busy.add(el);
    size();
    const ix = cx / px, iy = cy / px;
    const bolt = createFx(skyBolt, { x: ix, y: -6, seed: seed(), palette: skyBolt.STORM_GOLD, length: iy + 6, aim: 0, thickness: 1.15, light: 1 });
    const HIT = 0.14;
    let T = 0, parts = null, follow = null, back = 0;

    /* the particles: one per cell of every letter */
    function burst() {
      const letters = glyphs(el, px);
      let n = 0;
      for (const g of letters) n += g.n;
      const P = {
        n, hx: new Float32Array(n), hy: new Float32Array(n), x: new Float32Array(n), y: new Float32Array(n),
        vx: new Float32Array(n), vy: new Float32Array(n), heat: new Float32Array(n),
        go: new Float32Array(n), sx: new Float32Array(n), sy: new Float32Array(n), lift: new Float32Array(n),
      };
      let minX = Infinity, maxX = -Infinity, k = 0;
      for (const g of letters) for (let i = 0; i < g.n; i++, k++) {
        P.hx[k] = P.x[k] = g.xs[i];
        P.hy[k] = P.y[k] = g.ys[i];
        minX = Math.min(minX, g.xs[i]);
        maxX = Math.max(maxX, g.xs[i]);
      }
      const reach = Math.max(30, (maxX - minX) * 0.35);
      for (let i = 0; i < n; i++) {
        const dx = P.x[i] - ix, dy = P.y[i] - iy, d = Math.hypot(dx, dy) || 1;
        const a = Math.atan2(dy, dx) + (Math.random() - 0.5) * 0.9;
        const s = (70 + 300 * Math.exp(-d / reach)) * (0.55 + Math.random() * 0.7);
        P.vx[i] = Math.cos(a) * s;
        P.vy[i] = Math.sin(a) * s - 40 - Math.random() * 90;
        P.heat[i] = Math.exp(-d / (reach * 0.8));
        /* they come home in a sweep, left to right, a little out of order */
        P.go[i] = 0.62 + ((P.hx[i] - minX) / Math.max(1, maxX - minX)) * 0.28 + Math.random() * 0.1;
        P.lift[i] = 4 + Math.random() * 14;
      }
      back = 0.62 + 0.28 + 0.1 + 0.5;
      return P;
    }

    run({
      step(dt, p) {
        T += dt;
        if (!bolt.done()) { bolt.update(dt); bolt.draw(frame); }
        if (T < HIT) return;
        if (!parts) {
          follow = tracker(el);
          parts = burst();
          el.classList.add("zap-hide");
          window.siteRipple?.(cx, cy);
          window.dispatchEvent(new CustomEvent("zap:hit", { detail: { el } }));
          if (!parts.n) { el.classList.remove("zap-hide"); busy.delete(el); return false; }
        }
        const t = T - HIT, P = parts, [ox, oy] = follow();
        if (t < 0.3) p.glow(ix, iy, 34, C[5], 1 - t / 0.3);
        /* all home: the real letters come back as the pixels fade off them */
        if (t > back) {
          if (el.classList.contains("zap-hide")) {
            el.classList.remove("zap-hide");
            const r = el.getBoundingClientRect();
            window.sitePop?.(r.left + r.width / 2, r.top + r.height / 2);
          }
          const u = t - back;
          if (u > 0.3) { busy.delete(el); return false; }
          for (let i = 0; i < P.n; i++) p.put(P.hx[i] + ox, P.hy[i] + oy, u < 0.08 ? C[7] : C[6], 1 - u / 0.3);
          return;
        }
        for (let i = 0; i < P.n; i++) {
          let c;
          if (t < P.go[i]) {
            /* flying apart: gravity and drag, cooling as they go */
            const drag = Math.exp(-dt * 2.2);
            P.vx[i] *= drag;
            P.vy[i] = P.vy[i] * drag + 300 * dt;
            P.x[i] += P.vx[i] * dt;
            P.y[i] += P.vy[i] * dt;
            P.sx[i] = P.x[i];
            P.sy[i] = P.y[i];
            const hot = P.heat[i] * Math.exp(-t * 3) + (t < 0.04 ? 1 : 0);
            c = hot > 0.7 ? C[7] : hot > 0.35 ? C[6] : hot > 0.12 ? C[5] : C[4];
          } else {
            /* and flying back */
            const k = Math.min(1, (t - P.go[i]) / 0.5), e = ease(k);
            P.x[i] = P.sx[i] + (P.hx[i] + ox - P.sx[i]) * e;
            P.y[i] = P.sy[i] + (P.hy[i] + oy - P.sy[i]) * e - Math.sin(Math.PI * k) * P.lift[i];
            const since = t - P.go[i] - 0.5;
            c = since < 0 ? (k > 0.8 ? C[6] : C[5]) : since < 0.05 ? C[7] : C[6];
          }
          p.put(Math.round(P.x[i]), Math.round(P.y[i]), c);
        }
      },
    });
  }

  /* click a title and it takes the hit */
  document.addEventListener("click", (e) => {
    if (e.button !== 0) return;
    const el = e.target.closest?.(TITLES);
    if (!el) return;
    const sel = window.getSelection?.();
    if (sel && !sel.isCollapsed) return;
    let x = e.clientX, y = e.clientY;
    if (e.detail === 0) { const r = el.getBoundingClientRect(); x = r.left + r.width / 2; y = r.top + r.height / 2; }
    shatter(el, x, y);
  });

  if (import.meta.env.DEV) window.__zap = api;
  return api;
}
