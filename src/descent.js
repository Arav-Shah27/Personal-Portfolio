/* ==========================================================================
   The descent: scrolling through the hero dives into the round door.

   The hero is sticky inside a tall runway (.hero-run). Across that runway:
     - the name parts like curtains and the rest of the hero falls away,
     - the camera zooms into the door, and a bolt comes down on the brass
       knob on the way in,
     - the door opens, and its inside is the circuit board, which then fills
       the screen and stays on behind the rest of the page.
   Under reduced motion there is no runway and no zoom; the painting simply
   gives way to the board once you scroll past it.
   ========================================================================== */
import { gsap, ScrollTrigger, reduceMotion } from "./lib/motion.js";

export function startDescent(storm) {
  const run = document.querySelector(".hero-run");
  if (!run) return;
  const world = storm?.world;
  const state = world?.state;

  if (!storm || reduceMotion) {
    /* no dive: the painting until the hero has gone, then the board */
    if (!state) return;
    /* a plain check rather than a trigger: a jump straight past the hero
       (a link, the End key) has to land on the board too */
    let past = null;
    const check = () => {
      const now = window.scrollY > run.offsetTop + run.offsetHeight * 0.6;
      if (now === past) return;
      past = now;
      state.painting = now ? 0 : 1;
      state.board = state.open = now ? 1 : 0;
      state.zoom = 1;
      state.dim = 0.45;
      storm.stage.invalidate();
    };
    window.addEventListener("scroll", check, { passive: true });
    check();
    return;
  }

  const cam = { lz: 0 };
  const apply = () => { state.zoom = Math.exp(cam.lz); };

  const tl = gsap.timeline({
    defaults: { ease: "none" },
    scrollTrigger: {
      trigger: run, start: "top top", end: "bottom bottom",
      scrub: true,
      onUpdate: (self) => {
        /* the bolt on the knob, once, on the way in */
        if (self.direction > 0 && self.progress > 0.24 && !struck) {
          struck = true;
          const k = world.toScreen(world.KNOB.x, world.KNOB.y);
          const px = storm.stage.frame.px;
          world.strike(k.x / px, k.y / px, { aimed: true });
        }
        if (self.progress < 0.1) struck = false;
      },
    },
  });
  let struck = false;

  tl
    /* the hero gives way */
    .to(".hero", { "--fall": 1, duration: 0.12 }, 0)
    .to(".hero-line--a", { xPercent: -120, yPercent: -30, opacity: 0, filter: "blur(8px)", duration: 0.42, ease: "power2.in" }, 0.02)
    .to(".hero-line--b", { xPercent: 120, yPercent: 30, opacity: 0, filter: "blur(8px)", duration: 0.42, ease: "power2.in" }, 0.02)
    /* into the door */
    .to(cam, { lz: Math.log(7), duration: 0.74, ease: "power1.in", onUpdate: apply }, 0.04)
    .to(state, { open: 1, duration: 0.4, ease: "power1.inOut" }, 0.4)
    .to(state, { painting: 0, board: 1, duration: 0.1 }, 0.86);

  /* once there's text over it, the board steps back to a whisper */
  gsap.to(state, {
    dim: 0.42, ease: "none",
    scrollTrigger: { trigger: run, start: "bottom bottom", end: "bottom 30%", scrub: true },
  });

  /* the board drifts with the page after the dive */
  ScrollTrigger.create({
    trigger: run, start: "bottom bottom", end: "max",
    onUpdate: (self) => { state.scroll = Math.max(0, window.scrollY - (self.start || 0)); },
  });
}
