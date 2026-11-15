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
import { reduceMotion } from "../lib/motion.js";
import { createFrame, clearFrame, createFx, composite } from "../../pixelfx/src/core/index.js";
import * as skyBolt from "../../pixelfx/src/fx/lightning/sky-bolt.js";
/* a lighter encode of the painting: the stage dithers it, so the extra
   JPEG quality of the original would never show */
import shireUrl from "../../assets/shire-stage.jpg";

/* landmarks in the painting, in its own pixels (1800 x 1688, y down) */
export const PAINTING = { w: 1800, h: 1688 };
const DOOR = { x: 836, y: 763, r: 268 };          /* the green of the door, inside the brick ring */
const KNOB = { x: 816, y: 782 };                  /* the brass knob: the board opens out of it */
const LAMPS = [[441, 628], [1160, 620]];

const seed = () => (Math.random() * 1e6) | 0;
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

export function createWorld(stage, { onFlash, onReady, inside = null } = {}) {
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
      uRipple: { value: new THREE.Vector3(0, 0, -99) },
      uLand: { value: new THREE.Vector2(0, 0) },
      uRain: { value: reduceMotion ? 0 : 1 },
      uMouse: { value: new THREE.Vector2() },
      uCenterY: { value: 640 },
      /* the house behind the door (src/stage/house.js), when there is one */
      uHouse: { value: null },
      uHouseOn: { value: 0 },
      uHouseLum: { value: 1 },
      uHouseFlash: { value: 0 },
    },
    vertexShader: /* glsl */ `
      out vec2 vUv;
      void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
    `,
    fragmentShader: /* glsl */ `
      precision highp float;
      uniform sampler2D uPaint, uBolt, uHouse;
      uniform float uHouseOn, uHouseLum, uHouseFlash;
      uniform vec2 uRes, uStrike, uMouse;
      uniform vec3 uRipple;
      uniform vec2 uLand;                     /* where the last bolt came down, art px, y down */
      uniform float uPx, uTime, uFlash, uZoom, uOpen, uBoard, uPainting, uScroll, uCenterY, uDim, uRain;
      in vec2 vUv;
      out vec4 fragColor;

      const vec2 IMG = vec2(${PAINTING.w}.0, ${PAINTING.h}.0);
      const vec2 DOOR = vec2(${DOOR.x}.0, ${DOOR.y}.0);
      const float DOOR_R = ${DOOR.r}.0;
      const vec2 KNOB = vec2(${KNOB.x}.0, ${KNOB.y}.0);

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

      /* domain-warped cloud, fbm(p + fbm(p + fbm(p))) with a rotation
         between octaves so the layers don't line up (shader-dev: domain-warping) */
      const mat2 ROT = mat2(0.80, 0.60, -0.60, 0.80);
      float warped(vec2 p, float t) {
        vec2 q = vec2(fbm(p + vec2(0.0, t * 0.05)), fbm(ROT * p + vec2(5.2, 1.3)));
        vec2 r = vec2(fbm(p + 3.0 * q + vec2(1.7, 9.2) + t * 0.03), fbm(ROT * p + 3.0 * q + vec2(8.3, 2.8)));
        return fbm(p + 2.5 * r);
      }

      /* stateless rain: slanted 1px streaks in three depths, every drop
         worked out from its cell and the time, no state kept between frames
         (shader-dev: particle-system, stateless) */
      float rain(vec2 sp, float t, float wind) {
        float acc = 0.0;
        for (int i = 0; i < 3; i++) {
          float fi = float(i);
          float W = 9.0 - fi * 2.0;            /* columns get closer as they get farther away */
          float speed = 260.0 - fi * 70.0;     /* art px a second */
          float L = 7.0 - fi * 2.0;            /* streak length */
          float slant = wind * (1.0 - fi * 0.25);
          float u = sp.x + sp.y * slant + fi * 37.0;
          float col = floor(u / W);
          float v = sp.y + t * speed + hash(vec2(col, fi)) * 400.0;
          float P = 46.0 + fi * 10.0;
          float cell = floor(v / P);
          float h = hash(vec2(col * 1.7 + fi, cell));
          if (h < 0.55) continue;              /* not every cell has a drop */
          float x0 = floor(hash(vec2(col, cell + 3.1)) * (W - 1.0));
          float y0 = hash(vec2(cell, col + 7.7)) * (P - L);
          float inX = 1.0 - step(0.5, abs(floor(u - col * W) - x0));
          float y = v - cell * P - y0;
          float inY = step(0.0, y) * step(y, L);
          acc += inX * inY * (1.0 - fi * 0.3) * (0.6 + 0.4 * y / L);
        }
        return acc;
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
        center = mix(center, KNOB, focus) + uMouse * 14.0 / uZoom;
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
        night += vec3(0.5) * exp(-length(p - vec2(816.0, 782.0)) / 9.0);
        /* as you come in close, current gathers: the door's edge burns into
           a ring of light and the knob glows hot, just before it opens */
        float charge = smoothstep(1.25, 3.2, uZoom) * (1.0 - uOpen);
        night += vec3(0.75) * exp(-abs(dDoor - DOOR_R) / (3.0 + 10.0 / uZoom)) * charge;
        night += vec3(0.9) * exp(-length(p - vec2(816.0, 782.0)) / (6.0 + 8.0 * charge)) * charge;

        /* the watercolour sky becomes cloud, lit from inside when it strikes */
        float blue = smoothstep(0.03, 0.16, col.b - max(col.r, col.g) * 0.92);
        float sky = blue * (1.0 - smoothstep(330.0, 470.0, p.y));
        vec2 cp = p * 0.0042 + vec2(uTime * 0.035, -uTime * 0.01);
        float cloud = warped(cp, uTime);
        /* sheet lightning: now and then a patch of cloud lights up from
           inside, somewhere along the sky, without a bolt coming down */
        float epoch = floor(uTime / 2.3);
        vec2 sheetAt = vec2(hash(vec2(epoch, 1.0)) * IMG.x, 120.0 + hash(vec2(epoch, 2.0)) * 220.0);
        float st = fract(uTime / 2.3) * 2.3;
        float sheet = step(0.45, hash(vec2(epoch, 3.0))) * exp(-st * 7.0) * (0.6 + 0.4 * sin(st * 70.0))
                    * exp(-length(p - sheetAt) / 260.0) * uRain;
        vec3 storm = vec3(0.05 + 0.2 * cloud * cloud) + (flash + sheet * 0.7) * vec3(0.55 * cloud + 0.12)
                   + vec3(0.35) * sheet * smoothstep(0.45, 0.75, cloud);
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

        /* ---- the board, opening out of the brass knob ---------------------
           The camera homes in on the knob, the knob charges, and then a
           circle of circuitry grows out of it: a bead of light first, then
           a rush to the edges, with a bright front of current as it goes.
           The soft edge is left for the dither pass to break into pixels. */
        vec2 knobCss = (KNOB - center) * k * uZoom + cssRes * 0.5;
        vec2 knobArt = vec2(knobCss.x, cssRes.y - knobCss.y) / uPx;
        float depth = mix(0.3, 1.0, smoothstep(0.0, 1.0, uOpen));
        vec2 q = (sp - knobArt) / depth;
        q.y -= uScroll * 0.45 / uPx;
        vec2 bd = board(q + 4096.0);
        float r = length(q);
        float wave = fract(r / 150.0 - uTime * 0.32);
        float pulse = smoothstep(0.9, 1.0, wave) * smoothstep(1.0, 0.985, wave);
        float shimmer = 0.75 + 0.25 * noise(floor((q + 4096.0) / 12.0) + uTime * 0.6);
        /* a ripple from wherever something on the page just lit up */
        float rt = uTime - uRipple.z;
        float rr = length(sp - uRipple.xy);
        float ripple = exp(-pow((rr - rt * 260.0) / 10.0, 2.0)) * exp(-rt * 1.6);
        float boardLum = bd.x * (0.3 * shimmer + 0.65 * pulse + 2.2 * ripple) + bd.y * 0.18 + fbm(q * 0.05) * 0.03;
        /* the current pours out of the knob while it opens */
        float opening = smoothstep(0.0, 0.3, uOpen) * (1.0 - smoothstep(0.85, 1.0, uOpen));
        boardLum += bd.x * exp(-r / 70.0) * opening * 0.9;

        float R = pow(uOpen, 2.2) * length(uRes) * 1.08;
        float dk = length(sp - knobArt);
        float live = step(0.001, uOpen);
        float portal = (1.0 - smoothstep(R - 5.0, R + 5.0, dk)) * live;
        float front = exp(-abs(dk - R) / (1.5 + R * 0.025)) * live * (1.0 - smoothstep(0.9, 1.0, uOpen));
        /* the painting just outside the front catches its light */
        float spill = exp(-max(0.0, dk - R) / (18.0 + R * 0.15)) * live * (1.0 - portal) * uPainting;

        float showBoard = max(portal, uBoard * (1.0 - uPainting));
        float boardOut = boardLum * uDim;

        /* with the house built, the door opens onto it instead: rendered in
           linear light, so it's brought up to the eye's curve before the
           ramp reads it. A touch on the page still sends a ring of current
           across it. */
        vec3 inside = vec3(boardOut);
        if (uHouseOn > 0.5) {
          vec3 hc = pow(max(texture(uHouse, vUv).rgb, 0.0), vec3(1.0 / 2.2));
          inside = hc * uHouseLum + vec3(0.4) * ripple;
        }

        vec3 outCol = mix(lit * uPainting, inside, showBoard);
        outCol += vec3(0.95) * front + lit * spill * 0.8 + vec3(0.12) * spill;
        float outA = reveal * uPainting * (1.0 - showBoard);
        /* lightning in the windows shows the rooms in their real colours */
        outA = max(outA, smoothstep(0.3, 0.95, uHouseFlash) * showBoard * uHouseOn * 0.85);

        /* ---- light shafts from the strike ---------------------------------
           For each pixel, step toward where the bolt came down and count how
           much of the way is open: light streams through the gaps between
           the dark shapes of the painting and the stone and leaves catch it
           at the edges (shader-dev: screen-space volumetric light / god rays).
           Only while a flash is going, so it costs nothing the rest of the time. */
        float scene = uPainting * (1.0 - showBoard);
        if (uFlash > 0.02 && scene > 0.01) {
          vec2 L = vec2(uLand.x, uRes.y - uLand.y);
          vec2 dir = (L - sp) / 22.0;
          vec2 s = sp + dir * hash(sp + fract(uTime) * 61.0);   /* jittered start: the dither hides the steps */
          float acc = 0.0, decay = 1.0;
          for (int i = 0; i < 22; i++) {
            s += dir;
            vec2 ps = center + (vec2(s.x, uRes.y - s.y) * uPx - cssRes * 0.5) / (k * uZoom);
            vec3 c = texture(uPaint, vec2(ps.x / IMG.x, 1.0 - ps.y / IMG.y)).rgb;
            acc += smoothstep(0.12, 0.45, dot(c, vec3(0.299, 0.587, 0.114))) * decay;
            decay *= 0.93;
          }
          /* spokes: the light breaks into rays around the strike, a new
             pattern for every bolt */
          vec2 d = sp - L;
          float ang = atan(d.y, d.x);
          float spokes = pow(noise(vec2(ang * 7.0, uLand.x * 0.37)), 3.0) + 0.5 * pow(noise(vec2(ang * 19.0, uLand.y)), 4.0);
          float dl = length(d) / uRes.y;
          outCol += vec3(0.7) * (acc / 11.5) * (0.05 + 1.6 * spokes) * uFlash * exp(-dl * 1.8) * scene;
        }

        /* ---- rain over the painting, lit by the lanterns and the lightning */
        if (uRain > 0.0 && scene > 0.01) {
          float r = rain(sp, uTime, 0.22 + uMouse.x * 0.25);
          float lampLit = 0.0;
          for (int i = 0; i < 2; i++) {
            vec2 lp = i == 0 ? vec2(${LAMPS[0][0]}.0, ${LAMPS[0][1]}.0) : vec2(${LAMPS[1][0]}.0, ${LAMPS[1][1]}.0);
            lampLit += exp(-length(p - lp) / 140.0);
          }
          float calm = 1.0 - smoothstep(1.4, 3.0, uZoom);     /* it eases off as you go in at the door */
          outCol += vec3(r) * (0.14 + lampLit * 0.3 + flash * 0.75) * scene * calm;
        }

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
    cx = cx + (KNOB.x - cx) * focus + state.mouse.x * 14 / z;
    cy = cy + (KNOB.y - cy) * focus + state.mouse.y * 14 / z;
    return { x: (x - cx) * k * z + W / 2, y: (y - cy) * k * z + H / 2 };
  }

  let flash = 0, strikeX = 0.5, landY = 0;

  function strike(xArt, toYArt, { aimed = false } = {}) {
    if (!pf) return;
    const H = pf.frame.h;
    const length = toYArt ?? H * (0.3 + Math.random() * 0.2);
    bolts.push(createFx(skyBolt, {
      x: xArt, y: -6, seed: seed(), palette: skyBolt.STORM_GOLD, length,
      lean: 0.18, thickness: aimed ? 1.2 : 0.95, light: aimed ? 1 : 0.85, aim: aimed ? 0 : null,
    }));
    strikeX = xArt / pf.frame.w;
    landY = -6 + length;
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

  /* send a ripple of current across the board from a point on screen */
  let clockNow = 0;
  function ripple(cssX, cssY) {
    const px = material.uniforms.uPx.value, h = material.uniforms.uRes.value.y;
    material.uniforms.uRipple.value.set(cssX / px, h - cssY / px, clockNow);
    stage.invalidate();
  }

  const layer = {
    state,
    strike,
    ripple,
    toScreen,
    KNOB,
    get flash() { return flash; },
    get bolting() { return bolts.length > 0; },
    resize({ w, h, px }) {
      sizeBolts(w, h);
      material.uniforms.uRes.value.set(w, h);
      material.uniforms.uPx.value = px;
    },
    active: () => ready,
    animating: () => true,
    fast: () => bolts.length > 0 || boltsDirty || clockNow - material.uniforms.uRipple.value.z < 2.5 || Math.abs(state.mouse.x - state.mouseTarget.x) + Math.abs(state.mouse.y - state.mouseTarget.y) > 0.002,
    draw(renderer, target, frame) {
      updateBolts(frame.dt);
      state.mouse.lerp(state.mouseTarget, 1 - Math.pow(0.001, frame.dt));
      const u = material.uniforms;
      u.uTime.value = frame.t;
      clockNow = frame.t;
      u.uFlash.value = flash;
      u.uStrike.value.set(strikeX, 0);
      u.uLand.value.set(strikeX * frame.w, landY);
      u.uZoom.value = state.zoom;
      u.uOpen.value = state.open;
      u.uBoard.value = state.board;
      u.uPainting.value = state.painting;
      u.uScroll.value = state.scroll;
      u.uDim.value = state.dim;
      u.uMouse.value.copy(state.mouse);
      u.uCenterY.value = state.centerY;
      if (inside) {
        inside.state.on = state.open > 0.001 || (state.board > 0.001 && state.painting < 0.999);
        u.uHouse.value = inside.texture;
        u.uHouseOn.value = inside.state.on ? 1 : 0;
        u.uHouseLum.value = inside.state.lum;
        u.uHouseFlash.value = inside.flash;
      }
      renderer.render(scene, camera);
    },
  };
  return layer;
}
