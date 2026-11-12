/* ==========================================================================
   The hero's type: the name arrives letter by letter, and every lightning
   flash lights the letters from the side the bolt came down on.
   ========================================================================== */
import { gsap, reduceMotion } from "./lib/motion.js";
import { SplitText } from "gsap/SplitText";

gsap.registerPlugin(SplitText);

export function startHero() {
  const name = document.querySelector(".hero-name");
  if (!name) return;
  const root = document.documentElement;

  /* the name is read once, whole; the letters underneath are only for show */
  name.setAttribute("aria-label", name.textContent.replace(/\s+/g, " ").trim());
  const lines = [...name.querySelectorAll(".hero-line")];
  lines.forEach((l) => l.setAttribute("aria-hidden", "true"));
  const split = SplitText.create(lines, { type: "chars", charsClass: "ch", aria: "none" });
  const chars = split.chars;

  const intro = () => {
    root.classList.add("hero-in");
    if (reduceMotion) return;
    const tl = gsap.timeline({ defaults: { ease: "expo.out" } });
    tl.from(chars, {
      yPercent: 70, opacity: 0, rotate: () => gsap.utils.random(-6, 6), filter: "blur(10px)",
      duration: 1.6, stagger: 0.055,
    })
      .to(".hero-hello", { opacity: 1, y: 0, duration: 1.2 }, 0.35)
      .fromTo(".hero-foot", { opacity: 0, y: 18 }, { opacity: 1, y: 0, duration: 1.3 }, 0.7)
      .to(".scroll-hint", { opacity: 1, duration: 1 }, 1.3);
    gsap.set(".hero-hello", { y: 10 });
  };
  /* the loader (if any) says when; otherwise once the fonts are in */
  if (root.classList.contains("has-loader")) window.addEventListener("site:ready", intro, { once: true });
  else document.fonts.ready.then(intro);

  /* ---- light the letters from the strike ------------------------------- */
  if (reduceMotion) return;
  let lit = false;
  window.addEventListener("storm:flash", (e) => {
    const { flash, x } = e.detail;
    if (flash < 0.01 && !lit) return;
    lit = flash >= 0.01;
    const sx = x * window.innerWidth;
    /* read every letter's position first, then write: interleaving the two
       would force a layout per letter, every frame of the flash */
    const centers = chars.map((ch) => { const r = ch.getBoundingClientRect(); return r.left + r.width / 2; });
    chars.forEach((ch, i) => {
      const dx = (centers[i] - sx) / window.innerWidth;
      ch.style.setProperty("--lit", (flash * Math.exp(-Math.abs(dx) * 1.8)).toFixed(3));
      ch.style.setProperty("--dir", Math.sign(dx) || 1);
    });
  });
}
