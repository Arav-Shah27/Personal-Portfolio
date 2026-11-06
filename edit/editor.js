// The pixel lab: browse every pixelfx effect, customize it live, edit its code or write a new one, and save
// what you make. Saves go to pixelfx/custom/ in the project when the page is served by `node scripts/dev.mjs`
// (so Claude can wire them into the homepage); anywhere else, such as the deployed site, they stay in this
// browser and can be downloaded or copied into a prompt.
//
// The player follows pixelfx's own gallery (gallery/app.js, MIT).

import {
  createFrame, clearFrame, createFx, createAct, actBounds, actSpan, composite, backdrop,
  drawActor, painterFor, stockActor, actorAlphaOf, PAL, hex,
} from "/pixelfx/src/core/index.js";
import { STORM_GOLD } from "/pixelfx/src/fx/lightning/sky-bolt.js";

const FX_ROOT = "/pixelfx/src/fx/";
const LS_KEY = "pixel-lab:saved";
const SITE_BG = "#0c0b09";
const DEFAULT_FX = "lightning/sky-bolt";
const RESERVED = { flip: false, angle: 0, light: 1 };
const RAMPS = { "storm gold (site)": STORM_GOLD, ...PAL };

const $ = (s) => document.querySelector(s);
const isHex = (v) => typeof v === "string" && /^#[0-9a-f]{3,8}$/i.test(v);
const isRamp = (v) => Array.isArray(v) && v.length > 0 && v.every(isHex);
const clone = (v) => JSON.parse(JSON.stringify(v));
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const slugify = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60);
function el(tag, { dataset, ...props } = {}, kids = []) {
  const e = Object.assign(document.createElement(tag), props);
  if (dataset) Object.assign(e.dataset, dataset);
  for (const k of [].concat(kids)) if (k != null) e.append(k);
  return e;
}

// ---------------------------------------------------------------- the player
class Player {
  constructor(canvas) {
    Object.assign(this, { canvas, ctx: canvas.getContext("2d"), speed: 1, playing: true, actor: true, bg: "site", zoom: "auto", opts: {} });
  }
  load(mod, opts) {
    this.mod = mod;
    this.meta = mod.meta;
    this.opts = opts;
    this.layout();
  }
  get acted() {
    return !!this.mod.act && this.actor;
  }
  get start() {
    return this.acted ? actSpan(this.mod).from : 0;
  }
  get end() {
    const D = this.meta.duration;
    if (!this.acted) return D;
    const to = actSpan(this.mod).to;
    return Number.isFinite(to) ? to : D;
  }
  layout() {
    const acted = this.acted, m = this.meta;
    const b = acted ? { ...actBounds(this.mod) } : null;
    if (b) b.y1 = Math.min(b.y1, 22);
    const [w, h] = acted ? [b.x1 - b.x0, b.y1 - b.y0] : m.size, [ox, oy] = acted ? [-b.x0, -b.y0] : m.origin;
    this.W = Math.ceil(w * 1.12) + 8;
    this.H = Math.ceil(h * 1.12) + 8;
    this.x = Math.floor((this.W - w) / 2) + ox;
    this.y = acted ? Math.max(oy + 2, this.H - b.y1 - 4) : Math.floor((this.H - h) / 2) + oy;
    this.canvas.width = this.W;
    this.canvas.height = this.H;
    this.frame = createFrame(this.W, this.H);
    this.img = this.ctx.createImageData(this.W, this.H);
    this.setBg(this.bg);
    this.fit();
    this.restart();
  }
  setBg(kind) {
    this.bg = kind;
    this.bgBuf = kind === "none" ? null : kind === "site" ? new Uint32Array(this.W * this.H).fill(hex(SITE_BG)) : backdrop(kind, this.W, this.H, this.y);
    this.dirty = true;
  }
  fit() {
    if (!this.W) return;
    const box = this.canvas.parentElement.getBoundingClientRect();
    const auto = Math.max(1, Math.floor(Math.min((box.width - 24) / this.W, (Math.max(box.height, 340) - 24) / this.H)));
    const z = this.zoom === "auto" ? auto : +this.zoom;
    this.canvas.style.width = this.W * z + "px";
    this.canvas.style.height = this.H * z + "px";
  }
  restart() {
    try {
      this.inst = (this.acted ? createAct : createFx)(this.mod, { ...this.opts, x: this.x, y: this.y });
      this.error = null;
    } catch (e) {
      this.fail(e);
    }
    this.acc = 0;
    this.wait = 0;
    this.dirty = true;
  }
  fail(e) {
    this.inst = null;
    this.error = e;
    onPlayerError(e);
  }
  get t() {
    return this.inst ? this.inst.t : 0;
  }
  over() {
    if (!this.inst) return true;
    return this.meta.loop ? false : this.acted ? this.inst.done() : this.inst.t >= this.meta.duration;
  }
  tick(dt) {
    if (!this.inst) return;
    const step = 1 / (this.meta.fps || 30);
    if (this.playing) this.acc = Math.min(this.acc + dt * this.speed, 0.25);
    let moved = false;
    try {
      while (this.acc >= step) {
        this.acc -= step;
        if (this.over()) {
          this.wait += step;
          if (this.wait > 0.5) this.restart();
        } else this.inst.update(step);
        moved = true;
      }
      if (moved || this.dirty) this.render();
    } catch (e) {
      this.fail(e);
    }
  }
  seek(t) {
    this.restart();
    if (!this.inst) return;
    const step = 1 / (this.meta.fps || 30);
    try {
      for (let s = this.start; s < t - 1e-6; s += step) this.inst.update(Math.min(step, t - s));
      this.render();
    } catch (e) {
      this.fail(e);
    }
  }
  render() {
    const f = clearFrame(this.frame);
    if (this.acted) {
      this.inst.draw(f);
      composite(f, this.img.data, this.bgBuf);
      const [sx, sy] = this.inst.shake ?? [0, 0];
      if (sx || sy) this.ctx.clearRect(0, 0, this.W, this.H);
      this.ctx.putImageData(this.img, sx, sy);
    } else {
      this.inst.draw(f, "back");
      const m = this.meta, tt = m.loop ? this.inst.t % m.duration : Math.min(this.inst.t, m.duration);
      if (m.actor && this.actor) drawActor(painterFor(f).place(this.x, this.y, !!this.opts.flip), this.inst.options.actor ?? stockActor(), actorAlphaOf(this.mod, tt, this.inst.options));
      this.inst.draw(f, "front");
      composite(f, this.img.data, this.bgBuf);
      this.ctx.putImageData(this.img, 0, 0);
    }
    this.dirty = false;
  }
}

// ---------------------------------------------------------------- state
const player = new Player($("#cv"));
const S = {
  catalog: null,
  entry: null,        // what's open: { kind: "library" | "code", id, name }
  mod: null,
  base: null,         // the library effect it came from
  code: null,         // source text when it's a code effect
  defaults: {},
  values: {},
  slug: null,         // the saved item it was loaded from
  project: false,     // is the dev server's save endpoint here?
  projectItems: [],
  load: 0,
};

// ---------------------------------------------------------------- loading effects
function withDefaults(mod) {
  const meta = { fps: 30, bg: "dark", loop: false, duration: 1, tags: [], options: {}, size: [96, 96], origin: [48, 48], name: "untitled", desc: "", ...mod.meta };
  return { ...mod, meta };
}

/** Run effect source as a module: relative imports are pointed at the library, as if the file lived at id. */
async function compile(code, id) {
  const base = new URL(FX_ROOT + (id || "custom/new") + ".js", location.origin);
  const src = code.replace(/(\bfrom\s*|\bimport\s*\(\s*|\bimport\s+)(["'])(\.{1,2}\/[^"']+)\2/g, (_, pre, q, spec) => pre + q + new URL(spec, base).href + q);
  const url = URL.createObjectURL(new Blob([src], { type: "text/javascript" }));
  try {
    const mod = await import(url);
    if (!mod.meta || !(mod.draw || mod.create)) throw new Error("An effect needs `export const meta` and either `export function draw(p, t, o)` or `export function create(o)`.");
    return withDefaults(mod);
  } finally {
    URL.revokeObjectURL(url);
  }
}
/** The same source, with its imports rewritten to work from pixelfx/custom/ in the project. */
function asCustomModule(code, id) {
  const base = new URL(FX_ROOT + (id || "custom/new") + ".js", location.origin);
  return code.replace(/(\bfrom\s*|\bimport\s*\(\s*|\bimport\s+)(["'])(\.{1,2}\/[^"']+)\2/g, (_, pre, q, spec) => {
    const abs = new URL(spec, base).pathname;
    return pre + q + (abs.startsWith("/pixelfx/") ? "../" + abs.slice("/pixelfx/".length) : spec) + q;
  });
}

async function open({ kind = "library", id = DEFAULT_FX, code = null, options = null, slug = null, name = null, notes = "" } = {}) {
  const n = ++S.load;
  $("#code-err").textContent = "";
  let mod;
  try {
    mod = kind === "code" ? await compile(code, id) : withDefaults(await import(FX_ROOT + id + ".js"));
  } catch (e) {
    if (n !== S.load) return;
    showCodeError(e);
    if (kind === "code") {
      // keep the broken code in the editor so it can be fixed
      S.entry = { kind, id, name };
      S.code = code;
      $("#code").value = code;
      setCodeOpen(true);
    }
    return;
  }
  if (n !== S.load) return;
  S.entry = { kind, id, name: name ?? mod.meta.name };
  S.mod = mod;
  S.base = id;
  S.code = kind === "code" ? code : null;
  S.slug = slug;
  S.defaults = { ...RESERVED, ...clone(mod.meta.options) };
  S.values = { ...clone(S.defaults), ...(options ? clone(options) : {}) };

  $("#fx-id").textContent = (kind === "code" ? "code · " : "") + (slug ? `saved · ${slug}` : id);
  $("#fx-name").textContent = S.entry.name;
  $("#fx-desc").textContent = mod.meta.desc;
  $("#actor-wrap").hidden = !(mod.meta.actor || mod.act);
  $("#save-name").value = slug ? S.entry.name : "";
  $("#save-notes").value = notes || "";
  $("#save-status").textContent = "";
  if (kind === "library" && !slug) location.hash = "fx=" + id;
  else if (slug) location.hash = "saved=" + slug;

  player.load(mod, S.values);
  setPlaying(true);
  buildOptions();
  markActive();
  if (!$("#code-wrap").hidden) await fillCode();
}

// ---------------------------------------------------------------- options panel
function buildOptions() {
  const box = $("#opts");
  box.replaceChildren();
  const keys = Object.keys(S.defaults);
  // palette first, then the effect's own options, then the reserved ones
  const order = (k) => (k === "palette" ? 0 : k in RESERVED ? 2 : 1);
  keys.sort((a, b) => order(a) - order(b));
  for (const k of keys) box.append(control(k, S.defaults[k]));
}

function changed(k, v, { relayout = false } = {}) {
  S.values[k] = v;
  player.opts = S.values;
  const t = player.t;
  if (relayout) player.layout();
  else if (player.playing) player.restart();
  else player.seek(t);
  syncScrub();
}

function control(k, def) {
  const v = S.values[k];
  const head = el("div", { className: "opt-head" }, [el("span", { className: "label", textContent: k })]);
  const wrap = el("div", { className: "opt" }, head);

  if (isRamp(def)) {
    wrap.append(rampEditor(k));
    return wrap;
  }
  if (isHex(def)) {
    const text = el("input", { type: "text", value: v });
    const pick = el("input", { type: "color", value: v.length === 4 ? "#" + [...v.slice(1)].map((c) => c + c).join("") : v.slice(0, 7) });
    pick.addEventListener("input", () => ((text.value = pick.value), changed(k, pick.value)));
    text.addEventListener("change", () => isHex(text.value) && changed(k, text.value));
    wrap.append(el("div", { className: "color-one" }, [el("span", { className: "swatch" }, pick), text]));
    pick.parentElement.style.background = v;
    pick.addEventListener("input", () => (pick.parentElement.style.background = pick.value));
    return wrap;
  }
  if (typeof def === "boolean") {
    const box = el("input", { type: "checkbox", checked: !!v });
    box.addEventListener("change", () => changed(k, box.checked, { relayout: k === "flip" }));
    head.append(box);
    return wrap;
  }
  if (k === "seed") {
    const num = el("input", { type: "number", value: v, step: 1 });
    const dice = el("button", { type: "button", className: "btn ghost", textContent: "🎲 new take" });
    num.addEventListener("change", () => changed(k, Math.round(+num.value) || 1));
    dice.addEventListener("click", () => {
      num.value = 1 + Math.floor(Math.random() * 99999);
      changed(k, +num.value);
    });
    wrap.append(el("div", { className: "row" }, [num, dice]));
    return wrap;
  }
  if (typeof def === "number" || def === null) {
    const d = def ?? 0;
    const [min, max, step] =
      k === "angle" ? [-Math.PI, Math.PI, 0.01]
      : k === "light" ? [0, 2.5, 0.05]
      : def === null ? [-120, 120, 1]
      : Number.isInteger(d) && Math.abs(d) >= 2 ? [d < 0 ? d * 3 : 0, d === 0 ? 10 : Math.abs(d) * 3, 1]
      : [d < 0 ? d * 3 : 0, d === 0 ? 1 : Math.max(1, Math.abs(d) * 3), 0.01];
    const out = el("output", { textContent: v ?? "auto" });
    head.append(out);
    const range = el("input", { type: "range", min, max, step, value: v ?? d });
    range.addEventListener("input", () => {
      out.textContent = range.value;
      changed(k, +range.value);
    });
    wrap.append(range);
    if (def === null) {
      const clear = el("button", { type: "button", className: "link label", textContent: "set to auto" });
      clear.addEventListener("click", () => ((out.textContent = "auto"), changed(k, null)));
      wrap.append(clear);
    }
    return wrap;
  }
  if (typeof def === "string") {
    const text = el("input", { type: "text", value: v });
    text.addEventListener("change", () => changed(k, text.value));
    wrap.append(text);
    return wrap;
  }
  // anything else (a point, a list): edit it as JSON
  const text = el("input", { type: "text", value: JSON.stringify(v) });
  text.addEventListener("change", () => {
    try {
      changed(k, JSON.parse(text.value));
    } catch {
      toast("that isn't valid JSON");
    }
  });
  wrap.append(text);
  return wrap;
}

function rampEditor(k) {
  const box = el("div");
  const draw = () => {
    const ramp = S.values[k];
    const row = el("div", { className: "ramp" });
    ramp.forEach((c, i) => {
      const pick = el("input", { type: "color", value: c.length === 4 ? "#" + [...c.slice(1)].map((x) => x + x).join("") : c.slice(0, 7), title: `${c} (step ${i + 1})` });
      const sw = el("span", { className: "swatch", style: `background:${c}` }, pick);
      pick.addEventListener("input", () => (sw.style.background = pick.value));
      pick.addEventListener("change", () => {
        const next = S.values[k].slice();
        next[i] = pick.value;
        changed(k, next);
        draw();
      });
      row.append(sw);
    });
    const add = el("button", { type: "button", className: "mini", textContent: "+", title: "add a brighter step" });
    const rem = el("button", { type: "button", className: "mini", textContent: "−", title: "remove the last step" });
    add.addEventListener("click", () => (changed(k, [...S.values[k], S.values[k].at(-1)]), draw()));
    rem.addEventListener("click", () => S.values[k].length > 2 && (changed(k, S.values[k].slice(0, -1)), draw()));
    row.append(add, rem);

    const presets = el("select", { ariaLabel: `${k} presets` }, [el("option", { value: "", textContent: "use a preset ramp…" }), ...Object.keys(RAMPS).map((n) => el("option", { value: n, textContent: n }))]);
    presets.addEventListener("change", () => {
      if (!presets.value) return;
      changed(k, RAMPS[presets.value].slice());
      draw();
    });
    box.replaceChildren(row, presets, el("p", { className: "label", style: "margin:0", textContent: "dark → bright. the brightest step is the hot core." }));
  };
  draw();
  return box;
}

// ---------------------------------------------------------------- transport
const scrub = $("#scrub");
function syncScrub() {
  const a = player.start, b = player.end, t = player.t;
  scrub.min = a;
  scrub.max = b;
  scrub.value = player.meta?.loop && !player.acted ? t % b : t;
  $("#time").textContent = (+scrub.value).toFixed(2) + "s";
}
function setPlaying(on) {
  player.playing = on;
  $("#play").textContent = on ? "❚❚" : "▶";
  $("#play").ariaLabel = on ? "Pause" : "Play";
}
$("#play").addEventListener("click", () => setPlaying(!player.playing));
$("#restart").addEventListener("click", () => (player.restart(), setPlaying(true)));
scrub.addEventListener("input", () => {
  setPlaying(false);
  player.seek(+scrub.value);
  $("#time").textContent = (+scrub.value).toFixed(2) + "s";
});
$("#speed").addEventListener("change", (e) => (player.speed = +e.target.value));
$("#zoom").addEventListener("change", (e) => ((player.zoom = e.target.value), player.fit()));
$("#bg").addEventListener("change", (e) => (player.setBg(e.target.value), player.render()));
$("#actor").addEventListener("change", (e) => ((player.actor = e.target.checked), player.layout()));
window.addEventListener("resize", () => player.fit());
document.addEventListener("keydown", (e) => {
  if (e.target.closest("input, textarea, select, button")) return;
  if (e.key === " ") (e.preventDefault(), setPlaying(!player.playing));
});

let last = 0;
function frame(now) {
  const dt = last ? Math.min(0.1, (now - last) / 1000) : 0;
  last = now;
  if (S.mod) {
    player.tick(dt);
    if (player.playing) syncScrub();
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// ---------------------------------------------------------------- code
function setCodeOpen(on) {
  $("#code-wrap").hidden = !on;
  $("#toggle-code").setAttribute("aria-pressed", String(on));
}
async function fillCode() {
  if (S.code != null) {
    $("#code").value = S.code;
    return;
  }
  $("#code").value = "// loading…";
  const text = await (await fetch(FX_ROOT + S.base + ".js")).text();
  $("#code").value = text;
}
$("#toggle-code").addEventListener("click", async () => {
  const on = $("#code-wrap").hidden;
  setCodeOpen(on);
  if (on) await fillCode();
});
async function runCode() {
  const code = $("#code").value;
  const keep = S.values;
  await open({ kind: "code", id: S.base || "custom/new", code, slug: S.slug, name: S.slug ? S.entry?.name : null, notes: $("#save-notes").value });
  if (S.code === code && S.mod) {
    // keep tweaks to options that still exist
    for (const k of Object.keys(keep)) if (k in S.defaults && k !== "palette") S.values[k] = keep[k];
    if ("palette" in keep && "palette" in S.defaults) S.values.palette = keep.palette;
    player.opts = S.values;
    player.restart();
    buildOptions();
    toast("running your code");
  }
}
$("#run").addEventListener("click", runCode);
$("#code").addEventListener("keydown", (e) => {
  if ((e.metaKey || e.ctrlKey) && e.key === "Enter") (e.preventDefault(), runCode());
  if (e.key === "Tab") {
    e.preventDefault();
    const ta = e.target, s = ta.selectionStart;
    ta.setRangeText("  ", s, ta.selectionEnd, "end");
  }
});
function showCodeError(e) {
  console.error(e);
  $("#code-err").textContent = String(e?.message ?? e);
  setCodeOpen(true);
}
function onPlayerError(e) {
  showCodeError(e);
}

const TEMPLATE = `// A new pixel effect. draw(p, t, o) paints the frame at time t (seconds); p is the painter, in local
// pixels with (0, 0) at meta.origin. o holds meta.options plus whatever you change in the panel.
// Everything the library offers is in ../../core/index.js; lightning helpers are in ../lightning/_lib.js.

import { fit, TAU, rng } from "../../core/index.js";
import { STORM_GOLD } from "../lightning/sky-bolt.js";
import { zigzag, crackle } from "../lightning/_lib.js";

export const meta = {
  name: "Static ring",
  desc: "A ring of static crackling round a point, re-forking fifteen times a second while a soft glow breathes under it.",
  tags: ["lightning", "custom", "loop"],
  size: [96, 96],
  origin: [48, 48],
  duration: 2,
  loop: true,
  fps: 30,
  bg: "dark",
  options: { palette: STORM_GOLD, seed: 1, radius: 28, arcs: 6 },
};

export function draw(p, t, o) {
  const C = fit(o.palette, 8);
  const phase = t / meta.duration;            // 0..1 over one loop
  const f = Math.floor(t * 15);               // a new crackle 15 times a second
  p.glow(0, 0, o.radius * 1.4, C[4], 0.25 + 0.15 * Math.sin(phase * TAU * 2));
  for (let i = 0; i < o.arcs; i++) {
    const a0 = (i / o.arcs) * TAU + phase * TAU, a1 = a0 + (TAU / o.arcs) * 0.8;
    const bolt = zigzag(rng(o.seed, i, f), Math.cos(a0) * o.radius, Math.sin(a0) * o.radius, Math.cos(a1) * o.radius, Math.sin(a1) * o.radius, 0.3, 0.3);
    crackle(p, bolt, 0.8, C, 0.4);
  }
  p.circle(0, 0, 2, C[7]);
}
`;
$("#new-code").addEventListener("click", async () => {
  setCodeOpen(true);
  await open({ kind: "code", id: "custom/new", code: TEMPLATE });
  $("#code").value = TEMPLATE;
  $("#code").focus();
});

// ---------------------------------------------------------------- library list
function buildLibrary() {
  const q = $("#search").value.trim().toLowerCase();
  const box = $("#library");
  box.replaceChildren();
  let shown = 0;
  for (const c of S.catalog.categories) {
    const list = S.catalog.effects.filter((e) => e.cat === c.id && (!q || `${e.id} ${e.name} ${e.tags.join(" ")} ${e.desc}`.toLowerCase().includes(q)));
    if (!list.length) continue;
    box.append(el("h4", { textContent: c.name }));
    for (const e of list) {
      const b = el("button", { type: "button", className: "item", dataset: { id: e.id } }, [el("span", { textContent: e.name }), el("small", { textContent: e.loop ? "loop" : +e.duration.toFixed(2) + "s" })]);
      b.addEventListener("click", () => open({ id: e.id }));
      box.append(b);
      shown++;
    }
  }
  if (!shown) box.append(el("p", { className: "empty", textContent: "nothing matches that." }));
  markActive();
}
$("#search").addEventListener("input", () => (switchTab("library"), buildLibrary()));

function markActive() {
  for (const b of document.querySelectorAll("#library .item")) b.classList.toggle("is-on", !S.slug && S.entry?.kind === "library" && b.dataset.id === S.entry.id);
  for (const b of document.querySelectorAll("#saved .item")) b.classList.toggle("is-on", b.dataset.slug === S.slug);
}

function switchTab(tab) {
  for (const b of document.querySelectorAll(".side-tabs button")) {
    const on = b.dataset.tab === tab;
    b.classList.toggle("is-on", on);
    b.setAttribute("aria-selected", String(on));
  }
  $("#library").hidden = tab !== "library";
  $("#saved").hidden = tab !== "saved";
}
for (const b of document.querySelectorAll(".side-tabs button")) b.addEventListener("click", () => switchTab(b.dataset.tab));

// ---------------------------------------------------------------- saving
const local = {
  all() {
    try {
      return JSON.parse(localStorage.getItem(LS_KEY)) ?? [];
    } catch {
      return [];
    }
  },
  put(item) {
    const list = local.all().filter((x) => x.slug !== item.slug);
    list.unshift(item);
    localStorage.setItem(LS_KEY, JSON.stringify(list));
  },
  remove(slug) {
    localStorage.setItem(LS_KEY, JSON.stringify(local.all().filter((x) => x.slug !== slug)));
  },
};

async function detectProject() {
  try {
    const r = await fetch("/api/pixelfx/custom", { cache: "no-store" });
    if (!r.ok) throw 0;
    S.projectItems = await r.json();
    S.project = Array.isArray(S.projectItems);
  } catch {
    S.project = false;
    S.projectItems = [];
  }
  $("#save-mode").textContent = S.project ? "saves go to pixelfx/custom/ in your project" : "saves stay in this browser";
}

function allSaved() {
  const map = new Map();
  for (const x of local.all()) map.set(x.slug, { ...x, where: "browser" });
  for (const x of S.projectItems) map.set(x.slug, { ...x, where: map.has(x.slug) ? "project + browser" : "project" });
  return [...map.values()].sort((a, b) => String(b.savedAt).localeCompare(String(a.savedAt)));
}

function buildSaved() {
  const box = $("#saved");
  const list = allSaved();
  $("#saved-count").textContent = list.length ? `(${list.length})` : "";
  box.replaceChildren();
  if (!list.length) box.append(el("p", { className: "empty", textContent: "nothing saved yet. tweak an effect, name it, and press save." }));
  for (const x of list) {
    const b = el("button", { type: "button", className: "item", dataset: { slug: x.slug } }, [el("span", { textContent: x.name }), el("small", { className: "where", textContent: x.where })]);
    b.addEventListener("click", () => openSaved(x));
    const del = el("button", { type: "button", className: "del", textContent: "×", title: `delete ${x.name}`, ariaLabel: `delete ${x.name}` });
    del.addEventListener("click", async () => {
      if (!confirm(`Delete "${x.name}"?`)) return;
      local.remove(x.slug);
      if (S.project) await fetch("/api/pixelfx/custom/" + x.slug, { method: "DELETE" }).catch(() => {});
      await detectProject();
      buildSaved();
      toast(`deleted ${x.name}`);
    });
    box.append(el("div", { className: "saved-item" }, [b, del]));
  }
  markActive();
}

function openSaved(x) {
  if (x.kind === "code") $("#code").value = x.code;
  return open({ kind: x.kind, id: x.base, code: x.code ?? null, options: x.options, slug: x.slug, name: x.name, notes: x.notes });
}

/** What's on screen as a saved item: the effect it came from and only the options that differ. */
function currentItem() {
  const name = $("#save-name").value.trim() || S.entry?.name || "untitled";
  const options = {};
  for (const [k, v] of Object.entries(S.values)) if (!same(v, S.defaults[k])) options[k] = v;
  const m = S.mod.meta;
  const item = {
    name,
    slug: slugify(name),
    kind: S.entry.kind,
    base: S.base,
    options,
    notes: $("#save-notes").value.trim(),
    effect: { name: m.name, size: m.size, origin: m.origin, duration: m.duration, loop: m.loop, fps: m.fps },
    savedAt: new Date().toISOString(),
  };
  if (item.kind === "code") {
    item.code = S.code;
    item.module = asCustomModule(S.code, S.base);
  }
  return item;
}

$("#save").addEventListener("click", async () => {
  if (!S.mod) return;
  if (!$("#save-name").value.trim()) {
    $("#save-name").focus();
    $("#save-status").textContent = "give it a name first";
    return;
  }
  const item = currentItem();
  local.put(item);
  let msg = "saved in this browser";
  if (S.project) {
    try {
      const r = await fetch("/api/pixelfx/custom", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(item) });
      const out = await r.json();
      if (!r.ok) throw new Error(out.error);
      msg = `saved to ${out.path}`;
    } catch (e) {
      msg = `saved in this browser (project save failed: ${e.message})`;
    }
  }
  S.slug = item.slug;
  S.entry.name = item.name;
  $("#save-status").textContent = msg;
  $("#fx-id").textContent = (item.kind === "code" ? "code · " : "") + `saved · ${item.slug}`;
  location.hash = "saved=" + item.slug;
  await detectProject();
  buildSaved();
  toast(msg);
});

function download(name, blob) {
  const a = el("a", { href: URL.createObjectURL(blob), download: name });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
$("#dl-json").addEventListener("click", () => {
  if (!S.mod) return;
  const item = currentItem();
  download(item.slug + ".json", new Blob([JSON.stringify(item, null, 2)], { type: "application/json" }));
});

$("#copy-prompt").addEventListener("click", async () => {
  if (!S.mod) return;
  const item = currentItem();
  const inProject = S.project && S.slug === item.slug;
  const lines = [
    `Add my pixel lab effect "${item.name}" to my portfolio homepage.`,
    item.kind === "code"
      ? `It's my own code effect${inProject ? `, saved at pixelfx/custom/${item.slug}.json (module: pixelfx/custom/${item.slug}.js)` : ""}.`
      : `It's the pixelfx effect \`${item.base}\` with my options${inProject ? `, saved at pixelfx/custom/${item.slug}.json` : ""}.`,
    item.notes ? `My notes: ${item.notes}` : `Put it somewhere it fits without crowding the page, in the site's style.`,
  ];
  if (!inProject) lines.push("", "Here's the saved effect:", "```json", JSON.stringify(item, null, 2), "```");
  try {
    await navigator.clipboard.writeText(lines.join("\n"));
    toast("prompt copied: paste it to claude");
  } catch {
    download(item.slug + "-prompt.txt", new Blob([lines.join("\n")], { type: "text/plain" }));
  }
});

// sprite sheet: every frame of the effect alone, on transparency, in a grid, plus Aseprite-style JSON
$("#dl-sheet").addEventListener("click", () => {
  if (!S.mod) return;
  const m = S.mod.meta, [w, h] = m.size, fps = m.fps || 30;
  const n = Math.round(m.duration * fps) + (m.loop ? 0 : 1), cols = Math.ceil(Math.sqrt(n)), rows = Math.ceil(n / cols);
  const cv = el("canvas", { width: cols * w, height: rows * h }), ctx = cv.getContext("2d");
  const f = createFrame(w, h), img = new ImageData(w, h);
  const fx = createFx(S.mod, { ...S.values, x: m.origin[0], y: m.origin[1] });
  const frames = {};
  const name = slugify($("#save-name").value.trim() || m.name);
  for (let i = 0; i < n; i++) {
    clearFrame(f);
    fx.draw(f);
    composite(f, img.data, null);
    const x = (i % cols) * w, y = Math.floor(i / cols) * h;
    ctx.putImageData(img, x, y);
    frames[`${name} ${i}`] = { frame: { x, y, w, h }, rotated: false, trimmed: false, spriteSourceSize: { x: 0, y: 0, w, h }, sourceSize: { w, h }, duration: Math.round(1000 / fps) };
    fx.update(1 / fps);
  }
  const json = { frames, meta: { app: "pixelfx pixel lab", image: name + ".png", format: "RGBA8888", size: { w: cv.width, h: cv.height }, scale: "1", pixelfx: { fps, loop: m.loop, frame: [w, h], columns: cols, frames: n, pivot: m.origin } } };
  cv.toBlob((blob) => {
    download(name + ".png", blob);
    setTimeout(() => download(name + ".json", new Blob([JSON.stringify(json, null, 2)], { type: "application/json" })), 300);
    toast(`${n} frames, ${cols} across`);
  });
});

$("#reset").addEventListener("click", () => {
  S.values = clone(S.defaults);
  player.opts = S.values;
  player.layout();
  buildOptions();
});

let toastTimer = 0;
function toast(msg) {
  const t = $("#toast");
  t.textContent = msg;
  t.classList.add("is-shown");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove("is-shown"), 2400);
}

// ---------------------------------------------------------------- start
(async function init() {
  const [catalog] = await Promise.all([fetch("/pixelfx/catalog.json").then((r) => r.json()), detectProject()]);
  S.catalog = catalog;
  $("#search").placeholder = `search ${catalog.effects.length} effects…`;
  buildLibrary();
  buildSaved();
  const h = new URLSearchParams(location.hash.slice(1));
  const saved = h.get("saved") && allSaved().find((x) => x.slug === h.get("saved"));
  if (saved) {
    switchTab("saved");
    await openSaved(saved);
  } else {
    const id = h.get("fx");
    await open({ id: id && catalog.effects.some((e) => e.id === id) ? id : DEFAULT_FX });
  }
  // scroll the list (not the page) to the open effect
  const on = document.querySelector("#library .item.is-on"), list = $("#library");
  if (on) list.scrollTop = on.offsetTop - list.offsetTop - list.clientHeight / 2;
})();
