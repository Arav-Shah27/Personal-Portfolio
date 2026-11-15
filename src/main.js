/* ==========================================================================
   The page's one entry point. Type, layout and everything that reads as
   content come first; the stage (three.js and the pixel world) is loaded
   right after as its own chunk, so the words never wait on WebGL.
   ========================================================================== */
import "./fonts.js";
import "./styles/base.css";
import "./styles/chrome.css";
import "./styles/nav.css";
import "./styles/hero.css";
import "./styles/sections.css";
import "./styles/work.css";
import "./styles/chips.css";
import "./styles/reveal.css";
import "./styles/brain.css";
import "./styles/footer.css";
import "./styles/reader.css";
import "./styles/loader.css";

import "./lib/motion.js";
import "../js/cursor.js";
import "../js/main.js";
import "../js/brain.js";
import "../js/lightning.js";
import { startHero } from "./hero.js";
import { startWork } from "./work.js";
import { startDies } from "./dies.js";
import { startSound } from "./sound.js";
import { startTitles } from "./titles.js";
import { startMagnets } from "./magnet.js";
import { startLoader } from "./loader.js";
import { startDescent } from "./descent.js";
import { startTower } from "./tower.js";
import { startMellon } from "./mellon.js";
import { startZap } from "./zap.js";
import { startRooms } from "./rooms.js";

const zap = startZap();
startHero(zap);
startWork();
startDies();
startSound();
startTitles();
startMagnets();

/* the stage, in its own chunk */
let storm = null;
try {
  const { startStorm } = await import("./storm.js");
  storm = startStorm();
} catch {
  document.documentElement.classList.add("no-stage");
}
if (zap) zap.storm = storm;
startLoader(storm);
startDescent(storm);
startRooms(storm);
startTower(storm);
startMellon(storm);
