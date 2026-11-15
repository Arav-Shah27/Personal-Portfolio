/* ==========================================================================
   Is a point on the letters of an element, or only inside its box? A title's
   box can be far bigger than its words (the hero name stretches across most
   of the hero), so anything that should answer the letters themselves asks
   this instead of trusting the click target.
   ========================================================================== */
const range = document.createRange();

export function overText(el, x, y, pad = 6) {
  const walk = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  for (let node; (node = walk.nextNode()); ) {
    if (!node.data.trim()) continue;
    range.selectNodeContents(node);
    for (const b of range.getClientRects())
      if (x >= b.left - pad && x <= b.right + pad && y >= b.top - pad && y <= b.bottom + pad) return true;
  }
  return false;
}
