// The pixel lab's save endpoint (/api/pixelfx/custom). The /edit page posts the effects you make here, and they
// land in pixelfx/custom/ so they show up in the project. It only exists on the local dev server: on Vercel there
// is no save endpoint, so the lab keeps saves in your browser and lets you download them instead.

import { readFile, writeFile, readdir, mkdir, unlink } from "node:fs/promises";
import { join } from "node:path";

const slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60);

function send(res, code, body) {
  res.writeHead(code, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
  res.end(JSON.stringify(body));
}
async function body(req) {
  let s = "";
  for await (const c of req) {
    s += c;
    if (s.length > 2e6) throw new Error("too big");
  }
  return JSON.parse(s);
}

/** Connect-style middleware: handles /api/pixelfx/custom and passes everything else on. */
export function labApi(root) {
  const CUSTOM = join(root, "pixelfx", "custom");
  return async (req, res, next) => {
    const path = decodeURIComponent(new URL(req.url, "http://localhost").pathname);
    if (!path.startsWith("/api/pixelfx/custom")) return next();
    try {
      await mkdir(CUSTOM, { recursive: true });
      if (req.method === "GET" && path === "/api/pixelfx/custom") {
        const list = [];
        for (const f of (await readdir(CUSTOM)).filter((f) => f.endsWith(".json"))) {
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
      send(res, 404, { error: "not found" });
    } catch (e) {
      send(res, 500, { error: String(e.message ?? e) });
    }
  };
}
