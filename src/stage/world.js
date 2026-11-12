/* ==========================================================================
   The world: the painting at night, the storm over it, and the circuit
   board that waits behind the round door.

   It is one full-screen shader so the three can hand over to each other
   without seams:

     the painting  the Shire watercolour, graded down to night, with the two
                   lanterns breathing and storm clouds rolling where the sky
                   was. A lightning flash lights it up, and right under the
                   strike it shows its real colours for an instant.
     the door      the round green door is the hinge of the page. Scrolling
                   zooms into it (state.zoom), and as it opens (state.open)
                   the inside of the circle becomes the board.
     the board     gold circuit traces, laid out so every trace connects to
                   its neighbour, with current pulsing outward from where the
                   door was. It stays on, dim, behind the rest of the page.

   Bolts are pixelfx sky-bolts, drawn on the CPU into a texture the size of
   the stage and laid over the top.
   ========================================================================== */
import * as THREE from "three";
import { createFrame, clearFrame, createFx, composite } from "../../pixelfx/src/core/index.js";
import * as skyBolt from "../../pixelfx/src/fx/lightning/sky-bolt.js";
import shireUrl from "../../assets/shire.jpg";

/* landmarks in the painting, in its own pixels (1800 x 1688, y down) */
export const PAINTING = { w: 1800, h: 1688 };
const DOOR = { x: 836, y: 763, r: 268 };          /* the green of the door, inside the brick ring */
const LAMPS = [[441, 628], [1160, 620]];

const seed = () => (Math.random() * 1e6) | 0;
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

export function createWorld(stage, { onFlash, onReady } = {}) {
  const state = {
    zoom: 1,          /* 1 = the whole painting; ~14 = through the door */
    open: 0,          /* 0..1, how far the door has opened onto the board */
    board: 0,         /* 0..1, how strongly the board shows outside the door */
    painting: 1,      /* 0 once the painting is fully behind us */
    scroll: 0,        /* drifts the board as the page moves */
    dim: 1,           /* the board steps back once there's text over it */
    mouse: new THREE.Vector2(),
    mouseTarget: new THREE.Vector2(),
    centerY: 640,     /* where the painting is framed vertically */
  };

  const loader = new THREE.TextureLoader();
  const paint = loader.load(shireUrl, (t) => {
    t.needsUpdate = true;
    ready = true;
    stage.invalidate();
    onReady?.();
  });
  paint.colorSpace = THREE.NoColorSpace;
  paint.generateMipmaps = false;
  paint.minFilter = THREE.LinearFilter;
  paint.magFilter = THREE.LinearFilter;
  let ready = false;

  /* ---- bolts, drawn by pixelfx into a stage-sized texture ---------------- */
  let pf = null, boltTex = null, bolts = [], boltsDirty = false;
  function sizeBolts(w, h) {
    pf = { frame: createFrame(w, h), data: new Uint8Array(w * h * 4) };
    boltTex?.dispose();
    boltTex = new THREE.DataTexture(pf.data, w, h, THREE.RGBAFormat);
    boltTex.minFilter = boltTex.magFilter = THREE.NearestFilter;
    boltTex.needsUpdate = true;
    if (material) material.uniforms.uBolt.value = boltTex;
  }

  const material = new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3,
    uniforms: {
      uPaint: { value: paint },
      uBolt: { value: null },
      uRes: { value: new THREE.Vector2(1, 1) },
      uPx: { value: 3 },
      uTime: { value: 0 },
      uFlash: { value: 0 },
      uStrike: { value: new THREE.Vector2(0.5, 0) },
      uZoom: { value: 1 },
      uOpen: { value: 0 },
      uBoard: { value: 0 },
      uPainting: { value: 1 },
      uScroll: { value: 0 },
      uDim: { value: 1 },
      uMouse: { value: new THREE.Vector2() },
      uCenterY: { value: 640 },
    },
    vertexShader: /* glsl */ `
      out vec2 vUv;
      void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
    `,
    fragmentShader: /* glsl */ `
      precision highp float;
      uniform sampler2D uPaint, uBolt;
      uniform vec2 uRes, uStrike, uMouse;
      uniform float uPx, uTime, uFlash, uZoom, uOpen, uBoard, uPainting, uScroll, uCenterY, uDim;
      in vec2 vUv;
      out vec4 fragColor;

      const vec2 IMG = vec2(${PAINTING.w}.0, ${PAINTING.h}.0);
      const vec2 DOOR = vec2(${DOOR.x}.0, ${DOOR.y}.0);
      const float DOOR_R = ${DOOR.r}.0;

      float hash(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
      float noise(vec2 p) {
        vec2 i = floor(p), f = fract(p);
        vec2 u = f * f * (3.0 - 2.0 * f);
        return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
      }
      float fbm(vec2 p) {
        float s = 0.0, a = 0.5;
        for (int i = 0; i < 5; i++) { s += a * noise(p); p = p * 2.03 + 17.1; a *= 0.5; }
        return s;
      }

      /* ---- the board: a truchet of traces that always meet their neighbours */
      float seg(vec2 p, vec2 a, vec2 b) {
        vec2 pa = p - a, ba = b - a;
        return length(pa - ba * clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0));
      }
      float edgeOn(vec2 k) { return step(0.38, hash(k * 1.37 + 4.1)); }

      vec2 board(vec2 q) {               /* q in art pixels; returns (trace, pad) */
        const float S = 12.0;
        vec2 cell = floor(q / S), f = q / S - cell;
        float L = edgeOn(cell + vec2(-0.5, 0.0)), R = edgeOn(cell + vec2(0.5, 0.0));
        float B = edgeOn(cell + vec2(0.0, -0.5)), T = edgeOn(cell + vec2(0.0, 0.5));
        vec2 mL = vec2(0.0, 0.5), mR = vec2(1.0, 0.5), mB = vec2(0.5, 0.0), mT = vec2(0.5, 1.0), c = vec2(0.5);
        float n = L + R + B + T, d = 1e3, pad = 0.0;
        if (n == 2.0) {
          if (L * R > 0.0) d = seg(f, mL, mR);
          else if (T * B > 0.0) d = seg(f, mB, mT);
          else {                          /* two neighbours meet on a 45 degree chamfer */
            vec2 a = L > 0.0 ? mL : mR;
            vec2 b = T > 0.0 ? mT : mB;
            d = seg(f, a, b);
          }
        } else if (n == 1.0) {            /* a trace that ends in a via */
          vec2 a = L > 0.0 ? mL : R > 0.0 ? mR : B > 0.0 ? mB : mT;
          d = seg(f, a, c);
          pad = 1.0;
        } else if (n >= 3.0) {            /* a junction */
          if (L * R > 0.0) d = seg(f, mL, mR);
          if (T * B > 0.0) d = min(d, seg(f, mB, mT));
          if (L * R == 0.0) d = min(d, seg(f, L > 0.0 ? mL : mR, c));
          if (T * B == 0.0) d = min(d, seg(f, T > 0.0 ? mT : mB, c));
          pad = 1.0;
        }
        float trace = step(d * S, 0.6);
        float r = length(f - c) * S;
        float via = pad * step(r, 2.3) * (1.0 - step(r, 1.1));
        return vec2(max(trace, via), via);
      }

      void main() {
        vec2 sp = vUv * uRes;                                 /* art pixels, y up */
        vec2 cssRes = uRes * uPx;

        /* ---- frame the painting: cover the screen, then zoom on the door -- */
        float k = max(cssRes.x / IMG.x, cssRes.y / IMG.y);   /* css px per painting px */
        float focus = smoothstep(1.0, 2.2, uZoom);
        vec2 halfView = cssRes / (2.0 * k);
        vec2 center = vec2(clamp(DOOR.x, halfView.x, IMG.x - halfView.x),
                           clamp(uCenterY, halfView.y, IMG.y - halfView.y));
        center = mix(center, DOOR, focus) + uMouse * 14.0 / uZoom;
        vec2 css = vec2(vUv.x, 1.0 - vUv.y) * cssRes;       /* css px, y down */
        vec2 p = center + (css - cssRes * 0.5) / (k * uZoom);

        /* where the strike lands, in painting space, for the flash falloff */
        float strikeFall = exp(-abs(vUv.x - uStrike.x) * 2.6);
        float flash = uFlash * (0.3 + 0.7 * strikeFall);

        /* ---- the painting at night -------------------------------------- */
        vec3 col = texture(uPaint, vec2(p.x / IMG.x, 1.0 - p.y / IMG.y)).rgb;
        float lum = dot(col, vec3(0.299, 0.587, 0.114));
        /* the gold pass only reads brightness, so night is a tone curve: dark
           ink lines drop to black, stone and grass sit in the low golds */
        vec3 night = vec3(pow(smoothstep(0.05, 0.92, lum), 1.15) * 0.6);

        /* the round door is the hinge of the whole page, so it gets a little
           warm light of its own: a rim along the brick ring and a glow on the
           brass knob */
        float dDoor = length(p - DOOR);
        night += vec3(0.11) * exp(-abs(dDoor - (DOOR_R + 34.0)) / 22.0);
        night += vec3(0.5) * exp(-length(p - vec2(806.0, 815.0)) / 9.0);

        /* the watercolour sky becomes cloud, lit from inside when it strikes */
        float blue = smoothstep(0.03, 0.16, col.b - max(col.r, col.g) * 0.92);
        float sky = blue * (1.0 - smoothstep(330.0, 470.0, p.y));
        vec2 cp = p * 0.0042 + vec2(uTime * 0.035, -uTime * 0.01);
        float cloud = fbm(cp + fbm(cp * 0.7 - uTime * 0.02) * 0.9);
        vec3 storm = vec3(0.05 + 0.2 * cloud * cloud) + flash * vec3(0.55 * cloud + 0.12);
        night = mix(night, storm, sky);

        /* the lanterns by the door are lit, and breathe a little */
        for (int i = 0; i < 2; i++) {
          vec2 lp = i == 0 ? vec2(${LAMPS[0][0]}.0, ${LAMPS[0][1]}.0) : vec2(${LAMPS[1][0]}.0, ${LAMPS[1][1]}.0);
          float flick = 0.82 + 0.18 * noise(vec2(uTime * 7.0 + float(i) * 13.0, 0.0));
          float d = length(p - lp);
          night += vec3(0.95, 0.72, 0.32) * (exp(-d / 26.0) * 0.55 + exp(-d / 120.0) * 0.12) * flick;
        }

        /* lightning lights the scene, brightest under the strike */
        vec3 lit = night + col * flash * 1.25;
        float reveal = smoothstep(0.2, 0.95, flash) * (1.0 - sky);

        /* ---- the board, seen through the door ----------------------------- */
        vec2 doorCss = (DOOR - center) * k * uZoom + cssRes * 0.5;
        vec2 doorArt = vec2(doorCss.x, cssRes.y - doorCss.y) / uPx;
        float depth = mix(0.35, 1.0, smoothstep(0.0, 1.0, uOpen));
        vec2 q = (sp - doorArt) / depth;
        q.y -= uScroll * 0.45 / uPx;
        vec2 bd = board(q + 4096.0);
        float r = length(q);
        float wave = fract(r / 150.0 - uTime * 0.32);
        float pulse = smoothstep(0.9, 1.0, wave) * smoothstep(1.0, 0.985, wave);
        float shimmer = 0.75 + 0.25 * noise(floor((q + 4096.0) / 12.0) + uTime * 0.6);
        float boardLum = bd.x * (0.3 * shimmer + 0.65 * pulse) + bd.y * 0.18 + fbm(q * 0.05) * 0.03;
        /* the current comes in through the door: a bright bloom at the core
           while it opens */
        boardLum += bd.x * exp(-r / 60.0) * smoothstep(0.2, 0.7, uOpen) * (1.0 - smoothstep(0.85, 1.0, uOpen)) * 0.8;

        float inDoor = 1.0 - smoothstep(DOOR_R - 1.5, DOOR_R + 1.5, length(p - DOOR));
        float showBoard = max(inDoor * uOpen, uBoard * (1.0 - uPainting));
        float boardOut = mix(boardLum * 0.55, boardLum, uOpen) * uDim;

        vec3 outCol = mix(lit * uPainting, vec3(boardOut), showBoard);
        float outA = reveal * uPainting * (1.0 - showBoard);

        /* gentle vignette so the edges sit back */
        vec2 vq = vUv - 0.5;
        outCol *= 1.0 - dot(vq, vq) * 0.9;

        /* the bolt itself, on top of everything */
        vec4 bolt = texture(uBolt, vec2(vUv.x, 1.0 - vUv.y));
        outCol += bolt.rgb * bolt.a;
        outA *= 1.0 - bolt.a;

        fragColor = vec4(outCol, outA);
      }
    `,
    depthTest: false,
    depthWrite: false,
  });

  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
  quad.frustumCulled = false;
  const scene = new THREE.Scene();
  scene.add(quad);
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

  /* where a point of the painting is on screen right now, in css px; the
     same framing the shader uses, so a bolt can be aimed at the door knob */
  function toScreen(x, y) {
    const W = window.innerWidth, H = window.innerHeight;
    const k = Math.max(W / PAINTING.w, H / PAINTING.h);
    const z = state.zoom;
    const focus = smooth(1, 2.2, z);
    const hx = W / (2 * k), hy = H / (2 * k);
    let cx = Math.min(Math.max(DOOR.x, hx), PAINTING.w - hx);
    let cy = Math.min(Math.max(state.centerY, hy), PAINTING.h - hy);
    cx = cx + (DOOR.x - cx) * focus + state.mouse.x * 14 / z;
    cy = cy + (DOOR.y - cy) * focus + state.mouse.y * 14 / z;
    return { x: (x - cx) * k * z + W / 2, y: (y - cy) * k * z + H / 2 };
  }

  let flash = 0, strikeX = 0.5;

  function strike(xArt, toYArt, { aimed = false } = {}) {
    if (!pf) return;
    const H = pf.frame.h;
    const length = toYArt ?? H * (0.3 + Math.random() * 0.2);
    bolts.push(createFx(skyBolt, {
      x: xArt, y: -6, seed: seed(), palette: skyBolt.STORM_GOLD, length,
      lean: 0.18, thickness: aimed ? 1.2 : 0.95, light: aimed ? 1 : 0.85, aim: aimed ? 0 : null,
    }));
    strikeX = xArt / pf.frame.w;
    stage.invalidate();
    window.dispatchEvent(new CustomEvent("storm:strike", { detail: { x: strikeX, near: aimed } }));
  }

  function updateBolts(dt) {
    if (!bolts.length && !boltsDirty) return;
    clearFrame(pf.frame);
    flash = 0;
    bolts = bolts.filter((b) => {
      b.update(dt);
      if (b.done()) return false;
      b.draw(pf.frame);
      flash = Math.max(flash, skyBolt.flash(b.t));
      return true;
    });
    composite(pf.frame, pf.data, null);
    boltTex.needsUpdate = true;
    boltsDirty = bolts.length > 0;     /* one more pass after the last bolt, to clear it */
    onFlash?.(flash, strikeX);
  }

  const layer = {
    state,
    strike,
    toScreen,
    KNOB: { x: 806, y: 815 },
    get flash() { return flash; },
    get bolting() { return bolts.length > 0; },
    resize({ w, h, px }) {
      sizeBolts(w, h);
      material.uniforms.uRes.value.set(w, h);
      material.uniforms.uPx.value = px;
    },
    active: () => ready,
    animating: () => true,
    draw(renderer, target, frame) {
      updateBolts(frame.dt);
      state.mouse.lerp(state.mouseTarget, 1 - Math.pow(0.001, frame.dt));
      const u = material.uniforms;
      u.uTime.value = frame.t;
      u.uFlash.value = flash;
      u.uStrike.value.set(strikeX, 0);
      u.uZoom.value = state.zoom;
      u.uOpen.value = state.open;
      u.uBoard.value = state.board;
      u.uPainting.value = state.painting;
      u.uScroll.value = state.scroll;
      u.uDim.value = state.dim;
      u.uMouse.value.copy(state.mouse);
      u.uCenterY.value = state.centerY;
      renderer.render(scene, camera);
    },
  };
  return layer;
}
