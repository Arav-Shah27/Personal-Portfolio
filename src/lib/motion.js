/* ==========================================================================
   Motion: one GSAP clock, ScrollTrigger, and Lenis smooth scrolling.

   Lenis only runs with a mouse or trackpad and only when motion is welcome.
   Touch keeps the phone's own scrolling (it already has momentum, and faking
   it feels worse), and reduced motion keeps the browser's plain scroll.
   ========================================================================== */
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Lenis from "lenis";
import "lenis/dist/lenis.css";

gsap.registerPlugin(ScrollTrigger);

const mq = (q) => window.matchMedia(q);
export const reduceMotion = mq("(prefers-reduced-motion: reduce)").matches;
export const finePointer = mq("(hover: hover) and (pointer: fine)").matches;

export let lenis = null;
if (reduceMotion) document.documentElement.classList.add("reduce-motion");

if (!reduceMotion && finePointer) {
  lenis = new Lenis({
    autoRaf: false,          /* GSAP's ticker drives it, so there is one clock */
    lerp: 0.11,
    wheelMultiplier: 0.95,
    anchors: { offset: 0 },  /* in-page links glide instead of jumping */
    prevent: (node) => node.closest?.("[data-lenis-prevent]"),
  });
  lenis.on("scroll", ScrollTrigger.update);
  gsap.ticker.add((time) => lenis.raf(time * 1000));
  gsap.ticker.lagSmoothing(0);
  document.documentElement.classList.add("has-lenis");
  if (import.meta.env.DEV) window.__lenis = lenis;
}

/* the essay reader scrolls itself, so the page has to hold still under it */
export function holdScroll(on) {
  if (!lenis) return;
  on ? lenis.stop() : lenis.start();
}

/* the reader marks <html> while it's open; follow that rather than wiring
   every caller up to this module */
new MutationObserver(() => holdScroll(document.documentElement.classList.contains("reader-open")))
  .observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });

/* the page changes height after load (fonts, the essay list), so scroll
   triggers re-measure when it does */
const refresh = () => ScrollTrigger.refresh();
document.fonts?.ready.then(refresh);
window.addEventListener("essays:ready", () => requestAnimationFrame(refresh));
window.addEventListener("load", refresh);

export { gsap, ScrollTrigger };
