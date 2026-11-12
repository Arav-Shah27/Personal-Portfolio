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

  /* small labels warm up through a few glyphs before they settle */
  const GLYPHS = "#%&*+=/\\<>[]{}01";
  const scramble = (node) => {
    const final = node.nodeValue;
    let frame = 0;
    const total = 14;
    const id = setInterval(() => {
      frame++;
      const done = Math.floor((frame / total) * final.length);
      node.nodeValue = final.split("").map((ch, i) =>
        i < done || ch === " " ? ch : GLYPHS[(Math.random() * GLYPHS.length) | 0]).join("");
      if (frame >= total) { clearInterval(id); node.nodeValue = final; }
    }, 40);
  };
  document.querySelectorAll(".group-label, .brain-box-head > span:first-child").forEach((label) => {
    const node = [...label.childNodes].find((n) => n.nodeType === 3 && n.nodeValue.trim());
    if (!node) return;
    ScrollTrigger.create({ trigger: label, start: "top 90%", once: true, onEnter: () => scramble(node) });
  });
}
