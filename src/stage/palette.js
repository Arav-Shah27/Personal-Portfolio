/* The one palette everything on the stage is drawn in: storm gold, from the
   page's own black up to a white-hot core. It's pixelfx's STORM_GOLD with the
   darkest step swapped for the page background, so the canvas melts into the
   sections around it. */
export const RAMP = [
  "#0a0806", "#1f1607", "#3a2709", "#6e4b14", "#a87a2a",
  "#d9b45a", "#f0cf7a", "#fff3cf", "#ffffff",
];

/* css px per art pixel: chunky enough to read as pixel art, fine enough that
   the painting is still recognisable */
export function pixelSize() {
  const w = window.innerWidth;
  return w < 520 ? 2 : w < 1100 ? 3 : 3;
}
