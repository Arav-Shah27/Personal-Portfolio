/* the page's one entry point; Vite bundles everything it imports */
import "./fonts.js";
import "./lib/motion.js";
import { startStorm } from "./storm.js";
import { startHero } from "./hero.js";
import { startDescent } from "./descent.js";
import "../styles.css";
import "./styles/hero.css";
import "../js/cursor.js";
import "../js/main.js";
import "../js/brain.js";
import "../js/lightning.js";

export const storm = startStorm();
startHero();
startDescent(storm);
