/* ==========================================================================
   Speak, friend, and enter. Type "mellon" anywhere on the page (not in a
   text field) and the sky answers, then the door opens onto the pixel lab.
   ========================================================================== */
const WORD = "mellon";

export function startMellon(storm) {
  let typed = "";
  window.addEventListener("keydown", (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey || e.key.length !== 1) return;
    if (e.target.closest?.("input, textarea, [contenteditable]")) return;
    typed = (typed + e.key.toLowerCase()).slice(-WORD.length);
    if (typed !== WORD) return;
    typed = "";
    window.siteToast?.("speak, friend, and enter");
    if (storm) {
      const { stage, world } = storm;
      world.strike(stage.frame.w / 2, stage.frame.h * 0.6, { aimed: true });
    }
    setTimeout(() => { window.location.href = "/edit/"; }, 1100);
  });
}
