# Writing in My Brain

Every essay is two things:

1. **A line in `index.json`** — this is the row people see and click.
2. **A `.md` file** — this is the essay itself.

The `slug` in `index.json` must match the file name. `"slug": "essay-1"` reads `essay-1.md`.

---

## Fill in one of the blank essays

Open `index.json` and fill in the empty quotes:

```json
{ "slug": "essay-1", "title": "The Real Why", "tag": "thoughts", "date": "sep 2026" },
```

- `title` — the row's title, and the big heading when the essay opens
- `tag` — optional, a one-word label shown beside the date (`thoughts`, `building`…)
- `date` — optional, written however you like (`sep 2026`, `Sep 14, 2026`)

Then open `essay-1.md` and write. Plain text works fine — just leave a blank line between paragraphs.

## Add a new essay

1. Make a new file in this folder, e.g. `on-listening.md`, and write in it.
2. Add a line to `index.json` whose `slug` matches that file name (without `.md`):

```json
[
  { "slug": "essay-1", "title": "The Real Why", "tag": "thoughts", "date": "sep 2026" },
  { "slug": "on-listening", "title": "On Listening", "tag": "people", "date": "oct 2026" }
]
```

Watch the commas: every line except the last one ends with `,`. A missing or extra comma is the most common reason the list stops showing up.

**Slugs** can only use letters, numbers, `-` and `_`. No spaces. The slug also becomes the essay's link, e.g. `aravshah.com/#brain/on-listening`, so it's worth picking a good one.

## Reorder, hide, or delete

- **Reorder** — move lines around in `index.json`. The site shows them top to bottom and numbers them automatically.
- **Hide** — delete the line from `index.json` but keep the `.md` file. It disappears from the site and you can bring it back later.
- **Delete** — remove the line *and* the `.md` file.

## Formatting cheat sheet

```markdown
A normal paragraph. Leave a blank line between paragraphs.

## A section heading
### A smaller heading

**bold** and *italic*

> A quote, shown larger and in italics.

- a bulleted list
- another point

1. a numbered list
2. second item

[a link](https://example.com)

![a picture](assets/essays/photo.jpg)

---   (a divider line)
```

For pictures, put the image in `assets/essays/` (create the folder) and reference it as shown.

## Check it before you push

From the project folder, run:

```bash
python3 -m http.server 4173
```

Open http://localhost:4173, scroll to My Brain, and click your essay. Refresh the page after each edit.

If the list shows *"Couldn't load essays/index.json"*, the JSON has a typo (usually a comma). Paste the file into https://jsonlint.com to find the exact line.
