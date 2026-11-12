/* ==========================================================================
   Magnetic keys: the round buttons lean toward the mouse when it comes
   close, and spring back when it leaves. Mouse only, never under reduced
   motion.
   ========================================================================== */
import { gsap, reduceMotion, finePointer } from "./lib/motion.js";

export function startMagnets() {
  if (reduceMotion || !finePointer) return;
  document.querySelectorAll(".socials a, .socials button, .sound, .reader-done").forEach((el) => {
    const x = gsap.quickTo(el, "x", { duration: 0.5, ease: "power3.out" });
    const y = gsap.quickTo(el, "y", { duration: 0.5, ease: "power3.out" });
    el.addEventListener("pointermove", (e) => {
      const r = el.getBoundingClientRect();
      x((e.clientX - (r.left + r.width / 2)) * 0.35);
      y((e.clientY - (r.top + r.height / 2)) * 0.35);
    });
    el.addEventListener("pointerleave", () => {
      gsap.to(el, { x: 0, y: 0, duration: 0.9, ease: "elastic.out(1, 0.4)", overwrite: true });
    });
  });
}
