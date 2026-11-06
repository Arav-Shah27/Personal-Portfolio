#!/usr/bin/env node
// Writes pixelfx/catalog.json: every effect's id and meta, so the /edit page can list them all without
// loading 240-odd modules up front. Run it after adding or changing an effect file:
//
//   node scripts/pixelfx-catalog.mjs

import { readdirSync, writeFileSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "pixelfx");
const FX = join(ROOT, "src", "fx");
const { categories } = await import(pathToFileURL(join(FX, "categories.js")).href);

const ids = [];
for (const cat of readdirSync(FX)) {
  if (!statSync(join(FX, cat)).isDirectory()) continue;
  for (const f of readdirSync(join(FX, cat)))
    if (f.endsWith(".js") && !f.startsWith("_")) ids.push(`${cat}/${f.slice(0, -3)}`);
}

const order = new Map(categories.map((c, i) => [c.id, i]));
const effects = [];
for (const id of ids) {
  try {
    const mod = await import(pathToFileURL(join(FX, id + ".js")).href);
    const m = mod.meta;
    if (!m) continue;
    effects.push({
      id,
      cat: id.split("/")[0],
      name: m.name,
      desc: m.desc,
      tags: m.tags ?? [],
      size: m.size,
      origin: m.origin,
      duration: m.duration,
      loop: !!m.loop,
      fps: m.fps ?? 30,
      bg: m.bg ?? "dark",
      actor: !!m.actor,
      acted: !!mod.act,
      options: m.options ?? {},
    });
  } catch (e) {
    console.error(`skipping ${id}: ${String(e.message ?? e).split("\n")[0]}`);
  }
}
effects.sort((a, b) => (order.get(a.cat) ?? 99) - (order.get(b.cat) ?? 99) || a.id.localeCompare(b.id));

writeFileSync(
  join(ROOT, "catalog.json"),
  JSON.stringify({ categories: categories.map(({ id, name, blurb }) => ({ id, name, blurb })), effects }) + "\n",
);
console.log(`${effects.length} effects -> pixelfx/catalog.json`);
