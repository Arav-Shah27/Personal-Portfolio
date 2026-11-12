/* ==========================================================================
   Type that arrives: the big section titles rise letter by letter out of
   their own baseline as they scroll in, and the small labels flicker
   through a few pixel glyphs before they settle, like a display warming up.
   ========================================================================== */
import { gsap, ScrollTrigger, reduceMotion } from "./lib/motion.js";
import { SplitText } from "gsap/SplitText";

gsap.registerPlugin(SplitText);

export function startTitles() {
  if (reduceMotion) return;

  document.querySelectorAll(".section-title").forEach((title) => {
    const split = SplitText.create(title, { type: "lines,chars", mask: "lines", charsClass: "tch", aria: "auto" });
    gsap.from(split.chars, {
      yPercent: 105, rotate: 4, duration: 1.2, ease: "expo.out", stagger: 0.035,
      scrollTrigger: { trigger: title, start: "top 85%", once: true },
    });
  });
}
