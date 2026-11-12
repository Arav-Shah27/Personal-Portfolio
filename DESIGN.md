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

| face | job | where |
|---|---|---|
| Cormorant 500 | display | the name, section titles, entry and chip titles, essay titles, drop caps |
| Literata | reading | body copy, essays (1.125rem, 1.78 leading, ~62ch) |
| IBM Plex Mono 400/500 | chrome | nav, labels, dates, tags (lowercase, tracked .08em) |
| Geist Pixel | numbers and markings | counters, essay numbers, chip part numbers, the loader |

Display type goes big and tight (`-.03em`, line-height under 1). Text over the
stage always carries a soft dark shadow so its edges stay clean on the
dithering.

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
