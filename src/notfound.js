/* the 404 page: the same storm over the same painting, a little further
   off, with bolts coming down more often (you're lost, after all) */
import "./fonts.js";
import "./styles/base.css";
import "./styles/chrome.css";
import { reduceMotion } from "./lib/motion.js";
import { createStage } from "./stage/stage.js";
import { createWorld } from "./stage/world.js";

const root = document.documentElement;
const stage = createStage();
if (stage) {
  root.classList.add("has-stage");
  const world = stage.add(createWorld(stage, {
    onReady: () => root.classList.add("stage-ready"),
    onFlash: (f) => root.style.setProperty("--flash", f.toFixed(3)),
  }));
  world.state.centerY = 520;
  world.state.dim = 1;
  if (!reduceMotion) {
    const strike = () => {
      const W = stage.frame.w;
      world.strike(W * (0.1 + Math.random() * 0.8));
      setTimeout(strike, 4500 + Math.random() * 4000);
    };
    setTimeout(strike, 900);
    document.addEventListener("click", (e) => {
      if (e.target.closest("a")) return;
      world.strike(e.clientX / stage.frame.px, e.clientY / stage.frame.px, { aimed: true });
    });
  }
} else {
  root.classList.add("no-stage");
}
