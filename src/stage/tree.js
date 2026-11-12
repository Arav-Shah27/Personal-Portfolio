/* ==========================================================================
   The Party Tree: a voxel tree growing out of ground that is a real QR code
   for my LinkedIn. Tap it and the tree folds back into the ground and the
   camera turns to look straight down, until all that's left is a flat code
   you can scan. Tap again and it grows back.

   Every voxel is one instance of one cube. Growing and folding run in the
   vertex shader off two numbers (uGrow, uFold), each voxel waiting its turn
   by its height, so nothing is updated on the CPU while it animates.
   ========================================================================== */
import * as THREE from "three";
import { qrMatrix } from "../qr.js";

function rng(seed) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

/* kinds: 0 light ground, 1 dark ground, 2 bark, 3 leaves, 4 lantern */
function buildVoxels(qr) {
  const R = rng(1401);
  const vox = [];
  const half = (qr.size - 1) / 2;
  for (let r = 0; r < qr.size; r++)
    for (let c = 0; c < qr.size; c++) {
      const d = qr.dark(r, c);
      vox.push([c - half, d ? -0.42 : 0, r - half, d ? 1 : 0, 0]);
    }

  const taken = new Set();
  const put = (x, y, z, kind) => {
    const k = `${x},${y},${z}`;
    if (taken.has(k)) return;
    taken.add(k);
    vox.push([x, y, z, kind, 0]);
  };

  /* trunk, with roots flaring into the ground */
  for (let y = 1; y <= 12; y++) {
    const w = y < 2 ? 2 : 1;
    for (let x = -w; x <= w; x++) for (let z = -w; z <= w; z++)
      if (Math.abs(x) + Math.abs(z) <= w + (y < 2 ? 1 : 0)) put(x + (y > 8 ? 1 : 0), y, z, 2);
  }
  /* branches out to the canopy */
  const crowns = [[1, 17, 0, 5]];
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 + R() * 0.6;
    const len = 5 + R() * 3, y0 = 8 + R() * 3;
    let x = 0, y = y0, z = 0;
    for (let s = 0; s < len; s++) {
      x += Math.cos(a) * 1.05; z += Math.sin(a) * 1.05; y += 0.55;
      put(Math.round(x), Math.round(y), Math.round(z), 2);
    }
    crowns.push([x, y + 1.5, z, 3 + R() * 1.3]);
  }
  /* the canopy: shells of leaves around each branch end, a little ragged */
  for (const [cx, cy, cz, r] of crowns)
    for (let y = Math.floor(cy - r); y <= cy + r; y++)
      for (let x = Math.floor(cx - r); x <= cx + r; x++)
        for (let z = Math.floor(cz - r); z <= cz + r; z++) {
          const d = Math.hypot(x - cx, (y - cy) * 1.15, z - cz);
          if (d <= r && d > r - 1.6 && R() > 0.14) put(x, y, z, 3);
        }
  /* lanterns hanging under the canopy, like at a party */
  for (let i = 0; i < 7; i++) {
    const [cx, cy, cz, r] = crowns[1 + (i % 5)];
    const a = R() * Math.PI * 2;
    const x = Math.round(cx + Math.cos(a) * r * 0.7), z = Math.round(cz + Math.sin(a) * r * 0.7);
    const top = Math.round(cy - r * 0.6);
    put(x, top - 1, z, 2);
    put(x, top - 2, z, 4);
  }
  /* each voxel's turn: lowest first when growing */
  const maxY = Math.max(...vox.map((v) => v[1]));
  for (const v of vox) v[4] = v[3] >= 2 ? Math.max(0, v[1]) / maxY : 0;
  return vox;
}

export function createTree(stage, { box }) {
  const qr = qrMatrix();
  const vox = buildVoxels(qr);
  const n = vox.length;
  const geo = new THREE.BoxGeometry(1, 1, 1);
  const aPos = new Float32Array(n * 3), aKind = new Float32Array(n), aTurn = new Float32Array(n), aRand = new Float32Array(n);
  const R = rng(9);
  vox.forEach(([x, y, z, k, t], i) => { aPos.set([x, y, z], i * 3); aKind[i] = k; aTurn[i] = t; aRand[i] = R(); });
  geo.setAttribute("aPos", new THREE.InstancedBufferAttribute(aPos, 3));
  geo.setAttribute("aKind", new THREE.InstancedBufferAttribute(aKind, 1));
  geo.setAttribute("aTurn", new THREE.InstancedBufferAttribute(aTurn, 1));
  geo.setAttribute("aRand", new THREE.InstancedBufferAttribute(aRand, 1));

  const uniforms = { uGrow: { value: 0 }, uFold: { value: 0 }, uTime: { value: 0 } };
  const material = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: /* glsl */ `
      attribute vec3 aPos;
      attribute float aKind, aTurn, aRand;
      uniform float uGrow, uFold, uTime;
      varying float vL;

      float backOut(float t) { float c = 1.7; t -= 1.0; return 1.0 + (c + 1.0) * t * t * t + c * t * t; }

      /* exactly a step on the gold ramp, so the folded code has no dither
         noise in it: light squares are pure cream, dark squares page black */
      const float QR_LIGHT = 0.876;

      void main() {
        float tree = step(1.5, aKind);
        float ground = 1.0 - tree;

        /* the tree grows bottom-up and folds away top-down */
        float g = clamp((uGrow * 1.5 - aTurn * 1.1 - aRand * 0.1) / 0.4, 0.0, 1.0);
        float f = clamp((uFold * 1.5 - (1.0 - aTurn) * 1.1 - aRand * 0.1) / 0.4, 0.0, 1.0);

        /* the ground turns over tile by tile, in a wave running out from the
           trunk, and lands flat as the code */
        float d = length(aPos.xz) / 29.0;
        float flip = clamp((uFold * 1.7 - d * 0.95 - aRand * 0.06) / 0.5, 0.0, 1.0) * ground;
        float ang = flip * 3.14159265;
        float ca = cos(ang), sa = sin(ang);
        mat3 rx = mat3(1.0, 0.0, 0.0, 0.0, ca, sa, 0.0, -sa, ca);

        float s = mix(1.0, backOut(g) * (1.0 - f), tree);
        vec3 p = aPos;
        p.y = mix(p.y, 0.0, f * tree);
        p.y = mix(p.y, 0.0, flip) + sin(flip * 3.14159265) * 0.9;
        vec3 local = ground > 0.5 ? rx * position : position * s;
        vec3 n = ground > 0.5 ? rx * normal : normal;
        vec3 wp = p + local;

        vec3 L = normalize(vec3(-0.45, 0.85, 0.35));
        float lam = 0.42 + 0.58 * max(0.0, dot(n, L));
        float top = step(0.5, n.y);
        float base =
          aKind < 0.5 ? mix(0.3, 0.6, top) :                 /* light ground: the code's light squares */
          aKind < 1.5 ? 0.03 :                               /* dark ground: the code's dark squares */
          aKind < 2.5 ? 0.36 :                               /* bark */
          aKind < 3.5 ? 0.58 + aRand * 0.38 :                /* leaves */
                        0.75 + 0.2 * sin(uTime * 5.0 + aRand * 20.0);  /* lanterns */
        vL = aKind > 3.5 ? base : base * lam;
        /* past halfway through its turn, a tile shows its final colour */
        float settled = smoothstep(0.45, 0.6, flip);
        vL = mix(vL, aKind < 0.5 ? QR_LIGHT : 0.0, settled);
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

  /* the camera swings from a three-quarter view down to straight overhead */
  const camera = new THREE.PerspectiveCamera(32, 1, 1, 400);
  const A = new THREE.Vector3(54, 44, 61), B = new THREE.Vector3();
  const lookA = new THREE.Vector3(0, 4.5, 0), lookB = new THREE.Vector3();
  const tmp = new THREE.Vector3(), look = new THREE.Vector3();
  const state = { grow: 0, fold: 0, cam: 0 };

  /* Overhead, the code is framed so every module is a whole number of
     pixels and every module edge lands on a pixel edge. Looking straight
     down at a flat plane, the projection is exact, so the folded code is as
     crisp as a printed one. */
  const TOP = 0.5, HEIGHT = 70;           /* tile tops sit at y = 0.5 */
  function overhead(w, h) {
    const mod = Math.max(1, Math.floor(Math.min(w, h) / (qr.size + 2)));
    const fov = (2 * Math.atan(h / mod / 2 / (HEIGHT - TOP)) * 180) / Math.PI;
    /* nudge the code so its edges fall on pixel boundaries */
    const fx = ((w / 2 + 0.5 * mod) % 1) / mod;
    const fz = ((h / 2 + 0.5 * mod) % 1) / mod;
    return { fov, fx, fz };
  }

  function place(w, h) {
    const k = state.cam;
    const e = k * k * (3 - 2 * k);
    const o = overhead(w, h);
    B.set(o.fx, HEIGHT, o.fz + 0.0001);
    lookB.set(o.fx, 0, o.fz);
    tmp.lerpVectors(A, B, e);
    /* arc over rather than cutting straight through */
    tmp.y += Math.sin(e * Math.PI) * 12;
    camera.position.copy(tmp);
    look.lerpVectors(lookA, lookB, e);
    camera.lookAt(look);
    camera.fov = 32 + (o.fov - 32) * e;
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
      const x = Math.floor(rect.left / px), w = Math.ceil(rect.width / px);
      const y = h - Math.ceil(rect.bottom / px), hh = Math.ceil(rect.height / px);
      mesh.rotation.y = (1 - state.cam) * Math.sin(frame.t * 0.25) * 0.18;
      place(w, hh);
      renderer.setViewport(x, y, w, hh);
      renderer.setScissor(x, y, w, hh);
      renderer.setScissorTest(true);
      renderer.clearDepth();
      renderer.render(scene, camera);
      renderer.setScissorTest(false);
    },
  };
}
