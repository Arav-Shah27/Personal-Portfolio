/* ==========================================================================
   Wires the stage into the page: the storm over the hero, bolts on click,
   the painting leaning toward the mouse, and the lightning's flash handed
   to anything on the page that wants to react to it.
   ========================================================================== */
import { reduceMotion, finePointer } from "./lib/motion.js";
import { createStage } from "./stage/stage.js";
import { createWorld } from "./stage/world.js";
import { createBrain } from "./stage/brain.js";
import { createHouse } from "./stage/house.js";
import { overText } from "./lib/hit.js";

export function startStorm() {
  const stage = createStage();
  if (!stage) {
    document.documentElement.classList.add("no-stage");
    return null;
  }
  const root = document.documentElement;
  const hero = document.querySelector(".hero");

  /* the house behind the door draws first, into its own target, and the
     world shows it through the door */
  const house = stage.add(createHouse(stage));
  const world = stage.add(createWorld(stage, {
    inside: house,
    onReady: () => { root.classList.add("stage-ready"); window.dispatchEvent(new Event("stage:ready")); },
    /* the flash goes out as a CSS variable and an event, so type and
       anything else can light up in step with the sky */
    onFlash: (flash, x) => {
      root.style.setProperty("--flash", flash.toFixed(3));
      root.style.setProperty("--strike-x", x.toFixed(3));
      window.dispatchEvent(new CustomEvent("storm:flash", { detail: { flash, x } }));
    },
  }));
  root.classList.add("has-stage");

  const heroVisible = () => {
    const r = hero?.getBoundingClientRect();
    return r && r.bottom > 0 && r.top < window.innerHeight;
  };

  /* ambient bolts: every 9 to 18 seconds, out at the edges of the painting so
     they never cross the name. Under reduced motion the sky stays still. */
  if (!reduceMotion) {
    const ambient = (delay) => setTimeout(() => {
      if (heroVisible() && !document.hidden && world.state.zoom < 1.5) {
        const W = stage.frame.w, left = Math.random() < 0.5;
        world.strike(left ? W * (0.04 + Math.random() * 0.16) : W * (0.8 + Math.random() * 0.16));
      }
      ambient(9000 + Math.random() * 9000);
    }, delay);
    ambient(6000);   /* after the name has been written in lightning (src/zap.js) */
  }

  /* click the sky and it strikes right there */
  let lastClick = 0;
  hero?.addEventListener("click", (e) => {
    if (e.target.closest("a, button, p, ul, .no-strike")) return;
    /* the name's box fills most of the hero: only its letters are off limits */
    const h1 = e.target.closest("h1");
    if (h1 && overText(h1, e.clientX, e.clientY)) return;
    const sel = window.getSelection?.();
    if (sel && !sel.isCollapsed) return;
    const now = performance.now();
    if (now - lastClick < 650) return;
    lastClick = now;
    const px = stage.frame.px;
    world.strike(e.clientX / px, e.clientY / px + 4, { aimed: true });
  });

  /* the painting leans a little toward a real mouse */
  if (finePointer && !reduceMotion) {
    window.addEventListener("pointermove", (e) => {
      world.state.mouseTarget.set(e.clientX / window.innerWidth - 0.5, e.clientY / window.innerHeight - 0.5);
    }, { passive: true });
  }

  /* the brain, with a node for every essay in My Brain */
  const box = document.querySelector(".brain-viz");
  if (box) {
    const rowFor = (slug) => document.querySelector(`.essay-row[data-slug="${slug}"]`);
    const brain = stage.add(createBrain(stage, {
      box, tags: box.querySelector(".brain-tags"),
      onOpen: (slug) => rowFor(slug)?.click(),
    }));
    const link = (list) => {
      brain.setEssays(list);
      list.forEach((e, i) => {
        const row = rowFor(e.slug);
        row?.addEventListener("pointerenter", () => brain.focus(i));
        row?.addEventListener("focus", () => brain.focus(i));
        row?.addEventListener("pointerleave", () => brain.focus(-1));
        row?.addEventListener("blur", () => brain.focus(-1));
      });
    };
    if (window.siteEssays) link(window.siteEssays);
    window.addEventListener("essays:ready", (e) => link(e.detail));
    /* and a node hovered on the brain lights its row */
    box.addEventListener("pointermove", () => {
      document.querySelectorAll(".essay-row").forEach((r) => r.classList.remove("is-hot"));
      const t = box.querySelector(".brain-tag.is-hot");
      if (t) rowFor((window.siteEssays || []).find((e) => e.num === t.textContent)?.slug)?.classList.add("is-hot");
    });
    box.addEventListener("pointerleave", () => document.querySelectorAll(".essay-row.is-hot").forEach((r) => r.classList.remove("is-hot")));
  }

  /* anything on the page can send current across the board */
  window.siteRipple = (x, y) => world.ripple(x, y);

  if (import.meta.env.DEV) window.__storm = { stage, world, house };
  return { stage, world, house };
}
