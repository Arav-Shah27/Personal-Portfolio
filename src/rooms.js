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

   Things in the rooms can be found: point at one and it lights up, click
   it and it opens. The map, the books and the workbench take you to the
   experiences, the essays and the projects; everything else says whatever
   src/finds.js says about it. A click on nothing in particular brings
   lightning to the windows.
   ========================================================================== */
import { reduceMotion, lenis } from "./lib/motion.js";
import { FINDS } from "./finds.js";

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
      [top(footer) - vh * 0.6, 10],
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
    lum *= 1 - 0.92 * smooth(ft - vh * 0.55, ft - vh * 0.05, y);
    if (import.meta.env.DEV && window.__lum != null) lum = window.__lum;
    house.state.lum = lum;
    storm.stage.invalidate();
  }
  window.addEventListener("scroll", update, { passive: true });
  window.addEventListener("resize", update);
  window.addEventListener("essays:ready", () => requestAnimationFrame(update));
  update();

  /* ---- finding things ------------------------------------------------- */
  const root = document.documentElement;
  const goTo = (el) => {
    if (lenis) lenis.scrollTo(el, { offset: -window.innerHeight * 0.12 });
    else el.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth" });
  };
  /* the ones that lead somewhere on the page */
  const LEADS = { map: groups[0], bench: groups[1], books: brain };
  const said = (id) => FINDS[id] && FINDS[id].text && FINDS[id].text.trim();
  const live = (id) => !!id && (id in LEADS || !!said(id));

  /* anything you can read or press is off limits: only empty space looks
     through into the room */
  const SOLID = "a, button, input, label, p, h1, h2, h3, h4, li, .project, .entry-body, .brain-box, .brain-viz, .nav, .party, .reader, .find, .toast";
  const open_ = (el) => !(el && el.closest && el.closest(SOLID));

  let aim = null, last = null, queued = false;
  function aimAt(x, y, el) {
    const id = open_(el) ? house.pick(x, y) : null;
    const next = live(id) ? id : null;
    if (next === aim) return;
    aim = next;
    house.highlight(next);
    root.classList.toggle("find-aim", !!next);
  }
  window.addEventListener("pointermove", (e) => {
    if (e.pointerType !== "mouse") return;
    last = { x: e.clientX, y: e.clientY, el: e.target };
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => { queued = false; if (last) aimAt(last.x, last.y, last.el); });
  }, { passive: true });
  /* the room moves under a still pointer as the page scrolls */
  window.addEventListener("scroll", () => {
    if (last) aimAt(last.x, last.y, document.elementFromPoint(last.x, last.y));
  }, { passive: true });

  /* the card a find opens */
  const card = document.createElement("div");
  card.className = "find";
  card.setAttribute("role", "dialog");
  card.setAttribute("aria-labelledby", "find-label");
  card.hidden = true;
  card.innerHTML = '<p class="find-label label" id="find-label"></p><div class="find-text"></div>' +
    '<button type="button" class="find-close" aria-label="Close"><span aria-hidden="true">&times;</span></button>';
  document.body.append(card);
  let openAt = 0, opener = null;
  function show(id, x, y) {
    const f = FINDS[id];
    card.querySelector(".find-label").textContent = f.label || "";
    const body = card.querySelector(".find-text");
    body.replaceChildren(...f.text.trim().split(/\n\s*\n/).map((t) => {
      const p = document.createElement("p");
      p.textContent = t.trim();
      return p;
    }));
    if (f.link && f.link.href) {
      const a = document.createElement("a");
      a.href = f.link.href;
      a.textContent = f.link.text || f.link.href;
      if (/^https?:/.test(f.link.href)) { a.target = "_blank"; a.rel = "noopener noreferrer"; }
      body.append(a);
    }
    card.hidden = false;
    /* beside the thing, kept on screen */
    const r = card.getBoundingClientRect(), m = 16;
    const left = Math.min(window.innerWidth - r.width - m, Math.max(m, x + 18));
    const top = Math.min(window.innerHeight - r.height - m, Math.max(m + 56, y - r.height - 18));
    card.style.transform = `translate(${Math.round(left)}px, ${Math.round(top)}px)`;
    card.classList.remove("is-shown");
    void card.offsetWidth;
    card.classList.add("is-shown");
    openAt = window.scrollY;
    opener = document.activeElement;
    card.querySelector(".find-close").focus({ preventScroll: true });
    window.siteRipple?.(x, y);
  }
  function hide() {
    if (card.hidden) return;
    card.hidden = true;
    card.classList.remove("is-shown");
    if (opener && opener.focus && card.contains(document.activeElement)) opener.focus({ preventScroll: true });
  }
  card.querySelector(".find-close").addEventListener("click", hide);
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") hide(); });
  window.addEventListener("scroll", () => { if (Math.abs(window.scrollY - openAt) > 120) hide(); }, { passive: true });

  document.addEventListener("click", (e) => {
    if (card.contains(e.target)) return;
    hide();
    if (!open_(e.target) || !house.state.on) return;
    const id = house.pick(e.clientX, e.clientY);
    if (live(id)) {
      if (id in LEADS) goTo(LEADS[id]);
      else show(id, e.clientX, e.clientY);
      return;
    }
    /* nothing there: lightning in the windows, if you're in a room */
    if (!e.target.closest(".hero-run") && house.state.lum > 0.6) house.strike();
  });

  /* what's been written about the rooms is there for screen readers too */
  const told = Object.keys(FINDS).filter(said);
  if (told.length) {
    const list = document.createElement("section");
    list.className = "sr-only";
    list.setAttribute("aria-label", "around the house");
    const ul = document.createElement("ul");
    for (const id of told) {
      const li = document.createElement("li");
      li.textContent = `${FINDS[id].label}: ${FINDS[id].text.trim()}`;
      ul.append(li);
    }
    list.append(ul);
    footer.before(list);
  }

  if (import.meta.env.DEV) window.__rooms = { update, anchors, show, FINDS };
}
