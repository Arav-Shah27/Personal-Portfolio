/* ==========================================================================
   What I've Done: current runs down the route as you read, each stop
   lights up when it gets there, and the project chips tilt toward the mouse.
   ========================================================================== */
import { gsap, ScrollTrigger, reduceMotion, finePointer } from "./lib/motion.js";

export function startWork() {
  route();
  chips();
}

function route() {
  const route = document.querySelector(".route");
  if (!route) return;
  const track = route.querySelector(".route-track");
  const entries = [...route.querySelectorAll(".entry")];

  if (reduceMotion) {
    route.style.setProperty("--fill", 1);
    entries.forEach((e) => e.classList.add("is-lit"));
    return;
  }

  /* where each stop sits along the track, as a fraction of its length */
  let stops = [];
  const measure = () => {
    const t = track.getBoundingClientRect();
    stops = entries.map((e) => {
      const n = e.querySelector(".route-node").getBoundingClientRect();
      return (n.top + n.height / 2 - t.top) / t.height;
    });
  };

  ScrollTrigger.create({
    trigger: route,
    start: "top 72%",
    end: "bottom 55%",
    scrub: 0.4,
    onRefresh: measure,
    onUpdate: (self) => {
      const f = self.progress;
      route.style.setProperty("--fill", f.toFixed(4));
      entries.forEach((e, i) => {
        const lit = f >= stops[i] - 0.004;
        if (lit && !e.classList.contains("is-lit")) {
          e.classList.add("is-lit");
          const n = e.querySelector(".route-node").getBoundingClientRect();
          window.sitePop?.(n.left + n.width / 2, n.top + n.height / 2);
          window.siteRipple?.(n.left + n.width / 2, n.top + n.height / 2);
        } else if (!lit) e.classList.remove("is-lit");
      });
    },
  });
}

/* chips lean a few degrees toward the mouse, like picking one up to look */
function chips() {
  if (reduceMotion || !finePointer) return;
  document.querySelectorAll(".project").forEach((card) => {
    /* picking a chip up sends a little current out into the board under it */
    card.addEventListener("pointerenter", () => {
      const r = card.getBoundingClientRect();
      window.siteRipple?.(r.left + r.width / 2, r.top + r.height / 2);
    });
    const tilt = (rx, ry) => gsap.to(card, { "--rx": `${rx}deg`, "--ry": `${ry}deg`, duration: 0.6, ease: "power3.out", overwrite: "auto" });
    card.addEventListener("pointermove", (e) => {
      const r = card.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width - 0.5, y = (e.clientY - r.top) / r.height - 0.5;
      tilt((-y * 6).toFixed(2), (x * 7).toFixed(2));
    });
    card.addEventListener("pointerleave", () => tilt(0, 0));
  });
}
