# Design: Storm over the Shire

The rules the site is built on, so new pieces fit the world instead of
sitting on top of it.

## The world

- **One canvas, one palette.** Everything that isn't text is drawn by the
  stage (`src/stage/`) into a small render target and dithered into the storm
  gold ramp (`src/stage/palette.js`). New visuals should be a stage layer or a
  pixel canvas that uses the same ramp and the same 4x4 Bayer dither. No
  smooth gradients, glows or blurs standing in for pixel art.
- **Light, not colour.** Scenes output brightness; the ramp turns it into
  gold. True colour only appears where a scene writes alpha (a lightning flash
  showing the painting as it really is). Use it rarely; that's what makes it
  land.
- **The ring is the motif.** The logo, the round door, the reader opening, the
  loader, the route's stops, the sign-off at the end of an essay. When a new
  thing needs a shape, it's probably the ring.
- **Current is the thread.** Lightning strikes the door, runs through the
  board, fills the route, lights the stops, ripples out from what you touch.
  New interactions should feel like they send or receive current.

## Type

Pixel letters for titles, a plain clean sans for reading. The pixel face is
what ties the type to the dithered world; everything you read for more than a
line stays in an ordinary, quiet face.

| face | job | where |
|---|---|---|
| Pixelify Sans | display and titles | the name, section titles, entries, projects, essay titles, drop caps, the 404 |
| Geist | reading | body copy and essays (17px, 1.7 leading; 18px and 1.75 in the reader) |
| Geist Mono | chrome | nav, labels, dates, tags, counters, chip markings |

Pixelify only goes on big type: below about 20px its pixel grid smears, so
small markings use Geist Mono instead. Titles sit at weight 500 so the strokes
stay even, like a font drawn on a grid. `font-synthesis` is off: every face
ships its real weights and Geist its real italics. No negative tracking on the
pixel face. Text over the stage always carries a soft dark shadow so its edges
stay clean on the dithering.

## Colour

- Page `#0a0806` (the ramp's first step), text `#ece4d2` with muted (.68) and
  faint (.56) alphas, gold `#d9b45a`, bright gold `#f0cf7a`.
- Gold is for state and emphasis (the active section, a lit stop, a role, a
  hover), not decoration.

## Motion

- One clock: GSAP's ticker drives Lenis, ScrollTrigger and the stage.
- Ambient motion runs at 30fps; anything answering the visitor runs at 60.
- Every animation has a reduced-motion answer: usually "be in the final state
  and stay still".
- Entrances ease out (`expo.out`); scroll-driven scenes scrub with no easing
  of their own so they track the scroll exactly.

## Content

Every word on the page is the owner's. Design work never edits copy, fixes
typos in essays, or adds claims. New UI text is limited to short lowercase
chrome labels (like "tap the tree").
