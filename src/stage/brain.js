/* ==========================================================================
   The brain: a few thousand gold points on the stage, drawn inside the
   .brain-viz box. Points cluster along the folds of the cortex, light from
   the upper left, and now and then a neuron fires.

   Every essay is a node on its surface. Hover an essay in the list and a
   signal ripples out across the brain from its node; click a node and the
   essay opens.
   ========================================================================== */
import * as THREE from "three";
import { reduceMotion, finePointer } from "../lib/motion.js";

/* light adds up, but alpha is left alone: the dither pass reads alpha as
   "show true colour here", and the brain should always be gold */
const ADD = {
  transparent: true,
  depthWrite: false,
  blending: THREE.CustomBlending,
  blendEquation: THREE.AddEquation,
  blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor,
  blendSrcAlpha: THREE.ZeroFactor, blendDstAlpha: THREE.OneFactor,
};

/* a seeded random, so the brain is the same shape on every visit */
function rng(seed) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

function buildBrain(count) {
  const R = rng(27);
  const pos = [], nrm = [], seedA = [];
  const waves = Array.from({ length: 9 }, () => {
    const v = new THREE.Vector3(R() - 0.5, R() - 0.5, R() - 0.5).normalize().multiplyScalar(13 + R() * 9);
    return [v, R() * 6.28];
  });
  const folds = (p) => waves.reduce((s, [k, ph]) => s + Math.sin(p.dot(k) + ph), 0) / waves.length;
  const v = new THREE.Vector3(), n = new THREE.Vector3();

  let tries = 0;
  while (pos.length / 3 < count && tries++ < count * 40) {
    const part = R();
    v.set(R() * 2 - 1, R() * 2 - 1, R() * 2 - 1);
    if (v.lengthSq() > 1 || v.lengthSq() < 0.01) continue;
    v.normalize();

    if (part < 0.86) {
      /* the cerebrum: two hemispheres with a fissure down the middle */
      const side = Math.sign(v.x) || 1;
      const p = new THREE.Vector3(v.x * 0.68, v.y * 0.6, v.z * 0.9);
      if (p.y < -0.18) p.y = -0.18 + (p.y + 0.18) * 0.55;       /* flatter underneath */
      p.x += side * 0.035;
      const f = folds(p);
      if (Math.abs(f) > 0.085 && R() > 0.07) continue;           /* keep to the folds */
      p.multiplyScalar(1 + f * 0.05);
      n.copy(v);
      pos.push(p.x, p.y + 0.12, p.z);
    } else if (part < 0.98) {
      /* the cerebellum, finely striped */
      const p = new THREE.Vector3(v.x * 0.42, v.y * 0.2, v.z * 0.28).add(new THREE.Vector3(0, -0.36, -0.58));
      if (Math.abs(Math.sin(p.y * 90)) > 0.5 && R() > 0.25) continue;
      n.copy(v);
      pos.push(p.x, p.y, p.z);
    } else {
      /* the brain stem, short and angled back */
      const a = R() * Math.PI * 2, t = R();
      n.set(Math.cos(a), 0, Math.sin(a));
      pos.push(Math.cos(a) * 0.07, -0.2 - t * 0.32, -0.3 + Math.sin(a) * 0.07 - t * 0.12);
    }
    nrm.push(n.x, n.y, n.z);
    seedA.push(R());
  }
  return { pos: new Float32Array(pos), nrm: new Float32Array(nrm), seed: new Float32Array(seedA) };
}

/* essay nodes sit on the outside of the cortex, spread around it */
function nodeSpot(i, total) {
  const golden = Math.PI * (3 - Math.sqrt(5));
  const y = 0.55 - (i / Math.max(1, total - 1)) * 0.75;
  const a = i * golden + 0.6;
  const r = Math.sqrt(1 - y * y);
  const v = new THREE.Vector3(Math.cos(a) * r * 0.7, y * 0.6 + 0.12, Math.sin(a) * r * 0.92);
  return v.multiplyScalar(1.04);
}

export function createBrain(stage, { box, tags, onOpen }) {
  const geo = new THREE.BufferGeometry();
  const b = buildBrain(window.innerWidth < 700 ? 7000 : 13000);
  geo.setAttribute("position", new THREE.BufferAttribute(b.pos, 3));
  geo.setAttribute("normal", new THREE.BufferAttribute(b.nrm, 3));
  geo.setAttribute("aSeed", new THREE.BufferAttribute(b.seed, 1));

  const uniforms = {
    uTime: { value: 0 },
    uFocus: { value: new THREE.Vector3(0, 9, 0) },
    uFocusT: { value: 99 },
    uLight: { value: new THREE.Vector3(-0.5, 0.75, 0.6).normalize() },
    uGlow: { value: 0 },
  };
  const material = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: /* glsl */ `
      attribute float aSeed;
      uniform float uTime, uFocusT, uGlow;
      uniform vec3 uFocus, uLight;
      varying float vL;
      void main() {
        vec3 n = normalize(normalMatrix * normal);
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        float light = 0.28 + 0.72 * max(0.0, dot(n, normalize(uLight)));
        float depth = smoothstep(-4.9, -3.1, mv.z);              /* far side sits back */
        float fire = pow(fract(uTime * 0.11 + aSeed * 7.0), 60.0);  /* a neuron firing */
        float d = distance(position, uFocus);
        float wave = exp(-pow((d - uFocusT * 0.9) * 7.0, 2.0)) * exp(-uFocusT * 0.9);
        vL = (light * (0.42 + uGlow * 0.15) + fire * 0.7 + wave * 0.9) * mix(0.3, 1.0, depth);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = 1.0;
      }
    `,
    fragmentShader: /* glsl */ `
      varying float vL;
      void main() { gl_FragColor = vec4(vec3(vL), 1.0); }
    `,
    ...ADD,
  });
  const points = new THREE.Points(geo, material);

  /* the essay nodes: brighter, bigger points */
  const nodeGeo = new THREE.BufferGeometry();
  const nodeMat = new THREE.ShaderMaterial({
    uniforms: { uHot: { value: -1 }, uTime: uniforms.uTime },
    vertexShader: /* glsl */ `
      attribute float aIndex, aDraft;
      uniform float uHot, uTime;
      varying float vL;
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        float hot = 1.0 - step(0.5, abs(aIndex - uHot));
        float breathe = 0.85 + 0.15 * sin(uTime * 2.0 + aIndex * 2.1);
        vL = mix(0.95, 0.5, aDraft) * breathe + hot * 0.4;
        gl_Position = projectionMatrix * mv;
        gl_PointSize = 3.0 + hot * 2.0;
      }
    `,
    fragmentShader: /* glsl */ `
      varying float vL;
      void main() { gl_FragColor = vec4(vec3(vL), 1.0); }
    `,
    ...ADD,
  });
  const nodes = new THREE.Points(nodeGeo, nodeMat);

  const group = new THREE.Group();
  group.add(points, nodes);
  group.rotation.set(0.24, -1.2, 0);
  const scene = new THREE.Scene();
  scene.add(group);
  const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 20);
  camera.position.set(0, 0.02, 4.0);

  /* ---- nodes and their tags ---------------------------------------------- */
  let essays = [], spots = [], tagEls = [];
  function setEssays(list) {
    essays = list;
    spots = list.map((_, i) => nodeSpot(i, list.length));
    const p = new Float32Array(spots.length * 3), idx = new Float32Array(spots.length), dr = new Float32Array(spots.length);
    spots.forEach((s, i) => { p.set([s.x, s.y, s.z], i * 3); idx[i] = i; dr[i] = list[i].draft ? 1 : 0; });
    nodeGeo.setAttribute("position", new THREE.BufferAttribute(p, 3));
    nodeGeo.setAttribute("aIndex", new THREE.BufferAttribute(idx, 1));
    nodeGeo.setAttribute("aDraft", new THREE.BufferAttribute(dr, 1));
    tags.innerHTML = "";
    tagEls = list.map((e) => {
      const t = document.createElement("span");
      t.className = "brain-tag" + (e.draft ? " is-draft" : "");
      t.textContent = e.num;
      tags.appendChild(t);
      return t;
    });
    stage.invalidate();
  }

  let hot = -1;
  function focus(i) {
    if (i === hot) return;
    hot = i;
    nodeMat.uniforms.uHot.value = i;
    tagEls.forEach((t, k) => t.classList.toggle("is-hot", k === i));
    if (i >= 0) {
      uniforms.uFocus.value.copy(spots[i]);
      uniforms.uFocusT.value = 0;
    }
    stage.invalidate();
  }

  /* ---- spin: slowly on its own, leaning toward the mouse, and draggable --- */
  let spin = -1.2, spinV = 0.12, tiltX = 0.24, leanX = 0, leanY = 0, dragging = false, lastX = 0, glow = 0;
  if (finePointer && !reduceMotion) {
    box.addEventListener("pointermove", (e) => {
      const r = box.getBoundingClientRect();
      leanX = ((e.clientY - r.top) / r.height - 0.5) * 0.4;
      leanY = ((e.clientX - r.left) / r.width - 0.5) * 0.5;
      if (dragging) { spin += (e.clientX - lastX) * 0.008; spinV = (e.clientX - lastX) * 0.4; lastX = e.clientX; }
      const near = nearest(e.clientX, e.clientY);
      box.style.cursor = near >= 0 ? "pointer" : dragging ? "grabbing" : "grab";
      if (!dragging) focus(near);
    });
    box.addEventListener("pointerleave", () => { leanX = leanY = 0; dragging = false; focus(-1); });
  }
  let downX = null;
  box.addEventListener("pointerdown", (e) => {
    dragging = true; lastX = downX = e.clientX;
    box.setPointerCapture?.(e.pointerId);
  });
  box.addEventListener("pointerup", (e) => {
    if (downX === null) return;                  /* only a press that started here */
    const moved = Math.abs(e.clientX - downX) > 4;
    dragging = false; downX = null;
    const i = nearest(e.clientX, e.clientY);
    if (i >= 0 && !moved) onOpen?.(essays[i].slug);
  });

  /* which node is under the pointer, if any (within 22 css px) */
  const proj = new THREE.Vector3();
  let screen = [];
  function nearest(x, y) {
    let best = -1, bd = 22;
    screen.forEach((s, i) => {
      if (!s.front) return;
      const d = Math.hypot(s.x - x, s.y - y);
      if (d < bd) { bd = d; best = i; }
    });
    return best;
  }

  /* ---- where the box is, in art pixels ---------------------------------- */
  let rect = null;
  const visible = () => {
    rect = box.getBoundingClientRect();
    return rect.bottom > 0 && rect.top < window.innerHeight && rect.width > 0;
  };

  const layer = {
    focus,
    setEssays,
    active: visible,
    animating: () => true,
    fast: () => dragging || hot >= 0 || uniforms.uFocusT.value < 2,
    draw(renderer, target, frame) {
      const dt = frame.dt;
      if (!dragging) { spinV += (0.12 - spinV) * Math.min(1, dt * 1.5); spin += spinV * dt * (reduceMotion ? 0 : 1); }
      group.rotation.y += (spin + leanY - group.rotation.y) * Math.min(1, dt * 4);
      group.rotation.x += (tiltX + leanX - group.rotation.x) * Math.min(1, dt * 4);
      glow += ((hot >= 0 ? 1 : 0) - glow) * Math.min(1, dt * 3);
      uniforms.uGlow.value = glow;
      uniforms.uTime.value = frame.t;
      uniforms.uFocusT.value += dt;
      nodeMat.uniforms.uTime = uniforms.uTime;

      const { px, h } = frame;
      const x = Math.floor(rect.left / px), w = Math.ceil(rect.width / px);
      const y = h - Math.ceil(rect.bottom / px), hh = Math.ceil(rect.height / px);
      camera.aspect = w / hh;
      camera.updateProjectionMatrix();
      renderer.setViewport(x, y, w, hh);
      renderer.setScissor(x, y, w, hh);
      renderer.setScissorTest(true);
      renderer.clearDepth();
      renderer.render(scene, camera);
      renderer.setScissorTest(false);

      /* pin the tags to their nodes */
      group.updateMatrixWorld();
      screen = spots.map((s, i) => {
        proj.copy(s).applyMatrix4(group.matrixWorld);
        const front = proj.z > -0.15;
        proj.project(camera);
        const sx = rect.left + (proj.x * 0.5 + 0.5) * rect.width;
        const sy = rect.top + (-proj.y * 0.5 + 0.5) * rect.height;
        const t = tagEls[i];
        if (t) {
          t.style.transform = `translate(${(sx - rect.left).toFixed(1)}px, ${(sy - rect.top).toFixed(1)}px)`;
          t.classList.toggle("is-behind", !front);
        }
        return { x: sx, y: sy, front };
      });
    },
  };
  return layer;
}
