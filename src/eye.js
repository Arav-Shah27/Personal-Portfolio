/* ==========================================================================
   The eye, as a little character. It perches on top of the text on the page
   (a heading, a title, a paragraph) and hops from one to the next: to the
   one you point at, to the next one as you scroll, and now and then just to
   have a look around. Its pupil watches you the whole time, and it blinks.

   When you reach the dark tower it flares, leaps down and settles between
   the horns, where it stays (still watching) until a tap turns the tower
   into the QR code; then its own voxels fly into the code with the rest.
   Scroll back up and it hops out of the socket and back onto the page.
   ========================================================================== */
import { gsap, ScrollTrigger, reduceMotion, finePointer } from "./lib/motion.js";
import { createEye } from "./stage/eye.js";

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

/* the text it likes to sit on */
const PERCHES = [
  ".hero-hello", ".hero-lede", ".section-title", ".section-sub", ".group-label",
  ".entry-title", ".entry-desc", ".project-title", ".project-desc", ".essay-title",
].join(", ");

export function startEye(storm, tower, button) {
  const s = tower.state;
  const eye = createEye();
  const E = eye.state;
  const W = finePointer ? 54 : 44;
  E.w = W;

  const pointer = { x: innerWidth / 2, y: innerHeight / 2, seen: false, at: -1e9 };
  const note = (e) => { pointer.x = e.clientX; pointer.y = e.clientY; pointer.seen = true; pointer.at = performance.now(); };
  window.addEventListener("pointerdown", note, { passive: true });

  let mode = reduceMotion ? "home" : "perch";   /* perch | hop | flying | home */
  let perch = null, tl = null, folded = false, want = false, waiting = null;
  let clock = 0, lastHop = 0, nextWander = 8;
  if (import.meta.env.DEV) window.__eye = { eye, E, pointer, get mode() { return mode; }, get perch() { return perch; } };

  const navH = () => document.querySelector(".nav")?.getBoundingClientRect().bottom ?? 70;

  /* where it sits on a piece of text: on top of the first line, near its end */
  function spot(el) {
    const range = document.createRange();
    range.selectNodeContents(el);
    const r = range.getClientRects()[0] || el.getBoundingClientRect();
    return {
      x: clamp(r.right - W * 0.55, r.left + W * 0.5, innerWidth - W * 0.6),
      y: r.top - W * 0.3,
    };
  }
  function valid(el) {
    if (!el || !el.isConnected) return false;
    const r = el.getBoundingClientRect();
    if (r.width < 8 || r.top < navH() + W * 0.4 || r.top > innerHeight - W) return false;
    return el.checkVisibility ? el.checkVisibility({ opacityProperty: true, visibilityProperty: true }) : true;
  }
  /* the best place to hop to: the text nearest to you, or to the middle of
     what you're reading on a phone */
  function pick(near, avoid) {
    let best = null, bestD = Infinity;
    for (const el of document.querySelectorAll(PERCHES)) {
      if (el === avoid || !valid(el)) continue;
      const p = spot(el);
      const d = Math.hypot(p.x - near.x, (p.y - near.y) * 1.6) + Math.random() * 40;
      if (d < bestD) { bestD = d; best = el; }
    }
    return best;
  }
  const reading = () =>
    finePointer && performance.now() - pointer.at < 6000 ? { x: pointer.x, y: pointer.y } : { x: innerWidth * 0.5, y: innerHeight * 0.38 };

  /* while you scroll it keeps to the middle of the screen: once its perch
     drifts out of this band it hops to the text nearest the middle */
  const bandTop = () => Math.max(navH() + W * 0.6, innerHeight * 0.24);
  const bandBot = () => innerHeight * 0.68;
  const inBand = (y) => y > bandTop() && y < bandBot();
  function pickMiddle(avoid) {
    /* aim ahead of the scroll, so the next one has room to come to it */
    const mid = { x: perch ? E.x : innerWidth * 0.5, y: innerHeight * (scrollDir > 0 ? 0.52 : scrollDir < 0 ? 0.36 : 0.44) };
    /* and judge each one by where it will be when it lands, not where it is now */
    const lead = scrolling() ? scrollV * 0.5 : 0;
    let best = null, bestD = Infinity;
    for (const el of document.querySelectorAll(PERCHES)) {
      if (el === avoid || !valid(el)) continue;
      const p = spot(el);
      p.y -= lead;
      if (!inBand(p.y)) continue;
      const d = Math.hypot((p.x - mid.x) * 0.5, p.y - mid.y) + Math.random() * 30;
      if (d < bestD) { bestD = d; best = el; }
    }
    return best;
  }
  /* how fast the page is moving, in px/s (down is positive) */
  let scrolledAt = -1e9, scrollDir = 0, scrollV = 0, lastY = scrollY;
  window.addEventListener("scroll", () => {
    const now = performance.now(), dt = Math.max(8, now - scrolledAt) / 1000;
    const v = dt > 0.3 ? 0 : (scrollY - lastY) / dt;
    scrollV += (clamp(v, -3000, 3000) - scrollV) * 0.3;
    scrollDir = Math.sign(scrollY - lastY) || scrollDir;
    scrolledAt = now;
    lastY = scrollY;
  }, { passive: true });
  const scrolling = () => performance.now() - scrolledAt < 400;

  /* a hop: crouch, spring up in an arc, land with a squash */
  function hopTo(el, from = { x: E.x, y: E.y }) {
    if (!el) return;
    tl?.kill();
    mode = "hop";
    perch = el;
    lastHop = clock;
    const to0 = spot(el);
    const dist = Math.hypot(to0.x - from.x, to0.y - from.y);
    /* quicker, flatter hops while the page is moving, so it keeps up */
    const quick = scrolling();
    const dur = quick ? clamp(0.26 + dist / 1800, 0.3, 0.55) : clamp(0.32 + dist / 1500, 0.38, 0.85);
    const lift = quick ? clamp(14 + dist * 0.12, 22, 70) : clamp(24 + dist * 0.22, 34, 200);
    const crouch = quick ? 0.05 : 0.09;
    /* where it took off from scrolls with the page, like the text it left */
    const sy0 = scrollY;
    const h = { k: 0 };
    tl = gsap.timeline()
      .to(E, { sq: 0.62, duration: crouch, ease: "power2.out" })
      .to(E, { sq: 1.25, duration: 0.1, ease: "power2.out" })
      .to(h, {
        k: 1, duration: dur, ease: "none",
        onUpdate() {
          const to = spot(perch), t = h.k, fy = from.y - (scrollY - sy0);
          E.x = from.x + (to.x - from.x) * t;
          E.y = fy + (to.y - fy) * t - lift * 4 * t * (1 - t);
        },
      }, "<")
      .to(E, { sq: 1, duration: dur * 0.6 }, "<+=0.1")
      .add(() => { mode = "perch"; })
      .to(E, { sq: 0.6, duration: 0.06, ease: "power2.in" })
      .to(E, { sq: 1, duration: 0.45, ease: "elastic.out(1, 0.4)" });
  }

  /* point at a piece of text and it comes over, once you've lingered */
  let dwell = null;
  if (finePointer) {
    window.addEventListener("pointermove", (e) => {
      if (e.pointerType !== "mouse") return;
      note(e);
      const el = e.target.closest?.(PERCHES);
      if (!el || el === perch || mode !== "perch") { if (!el) { dwell?.kill(); dwell = null; } return; }
      if (dwell?.el === el) return;
      dwell?.kill();
      dwell = gsap.delayedCall(0.35, () => { dwell = null; if (mode === "perch" && valid(el) && clock - lastHop > 0.8) hopTo(el); });
      dwell.el = el;
    }, { passive: true });
  }

  /* where it looks: at you, or (with nothing to look at) around */
  function gaze(fromX, fromY) {
    const idle = performance.now() - pointer.at > (finePointer ? 4000 : 2500);
    if (idle || reduceMotion) return { x: Math.sin(clock * 0.6) * 0.7, y: Math.sin(clock * 0.9 + 1) * 0.4 };
    return { x: clamp((pointer.x - fromX) / 160, -1, 1), y: clamp((pointer.y - fromY) / 160, -1, 1) };
  }

  gsap.ticker.add((time, deltaMs) => {
    const dt = reduceMotion ? 0 : Math.min(0.05, deltaMs / 1000);
    clock += dt;

    let show = true;
    if (mode === "perch") {
      if (!valid(perch)) {
        const next = pickMiddle(perch) || pick(reading(), perch);
        if (next) hopTo(next); else show = false;
      } else {
        const p = spot(perch);
        E.x = p.x;
        E.y = p.y;
        if (scrolling() && !inBand(p.y) && clock - lastHop > 0.25) {
          /* the page is moving under it: hop to keep up */
          const next = pickMiddle(perch);
          if (next) hopTo(next);
        } else if (clock > nextWander && clock - lastHop > 5) {
          /* every so often it goes for a wander */
          nextWander = clock + 8 + Math.random() * 7;
          const next = pick({ x: E.x + (Math.random() - 0.5) * 500, y: E.y + (Math.random() - 0.5) * 300 }, perch);
          if (next) hopTo(next);
        }
      }
    } else if (mode === "home") {
      const r = button.getBoundingClientRect();
      /* never over the code: hidden as soon as the tower starts to fold */
      show = !folded && s.fold < 0.01 && r.bottom > 0 && r.top < innerHeight;
      E.x = tower.eye.x; E.y = tower.eye.y; E.w = tower.eye.w;
    }

    const g = gaze(E.x, E.y);
    const kl = 1 - Math.exp(-Math.max(dt, 0.016) * 8);
    E.look.x += (g.x - E.look.x) * kl;
    E.look.y += (g.y - E.look.y) * kl;
    if (mode !== "home" && mode !== "flying") E.w += (W - E.w) * kl;

    E.hidden = !show;
    eye.render(clock);
  });

  /* a blink every few seconds */
  if (!reduceMotion) (function blink() {
    gsap.delayedCall(2.5 + Math.random() * 4.5, () => {
      if (E.open > 0.9) gsap.to(E, { blink: 0.06, duration: 0.07, yoyo: true, repeat: 1, ease: "power1.in" });
      blink();
    });
  })();

  /* it opens once the page has loaded */
  function wake() {
    if (mode === "perch") {
      perch = pickMiddle() || pick(reading());
      if (perch) Object.assign(E, spot(perch));
    }
    gsap.to(E, { open: 1, duration: 0.5, delay: reduceMotion ? 0 : 0.6, ease: "power2.out" });
  }
  if (document.documentElement.classList.contains("stage-ready")) wake();
  else window.addEventListener("stage:ready", wake, { once: true });

  if (reduceMotion) {
    /* asked for less motion: it just sits in the tower */
    s.eyeLit = 1;
    return { fold() { folded = true; s.eyeHome = 1; }, unfolded() { folded = false; s.eyeHome = 0; } };
  }

  function goHome() {
    want = true;
    if (mode === "flying" || mode === "home" || waiting) return;
    /* let the tower finish rising first */
    if (s.grow < 0.98) { waiting = gsap.delayedCall(0.2, () => { waiting = null; if (want) goHome(); }); return; }
    tl?.kill();
    mode = "flying";
    const from = { x: E.x, y: E.y, w: E.w };
    const fly = { k: 0 };
    tl = gsap.timeline()
      /* it notices, flares, crouches, and leaps down in a long arc */
      .to(E, { heat: 1, open: 1, blink: 1, sq: 0.6, duration: 0.35, ease: "power2.out" })
      .to(E, { sq: 1.3, duration: 0.12 })
      .to(fly, {
        k: 1, duration: 1.3, ease: "power2.inOut",
        onUpdate() {
          const to = tower.eye, t = fly.k, u = 1 - t;
          const cx = (from.x + to.x) / 2 + (from.x < to.x ? -1 : 1) * 90;
          const cy = Math.min(from.y, to.y) - 160;
          E.x = u * u * from.x + 2 * u * t * cx + t * t * to.x;
          E.y = u * u * from.y + 2 * u * t * cy + t * t * to.y;
          E.w = from.w + (to.w - from.w) * t;
        },
      }, "<")
      .to(E, { sq: 1, duration: 0.6 }, "<+=0.2")
      /* and settles into the socket, lighting the stone round it */
      .add(() => { mode = "home"; window.sitePop?.(tower.eye.x, tower.eye.y); if (folded) E.open = 0; })
      .to(E, { sq: 0.7, duration: 0.07 })
      .to(E, { sq: 1, heat: 0, duration: 0.5, ease: "elastic.out(1, 0.45)" })
      .to(s, { eyeLit: 1, duration: 0.6, ease: "power2.out" }, "<");
  }

  function leaveHome() {
    want = false;
    waiting?.kill(); waiting = null;
    if (mode !== "home" && mode !== "flying") return;
    tl?.kill();
    gsap.to(s, { eyeLit: 0, duration: 0.3 });
    const from = mode === "home" ? { x: tower.eye.x, y: tower.eye.y } : { x: E.x, y: E.y };
    E.heat = 0; E.sq = 1;
    if (folded) gsap.to(E, { open: 1, duration: 0.25 });
    mode = "perch";
    perch = null;
    const next = pick(reading());
    if (next) hopTo(next, from);
  }

  ScrollTrigger.create({ trigger: button, start: "top 62%", onEnter: goHome, onLeaveBack: leaveHome });

  return {
    /* the tower is turning into the code: the eye's voxels go with it */
    fold() {
      folded = true;
      s.eyeHome = 1;
      if (mode === "home") gsap.to(E, { open: 0, duration: 0.1, overwrite: "auto" });
    },
    /* the tower has re-formed: the eye takes its place again */
    unfolded() {
      folded = false;
      gsap.to(s, { eyeHome: 0, duration: 0.15 });
      if (mode === "home") gsap.fromTo(E, { open: 0.2, heat: 0.8 }, { open: 1, heat: 0, duration: 0.4, ease: "power2.out", overwrite: "auto" });
    },
  };
}
