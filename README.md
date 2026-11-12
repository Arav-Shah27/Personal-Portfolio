# Arav Shah — Portfolio

A single-page site with no build step and no dependencies: HTML, one stylesheet,
a few small scripts, and a vendored copy of the pixelfx pixel-art library for
the lightning.

```
index.html              the page: home, what I've done, my brain
styles.css              all styling
js/cursor.js            the gold ring cursor and its dust trail
js/main.js              nav, hero parallax, scroll reveals, copy-email
js/brain.js             the essay list and reader
js/lightning.js         pixel lightning: hero sky bolts, click pops, footer ball
edit/                   the pixel lab at /edit (customize + save pixel effects)
pixelfx/                pixelfx library (MIT), plus my own effects
pixelfx/custom/         >>> EFFECTS SAVED FROM THE PIXEL LAB <<<
scripts/dev.mjs         local server (lets the pixel lab save into the project)
essays/                 >>> YOUR ESSAYS — see essays/README.md <<<
assets/shire.jpg        hero background
assets/logos/           >>> YOUR LOGO PNGs — see assets/logos/README.md <<<
vercel.json             caching + clean URLs
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
| Colors                         | `styles.css`, the variables at the top (`--gold`…) |
| Fonts                          | the Google Fonts `<link>` in `index.html`, plus `--font-content` / `--font-chrome` in `styles.css` |
| Cursor dust amount             | `js/cursor.js`, `distance / 10` in `shed()` — bigger number, less dust |

## The design system

Everything visual comes from the tokens at the top of `styles.css`, not from
per-component values. There is one type scale, four line heights, one 4px
spacing scale, three corner radii, three durations and two easing curves.

Type has two faces with fixed jobs:

- **Literata** (serif) carries content: the name, headings, body copy, essays.
- **IBM Plex Mono** carries chrome: nav, dates, tags, counters, the footer.

Every small mono label shares the single `.label` class, so they can't drift
apart. Mono labels are lowercase; mono data (dates, monograms) keeps its
natural case. Ranges use en dashes (2025 – 2026), not hyphens or em dashes.

If you add something, reuse a token rather than typing a new value. That
consistency is most of what separates a designed page from a generated one.

## Details worth knowing

- **The cursor** only replaces the normal one on devices with a real mouse or
  trackpad. Phones, tablets, and anyone with "reduce motion" turned on get the
  standard cursor. Its easing is time-based, so it feels the same on 60Hz and
  120Hz displays.
- **Motion** — parallax, reveals, and the cursor all switch off under the
  system's reduce-motion setting.
- **Essays** are escaped before formatting is applied, so nothing written in a
  `.md` file can inject HTML or scripts into the page.
- **Essay links** are shareable: `yourdomain.com/#brain/<slug>` opens that essay
  directly, and the browser back button closes it.

## Lightning

Three touches, all in the site's own gold (`STORM_GOLD` in
`pixelfx/src/fx/lightning/sky-bolt.js`):

- **Hero sky.** Every 9–18 s a distant bolt flickers down at the left or right
  edge of the painting and the painting brightens with it (`--flash`). Click
  the sky and a bolt comes down where you clicked.
- **Clicks.** A tiny static pop wherever you click.
- **Footer.** A small ball of lightning wanders over the footer line.

Two of the effects were made for this site: `lightning/sky-bolt` and
`lightning/static-pop`. The footer uses the library's `lightning/ball-lightning`,
recolored. All of it loads after the page settles, pauses off screen, and is
off entirely under reduce-motion. Tuning lives at the top of each section in
`js/lightning.js` (how often bolts come, where, how big a pixel is).

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
| `node scripts/dev.mjs`  | `pixelfx/custom/<name>.json` (+ `.js` for code) |
| the live Vercel site    | that browser's localStorage (download or copy the prompt to move them) |

The live site is static hosting, so it has nowhere to write files. That also
means nobody visiting /edit can change anything on the site.

After adding or changing an effect file under `pixelfx/src/fx/`, run
`node scripts/pixelfx-catalog.mjs` so the lab lists it.
