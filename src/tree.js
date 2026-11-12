/* ==========================================================================
   The Party Tree in the footer: it grows when you reach it, and a tap folds
   it into a QR code for my LinkedIn (and back again).
   ========================================================================== */
import { gsap, ScrollTrigger, reduceMotion } from "./lib/motion.js";
import { qrMatrix } from "./qr.js";

/* the flat, crisp code: one canvas pixel per module, scaled up by CSS */
function paintQr(canvas, qr) {
  canvas.width = canvas.height = qr.size;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#fff3cf";
  ctx.fillRect(0, 0, qr.size, qr.size);
  ctx.fillStyle = "#0a0806";
  for (let r = 0; r < qr.size; r++) for (let c = 0; c < qr.size; c++) if (qr.dark(r, c)) ctx.fillRect(c, r, 1, 1);
}

export async function startTree(storm) {
  const button = document.querySelector(".party-tree");
  if (!button) return;
  const hint = document.querySelector(".party-hint");
  const canvas = button.querySelector(".party-qr");

  if (!storm) {
    /* no stage: just the code */
    paintQr(canvas, qrMatrix());
    button.setAttribute("aria-pressed", "true");
    button.disabled = true;
    hint.textContent = "scan for my linkedin";
    return;
  }

  const { createTree } = await import("./stage/tree.js");
  const tree = storm.stage.add(createTree(storm.stage, { box: button }));
  paintQr(canvas, tree.qr);
  const s = tree.state;
  if (import.meta.env.DEV) window.__tree = tree;

  /* it grows when you get there */
  if (reduceMotion) s.grow = 1;
  else ScrollTrigger.create({
    trigger: button, start: "top 85%", once: true,
    onEnter: () => gsap.to(s, { grow: 1, duration: 2.8, ease: "none" }),
  });

  let folded = false, tl = null;
  button.addEventListener("click", () => {
    folded = !folded;
    button.setAttribute("aria-pressed", String(folded));
    button.setAttribute("aria-label", folded ? "Grow the tree back" : "Fold the tree into a QR code for my LinkedIn");
    hint.textContent = folded ? "scan for my linkedin · tap to grow it back" : "tap the tree";
    tl?.kill();
    if (reduceMotion) {
      Object.assign(s, { fold: folded ? 1 : 0, cam: folded ? 1 : 0, grow: 1 });
      storm.stage.invalidate();
      return;
    }
    if (s.grow < 1) gsap.to(s, { grow: 1, duration: 0.6 });
    tl = gsap.timeline({ defaults: { ease: "power2.inOut" } });
    if (folded) tl.to(s, { fold: 1, duration: 1.5 }, 0).to(s, { cam: 1, duration: 1.7 }, 0.15);
    else tl.to(s, { cam: 0, duration: 1.5 }, 0).to(s, { fold: 0, duration: 1.7 }, 0.2);
  });
}
