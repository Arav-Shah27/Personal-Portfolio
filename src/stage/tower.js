/* ==========================================================================
   The dark tower: a voxel tower on a crag, a burning eye between its horns.
   Tap it and every voxel lifts off, tumbles through the air and lands as one
   square of a real QR code for my LinkedIn, while the camera turns to look
   straight down at it. Tap again and the squares fly back up into the tower.

   Every voxel is one instance of one cube, and each one knows two places:
   where it sits in the tower and which square of the code it becomes. The
   flight runs in the vertex shader off one number (uFold), so nothing is
   updated on the CPU while it animates.
   ========================================================================== */
import * as THREE from "three";
import { qrMatrix } from "../qr.js";

function rng(seed) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

/* the camera looks in from here; the horns and the eye are set square to it
   so the eye stares straight out of the page */
const VIEW = new THREE.Vector3(54, 0, 61).normalize();
const SIDE = [VIEW.z, -VIEW.x];
const EYE_Y = 50;

/* kinds: 0 stone, 1 stone edge, 2 crag rock, 3 lava, 4 window, 5 eye, 6 pupil */
function buildTower() {
  const R = rng(1401);
  const vox = [];
  const taken = new Set();
  const put = (x, y, z, kind) => {
    x = Math.round(x); y = Math.round(y); z = Math.round(z);
    const k = `${x},${y},${z}`;
    if (taken.has(k)) return;
    taken.add(k);
    vox.push([x, y, z, kind]);
  };
  const at = (a, y, w) => [SIDE[0] * a + VIEW.x * w, y, SIDE[1] * a + VIEW.z * w];

  /* the eye first, so nothing else claims its voxels: a wide burning oval
     with a black slit down the middle, floating between the horns */
  for (let a = -3.2; a <= 3.2; a += 0.3)
    for (let b = -2; b <= 2; b += 0.3) {
      if ((a / 3.2) ** 2 + (b / 2) ** 2 > 1) continue;
      const slit = Math.abs(a) < 0.55 * (1 - (b / 2) ** 2) + 0.1;
      for (const w of [-0.4, 0.4]) put(...at(a, EYE_Y + b, w), slit ? 6 : 5);
    }

  /* the tower: stepped tiers, each a hollow shell with ribs running up its
     faces, a ledge where it steps in and spikes at the corners */
  const tiers = [[1, 14, 4], [15, 26, 3], [27, 36, 2], [37, 42, 1]];
  for (const [y0, y1, hw] of tiers) {
    for (let y = y0; y <= y1; y++)
      for (let x = -hw; x <= hw; x++)
        for (let z = -hw; z <= hw; z++) {
          if (Math.max(Math.abs(x), Math.abs(z)) < hw) continue;
          const edge = Math.abs(x) === hw && Math.abs(z) === hw;
          put(x, y, z, edge ? 1 : R() < 0.04 && y < y1 - 1 ? 4 : 0);
        }
    for (let y = y0; y <= y1 - 1; y++)
      for (let i = -hw + 1; i <= hw - 1; i += 2) {
        put(hw + 1, y, i, 0); put(-hw - 1, y, i, 0);
        put(i, y, hw + 1, 0); put(i, y, -hw - 1, 0);
      }
    for (let x = -hw - 1; x <= hw + 1; x++) for (let z = -hw - 1; z <= hw + 1; z++) put(x, y1, z, 1);
    for (const sx of [-1, 1]) for (const sz of [-1, 1])
      for (let k = 1; k <= (hw > 1 ? 2 : 1); k++) put(sx * (hw + 1), y1 + k, sz * (hw + 1), 1);
  }

  /* two horns, bulging out round the eye and hooking back in to points */
  for (const sg of [-1, 1])
    for (let k = 0; k <= 15; k += 0.5) {
      const t = k / 15;
      const off = 1.6 + 2.6 * Math.sin(t * Math.PI * 0.95) - 0.9 * t;
      const th = 1.1 * (1 - t) + 0.25;
      for (let a = -th; a <= th; a += 0.5)
        for (let w = -th; w <= th; w += 0.5) put(...at(sg * (off + a), 43 + k, w), t > 0.8 ? 1 : 0);
    }

  /* the crag: jagged rock, highest against the tower, with lava in the
     cracks round its foot. Only the rock you can see is built. */
  const hash = (x, z) => { const v = Math.sin(x * 127.1 + z * 311.7) * 43758.5453; return v - Math.floor(v); };
  const H = (x, z) => {
    const d = Math.hypot(x, z * 1.08);
    return Math.round(14 - d * 1.0 + (hash(x, z) - 0.5) * 3.6 + (hash(x * 3, z * 7) > 0.88 ? 3 : 0));
  };
  for (let x = -15; x <= 15; x++)
    for (let z = -15; z <= 15; z++) {
      const h = H(x, z);
      if (h < 1) continue;
      const low = Math.min(H(x + 1, z), H(x - 1, z), H(x, z + 1), H(x, z - 1));
      for (let y = Math.max(1, Math.min(h, low + 1)); y <= h; y++) put(x, y, z, 2);
      if (h <= 3 && hash(z, x) < 0.3) put(x, h + 1, z, 3);
    }
  return vox;
}

/* Which square of the code each voxel becomes. The tower is taken from the
   top down and the code filled from the outside in, matched by angle in
   bands, so the eye and the horns fly out to the corners, the crag spreads
   into the middle, and each voxel heads roughly the way it already faces. */
function assign(vox, qr) {
  const half = (qr.size - 1) / 2;
  const cells = [];
  for (let r = 0; r < qr.size; r++)
    for (let c = 0; c < qr.size; c++) {
      const x = c - half, z = r - half;
      cells.push({ x, z, dark: qr.dark(r, c), d: Math.max(Math.abs(x), Math.abs(z)) + Math.hypot(x, z) * 0.01, a: Math.atan2(z, x) });
    }
  cells.sort((p, q) => q.d - p.d);

  const R = rng(77);
  let all = vox.map(([x, y, z, k]) => ({ x, y, z, k, a: Math.atan2(z, x) + (R() - 0.5) * 0.3, h: y + R() * 0.8 }));
  all.sort((p, q) => q.h - p.h);
  /* the code needs a voxel for every square; any short of that come from
     inside the crag, where they were never seen */
  const extra = [];
  while (all.length + extra.length < cells.length) extra.push({ x: (R() - 0.5) * 6, y: 1 + R() * 3, z: (R() - 0.5) * 6, k: 2, hidden: true });
  all = all.concat(extra);

  const out = new Array(all.length);
  const BAND = 48;
  for (let i = 0; i < all.length; i += BAND) {
    const vs = all.slice(i, i + BAND).map((v, j) => ({ v, i: i + j })).sort((p, q) => p.v.a - q.v.a);
    const cs = cells.slice(i, i + BAND).sort((p, q) => p.a - q.a);
    /* with more voxels than squares left, the spares share a square and
       shrink away as they land on it */
    let last = -1;
    vs.forEach(({ v, i: idx }, j) => {
      const ci = Math.floor((j * cs.length) / vs.length);
      const c = cs[ci];
      const spare = !c || ci === last;
      last = ci;
      out[idx] = { ...v, order: idx / all.length, tx: c ? c.x : v.x, tz: c ? c.z : v.z, tone: c && !c.dark ? 1 : 0, spare };
    });
  }
  return out;
}

export function createTower(stage, { box }) {
  const qr = qrMatrix();
  const vox = assign(buildTower(), qr);
  const n = vox.length;
  const maxY = Math.max(...vox.map((v) => v.y));
  const geo = new THREE.BoxGeometry(1, 1, 1);
  const aPos = new Float32Array(n * 3), aTarget = new Float32Array(n * 3);
  const aKind = new Float32Array(n), aTone = new Float32Array(n), aRise = new Float32Array(n);
  const aOrder = new Float32Array(n), aRand = new Float32Array(n), aSpare = new Float32Array(n);
  const R = rng(9);
  vox.forEach((v, i) => {
    aPos.set([v.x, v.y, v.z], i * 3);
    aTarget.set([v.tx, 0, v.tz], i * 3);
    aKind[i] = v.k;
    aTone[i] = v.tone;
    aRise[i] = v.hidden ? 2 : Math.max(0, v.y) / maxY;
    aOrder[i] = v.order;
    aRand[i] = R();
    aSpare[i] = v.spare ? 1 : 0;
  });
  for (const [name, arr, size] of [["aPos", aPos, 3], ["aTarget", aTarget, 3], ["aKind", aKind, 1], ["aTone", aTone, 1],
    ["aRise", aRise, 1], ["aOrder", aOrder, 1], ["aRand", aRand, 1], ["aSpare", aSpare, 1]])
    geo.setAttribute(name, new THREE.InstancedBufferAttribute(arr, size));

  const uniforms = { uGrow: { value: 0 }, uFold: { value: 0 }, uTime: { value: 0 } };
  const material = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: /* glsl */ `
      attribute vec3 aPos, aTarget;
      attribute float aKind, aTone, aRise, aOrder, aRand, aSpare;
      uniform float uGrow, uFold, uTime;
      varying float vL;

      float backOut(float t) { float c = 1.7; t -= 1.0; return 1.0 + (c + 1.0) * t * t * t + c * t * t; }

      /* exactly a step on the gold ramp, so the finished code has no dither
         noise in it: light squares are pure cream, dark squares page black */
      const float QR_LIGHT = 0.876;
      const float SPAN = 0.85, FLIGHT = 0.6;

      void main() {
        /* it rises bottom-up when you first get to it (aRise > 1: voxels
           that only exist to fill the code, and never show in the tower) */
        float g = clamp((uGrow * 1.5 - aRise * 1.1 - aRand * 0.1) / 0.4, 0.0, 1.0);

        /* each voxel's flight, in turn from the top of the tower down */
        float t = clamp((uFold * (SPAN + FLIGHT + 0.05) - aOrder * SPAN - aRand * 0.05) / FLIGHT, 0.0, 1.0);
        float e = t * t * (3.0 - 2.0 * t);
        float hidden = step(1.5, aRise);
        float s = mix(backOut(g) * (1.0 - hidden), 1.0, smoothstep(0.0, 0.3, t));
        s *= 1.0 - aSpare * smoothstep(0.5, 0.9, t);

        /* a tumble of a whole number of quarter turns, so it lands square */
        float ang = e * 1.5707963 * (1.0 + floor(aRand * 3.0));
        float ca = cos(ang), sa = sin(ang);
        mat3 rot = aRand < 0.5
          ? mat3(1.0, 0.0, 0.0, 0.0, ca, sa, 0.0, -sa, ca)
          : mat3(ca, sa, 0.0, -sa, ca, 0.0, 0.0, 0.0, 1.0);

        vec3 p = mix(aPos, aTarget, e);
        p.y += sin(t * 3.14159265) * (5.0 + aRand * 9.0);
        vec3 n = rot * normal;
        vec3 wp = p + rot * position * s;

        vec3 L = normalize(vec3(-0.45, 0.85, 0.35));
        float lam = 0.36 + 0.64 * max(0.0, dot(n, L));
        float base =
          aKind < 0.5 ? 0.58 + aRand * 0.1 :                 /* tower stone */
          aKind < 1.5 ? 0.72 :                               /* its edges, catching the light */
          aKind < 2.5 ? 0.52 + aRand * 0.22 :                /* crag rock */
          aKind < 3.5 ? 0.66 + 0.24 * sin(uTime * 4.0 + aRand * 20.0) :  /* lava */
          aKind < 4.5 ? 0.55 + 0.15 * sin(uTime * 1.3 + aRand * 30.0) :  /* windows */
          aKind < 5.5 ? 0.9 + 0.08 * sin(uTime * 2.2 + aPos.y * 1.7) :   /* the eye */
                        0.0;                                 /* its pupil */
        /* the eye lights the stone around it */
        base += aKind < 2.5 ? 0.4 * smoothstep(13.0, 0.0, length(aPos - vec3(0.0, ${EYE_Y.toFixed(1)}, 0.0))) : 0.0;
        vL = aKind > 2.5 ? base : base * lam;
        /* landing, a voxel takes on its square's exact colour */
        vL = mix(vL, aTone * QR_LIGHT, smoothstep(0.7, 0.95, t));
        gl_Position = projectionMatrix * modelViewMatrix * vec4(wp, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      varying float vL;
      void main() { gl_FragColor = vec4(vec3(vL), 0.0); }
    `,
  });
  const mesh = new THREE.InstancedMesh(geo, material, n);
  mesh.frustumCulled = false;
  const scene = new THREE.Scene();
  scene.add(mesh);
  if (import.meta.env.DEV) console.log(`[tower] ${n} voxels for ${qr.size * qr.size} squares`);

  /* the camera swings from a three-quarter view down to straight overhead */
  const camera = new THREE.PerspectiveCamera(32, 1, 1, 400);
  const A = new THREE.Vector3(75, 30, 86), B = new THREE.Vector3();
  const lookA = new THREE.Vector3(0, 27, 0), lookB = new THREE.Vector3();
  const tmp = new THREE.Vector3(), look = new THREE.Vector3();
  const state = { grow: 0, fold: 0, cam: 0 };

  /* Overhead, the code is framed so every module is a whole number of
     pixels and every module edge lands on a pixel edge. Looking straight
     down at a flat plane, the projection is exact, so the folded code is as
     crisp as a printed one. */
  const TOP = 0.5, HEIGHT = 70;           /* tile tops sit at y = 0.5 */
  function overhead(w, h, fit) {
    const mod = Math.max(1, Math.floor(fit / (qr.size + 2)));
    const fov = (2 * Math.atan(h / mod / 2 / (HEIGHT - TOP)) * 180) / Math.PI;
    /* nudge the code so its edges fall on pixel boundaries */
    const fx = ((w / 2 + 0.5 * mod) % 1) / mod;
    const fz = ((h / 2 + 0.5 * mod) % 1) / mod;
    return { fov, fx, fz };
  }

  /* w, h: the area drawn into; bw, bh: the button inside it, which is
     what the tower and the finished code are framed to */
  function place(w, h, bw, bh) {
    const k = state.cam;
    const e = k * k * (3 - 2 * k);
    const o = overhead(w, h, Math.min(bw, bh));
    const fovA = (2 * Math.atan(Math.tan((16 * Math.PI) / 180) * (h / bh)) * 180) / Math.PI;
    B.set(o.fx, HEIGHT, o.fz + 0.0001);
    lookB.set(o.fx, 0, o.fz);
    tmp.lerpVectors(A, B, e);
    /* arc over rather than cutting straight through */
    tmp.y += Math.sin(e * Math.PI) * 12;
    camera.position.copy(tmp);
    look.lerpVectors(lookA, lookB, e);
    camera.lookAt(look);
    camera.fov = fovA + (o.fov - fovA) * e;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }

  let rect = null;
  const visible = () => {
    rect = box.getBoundingClientRect();
    return rect.bottom > 0 && rect.top < window.innerHeight && rect.width > 0;
  };

  return {
    qr,
    state,
    active: visible,
    animating: () => true,
    fast: () => (state.grow > 0 && state.grow < 1) || (state.fold > 0 && state.fold < 1) || (state.cam > 0 && state.cam < 1),
    draw(renderer, target, frame) {
      uniforms.uGrow.value = state.grow;
      uniforms.uFold.value = state.fold;
      uniforms.uTime.value = frame.t;
      const { px, h } = frame;
      const bw = Math.ceil(rect.width / px), bh = Math.ceil(rect.height / px);
      /* draw into a wider area than the button, so the voxels in flight
         are never cut off at its edges */
      const mx = Math.round(bw * 0.35), my = Math.round(bh * 0.12);
      const x = Math.floor(rect.left / px) - mx, w = bw + 2 * mx;
      const y = h - Math.ceil(rect.bottom / px) - my, hh = bh + 2 * my;
      mesh.rotation.y = (1 - state.cam) * Math.sin(frame.t * 0.25) * 0.18;
      place(w, hh, bw, bh);
      renderer.setViewport(x, y, w, hh);
      renderer.setScissor(x, y, w, hh);
      renderer.setScissorTest(true);
      renderer.clearDepth();
      renderer.render(scene, camera);
      renderer.setScissorTest(false);
    },
  };
}
