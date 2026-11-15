/* ==========================================================================
   The house behind the round door, as a stage layer.

   It renders the 3D house (src/stage/house/build.js) into its own small
   target, one texel per art pixel, and the world shader shows that through
   the door where the circuit board used to be, so it goes through the same
   gold dither as everything else.

   The camera walks a fixed path through the house: in at the door, down
   the bend of the hall, into the study (the map, then the workbench),
   through the round door to the parlour and the fire, and out of the back
   door into the night. Where it is on that path (state.u) is set by the
   page from the scroll (src/rooms.js); the camera eases after it.

   It has its own weather: now and then lightning shows through the round
   windows, lighting the rooms for an instant and, like the flash over the
   painting, showing them in their real colours.
   ========================================================================== */
import * as THREE from "three";
import { reduceMotion } from "../lib/motion.js";
import { buildHouse } from "./house/build.js";

/* where the camera stands and what it looks at, stop by stop. state.u is a
   position along these: 0 is the first, 1 the next and so on. */
function cameraPath(h) {
  const v = (x, y, z) => new THREE.Vector3(x, y, z);
  const keys = [
    /* 0  just inside the front door, while it opens */
    [h.inHall(-0.8, 0, 1.3), h.inHall(6, 0.1, 1.25)],
    /* 1  a few paces in */
    [h.inHall(3.5, -0.05, 1.3), h.inHall(9.5, 0.1, 1.25)],
    /* 2  halfway down the bend */
    [h.inHall(11.5, -0.1, 1.3), h.inHall(17, 0.2, 1.2)],
    /* 3  at the end of the hall, the study ahead */
    [h.inHall(18.6, 0, 1.35), v(0, 1.3, -4)],
    /* 4  in the study, at the map on the left wall */
    [v(0.9, 1.55, -1.4), v(-3.5, 1.7, -2.8)],
    /* 5  turning to the workbench under the window */
    [v(-0.1, 1.6, -2.2), v(1.9, 0.95, -5.7)],
    /* 6  at the round door to the parlour */
    [v(2.7, 1.42, -3.2), v(8.5, 1.3, -3.25)],
    /* 7  in the parlour, the fire across the room */
    [v(4.7, 1.6, -3.0), v(11.5, 1.45, -3.3)],
    /* 8  at the back door */
    [v(9.3, 1.45, -1.7), v(10, 1.3, 1.5)],
    /* 9  out into the night */
    [v(10, 1.5, 3.4), v(10, 1.2, 9)],
  ];
  const pos = new THREE.CatmullRomCurve3(keys.map((k) => k[0]), false, "centripetal");
  const look = new THREE.CatmullRomCurve3(keys.map((k) => k[1]), false, "centripetal");
  return { pos, look, last: keys.length - 1 };
}

/* a flash through the windows: a hard first stroke and a second, smaller
   one just after, the way lightning flickers */
function flashCurve(t) {
  if (t < 0) return 0;
  const a = Math.exp(-t * 9) * (t < 0.05 ? t / 0.05 : 1);
  const b = t > 0.16 ? Math.exp(-(t - 0.16) * 7) * 0.6 : 0;
  return Math.min(1, a + b);
}

export function createHouse(stage) {
  const house = buildHouse();
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x000000);
  scene.fog = new THREE.FogExp2(0x000000, 0.045);
  scene.add(house.root);

  /* a little light everywhere so nothing is pure black, and the lightning */
  const ambient = new THREE.HemisphereLight(0xb8a080, 0x3a2410, 3.2);
  scene.add(ambient);
  const bolt = new THREE.DirectionalLight(0xdfe8ff, 0);
  bolt.position.set(-2, 6, -12);
  scene.add(bolt);
  /* the light that lands on whatever you point at in a room */
  const hover = new THREE.PointLight(0xffd890, 0, 2.2, 1.2);
  scene.add(hover);

  const camera = new THREE.PerspectiveCamera(60, 1, 0.05, 60);
  const path = cameraPath(house);
  const target = new THREE.WebGLRenderTarget(1, 1, {
    minFilter: THREE.NearestFilter,
    magFilter: THREE.NearestFilter,
    depthBuffer: true,
  });

  const state = {
    u: 0,          /* where on the path the page wants the camera */
    lum: 1,        /* how bright the house shows (it steps back under text) */
    on: false,     /* set by the world while the door is open */
  };
  let u = 0, flash = 0, flashT = -1, nextFlash = 7, hot = null, hotGlow = 0;
  const raycaster = new THREE.Raycaster();
  const owner = new Map();       /* every mesh in a find, to the find's id */
  house.finds.forEach((f) => f.mesh.traverse((o) => owner.set(o, f.id)));

  function place() {
    const t = Math.min(1, Math.max(0, u / path.last));
    camera.position.copy(path.pos.getPoint(t));
    camera.lookAt(path.look.getPoint(t));
  }

  function bolt_(near) {
    flashT = 0;
    nextFlash = 8 + Math.random() * 9;
    window.dispatchEvent(new CustomEvent("storm:strike", { detail: { x: 0.5, near } }));
    stage.invalidate();
  }

  /* lightning through the windows, now and then while you're inside */
  function storm(dt) {
    if (reduceMotion) return;
    nextFlash -= dt;
    if (nextFlash <= 0 && state.lum > 0.2 && !document.hidden) bolt_(false);
    if (flashT >= 0) {
      flashT += dt;
      flash = flashCurve(flashT);
      if (flashT > 1.2) { flashT = -1; flash = 0; }
    }
  }

  const layer = {
    state,
    camera,
    get flash() { return flash; },
    get texture() { return target.texture; },
    /* lightning on demand, for a click in an empty room */
    strike() { if (!reduceMotion && flashT < 0) bolt_(true); },
    /* which find (if any) is under a point on the screen */
    pick(cx, cy) {
      if (!state.on) return null;
      const ndc = new THREE.Vector2((cx / window.innerWidth) * 2 - 1, -(cy / window.innerHeight) * 2 + 1);
      raycaster.setFromCamera(ndc, camera);
      const hit = raycaster.intersectObject(house.root, true)[0];
      if (!hit || hit.distance > 12) return null;
      for (let o = hit.object; o; o = o.parent) if (owner.has(o)) return owner.get(o);
      return null;
    },
    /* light up a find (or nothing) */
    highlight(id) {
      const f = id && house.finds.find((x) => x.id === id);
      hot = f ? new THREE.Box3().setFromObject(f.mesh).getCenter(new THREE.Vector3()) : null;
      stage.invalidate();
    },
    resize({ w, h }) {
      target.setSize(w, h);
      camera.aspect = w / h;
      /* keep the sides in view on a tall phone screen */
      camera.fov = camera.aspect < 1 ? 2 * Math.atan(Math.tan((60 * Math.PI) / 360) / camera.aspect ** 0.55) * 180 / Math.PI : 60;
      camera.updateProjectionMatrix();
    },
    active: () => state.on,
    animating: () => true,
    fast: () => Math.abs(u - state.u) > 0.002 || flashT >= 0,
    draw(renderer, main, frame) {
      const dt = frame.dt;
      /* the camera follows the scroll with a little weight */
      u += (state.u - u) * (reduceMotion ? 1 : 1 - Math.pow(0.0005, dt));
      if (Math.abs(state.u - u) < 0.0005) u = state.u;
      place();
      storm(dt);

      /* the fire and the lanterns breathe */
      const t = frame.t;
      for (const l of house.lights) {
        const n = Math.sin(t * 7.3 + l.base) * 0.5 + Math.sin(t * 13.1 + l.base * 3) * 0.3 + Math.sin(t * 23.7) * 0.2;
        l.light.intensity = l.base * (1 + n * l.flicker);
      }
      house.fire.uniforms.uTime.value = t;
      bolt.intensity = flash * 3.2;
      for (const m of house.panes) m.color.setRGB(0.06 + flash * 1.4, 0.09 + flash * 1.45, 0.15 + flash * 1.5);
      hotGlow += ((hot ? 1 : 0) - hotGlow) * Math.min(1, dt * 8);
      if (hot) hover.position.copy(hot).add(camera.position.clone().sub(hot).setLength(0.6));
      hover.intensity = hotGlow * 2.5;

      renderer.setRenderTarget(target);
      renderer.setViewport(0, 0, frame.w, frame.h);
      renderer.clear(true, true, true);
      renderer.render(scene, camera);
      renderer.setRenderTarget(main);
      renderer.setViewport(0, 0, frame.w, frame.h);
    },
  };
  return layer;
}
