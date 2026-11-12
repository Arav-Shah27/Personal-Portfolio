/* ==========================================================================
   The loader: counts up for real (fonts, the painting) with a short floor
   so it never just blinks, then a bolt hits the ring and the ring opens
   out onto the page. Plays once per session.
   ========================================================================== */
import { gsap } from "./lib/motion.js";

export function startLoader(storm) {
  const root = document.documentElement;
  const loader = document.querySelector(".loader");
  if (!root.classList.contains("has-loader") || !loader) {
    root.classList.add("loaded");
    window.dispatchEvent(new Event("site:ready"));
    return;
  }
  const count = loader.querySelector(".loader-count");
  const shown = { p: 0 };
  let target = 0;

  const steps = [
    document.fonts?.ready ?? Promise.resolve(),
    new Promise((r) => (root.classList.contains("stage-ready") || !storm ? r() : window.addEventListener("stage:ready", r, { once: true }))),
    new Promise((r) => setTimeout(r, 1100)),
  ];
  let done = 0;
  steps.forEach((p) => p.then(() => { done++; target = done / steps.length; }));

  const tick = gsap.ticker.add(() => {
    shown.p += (target - shown.p) * 0.08;
    if (target === 1 && shown.p > 0.995) shown.p = 1;
    const v = Math.round(shown.p * 100);
    count.textContent = String(v).padStart(3, "0");
    loader.style.setProperty("--fill", v);
    if (shown.p === 1) finish();
  });

  let finished = false;
  function finish() {
    if (finished) return;
    finished = true;
    gsap.ticker.remove(tick);
    try { sessionStorage.setItem("seen", "1"); } catch {}
    loader.classList.add("is-struck");
    /* the bolt comes down onto the ring as it opens */
    if (storm) {
      const { stage, world } = storm;
      world.strike(stage.frame.w / 2, stage.frame.h / 2, { aimed: true });
    }
    gsap.timeline({ delay: 0.18 })
      .to(count, { opacity: 0, duration: 0.2 }, 0)
      .to(loader, { "--open": "150%", duration: 1.1, ease: "expo.in" }, 0.05)
      .add(() => window.dispatchEvent(new Event("site:ready")), 0.75)
      .add(() => root.classList.add("loaded"));
  }
}
