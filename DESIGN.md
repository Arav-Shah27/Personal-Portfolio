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
- **Weather is light too.** Rain, light shafts and sheet lightning are all
  computed in the world shader and go through the same dither, so they're
  pixels in the ramp, not overlays. Rain is always there but faint, and
  brightens near the lanterns and in a flash; shafts burst out from wherever
  a bolt lands and only cost anything while it's flashing.
- **Current is the thread.** Lightning strikes the door, runs through the
  board, fills the route, lights the stops, ripples out from what you touch.
  New interactions should feel like they send or receive current.

## The house

Behind the round door is a house, and the page is a walk through it. The
dive goes in at the door, the hall's ribs curl away to the left, What I've
Done is the study (the map for the experiences, the workbench for the
projects), My Brain is the parlour by the fire, and the end of the page
steps out of the back door and looks back at it glowing in the hill.

- **It's the stage's own pixels.** The house is plain 3D shapes, lit by
  lanterns and a fire, rendered at one texel per art pixel and dithered into
  the same gold ramp as the painting. Lightning in the round windows shows
  the rooms in their real colours for an instant, like the flash over the
  painting does.
- **The page is the route.** Each section is pinned to a stop on the
  camera's path; the gaps between sections (`.walk`) are where you walk.
  Nobody has to explore to read anything: scrolling straight down passes
  every room and every word.
- **Rooms step back under words.** Where text covers the screen the house
  dims to about half, so it still shows but never fights the reading. In
  the walks it's at full strength.
- **Finding things is extra.** Objects light up under the pointer when
  there's something to find; the map, books and workbench lead to their
  sections, and anything else says what `src/finds.js` says. Empty entries
  are just furniture. What's written there is also in the page for screen
  readers.
- **Reduced motion** stands still at each room instead of walking.

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

## Current in the type

Two moments where the lightning touches the words themselves, both built from
the real glyphs rasterised onto the stage's pixel grid, so they're the
letters' own shapes in the stage's own pixels and ramp:

- **The name is written in lightning.** A bolt lands on the first letter and
  the current runs through each stroke, jumps to the next letter (and leaps
  across the painting from one line to the other), and each finished letter
  flashes and becomes the real one. Bolts and sparks are random every visit.
- **Click a title and it takes the hit.** The letters burst into gold pixels
  from where it struck and fly back, left to right, into place.

The words are always real text underneath (they're only hidden while their
pixels are out), and under reduced motion neither happens.

## The eye

The tower's eye is the one character on the site. It perches on top of text
(never over it), hops between headings and paragraphs, and watches the
visitor. It never trails the cursor like a second pointer: it goes to where
you are, in hops, and stays put. While the page scrolls it keeps to the
middle of the screen, hopping ahead to the text that will be there when it
lands, instead of riding a heading off the top. When the tower is on screen it lives in its
socket, and it gets out of the way of the QR code completely.

The QR code is gold on black stone to match the tower, but the gold squares
are one flat colour. Scanners threshold block by block, so any shading inside
the light squares can read as dark; texture only ever goes in the black.

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
chrome labels (like "tap the tower").
