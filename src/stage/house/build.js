/* ==========================================================================
   The house behind the round door, built from plain shapes: a curved
   tunnel hall ribbed with wooden arches, a study at the end of it, and a
   parlour with a fire through a round door on the right.

     the hall     a tunnel with a flat tiled floor, swept along a long bend
                  to the right so you can't see the end until you're near it.
                  Benches run along both walls, wooden ribs every pace, a
                  lantern now and then.
     the study    a map on the left wall, a workbench under a round window
                  at the back, a wall of books.
     the parlour  a fireplace with plates above the mantel, portraits, a
                  chandelier of little lanterns, armchairs round a rug, and
                  a round back door out into the night.

   Distances are in metres. Everything is laid out in the study's frame
   (the study's front wall is z = 0, looking down -z), and the hall is
   placed so it runs into the study's front wall.

   Nothing here is detailed: the stage draws it a few hundred pixels across
   and dithers it into gold, so what matters is the silhouette, where the
   light falls and what's in shadow.
   ========================================================================== */
import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import * as T from "./tex.js";

/* the hall's cross-section: a circle cut by the floor */
export const HALL = { R: 1.7, C: 1.35, len: 20, bend: 26, rib: 1.25 };
const TH0 = Math.asin(-HALL.C / HALL.R);         /* where the circle meets the floor, right side */

/* ---- materials --------------------------------------------------------- */
const lam = (o) => new THREE.MeshLambertMaterial({ side: THREE.DoubleSide, ...o });
const glow = (color) => new THREE.MeshBasicMaterial({ color });

function mats() {
  const tiles = T.hallTiles();
  const plaster = T.plaster();
  const woodTex = T.wood();
  const dark = T.wood("#6a4020", 9);
  const planks = T.planks();
  const herring = T.herringbone();
  return {
    tiles: lam({ map: tiles }),
    plaster: lam({ map: plaster }),
    rib: lam({ map: T.wood("#c08850", 13) }),
    wood: lam({ map: woodTex }),
    dark: lam({ map: dark }),
    planks: lam({ map: planks }),
    herring: lam({ map: herring }),
    stone: lam({ color: 0x9a8c74 }),
    soot: lam({ color: 0x0a0806 }),
    green: lam({ color: 0x3e5a36 }),
    door: lam({ color: 0x2f5a2a }),
    brass: lam({ color: 0xd9a84a, emissive: 0x3a2508 }),
    rug: lam({ color: 0x7a3a22 }),
    rugIn: lam({ color: 0xa8743a }),
    paper: lam({ color: 0xe8dcc0 }),
    plate: lam({ color: 0xd8cfb8 }),
    plateRim: lam({ color: 0x5a6a8a }),
    map: lam({ map: T.map() }),
    lantern: glow(0xffc070),
    pane: glow(0x101826),
    ground: lam({ color: 0x1e2a14 }),
  };
}

/* ---- the hall, swept along its bend ------------------------------------ */
/* where s metres down the hall is, and which way is right */
export function hallAt(s) {
  const a = s / HALL.bend;
  return {
    p: new THREE.Vector3(HALL.bend - HALL.bend * Math.cos(a), 0, -HALL.bend * Math.sin(a)),
    right: new THREE.Vector3(Math.cos(a), 0, Math.sin(a)),
    yaw: -a,
  };
}
const UP = new THREE.Vector3(0, 1, 0);
function hallPoint(s, x, y) {
  const f = hallAt(s);
  return f.p.addScaledVector(f.right, x).addScaledVector(UP, y);
}
function hallMatrix(s) {
  const f = hallAt(s);
  return new THREE.Matrix4().makeRotationY(f.yaw).setPosition(f.p);
}

/* a ribbon: a cross-section profile ([x, y] points) carried along the hall
   from s0 to s1. u runs along the profile, v along the hall. */
function sweep(profile, s0, s1, ds, uv = (i, s) => [i / (profile.length - 1), s]) {
  const pos = [], uvs = [], idx = [];
  const n = Math.ceil((s1 - s0) / ds);
  for (let k = 0; k <= n; k++) {
    const s = s0 + ((s1 - s0) * k) / n;
    profile.forEach(([x, y], i) => {
      const p = hallPoint(s, x, y);
      pos.push(p.x, p.y, p.z);
      uvs.push(...uv(i, s, x, y));
    });
  }
  const m = profile.length;
  for (let k = 0; k < n; k++) for (let i = 0; i < m - 1; i++) {
    const a = k * m + i, b = a + 1, c = a + m, d = c + 1;
    idx.push(a, c, b, b, c, d);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

const arc = (r, a0, a1, n) => Array.from({ length: n + 1 }, (_, i) => {
  const a = a0 + ((a1 - a0) * i) / n;
  return [r * Math.cos(a), HALL.C + r * Math.sin(a)];
});

function buildHall(M, root, lights) {
  const { R, C, len, rib } = HALL;
  const hall = new THREE.Group();
  root.add(hall);
  const L = len + 0.05;

  /* the plaster vault, above the benches */
  const BAND = 0.62;
  hall.add(new THREE.Mesh(sweep(arc(R + 0.02, TH0 + BAND, Math.PI - TH0 - BAND, 28), -0.2, L, 0.5,
    (i, s) => [i / 6, s / 1.6]), M.plaster));
  /* wooden panelling below, the benches' backs */
  for (const [a0, a1] of [[TH0, TH0 + BAND], [Math.PI - TH0 - BAND, Math.PI - TH0]]) {
    hall.add(new THREE.Mesh(sweep(arc(R, a0, a1, 6), -0.2, L, 0.5, (i, s) => [s / 1.2, i / 6]), M.dark));
  }
  /* the benches: a seat and a front board each side */
  const bench = [[1.47, 0.47], [1.0, 0.47], [1.0, 0.4], [1.05, 0.4], [1.05, 0]];
  hall.add(new THREE.Mesh(sweep(bench, -0.2, L, 0.5, (i, s) => [s / 1.4, i / 4]), M.wood));
  hall.add(new THREE.Mesh(sweep(bench.map(([x, y]) => [-x, y]), -0.2, L, 0.5, (i, s) => [s / 1.4, i / 4]), M.wood));
  /* the tiled floor: u across, v along, so the runner follows the bend */
  hall.add(new THREE.Mesh(sweep([[-1.06, 0], [1.06, 0]], -0.2, L, 0.25,
    (i, s, x) => [(x + 1.06) / 2.12, s / 2.12]), M.tiles));

  /* the ribs: a wide wooden band every pace, curving down into the benches */
  const ribGeo = new THREE.TorusGeometry(R - 0.03, 0.09, 4, 30, Math.PI - 2 * TH0);
  ribGeo.rotateZ(TH0);
  ribGeo.scale(1, 1, 1.9);
  ribGeo.translate(0, C, 0);
  const ribs = [];
  for (let s = 0.6; s < len; s += rib) ribs.push(ribGeo.clone().applyMatrix4(hallMatrix(s)));
  hall.add(new THREE.Mesh(mergeGeometries(ribs), M.rib));

  /* lanterns on the walls, alternating sides */
  const box = new THREE.BoxGeometry(0.16, 0.24, 0.16);
  [[3.1, 1], [8.1, -1], [13.1, 1], [18.1, -1]].forEach(([s, side]) => {
    const m = new THREE.Mesh(box, M.lantern);
    m.position.copy(hallPoint(s, side * 1.38, 1.85));
    m.rotation.y = hallAt(s).yaw;
    hall.add(m);
    const l = new THREE.PointLight(0xffa24a, 14, 9, 1.5);
    l.position.copy(hallPoint(s, side * 1.15, 1.8));
    hall.add(l);
    lights.push({ light: l, base: 14, flicker: 0.12 });
  });
  return hall;
}

/* ---- rooms ------------------------------------------------------------- */
function box(parent, mat, w, h, d, x, y, z, ry = 0) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  m.rotation.y = ry;
  parent.add(m);
  return m;
}
function soft(parent, mat, w, h, d, x, y, z, ry = 0, r = 0.06) {
  const m = new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 2, r), mat);
  m.position.set(x, y, z);
  m.rotation.y = ry;
  parent.add(m);
  return m;
}
function cyl(parent, mat, rt, rb, h, x, y, z, seg = 20) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat);
  m.position.set(x, y, z);
  parent.add(m);
  return m;
}

/* a wall, len wide and h tall, with round doorways cut up out of its
   bottom edge ({a, R, C}: a along the wall, a circle of radius R centred C
   up) and round windows through it ({a, y, r}) */
function wallGeo(len, h, doors = [], windows = [], t = 0.2) {
  const s = new THREE.Shape();
  s.moveTo(-len / 2, 0);
  for (const d of [...doors].sort((p, q) => p.a - q.a)) {
    const t0 = Math.asin(Math.max(-1, -d.C / d.R));
    const x0 = d.a - d.R * Math.cos(t0);
    s.lineTo(x0, 0);
    s.absarc(d.a, d.C, d.R, Math.PI - t0, t0, true);
  }
  s.lineTo(len / 2, 0);
  s.lineTo(len / 2, h);
  s.lineTo(-len / 2, h);
  s.lineTo(-len / 2, 0);
  for (const w of windows) {
    const p = new THREE.Path();
    p.absarc(w.a, w.y, w.r, 0, Math.PI * 2, false);
    s.holes.push(p);
  }
  const g = new THREE.ExtrudeGeometry(s, { depth: t, bevelEnabled: false, curveSegments: 24 });
  g.translate(0, 0, -t / 2);
  /* plaster texture in metres */
  const uv = g.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) / 1.6, uv.getY(i) / 1.6);
  return g;
}
function wall(parent, M, len, h, x, z, ry, doors, windows) {
  const m = new THREE.Mesh(wallGeo(len, h, doors, windows), M.plaster);
  m.position.set(x, 0, z);
  m.rotation.y = ry;
  parent.add(m);
  /* wood panelling along the bottom, broken where a doorway is */
  const cuts = [-len / 2, ...doors.flatMap((d) => {
    const w = d.R * Math.cos(Math.asin(Math.max(-1, (1.1 - d.C) / d.R)));
    return [d.a - w - 0.05, d.a + w + 0.05];
  }), len / 2];
  for (let i = 0; i < cuts.length; i += 2) {
    const w = cuts[i + 1] - cuts[i];
    if (w <= 0.05) continue;
    const p = new THREE.Mesh(new THREE.BoxGeometry(w, 1.1, 0.06), M.dark);
    p.position.set(cuts[i] + w / 2, 0.55, 0.13);
    const holder = new THREE.Group();
    holder.position.set(x, 0, z);
    holder.rotation.y = ry;
    holder.add(p);
    parent.add(holder);
    /* both faces: the panels face into whichever room this wall bounds */
    const q = p.clone(); q.position.z = -0.13; holder.add(q);
  }
  return m;
}
/* a wooden ring round a doorway, in the plane of its wall */
function frame(parent, mat, R, C, x, z, ry, t0 = Math.asin(-C / R)) {
  const g = new THREE.TorusGeometry(R + 0.05, 0.09, 5, 32, Math.PI - 2 * t0);
  g.rotateZ(t0);
  g.scale(1, 1, 2.6);
  const m = new THREE.Mesh(g, mat);
  m.position.set(x, C, z);
  m.rotation.y = ry;
  parent.add(m);
  return m;
}
function ceiling(parent, mat, w, d, h, x, z) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), mat);
  m.rotation.x = Math.PI / 2;
  m.position.set(x, h, z);
  parent.add(m);
}
function floor(parent, mat, w, d, x, z, rep) {
  const g = new THREE.PlaneGeometry(w, d);
  const uv = g.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, (uv.getX(i) * w) / rep, (uv.getY(i) * d) / rep);
  const m = new THREE.Mesh(g, mat);
  m.rotation.x = -Math.PI / 2;
  m.position.set(x, 0, z);
  parent.add(m);
}
/* a round window: a dark pane (lightning shows through it) and a cross of
   glazing bars */
function roundWindow(parent, M, x, y, z, ry, r, panes) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  g.rotation.y = ry;
  const pane = new THREE.Mesh(new THREE.CircleGeometry(r, 28), M.pane.clone());
  pane.position.z = -0.14;
  g.add(pane);
  panes.push(pane.material);
  const bar = new THREE.BoxGeometry(r * 2, 0.05, 0.05);
  g.add(new THREE.Mesh(bar, M.wood));
  const v = new THREE.Mesh(bar, M.wood); v.rotation.z = Math.PI / 2; g.add(v);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(r, 0.07, 5, 28), M.wood);
  g.add(ring);
  parent.add(g);
  return g;
}

/* the study: 7 wide, 6.5 deep, the hall coming in through the front wall */
const SW = 7, SD = 6.5, SH = 3.3, PH = 3.8;
export const STUDY_DOOR = { R: 1.05, C: 1.0, z: -3.25 };
export const BACK_DOOR = { R: 1.0, C: 0.95, x: 10 };

function buildStudy(M, root, lights, panes, finds) {
  const g = new THREE.Group();
  root.add(g);
  floor(g, M.planks, SW, SD, 0, -SD / 2, 2.2);
  ceiling(g, M.plaster, SW, SD, SH, 0, -SD / 2);
  for (const z of [-1.2, -3.25, -5.3]) box(g, M.dark, SW, 0.24, 0.26, 0, SH - 0.12, z);

  wall(g, M, SW, SH, 0, 0, 0, [{ a: 0, R: HALL.R, C: HALL.C }], []);
  wall(g, M, SW, SH, 0, -SD, 0, [], [{ a: 1.9, y: 1.95, r: 0.55 }]);
  wall(g, M, SD, SH, -SW / 2, -SD / 2, Math.PI / 2, [], []);
  /* the right wall is shared with the parlour, so it's the parlour's height */
  wall(g, M, SD, PH, SW / 2, -SD / 2, Math.PI / 2, [{ a: 0, R: STUDY_DOOR.R, C: STUDY_DOOR.C }], []);
  frame(g, M.rib, STUDY_DOOR.R, STUDY_DOOR.C, SW / 2, STUDY_DOOR.z, Math.PI / 2);
  roundWindow(g, M, 1.9, 1.95, -SD + 0.13, 0, 0.55, panes);

  /* the round green door to the parlour, swung open against the wall */
  const leaf = cyl(g, M.door, STUDY_DOOR.R, STUDY_DOOR.R, 0.08, SW / 2 - 0.1, STUDY_DOOR.C, STUDY_DOOR.z + 1.6, 32);
  leaf.rotation.x = Math.PI / 2;
  leaf.scale.set(1, 1, 1);
  cyl(g, M.brass, 0.07, 0.07, 0.06, SW / 2 - 0.16, STUDY_DOOR.C, STUDY_DOOR.z + 1.6).rotation.x = Math.PI / 2;

  /* the map on the left wall, over a low chest */
  const map = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 1.95), M.map);
  map.position.set(-SW / 2 + 0.12, 1.85, -2.7);
  map.rotation.y = Math.PI / 2;
  g.add(map);
  finds.push({ id: "map", mesh: map });
  box(g, M.wood, 0.55, 0.7, 1.8, -SW / 2 + 0.4, 0.35, -2.7);
  box(g, M.brass, 0.05, 0.12, 0.2, -SW / 2 + 0.69, 0.5, -2.7);
  /* a globe beside it */
  cyl(g, M.dark, 0.04, 0.12, 0.9, -2.5, 0.45, -4.7);
  const globe = new THREE.Mesh(new THREE.SphereGeometry(0.3, 16, 12), M.rugIn);
  globe.position.set(-2.5, 1.18, -4.7);
  g.add(globe);
  finds.push({ id: "globe", mesh: globe });

  /* the wall of books at the back, left of the window */
  const shelf = new THREE.Group();
  shelf.position.set(-1.35, 0, -SD + 0.32);
  g.add(shelf);
  box(shelf, M.dark, 3.6, 2.7, 0.06, 0, 1.35, -0.2);
  for (const y of [0.05, 0.65, 1.25, 1.85, 2.45]) box(shelf, M.wood, 3.6, 0.05, 0.42, 0, y, 0);
  for (const x of [-1.8, 0, 1.8]) box(shelf, M.wood, 0.06, 2.7, 0.42, x, 1.35, 0);
  {
    const R = T.rng(41);
    const pal = [0x6a2a1a, 0x2a4a3a, 0x8a6a3a, 0x3a2a4a, 0xa8743a, 0x4a3a1a, 0x5a1a1a];
    const books = [];
    for (const y of [0.08, 0.68, 1.28, 1.88]) {
      for (const [x0, x1] of [[-1.76, -0.04], [0.04, 1.76]]) {
        let x = x0;
        while (x < x1 - 0.06) {
          const w = 0.05 + R() * 0.07, h = 0.36 + R() * 0.16;
          if (R() < 0.08) { x += w * 2; continue; }
          books.push({ x: x + w / 2, y: y + h / 2, w, h, c: pal[(R() * pal.length) | 0], lean: R() < 0.06 ? 0.2 : 0 });
          x += w + 0.005;
        }
      }
    }
    const geo = new THREE.BoxGeometry(1, 1, 0.3);
    const inst = new THREE.InstancedMesh(geo, lam({ color: 0xffffff }), books.length);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
    books.forEach((b, i) => {
      e.set(0, 0, b.lean);
      q.setFromEuler(e);
      m4.compose(new THREE.Vector3(b.x, b.y, 0.02), q, new THREE.Vector3(b.w, b.h, 1));
      inst.setMatrixAt(i, m4);
      inst.setColorAt(i, new THREE.Color(b.c));
    });
    shelf.add(inst);
    finds.push({ id: "books", mesh: inst });
  }

  /* the workbench under the window */
  const bench = new THREE.Group();
  bench.position.set(1.9, 0, -SD + 0.75);
  g.add(bench);
  box(bench, M.wood, 2.4, 0.08, 0.95, 0, 0.86, 0);
  for (const [x, z] of [[-1.1, -0.38], [1.1, -0.38], [-1.1, 0.38], [1.1, 0.38]]) box(bench, M.dark, 0.08, 0.82, 0.08, x, 0.41, z);
  box(bench, M.dark, 2.3, 0.05, 0.85, 0, 0.25, 0);
  /* papers, a board, a jar, a lamp */
  box(bench, M.paper, 0.42, 0.01, 0.3, -0.6, 0.905, 0.12, 0.2);
  box(bench, M.paper, 0.4, 0.01, 0.3, -0.5, 0.915, 0.05, -0.15);
  const board = box(bench, lam({ color: 0x2a3a22 }), 0.34, 0.02, 0.24, 0.15, 0.91, 0.1, 0.1);
  for (let i = 0; i < 4; i++) box(bench, M.soot, 0.06, 0.03, 0.05, 0.06 + i * 0.06, 0.93, 0.1, 0.1);
  finds.push({ id: "bench", mesh: board });
  cyl(bench, M.plateRim, 0.07, 0.07, 0.18, 0.7, 0.99, -0.15);
  /* the desk lamp: a stem, an arm and a shade, lit */
  cyl(bench, M.brass, 0.1, 0.12, 0.03, -0.95, 0.915, -0.2);
  cyl(bench, M.brass, 0.015, 0.015, 0.5, -0.95, 1.15, -0.2);
  const shade = cyl(bench, M.brass, 0.06, 0.15, 0.14, -0.82, 1.38, -0.12, 14);
  shade.rotation.z = -0.5;
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), M.lantern);
  bulb.position.set(-0.8, 1.33, -0.12);
  bench.add(bulb);
  const lamp = new THREE.PointLight(0xffb060, 7, 6, 1.5);
  lamp.position.set(-0.7, 1.25, 0.1);
  bench.add(lamp);
  lights.push({ light: lamp, base: 7, flicker: 0.04 });
  /* a stool */
  cyl(bench, M.wood, 0.22, 0.22, 0.05, -0.1, 0.62, 0.75);
  for (const [x, z] of [[-0.25, 0.6], [0.05, 0.6], [-0.1, 0.92]]) cyl(bench, M.dark, 0.025, 0.025, 0.62, x, 0.31, z, 6);

  /* a lantern hanging from the middle beam */
  cyl(g, M.dark, 0.012, 0.012, 0.6, 0.9, SH - 0.42, -4.4, 4);
  const hang = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.08, 0.22, 6), M.lantern);
  hang.position.set(0.9, SH - 0.82, -4.4);
  g.add(hang);
  const hl = new THREE.PointLight(0xffa850, 7, 7, 1.4);
  hl.position.set(0.9, SH - 1.0, -4.4);
  g.add(hl);
  lights.push({ light: hl, base: 7, flicker: 0.05 });

  /* a rug in the middle and a candle on the chest */
  cyl(g, M.rug, 1.4, 1.4, 0.02, 0, 0.01, -3.2, 40).scale.set(1.25, 1, 0.85);
  cyl(g, M.rugIn, 1.0, 1.0, 0.025, 0, 0.012, -3.2, 40).scale.set(1.25, 1, 0.85);
  cyl(g, M.paper, 0.04, 0.04, 0.2, -SW / 2 + 0.4, 0.8, -2.0);
  const flame = new THREE.Mesh(new THREE.SphereGeometry(0.025, 6, 4), M.lantern);
  flame.position.set(-SW / 2 + 0.4, 0.93, -2.0);
  flame.scale.y = 1.8;
  g.add(flame);
  const candle = new THREE.PointLight(0xff9a40, 1.6, 4, 1.8);
  candle.position.set(-SW / 2 + 0.6, 1.0, -2.0);
  g.add(candle);
  lights.push({ light: candle, base: 1.6, flicker: 0.3 });
  return g;
}

/* the parlour: through the study's right wall, 8 wide and taller */
function buildParlour(M, root, lights, panes, finds, fire) {
  const g = new THREE.Group();
  root.add(g);
  const x0 = SW / 2, x1 = x0 + 8, cx = (x0 + x1) / 2, cz = -SD / 2;
  floor(g, M.herring, 8, SD, cx, cz, 1.6);
  ceiling(g, M.plaster, 8, SD, PH, cx, cz);
  /* beams: big ones across, a ridge beam along */
  for (const z of [-0.9, -2.5, -4.1, -5.7]) box(g, M.dark, 8, 0.28, 0.3, cx, PH - 0.14, z);
  box(g, M.dark, 0.34, 0.34, SD, cx, PH - 0.3, cz);

  wall(g, M, 8, PH, cx, 0, 0, [{ a: BACK_DOOR.x - cx, R: BACK_DOOR.R, C: BACK_DOOR.C }], []);
  frame(g, M.rib, BACK_DOOR.R, BACK_DOOR.C, BACK_DOOR.x, 0, 0);
  wall(g, M, 8, PH, cx, -SD, 0, [], [{ a: -1.6, y: 2.1, r: 0.5 }]);
  roundWindow(g, M, cx - 1.6, 2.1, -SD + 0.13, 0, 0.5, panes);
  wall(g, M, SD, PH, x1, cz, Math.PI / 2, [], []);

  /* the fireplace on the far wall */
  const fp = new THREE.Group();
  fp.position.set(x1, 0, cz);
  g.add(fp);
  box(fp, M.plaster, 0.5, PH, 2.9, -0.25, PH / 2, 0);                 /* chimney breast */
  box(fp, M.stone, 0.66, 1.3, 0.34, -0.33, 0.65, 0.78);               /* jambs */
  box(fp, M.stone, 0.66, 1.3, 0.34, -0.33, 0.65, -0.78);
  box(fp, M.stone, 0.66, 0.32, 1.9, -0.33, 1.3, 0);                   /* lintel */
  box(fp, M.soot, 0.2, 1.14, 1.24, -0.52, 0.57, 0);                   /* the black of the hearth */
  box(fp, M.wood, 0.8, 0.1, 2.5, -0.4, 1.52, 0);                      /* mantel */
  box(fp, M.stone, 1.1, 0.08, 2.3, -0.75, 0.04, 0);                   /* hearthstone */
  /* logs and the fire on them */
  for (const [z, r] of [[-0.25, 0.3], [0.2, -0.25]]) {
    const log = cyl(fp, M.dark, 0.07, 0.07, 0.8, -0.62, 0.14, z, 8);
    log.rotation.x = Math.PI / 2; log.rotation.z = r;
  }
  fire.position.set(-0.68, 0.48, 0);
  fire.rotation.y = -Math.PI / 2;
  fp.add(fire);
  const fireLight = new THREE.PointLight(0xff7a2a, 18, 12, 1.3);
  fireLight.position.set(-1.0, 0.7, 0);
  fp.add(fireLight);
  lights.push({ light: fireLight, base: 18, flicker: 0.3, fire: true });
  /* candles on the mantel light the plates and portraits from below */
  for (const z of [0.95, -0.95]) {
    const f = new THREE.Mesh(new THREE.SphereGeometry(0.03, 6, 4), M.lantern);
    f.position.set(-0.42, 1.98, z);
    f.scale.y = 1.8;
    fp.add(f);
  }
  const mantelLight = new THREE.PointLight(0xffb060, 6, 5, 1.3);
  mantelLight.position.set(-0.9, 2.2, 0);
  fp.add(mantelLight);
  lights.push({ light: mantelLight, base: 6, flicker: 0.12 });
  finds.push({ id: "fireplace", mesh: fp });
  /* things on the mantel */
  cyl(fp, M.brass, 0.03, 0.05, 0.36, -0.42, 1.75, 0.95);
  cyl(fp, M.brass, 0.03, 0.05, 0.36, -0.42, 1.75, -0.95);
  const vase = cyl(fp, M.plateRim, 0.06, 0.1, 0.3, -0.42, 1.72, 0.45, 12);
  finds.push({ id: "mantel", mesh: vase });
  /* the plates above, in an arch */
  const plates = new THREE.Group();
  for (let i = 0; i < 9; i++) {
    const a = Math.PI * (0.12 + (0.76 * i) / 8);
    const r = i % 2 ? 0.17 : 0.13;
    const p = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 0.02, 18), M.plate);
    p.rotation.z = Math.PI / 2;
    p.position.set(-0.52, 2.15 + Math.sin(a) * 0.8, Math.cos(a) * 1.05);
    plates.add(p);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(r, 0.02, 4, 18), M.plateRim);
    rim.rotation.y = Math.PI / 2;
    rim.position.copy(p.position).x -= 0.01;
    plates.add(rim);
  }
  fp.add(plates);
  finds.push({ id: "plates", mesh: plates });

  /* portraits either side of the chimney */
  [[cz + 2.25, 51, "portrait-left"], [cz - 2.25, 52, "portrait-right"]].forEach(([z, seed, id]) => {
    const pg = new THREE.Group();
    pg.position.set(x1 - 0.12, 2.15, z);
    pg.rotation.y = -Math.PI / 2;
    const canvas = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.88), lam({ map: T.portrait(seed) }));
    canvas.position.z = 0.03;
    pg.add(canvas);
    box(pg, M.brass, 0.86, 1.04, 0.04, 0, 0, 0);
    g.add(pg);
    finds.push({ id, mesh: pg });
  });

  /* the chandelier: a ring of little lanterns on a chain */
  const ch = new THREE.Group();
  ch.position.set(cx - 0.4, 2.85, cz);
  g.add(ch);
  cyl(ch, M.dark, 0.015, 0.015, PH - 2.85, 0, (PH - 2.85) / 2, 0, 5);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.03, 4, 28), M.dark);
  ring.rotation.x = Math.PI / 2;
  ch.add(ring);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const l = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.05, 0.16, 6), M.lantern);
    l.position.set(Math.cos(a) * 0.55, -0.1, Math.sin(a) * 0.55);
    ch.add(l);
    const cap = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.08, 6), M.dark);
    cap.position.set(l.position.x, 0.01, l.position.z);
    ch.add(cap);
  }
  const chLight = new THREE.PointLight(0xffa850, 5, 8, 1.5);
  chLight.position.set(0, -0.3, 0);
  ch.add(chLight);
  lights.push({ light: chLight, base: 5, flicker: 0.06 });
  finds.push({ id: "chandelier", mesh: ch });

  /* a round rug, a round table, armchairs facing the fire */
  cyl(g, M.rug, 1.9, 1.9, 0.02, cx + 1.0, 0.01, cz, 48);
  cyl(g, M.rugIn, 1.45, 1.45, 0.025, cx + 1.0, 0.012, cz, 48);
  cyl(g, M.rug, 0.7, 0.7, 0.03, cx + 1.0, 0.014, cz, 48);
  const table = new THREE.Group();
  table.position.set(cx + 0.7, 0, cz + 0.2);
  g.add(table);
  cyl(table, M.wood, 0.5, 0.5, 0.06, 0, 0.68, 0, 24);
  cyl(table, M.dark, 0.06, 0.1, 0.65, 0, 0.33, 0, 8);
  cyl(table, M.dark, 0.3, 0.32, 0.05, 0, 0.03, 0, 16);
  box(table, M.paper, 0.22, 0.04, 0.3, 0.1, 0.73, -0.05, 0.4);
  finds.push({ id: "table", mesh: table });

  const armchair = (x, z, ry, id) => {
    const c = new THREE.Group();
    c.position.set(x, 0, z);
    c.rotation.y = ry;
    soft(c, M.green, 0.86, 0.22, 0.8, 0, 0.42, 0);
    soft(c, M.green, 0.86, 0.95, 0.22, 0, 0.8, -0.34);
    soft(c, M.green, 0.16, 0.42, 0.78, -0.43, 0.6, 0);
    soft(c, M.green, 0.16, 0.42, 0.78, 0.43, 0.6, 0);
    for (const [lx, lz] of [[-0.35, -0.32], [0.35, -0.32], [-0.35, 0.32], [0.35, 0.32]]) cyl(c, M.dark, 0.03, 0.025, 0.32, lx, 0.16, lz, 6);
    g.add(c);
    finds.push({ id, mesh: c });
  };
  armchair(x1 - 2.3, cz + 1.5, Math.PI / 2 + 0.5, "armchair-left");
  armchair(x1 - 2.3, cz - 1.5, Math.PI / 2 - 0.5, "armchair-right");

  /* the tall carved chair by the fire */
  const hc = new THREE.Group();
  hc.position.set(x1 - 1.2, 0, cz + 2.2);
  hc.rotation.y = Math.PI * 0.85;
  g.add(hc);
  box(hc, M.dark, 0.62, 0.08, 0.56, 0, 0.5, 0);
  box(hc, M.dark, 0.62, 1.5, 0.08, 0, 1.2, -0.26);
  const crest = new THREE.Mesh(new THREE.TorusGeometry(0.31, 0.05, 4, 16, Math.PI), M.dark);
  crest.position.set(0, 1.95, -0.26);
  hc.add(crest);
  for (const [lx, lz] of [[-0.27, -0.24], [0.27, -0.24], [-0.27, 0.24], [0.27, 0.24]]) box(hc, M.dark, 0.06, 0.5, 0.06, lx, 0.25, lz);
  finds.push({ id: "chair", mesh: hc });

  /* a little side table with a lamp, in the corner by the door */
  cyl(g, M.dark, 0.25, 0.25, 0.04, x0 + 0.8, 0.62, -SD + 0.7, 16);
  cyl(g, M.dark, 0.03, 0.03, 0.6, x0 + 0.8, 0.31, -SD + 0.7, 6);
  return g;
}

/* outside the back door: a bit of grass and the night */
function buildOutside(M, root) {
  const g = new THREE.Group();
  root.add(g);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), M.ground);
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(BACK_DOOR.x, -0.02, 20.2);
  g.add(ground);
  /* a lantern on a post by the door */
  cyl(g, M.dark, 0.05, 0.05, 1.6, BACK_DOOR.x + 1.6, 0.8, 1.2, 6);
  const lan = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.24, 0.18), M.lantern);
  lan.position.set(BACK_DOOR.x + 1.6, 1.7, 1.2);
  g.add(lan);
  return g;
}

/* the fire: a quad of flames, worked out in its shader */
function makeFire() {
  const mat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    uniforms: { uTime: { value: 0 } },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      varying vec2 vUv;
      float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float noise(vec2 p) {
        vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
        return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
      }
      void main() {
        vec2 p = vUv;
        float n = noise(vec2(p.x * 5.0, p.y * 3.0 - uTime * 2.6)) * 0.6 + noise(vec2(p.x * 11.0, p.y * 6.0 - uTime * 4.1)) * 0.4;
        float body = (1.0 - abs(p.x - 0.5) * 2.0) * (1.0 - p.y);
        float f = body * 1.7 * (0.55 + 0.9 * n) - 0.25;
        if (f < 0.0) discard;
        vec3 c = mix(vec3(0.9, 0.25, 0.04), vec3(1.0, 0.85, 0.45), smoothstep(0.1, 0.7, f));
        gl_FragColor = vec4(c * (1.2 + f), smoothstep(0.0, 0.15, f));
      }
    `,
  });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 0.8), mat);
  return { mesh: m, material: mat };
}

export function buildHouse() {
  const M = mats();
  const root = new THREE.Group();
  const lights = [], panes = [], finds = [];

  /* the study is the origin; the hall comes in through its front wall */
  const hallRoot = new THREE.Group();
  const end = hallAt(HALL.len);
  /* move the hall so its far end sits at the study's front door, facing in */
  hallRoot.rotation.y = -end.yaw;
  hallRoot.updateMatrix();
  const endRot = end.p.clone().applyMatrix4(new THREE.Matrix4().makeRotationY(-end.yaw));
  hallRoot.position.set(-endRot.x, 0, -endRot.z);
  root.add(hallRoot);
  buildHall(M, hallRoot, lights);

  const fire = makeFire();
  buildStudy(M, root, lights, panes, finds);
  buildParlour(M, root, lights, panes, finds, fire.mesh);
  buildOutside(M, root);

  /* a point in the hall (s along it, x across, y up) in the house's frame */
  hallRoot.updateMatrixWorld();
  const inHall = (s, x = 0, y = 1.3) => hallPoint(s, x, y).applyMatrix4(hallRoot.matrix);

  return { root, lights, panes, finds, fire: fire.material, inHall };
}
