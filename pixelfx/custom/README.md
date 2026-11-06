# Your pixel lab saves

When the site runs locally with `node scripts/dev.mjs`, pressing **save** in the
pixel lab (`/edit`) writes here:

- `<name>.json`: the effect it's based on (`base`), the options you changed,
  your notes, and, for code effects, the source.
- `<name>.js`: for code effects only, the module itself, ready to import.

To put one on the homepage, press **copy prompt for claude** in the lab and
paste it to Claude, or just say "add pixelfx/custom/<name>.json to the site".

On the deployed site there's no server to write files, so saves stay in that
browser (download the .json or copy the prompt to move them over).
