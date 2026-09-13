# Arav Shah — Portfolio

A single-page, Lord of the Rings themed portfolio. No build step, no
dependencies — just HTML, CSS, and one JavaScript file.

```
index.html                  the whole page (3 sections)
styles.css                  all styling
script.js                   stone path, scroll reveals, brain interactions
assets/hobbit-shire.jpg     the Shire watercolor (hero)
assets/grass-tile.svg       generated grass that continues the painting
assets/grass-overlay.svg    larger wash layer that hides the tile repeat
assets/cursor-ring*.png     the golden ring cursor (generated)
assets/logos/               >>> DROP YOUR LOGO PNGs HERE <<<
vercel.json                 caching + clean URLs
```

## Run it locally

```bash
cd ~/arav-portfolio
python3 -m http.server 4173
```

Then open http://localhost:4173

## Add your logos

Put these files in `assets/logos/` (see the README in that folder):

**Experiences:** `hack-the-future.png` · `raytheon.png` · `aaee.png`
**Projects:** `homebeacon.png` · `socet.png` · `midtown.png` · `showflow.png`

Transparent PNGs, roughly square. Anything missing falls back to a lettered
monogram tile, so the page never shows a broken image.

## How the parallax works

The ground is two fixed, oversized layers (`.bg-tile` and `.bg-wash`) that get
moved with a GPU `translate3d` instead of repainting a page-sized tiled
background on every scroll. They drift at 34% and 16% of scroll speed, and the
hero painting drifts at 18%, which is what gives the depth.

Two details keep it from breaking: the eased value is the *scroll position*,
not the wrapped offset (easing a wrapped value would animate backwards through
a whole tile at every seam), and each layer's offset wraps at exactly one tile
width, so it never runs out of texture. All of it is disabled under
`prefers-reduced-motion`.

## How the background works

The hero is the watercolor painting. Its bottom edge is masked with a gradient
so it dissolves into a generated grass texture that tiles down the rest of the
page — the tile's colors were sampled from the painting's bottom row (`#658447`)
so the two never show a seam. `script.js` then draws the stepping-stone path as
one SVG sized to the full document height, weaving right-left-right the whole
way down. It redraws on resize, so it always reaches the bottom.
