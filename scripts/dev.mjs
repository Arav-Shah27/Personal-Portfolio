#!/usr/bin/env node
// Local preview server for the site, with one extra: the /edit pixel lab can save what you make straight into
// this project (pixelfx/custom/), so it shows up in VS Code and Claude can wire it into the homepage.
//
//   node scripts/dev.mjs            then open http://localhost:4173  (and /edit)
//
// No dependencies. It only listens on localhost. The deployed site on Vercel has no save endpoint, so there the
// editor keeps saves in your browser and lets you download them instead.

import { createServer } from "node:http";
import { readFile, writeFile, readdir, stat, mkdir, unlink } from "node:fs/promises";
import { join, extname, normalize, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const CUSTOM = join(ROOT, "pixelfx", "custom");
const PORT = Number(process.env.PORT) || 4173;
const TYPES = {
  ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8", ".json": "application/json; charset=utf-8", ".md": "text/markdown; charset=utf-8",
  ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".svg": "image/svg+xml", ".txt": "text/plain; charset=utf-8",
  ".woff2": "font/woff2", ".ico": "image/x-icon",
};
const slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60);

function send(res, code, body, type = "application/json; charset=utf-8") {
  res.writeHead(code, { "content-type": type, "cache-control": "no-store" });
  res.end(typeof body === "string" || Buffer.isBuffer(body) ? body : JSON.stringify(body));
}
async function body(req) {
  let s = "";
  for await (const c of req) {
    s += c;
    if (s.length > 2e6) throw new Error("too big");
  }
  return JSON.parse(s);
}

async function api(req, res, path) {
  await mkdir(CUSTOM, { recursive: true });
  if (req.method === "GET" && path === "/api/pixelfx/custom") {
    const files = (await readdir(CUSTOM)).filter((f) => f.endsWith(".json"));
    const list = [];
    for (const f of files) {
      try {
        list.push(JSON.parse(await readFile(join(CUSTOM, f), "utf8")));
      } catch {}
    }
    return send(res, 200, list);
  }
  if (req.method === "POST" && path === "/api/pixelfx/custom") {
    const item = await body(req);
    const name = slug(item.slug || item.name);
    if (!name) return send(res, 400, { error: "needs a name" });
    item.slug = name;
    await writeFile(join(CUSTOM, name + ".json"), JSON.stringify(item, null, 2) + "\n");
    // a hand-written effect also gets a real module file, ready to import
    // (item.module is the same source with its imports pointed at ../src/, so it works from pixelfx/custom/)
    if (item.kind === "code" && typeof item.code === "string") await writeFile(join(CUSTOM, name + ".js"), item.module ?? item.code);
    console.log(`saved pixelfx/custom/${name}.json`);
    return send(res, 200, { ok: true, slug: name, path: `pixelfx/custom/${name}.json` });
  }
  const del = path.match(/^\/api\/pixelfx\/custom\/([a-z0-9-]+)$/);
  if (req.method === "DELETE" && del) {
    for (const ext of [".json", ".js"]) await unlink(join(CUSTOM, del[1] + ext)).catch(() => {});
    console.log(`deleted pixelfx/custom/${del[1]}`);
    return send(res, 200, { ok: true });
  }
  return send(res, 404, { error: "not found" });
}

createServer(async (req, res) => {
  try {
    const url = new URL(req.url, "http://localhost");
    let path = decodeURIComponent(url.pathname);
    if (path.startsWith("/api/")) return await api(req, res, path);
    // like Vercel's cleanUrls: /edit -> /edit/index.html, /about -> /about.html
    let file = normalize(join(ROOT, path));
    if (!file.startsWith(ROOT)) return send(res, 403, "forbidden", "text/plain");
    let st = await stat(file).catch(() => null);
    if (st?.isDirectory()) {
      if (!path.endsWith("/")) {
        res.writeHead(308, { location: path + "/" + url.search });
        return res.end();
      }
      file = join(file, "index.html");
      st = await stat(file).catch(() => null);
    }
    if (!st && !extname(file)) {
      file += ".html";
      st = await stat(file).catch(() => null);
    }
    // same as Vercel: a missing page gets the site's own 404.html
    if (!st) {
      const page = await readFile(join(ROOT, "404.html")).catch(() => null);
      return page ? send(res, 404, page, TYPES[".html"]) : send(res, 404, "not found", "text/plain");
    }
    send(res, 200, await readFile(file), TYPES[extname(file).toLowerCase()] ?? "application/octet-stream");
  } catch (e) {
    send(res, 500, { error: String(e.message ?? e) });
  }
}).listen(PORT, "127.0.0.1", () => console.log(`http://localhost:${PORT}   (pixel lab: http://localhost:${PORT}/edit)`));
