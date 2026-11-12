# Arav Shah — Portfolio

**Storm over the Shire.** One continuous scene you scroll through: lightning
over the Shire at night, a dive through the round green door, a circuit board
on the other side, a brain made of gold points, and a voxel tree growing out of
a QR code. Everything visual is drawn by one WebGL canvas behind the page,
rendered as dithered gold pixel art, so it all reads as one world.

Every word on the page (the intro, experiences, projects, essays) is plain
HTML, so it's readable, selectable, indexable, and works without WebGL.

```
index.html              the page: home, what I've done, my brain, footer
404.html                the lost page (same storm, more lightning)
src/main.js             entry: loads the styles and starts everything below
src/stage/              the WebGL world (three.js)
  stage.js                one fixed canvas, one render target, 30fps when idle
  dither.js               turns every frame into gold pixel art (4x4 Bayer)
  palette.js              the gold ramp and the pixel size
  world.js                the painting at night, the storm, the door, the board
  brain.js                the brain made of points, with a node per essay
  tree.js                 the Party Tree on its QR code
src/storm.js            puts the stage on the page and wires up the brain
src/descent.js          scrolling dives into the door (GSAP ScrollTrigger)
src/hero.js             the name's intro and its letters catching the light
src/work.js             the route that fills with current, chips that tilt
src/dies.js             the little pixel animations inside each project chip
src/tree.js             the Party Tree's grow and fold
src/loader.js           the ring that charges up on a first visit
src/sound.js            thunder, made in the browser (off by default)
src/titles.js           titles that rise in, labels that flicker
src/magnet.js           round buttons that lean toward the mouse
src/mellon.js           type "mellon" anywhere
src/qr.js               the LinkedIn QR code
src/lib/motion.js       GSAP, ScrollTrigger and Lenis smooth scrolling
src/styles/             one stylesheet per part of the page
js/brain.js             the essay list and the reader
js/main.js              nav state, reveals, copy-email, toast
js/cursor.js            the ring cursor and its spark
js/lightning.js         pixel pops on click, ball lightning over the footer
edit/                   the pixel lab at /edit (customize + save pixel effects)
pixelfx/                pixelfx library (MIT), plus my own effects
pixelfx/custom/         >>> EFFECTS SAVED FROM THE PIXEL LAB <<<
essays/                 >>> YOUR ESSAYS — see essays/README.md <<<
assets/shire.jpg        the painting (shire-stage.jpg is a lighter copy for WebGL)
assets/og.png           the share card
assets/logos/           >>> YOUR LOGO PNGs — see assets/logos/README.md <<<
scripts/lab-api.mjs     lets the pixel lab save into the project during npm run dev
vite.config.js          the build; vercel.json tells Vercel to run it
```

## Run it locally

```bash
cd ~/arav-portfolio && npm install && npm run dev
```

Then open http://localhost:4173 (and http://localhost:4173/edit for the pixel
lab, which can save straight into `pixelfx/custom/` while the dev server runs).
`npm run build` makes the production site in `dist/`, and `npm run preview`
serves that build on http://localhost:4174. Vercel runs the same build on
every push (see `vercel.json`).

## Common edits

| To change…                     | Edit                                               |
|--------------------------------|----------------------------------------------------|
| Your intro line                | `index.html`, the `hero-lede` paragraph            |
| An experience or project       | `index.html`, inside `id="work"`                   |
| Essays                         | `essays/` — full guide in `essays/README.md`       |
| Logos                          | drop PNGs into `assets/logos/`                     |
| Where the QR code points       | `LINKEDIN` in `src/qr.js`                          |
| Colors                         | `src/styles/base.css` (`--gold`…) and the stage's ramp in `src/stage/palette.js` |
| How chunky the pixels are      | `pixelSize()` in `src/stage/palette.js`            |
| How often the sky strikes      | `ambient(...)` in `src/storm.js`                   |
| How long the dive into the door is | `.hero-run` height in `src/styles/hero.css`    |

A new project chip gets its die animation from the `data-die` name on its
canvas: add a scene with that name to `SCENES` in `src/dies.js`.

## The design system

Tokens live in `src/styles/base.css`; everything is built from them.

- **Cormorant** sets the display type: the name, section and essay titles.
- **Literata** carries the reading: body copy and essays.
- **IBM Plex Mono** is chrome: nav, labels, dates, tags.
- **Geist Pixel** is for numbers and markings: counters, chip part numbers.

Colour is one ramp of storm gold, from the page's own black to a white-hot
core. The stage uses exactly that ramp, so the canvas and the CSS never
disagree. Mono labels are lowercase; ranges use en dashes (2025 – 2026).

## How it behaves

- **Reduced motion:** no dive, no intro, no ambient lightning, no smooth
  scrolling; the painting simply gives way to a still board.
- **No WebGL:** the painting shows as a graded image, the QR code shows flat,
  and everything else works as normal.
- **Phones:** native scrolling (no Lenis), a finer pixel grid, and the brain
  sits under the essay list.
- **Performance:** text paints first; three.js loads after as its own chunk.
  The stage idles at 30fps, renders only what's on screen, and stops when the
  tab is hidden.
- **Essays** are escaped before formatting is applied, so nothing in a `.md`
  file can inject HTML or scripts into the page. `yourdomain.com/#brain/<slug>`
  opens an essay directly, and the back button closes it.
- **Sound** is off until you switch it on in the nav, and remembered after.

## The pixel lab (/edit)

A page for making pixel effects. It isn't linked from the site, and it's marked
noindex. In the lab you can:

- browse all ~246 pixelfx effects, plus mine, and play, pause or scrub them
- change any option live: palette ramps (with presets), seed, size, angle, glow
- open an effect's code, edit it, and run it, or start a new one from a template
- save it, download its JSON or a sprite sheet, or **copy a prompt for Claude**
  to have it added to the homepage

Saves are stored differently depending on where the lab runs:

| where                   | saves go to                                     |
|-------------------------|-------------------------------------------------|
| `npm run dev`           | `pixelfx/custom/<name>.json` (+ `.js` for code) |
| the live Vercel site    | that browser's localStorage (download or copy the prompt to move them) |

The live site is static hosting, so it has nowhere to write files. That also
means nobody visiting /edit can change anything on the site.

After adding or changing an effect file under `pixelfx/src/fx/`, run
`node scripts/pixelfx-catalog.mjs` so the lab lists it.
