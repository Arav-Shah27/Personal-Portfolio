/* ==========================================================================
   Things to find in the house.

   Every object here is in one of the rooms behind the round door. Write
   something in an object's `text` and it becomes something visitors can
   point at and click: the object lights up under the cursor, and a click
   opens a little card with your words. Leave `text` empty and it's just
   furniture.

   `label` is the card's small heading. `text` is plain text; a blank line
   starts a new paragraph. `link` is optional ({ href, text }) and goes at
   the bottom of the card.

   The map, the books and the workbench aren't here: they already lead to
   the experiences, the essays and the projects.
   ========================================================================== */
export const FINDS = {
  /* the parlour */
  "fireplace":      { label: "the fire",          text: "" },
  "plates":         { label: "the plates",        text: "" },
  "mantel":         { label: "on the mantel",     text: "" },
  "portrait-left":  { label: "a portrait",        text: "" },
  "portrait-right": { label: "another portrait",  text: "" },
  "chandelier":     { label: "the chandelier",    text: "" },
  "table":          { label: "on the table",      text: "" },
  "armchair-left":  { label: "an armchair",       text: "" },
  "armchair-right": { label: "the other armchair", text: "" },
  "chair":          { label: "the tall chair",    text: "" },

  /* the study */
  "globe":          { label: "the globe",         text: "" },
};
