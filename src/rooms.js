/* ==========================================================================
   The walk through the house: ties the page's scroll to where the camera
   is in the house behind the door (src/stage/house.js).

   The page is the route. Each part of it is pinned to a stop on the
   camera's path, and between them the camera walks:

     the dive into the door       the front door opens onto the hall
     the hall (a gap in the page) down the bend to the study
     What I've Done               the study: the map for experiences, then
                                  the workbench for projects
     the next gap                 through the round door to the parlour
     My Brain                     by the fire
     the last gap                 out of the back door, to the tower

   In the gaps (.walk) the rooms are at full brightness; under text they
   step back so the words stay easy to read. Under reduced motion the
   camera doesn't walk: it stands at whichever stop is nearest.
   ========================================================================== */
import { reduceMotion } from "./lib/motion.js";

const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

export function startRooms(storm) {
  const house = storm?.house;
  if (!house) return;
  const $ = (s) => document.querySelector(s);
  const run = $(".hero-run"), work = $("#work"), brain = $("#brain"), footer = $(".footer");
  const groups = work ? work.querySelectorAll(".group") : [];
  if (!run || !work || !brain || !footer || groups.length < 2) return;

  /* where an element starts, in document pixels */
  const top = (el) => el.getBoundingClientRect().top + window.scrollY;
  const bottom = (el) => el.getBoundingClientRect().bottom + window.scrollY;

  function anchors() {
    const vh = window.innerHeight;
    const runEnd = bottom(run) - vh;
    const runH = run.offsetHeight - vh;
    /* [scroll position, stop on the camera path] */
    return [
      [runEnd - runH * 0.6, 0],
      [runEnd, 1],
      [top(work) - vh * 0.55, 3],
      [top(groups[0]) - vh * 0.3, 4],
      [top(groups[1]) - vh * 0.3, 5],
      [bottom(work) - vh, 5.25],
      [top(brain) - vh * 0.1, 7],
      [bottom(brain) - vh, 7.3],
      [top(footer) - vh * 0.35, 9],
    ];
  }

  function stopAt(y, A) {
    if (y <= A[0][0]) return A[0][1];
    for (let i = 1; i < A.length; i++) {
      const [y1, u1] = A[i], [y0, u0] = A[i - 1];
      if (y <= y1) return u0 + ((u1 - u0) * (y - y0)) / Math.max(1, y1 - y0);
    }
    return A[A.length - 1][1];
  }

  /* how much of the screen is covered by a section's words */
  function covered(el, vh) {
    const r = el.getBoundingClientRect();
    const pad = vh * 0.12;
    const a = Math.max(0, r.top + pad), b = Math.min(vh, r.bottom - pad);
    return Math.max(0, b - a) / vh;
  }

  function update() {
    const vh = window.innerHeight, y = window.scrollY;
    const A = anchors();
    let u = stopAt(y, A);
    if (reduceMotion) u = Math.round(u);
    house.state.u = u;
    const cover = Math.max(covered(work, vh), covered(brain, vh));
    let lum = 1 - 0.45 * smooth(0.04, 0.4, cover);
    /* out of the back door, the house falls away behind you and the tower
       stands on its own */
    const ft = top(footer);
    lum *= 1 - 0.9 * smooth(ft - vh * 0.9, ft - vh * 0.2, y);
    if (import.meta.env.DEV && window.__lum != null) lum = window.__lum;
    house.state.lum = lum;
    storm.stage.invalidate();
  }
  window.addEventListener("scroll", update, { passive: true });
  window.addEventListener("resize", update);
  window.addEventListener("essays:ready", () => requestAnimationFrame(update));
  update();

  if (import.meta.env.DEV) window.__rooms = { update, anchors };
}
