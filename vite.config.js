import { defineConfig } from "vite";
import { cp } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));

/* These folders are served as plain files, the same in dev and in the build:
   essays and logos are fetched at runtime, and the /edit pixel lab loads
   pixelfx effect source by URL, so none of them go through the bundler. */
const STATIC = ["essays", "assets", "edit", "pixelfx", "robots.txt"];

export default defineConfig({
  server: { port: 4173, host: "127.0.0.1" },
  preview: { port: 4174, host: "127.0.0.1" },
  build: {
    target: "es2022",
    assetsDir: "build",
    assetsInlineLimit: 0,
    rollupOptions: {
      input: {
        main: resolve(root, "index.html"),
        notfound: resolve(root, "404.html"),
      },
    },
  },
  plugins: [
    {
      name: "pixel-lab-api",
      /* dev only, and loaded only then, so a production build never needs
         anything from scripts/ */
      async configureServer(server) {
        const api = pathToFileURL(resolve(root, "scripts", "lab-api.mjs")).href;
        const { labApi } = await import(/* @vite-ignore */ api);
        server.middlewares.use(labApi(root));
      },
    },
    {
      name: "copy-static",
      apply: "build",
      async closeBundle() {
        for (const p of STATIC) await cp(resolve(root, p), resolve(root, "dist", p), { recursive: true });
      },
    },
  ],
});
