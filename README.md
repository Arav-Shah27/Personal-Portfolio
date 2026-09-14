# Arav Shah — Portfolio

A single-page site with no build step and no dependencies: HTML, one stylesheet,
and three small scripts.

```
index.html              the page: home, what I've done, my brain
styles.css              all styling
js/cursor.js            the gold ring cursor and its dust trail
js/main.js              nav, hero parallax, scroll reveals, copy-email
js/brain.js             the essay list and reader
essays/                 >>> YOUR ESSAYS — see essays/README.md <<<
assets/shire.jpg        hero background
assets/logos/           >>> YOUR LOGO PNGs — see assets/logos/README.md <<<
vercel.json             caching + clean URLs
```

## Run it locally

```bash
cd ~/arav-portfolio && python3 -m http.server 4173
```

Then open http://localhost:4173. Opening `index.html` by double-clicking won't
load the essays, because browsers block reading local files; use the server.

## Common edits

| To change…                     | Edit                                               |
|--------------------------------|----------------------------------------------------|
| Your intro line                | `index.html`, the `hero-lede` paragraph            |
| An experience or project       | `index.html`, inside `id="work"`                   |
| Essays                         | `essays/` — full guide in `essays/README.md`       |
| Logos                          | drop PNGs into `assets/logos/`                     |
| Colors                         | `styles.css`, the variables at the top (`--gold`…) |
| Cursor dust amount             | `js/cursor.js`, `distance / 10` in `shed()` — bigger number, less dust |

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
