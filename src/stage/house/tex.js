/* ==========================================================================
   Textures for the house, painted on canvases at load: no image files.

   They're small and a little rough on purpose. The stage draws the house at
   one texel per art pixel and the dither pass turns it into gold, so all a
   texture has to carry is the pattern a wall or a floor would show at that
   size: grout lines, plank seams, a diamond runner, grain.
   ========================================================================== */
import * as THREE from "three";

/* a seeded random, so the house is the same on every visit */
export function rng(seed) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

function canvasTex(w, h, paint, { repeat = true } = {}) {
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  const g = c.getContext("2d");
  paint(g, w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = repeat ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping;
  t.anisotropy = 4;
  return t;
}

const shade = (hex, k) => {
  const c = new THREE.Color(hex);
  c.offsetHSL(0, 0, k);
  return `#${c.getHexString()}`;
};

/* The hall floor: terracotta squares with a runner of big diamonds down the
   middle and a border plank either side, like the tunnel in the reference.
   u runs across the hall (0..1, one full width), v along it (one repeat a
   couple of metres). */
export function hallTiles() {
  return canvasTex(256, 256, (g, w, h) => {
    const R = rng(7);
    g.fillStyle = "#5a2a14"; g.fillRect(0, 0, w, h);          /* grout */
    const n = 10, s = w / n;
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
      g.fillStyle = shade("#c4643a", (R() - 0.5) * 0.12);
      g.fillRect(i * s + 1.5, j * s + 1.5, s - 3, s - 3);
    }
    /* the diamond runner, alternating dark and light, outlined */
    const cx = w / 2, dh = h / 2;
    for (let k = 0; k < 2; k++) {
      const cy = dh * k + dh / 2;
      g.beginPath();
      g.moveTo(cx, cy - dh / 2); g.lineTo(cx + w * 0.2, cy); g.lineTo(cx, cy + dh / 2); g.lineTo(cx - w * 0.2, cy);
      g.closePath();
      g.fillStyle = k ? "#8c3f1e" : "#c9703c"; g.fill();
      g.lineWidth = 3; g.strokeStyle = "#e3a464"; g.stroke();
    }
    /* wooden borders at the edges, where the floor meets the benches */
    g.fillStyle = "#6b3a1c"; g.fillRect(0, 0, w * 0.07, h); g.fillRect(w * 0.93, 0, w * 0.07, h);
    g.fillStyle = "#8a5228"; g.fillRect(w * 0.07, 0, 3, h); g.fillRect(w * 0.93 - 3, 0, 3, h);
  });
}

/* plaster: a pale, slightly mottled wash */
export function plaster() {
  return canvasTex(128, 128, (g, w, h) => {
    g.fillStyle = "#cdb898"; g.fillRect(0, 0, w, h);
    const R = rng(11);
    for (let i = 0; i < 260; i++) {
      g.fillStyle = `rgba(${R() < 0.5 ? "90,70,40" : "255,240,210"},${0.04 + R() * 0.06})`;
      const r = 3 + R() * 12;
      g.beginPath(); g.arc(R() * w, R() * h, r, 0, Math.PI * 2); g.fill();
    }
  });
}

/* wood: long grain along u */
export function wood(base = "#7a4a22", seed = 3) {
  return canvasTex(128, 128, (g, w, h) => {
    const R = rng(seed);
    g.fillStyle = base; g.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 1) {
      const a = 0.05 + 0.1 * Math.abs(Math.sin(y * 0.37 + Math.sin(y * 0.05) * 3));
      g.fillStyle = `rgba(30,15,5,${a * R()})`;
      g.fillRect(0, y, w, 1);
    }
  });
}

/* plank floor for the study: boards of mixed length with dark seams */
export function planks() {
  return canvasTex(256, 256, (g, w, h) => {
    const R = rng(23);
    const rows = 8, bh = h / rows;
    for (let r = 0; r < rows; r++) {
      let x = -R() * 80;
      while (x < w) {
        const len = 70 + R() * 110;
        g.fillStyle = shade("#9a6634", (R() - 0.5) * 0.1);
        g.fillRect(x + 1, r * bh + 1, len - 2, bh - 2);
        x += len;
      }
    }
    g.globalAlpha = 0.25;
    for (let y = 0; y < h; y += 2) { g.fillStyle = R() < 0.5 ? "#2a160a" : "#8a5a30"; g.fillRect(0, y, w, 1); }
  });
}

/* herringbone parquet for the parlour */
export function herringbone() {
  return canvasTex(256, 256, (g, w, h) => {
    const R = rng(31);
    g.fillStyle = "#2c1a0c"; g.fillRect(0, 0, w, h);
    const L = 64, T = 16;
    g.save();
    for (let row = -4; row < 12; row++) {
      for (let col = -4; col < 12; col++) {
        const x = col * L / 2 + row * 0, y = row * T * 2 + col * T;
        g.fillStyle = shade("#8a5a2e", (R() - 0.5) * 0.12);
        g.save(); g.translate(x, y); g.rotate(Math.PI / 4); g.fillRect(0, 0, L * 0.68, T * 0.9); g.restore();
        g.fillStyle = shade("#7a4c26", (R() - 0.5) * 0.12);
        g.save(); g.translate(x, y); g.rotate(-Math.PI / 4); g.fillRect(-L * 0.68, 0, L * 0.68, T * 0.9); g.restore();
      }
    }
    g.restore();
  });
}

/* an old map: parchment, a coastline, hills, and a dotted route between
   three stops (the three places on the route in What I've Done) */
export function map() {
  return canvasTex(256, 192, (g, w, h) => {
    const R = rng(5);
    g.fillStyle = "#d8c08c"; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 120; i++) {
      g.fillStyle = `rgba(110,75,30,${R() * 0.08})`;
      g.beginPath(); g.arc(R() * w, R() * h, 4 + R() * 18, 0, Math.PI * 2); g.fill();
    }
    /* coast */
    g.strokeStyle = "#5a3a18"; g.lineWidth = 2;
    g.beginPath();
    for (let x = 0; x <= w; x += 6) g.lineTo(x, h * 0.72 + Math.sin(x * 0.05) * 10 + Math.sin(x * 0.17) * 4);
    g.stroke();
    /* hills */
    for (let i = 0; i < 9; i++) {
      const x = 20 + R() * (w - 40), y = 20 + R() * h * 0.45;
      g.beginPath(); g.moveTo(x - 9, y + 6); g.lineTo(x, y - 6); g.lineTo(x + 9, y + 6); g.stroke();
    }
    /* the route */
    const stops = [[w * 0.18, h * 0.62], [w * 0.5, h * 0.3], [w * 0.82, h * 0.55]];
    g.setLineDash([5, 5]); g.lineWidth = 2; g.strokeStyle = "#7a2a10";
    g.beginPath(); g.moveTo(...stops[0]);
    g.quadraticCurveTo(w * 0.3, h * 0.2, ...stops[1]);
    g.quadraticCurveTo(w * 0.7, h * 0.7, ...stops[2]);
    g.stroke(); g.setLineDash([]);
    for (const [x, y] of stops) { g.fillStyle = "#7a2a10"; g.beginPath(); g.arc(x, y, 5, 0, Math.PI * 2); g.fill(); }
    /* a compass ring, the ring again */
    g.strokeStyle = "#5a3a18"; g.lineWidth = 2;
    g.beginPath(); g.arc(w * 0.88, h * 0.18, 14, 0, Math.PI * 2); g.stroke();
    g.beginPath(); g.moveTo(w * 0.88, h * 0.18 - 20); g.lineTo(w * 0.88, h * 0.18 + 20); g.stroke();
    /* a frame */
    g.lineWidth = 6; g.strokeStyle = "#4a2c12"; g.strokeRect(3, 3, w - 6, h - 6);
  }, { repeat: false });
}

/* a dark oil painting: a figure-ish blob on a dark ground, for the frames */
export function portrait(seed) {
  return canvasTex(64, 80, (g, w, h) => {
    const R = rng(seed);
    const gr = g.createLinearGradient(0, 0, 0, h);
    gr.addColorStop(0, "#2a2418"); gr.addColorStop(1, "#141008");
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    g.fillStyle = shade("#7a6040", (R() - 0.5) * 0.2);
    g.beginPath(); g.ellipse(w / 2, h * 0.38, 11, 13, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = shade("#3a4a2a", (R() - 0.5) * 0.2);
    g.beginPath(); g.ellipse(w / 2, h * 0.95, 26, 28, 0, Math.PI, 0); g.fill();
  }, { repeat: false });
}
