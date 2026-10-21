import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { Builder, place, rgb, rng, vary, type BoxOpts, type Rgb } from './builder';
import {
  BACK,
  BASE,
  BUS_BAY,
  BUS_LANE,
  COURT,
  CROSS_PATH,
  DRIVE,
  FLOORS,
  GROUND,
  LEFT,
  PLINTH,
  RIGHT,
  ROOF,
  SIDE_PATH,
  STAGE_AREA,
  STOREY,
  TARGET,
  TOWER,
  VERANDA,
  WALL,
  WIN,
} from './layout';

/** Soft matte palette (sRGB hex in, linear vertex colours out). */
const C = {
  wall: rgb('#EFE6D6'),
  band: rgb('#E2D3BC'),
  plinth: rgb('#CDBA9C'),
  floor: rgb('#D9CDB9'),
  roof: rgb('#D5CAB7'),
  white: rgb('#EFEBE3'),
  grill: rgb('#56606E'),
  glassTop: rgb('#AFC3D4'),
  glassBottom: rgb('#7D93A9'),
  warmTop: rgb('#F6E2B8'),
  warmBottom: rgb('#E9C990'),
  door: rgb('#8E6142'),
  doorway: rgb('#4A4038'),
  tank: rgb('#30353D'),
  solar: rgb('#2C4C82'),
  solarFrame: rgb('#C7CED8'),
  grass: rgb('#9CC77B'),
  grassEdge: rgb('#86B566'),
  soilTop: rgb('#D2AE84'),
  soil: rgb('#B48B62'),
  path: rgb('#E8DCC6'),
  ground: rgb('#E3D4B9'),
  kerb: rgb('#D2C2A4'),
  pad: rgb('#D9D1C3'),
  court: rgb('#C96F4A'),
  line: rgb('#F1ECE2'),
  stage: rgb('#E7DAC2'),
  stageSkirt: rgb('#C9A57A'),
  rail: rgb('#3E4A5C'),
  metal: rgb('#59606C'),
  rim: rgb('#E2682E'),
  bus: rgb('#F2B22A'),
  busDark: rgb('#2C3646'),
  busStripe: rgb('#7A4A26'),
  tyre: rgb('#23262B'),
  busRoof: rgb('#F3E6C8'),
  bench: rgb('#9C6B45'),
  lampHead: rgb('#F3EBD6'),
  bedSoil: rgb('#8B6B4B'),
  bedEdge: rgb('#D8CAB2'),
  board: rgb('#0B1640'),
  gold: rgb('#FFB52E'),
  flowers: [rgb('#E2483A'), rgb('#F5C141'), rgb('#E57BB0'), rgb('#FFFFFF'), rgb('#F08A35')],
};

const UP = new THREE.Vector3(0, 1, 0);

/**
 * A wall face: points are origin + u * s + up * y + n * d, where u runs
 * along the wall and n points out of it. Every wall here is axis-aligned,
 * so boxes on it stay axis-aligned boxes.
 */
interface Facade {
  o: THREE.Vector3;
  u: THREE.Vector3;
  n: THREE.Vector3;
}
const facade = (o: [number, number, number], u: [number, number, number], n: [number, number, number]): Facade => ({
  o: new THREE.Vector3(...o),
  u: new THREE.Vector3(...u),
  n: new THREE.Vector3(...n),
});
const pa = new THREE.Vector3();
const pb = new THREE.Vector3();
function at(f: Facade, s: number, y: number, d: number, out: THREE.Vector3) {
  return out.copy(f.o).addScaledVector(f.u, s).addScaledVector(UP, y).addScaledVector(f.n, d);
}
function fbox(
  b: Builder,
  f: Facade,
  s0: number,
  y0: number,
  d0: number,
  s1: number,
  y1: number,
  d1: number,
  color: Rgb,
  opts?: BoxOpts,
) {
  at(f, s0, y0, d0, pa);
  at(f, s1, y1, d1, pb);
  b.box(pa.x, pa.y, pa.z, pb.x, pb.y, pb.z, color, opts);
}

interface WindowOpts {
  grill?: boolean;
  warm?: boolean;
  /** The target window: its glass, mullion and grill are drawn by its own shader. */
  target?: boolean;
  chajja?: boolean;
}

/**
 * A window with a white frame standing proud of the wall (so the glass sits
 * recessed in it), mullion, transom, iron grill, projecting sill and a
 * concrete sunshade (chajja) above, as on most North Indian school blocks.
 */
function windowOn(b: Builder, glass: Builder, f: Facade, sc: number, y0: number, w: number, h: number, o: WindowOpts = {}) {
  const s0 = sc - w / 2;
  const s1 = sc + w / 2;
  const y1 = y0 + h;
  const fr = 0.1;
  const depth = 0.16;
  const sk: BoxOpts = { skip: ['ny'] };
  fbox(b, f, s0 - fr, y0 - fr, 0, s0, y1 + fr, depth, C.white, sk);
  fbox(b, f, s1, y0 - fr, 0, s1 + fr, y1 + fr, depth, C.white, sk);
  fbox(b, f, s0, y1, 0, s1, y1 + fr, depth, C.white, sk);
  fbox(b, f, s0, y0 - fr, 0, s1, y0, depth, C.white, sk);
  if (!o.target) {
    fbox(b, f, sc - 0.035, y0, 0, sc + 0.035, y1, 0.07, C.white, sk);
    fbox(b, f, s0, y0 + h * 0.68 - 0.03, 0, s1, y0 + h * 0.68 + 0.03, 0.07, C.white, sk);
    if (o.grill !== false) {
      for (const k of [0.25, 0.75]) fbox(b, f, s0 + w * k - 0.02, y0, 0.08, s0 + w * k + 0.02, y1, 0.11, C.grill, sk);
      fbox(b, f, s0, y0 + h * 0.35 - 0.02, 0.08, s1, y0 + h * 0.35 + 0.02, 0.11, C.grill, sk);
    }
    at(f, s0, y0, 0.012, pa);
    glass.pane(
      pa,
      f.u.clone().multiplyScalar(w),
      UP.clone().multiplyScalar(h),
      f.n,
      o.warm ? C.warmBottom : vary(C.glassBottom, (Math.sin(sc * 3.1 + y0) * 0.5) * 0.08),
      o.warm ? C.warmTop : C.glassTop,
    );
  }
  fbox(b, f, s0 - 0.18, y0 - fr - 0.08, 0, s1 + 0.18, y0 - fr, 0.26, C.band);
  if (o.chajja !== false) fbox(b, f, s0 - 0.3, y1 + fr + 0.1, 0, s1 + 0.3, y1 + fr + 0.2, 0.56, C.band);
}

/** A classroom door off the veranda. */
function doorOn(b: Builder, f: Facade, sc: number, y0: number, w = 1.0, h = 2.2) {
  const s0 = sc - w / 2;
  const s1 = sc + w / 2;
  fbox(b, f, s0 - 0.08, y0, 0, s0, y0 + h + 0.08, 0.1, C.white, { skip: ['ny'] });
  fbox(b, f, s1, y0, 0, s1 + 0.08, y0 + h + 0.08, 0.1, C.white, { skip: ['ny'] });
  fbox(b, f, s0, y0 + h, 0, s1, y0 + h + 0.08, 0.1, C.white, { skip: ['ny'] });
  fbox(b, f, s0, y0, 0, sc - 0.01, y0 + h, 0.05, C.door, { skip: ['ny'] });
  fbox(b, f, sc + 0.01, y0, 0, s1, y0 + h, 0.05, C.door, { skip: ['ny'] });
}

/** Floor bands at each floor line, a cornice under the roof and the plinth. */
function bandsOn(b: Builder, f: Facade, s0: number, s1: number) {
  fbox(b, f, s0, 0, 0, s1, PLINTH, 0.12, C.plinth, { skip: ['ny'] });
  for (const y of [FLOORS[1], FLOORS[2]]) fbox(b, f, s0, y - 0.12, 0, s1, y + 0.12, 0.07, C.band, { skip: ['ny'] });
  fbox(b, f, s0, ROOF - 0.28, 0, s1, ROOF, 0.09, C.band);
}

/**
 * Open veranda in front of a classroom wall: floor slabs (banded edges),
 * pillars and white railings on the upper floors, classroom doors and
 * windows on the wall behind.
 *  wallF  the classroom wall (n points into the veranda)
 *  run    s range of the veranda along that wall
 *  pillars s positions of the pillars
 */
function veranda(
  b: Builder,
  glass: Builder,
  wallF: Facade,
  run: [number, number],
  pillars: number[],
  o: { detail?: boolean; shared?: 'first' | 'last' } = {},
) {
  const [r0, r1] = run;
  const edge = VERANDA;
  const detail = o.detail !== false;
  // A corner pillar shared with the back wing's veranda is drawn only there.
  const p0 = o.shared === 'first' ? r0 : pillars[0] - 0.22;
  const p1 = o.shared === 'last' ? r1 : pillars[pillars.length - 1] + 0.22;
  // ground: plinth under the veranda, floor slabs above
  fbox(b, wallF, r0, 0, 0, r1, PLINTH, edge, C.plinth, { top: C.floor, skip: ['ny'] });
  for (const y of [FLOORS[1], FLOORS[2], ROOF]) {
    fbox(b, wallF, r0, y - 0.3, 0, r1, y, edge, C.band, { top: y === ROOF ? C.roof : C.floor });
  }
  // roof parapet along the veranda edge
  fbox(b, wallF, p0, ROOF, edge - 0.25, p1, ROOF + 0.9, edge, C.wall, { skip: ['ny'] });
  fbox(b, wallF, p0, ROOF + 0.9, edge - 0.3, p1, ROOF + 0.98, edge + 0.04, C.band, { skip: ['ny'] });
  // pillars, full height
  pillars.forEach((s, i) => {
    if ((o.shared === 'first' && i === 0) || (o.shared === 'last' && i === pillars.length - 1)) return;
    fbox(b, wallF, s - 0.22, PLINTH, edge - 0.45, s + 0.22, ROOF - 0.3, edge, C.wall, { skip: ['ny', 'py'] });
  });
  // railings on the first and second floors
  for (const y of [FLOORS[1], FLOORS[2]]) {
    for (let i = 0; i < pillars.length - 1; i++) {
      const a = pillars[i] + 0.22;
      const c = pillars[i + 1] - 0.22;
      fbox(b, wallF, a, y + 0.94, edge - 0.32, c, y + 1.04, edge - 0.12, C.white, { skip: ['ny'] });
      fbox(b, wallF, a, y + 0.06, edge - 0.3, c, y + 0.14, edge - 0.14, C.white, { skip: ['ny'] });
      const n = Math.max(2, Math.round((c - a) / 0.42));
      for (let k = 1; k < n; k++) {
        const s = a + ((c - a) * k) / n;
        fbox(b, wallF, s - 0.03, y + 0.14, edge - 0.25, s + 0.03, y + 0.94, edge - 0.19, C.white, { skip: ['ny', 'py'] });
      }
    }
  }
  // classroom doors and windows on each floor, one door and one window per bay
  if (!detail) return;
  for (const y of FLOORS) {
    for (let i = 0; i < pillars.length - 1; i++) {
      const a = pillars[i];
      const c = pillars[i + 1];
      const span = c - a;
      if (span < 2.4) continue;
      doorOn(b, wallF, a + 0.9, y);
      windowOn(b, glass, wallF, a + span * 0.64, y + 0.9, Math.min(1.6, span * 0.42), 1.2, { chajja: false });
    }
  }
}

/** A wall with one window per bay on each floor, plus bands. */
function windowWall(b: Builder, glass: Builder, f: Facade, s0: number, s1: number, centres: number[], o: { warm?: number[]; skip?: [number, number] } = {}) {
  bandsOn(b, f, s0, s1);
  FLOORS.forEach((y, fl) => {
    centres.forEach((sc, i) => {
      const target = o.skip && o.skip[0] === fl && o.skip[1] === i;
      windowOn(b, glass, f, sc, y + WIN.sill, WIN.w, WIN.h, { target, warm: o.warm?.includes(fl * 10 + i) });
    });
  });
}

/** Rounded block (soft bevelled edges) with roof-coloured top and wall sides. */
function block(b: Builder, x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, wall: Rgb, top: Rgb, r = 0.18) {
  const g = new RoundedBoxGeometry(x1 - x0, y1 - y0, z1 - z0, 2, r);
  b.add(g, place((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2), (p, n) => (n.y > 0.7 ? top : p.y < y0 + 0.5 ? vary(wall, -0.06) : wall));
  g.dispose();
}

/** Roof parapet around a rectangle, with a coping band. */
function parapet(b: Builder, x0: number, z0: number, x1: number, z1: number, y: number, h = 0.9) {
  const t = 0.25;
  const sides: [number, number, number, number][] = [
    [x0, z0, x1, z0 + t],
    [x0, z1 - t, x1, z1],
    [x0, z0 + t, x0 + t, z1 - t],
    [x1 - t, z0 + t, x1, z1 - t],
  ];
  for (const [a, c, d, e] of sides) {
    b.box(a, y, c, d, y + h, e, C.wall, { skip: ['ny'] });
    b.box(a - 0.04, y + h, c - 0.04, d + 0.04, y + h + 0.08, e + 0.04, C.band, { skip: ['ny'] });
  }
}

function rect(b: Builder, r: { x0: number; x1: number; z0: number; z1: number }, y: number, color: Rgb, kerb?: Rgb) {
  b.box(r.x0, 0, r.z0, r.x1, y, r.z1, color, { skip: ['ny'] });
  if (kerb) {
    const k = 0.22;
    b.box(r.x0 - k, 0, r.z0 - k, r.x1 + k, y + 0.02, r.z0, kerb, { skip: ['ny'] });
    b.box(r.x0 - k, 0, r.z1, r.x1 + k, y + 0.02, r.z1 + k, kerb, { skip: ['ny'] });
    b.box(r.x0 - k, 0, r.z0, r.x0, y + 0.02, r.z1, kerb, { skip: ['ny'] });
    b.box(r.x1, 0, r.z0, r.x1 + k, y + 0.02, r.z1, kerb, { skip: ['ny'] });
  }
}

// ---- the base ----------------------------------------------------------------
function roundedRectShape(w: number, h: number, r: number) {
  const s = new THREE.Shape();
  const x = w / 2;
  const y = h / 2;
  s.moveTo(-x + r, -y);
  s.lineTo(x - r, -y);
  s.absarc(x - r, -y + r, r, -Math.PI / 2, 0, false);
  s.lineTo(x, y - r);
  s.absarc(x - r, y - r, r, 0, Math.PI / 2, false);
  s.lineTo(-x + r, y);
  s.absarc(-x + r, y - r, r, Math.PI / 2, Math.PI, false);
  s.lineTo(-x, -y + r);
  s.absarc(-x + r, -y + r, r, Math.PI, Math.PI * 1.5, false);
  return s;
}

function base(b: Builder) {
  const w = BASE.x1 - BASE.x0;
  const d = BASE.z1 - BASE.z0;
  const depth = 2.6;
  const bevel = 0.6;
  const g = new THREE.ExtrudeGeometry(roundedRectShape(w, d, BASE.r), {
    depth,
    bevelEnabled: true,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: 3,
    curveSegments: 6,
  });
  g.rotateX(-Math.PI / 2);
  // the grass grid covers the top cap, which sits just below it
  g.translate(0, -(depth + bevel) - 0.03, 0);
  b.add(g, new THREE.Matrix4(), (p) => {
    if (p.y > -0.4) return C.grassEdge;
    const t = THREE.MathUtils.clamp((-p.y - 0.4) / 3.2, 0, 1);
    return C.soilTop.clone().lerp(C.soil, t);
  });
  g.dispose();

  // grass with gentle colour variation (one grid, corners pulled onto the curve)
  const nx = 38;
  const nz = 30;
  const geo = new THREE.PlaneGeometry(w, d, nx, nz);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.getAttribute('position') as THREE.BufferAttribute;
  const ix = w / 2 - BASE.r;
  const iz = d / 2 - BASE.r;
  for (let i = 0; i < pos.count; i++) {
    let x = pos.getX(i);
    let z = pos.getZ(i);
    if (Math.abs(x) > ix && Math.abs(z) > iz) {
      const cx = Math.sign(x) * ix;
      const cz = Math.sign(z) * iz;
      const dx = x - cx;
      const dz = z - cz;
      const len = Math.hypot(dx, dz);
      if (len > BASE.r) {
        x = cx + (dx / len) * BASE.r;
        z = cz + (dz / len) * BASE.r;
      }
    }
    pos.setXYZ(i, x, 0, z);
  }
  const r = rng(5);
  b.add(geo, new THREE.Matrix4(), (p) => {
    const v = 0.05 * Math.sin(p.x * 0.21 + p.z * 0.13) + 0.035 * Math.sin(p.x * 0.07 - p.z * 0.19 + 1.3) + (r() - 0.5) * 0.04;
    return vary(C.grass, v);
  });
  geo.dispose();
}

// ---- the school block ------------------------------------------------------------
function* school(b: Builder, glass: Builder) {
  // Cores (classrooms). Side wings run back to the back wing's veranda line.
  block(b, BACK.x0, 0, BACK.z0, BACK.x1, ROOF, BACK.z1 - VERANDA, C.wall, C.roof);
  block(b, RIGHT.x0 + VERANDA, 0, BACK.z1 - VERANDA, RIGHT.x1, ROOF, RIGHT.z1, C.wall, C.roof);
  block(b, LEFT.x0, 0, BACK.z1 - VERANDA, LEFT.x1 - VERANDA, ROOF, LEFT.z1, C.wall, C.roof);
  block(b, TOWER.x0, 0, TOWER.z0, TOWER.x1, TOWER.top, TOWER.z1, C.wall, C.roof);

  yield;
  // Roof parapets, water tank, stair cabin, solar panels
  parapet(b, BACK.x0, BACK.z0, BACK.x1, BACK.z1 - VERANDA, ROOF);
  parapet(b, RIGHT.x0 + VERANDA, BACK.z1 - VERANDA, RIGHT.x1, RIGHT.z1, ROOF);
  parapet(b, LEFT.x0, BACK.z1 - VERANDA, LEFT.x1 - VERANDA, LEFT.z1, ROOF);
  parapet(b, TOWER.x0, TOWER.z0, TOWER.x1, TOWER.z1, TOWER.top, 0.8);
  block(b, 7, ROOF, -22.6, 10.4, ROOF + 2.7, -19, C.wall, C.roof, 0.12);
  b.box(8.1, ROOF, -19.02, 9.2, ROOF + 2.1, -18.96, C.door);
  b.box(14, ROOF, -22.2, 16.8, ROOF + 0.5, -19.4, C.metal, { skip: ['ny'] });
  const tank = new THREE.CylinderGeometry(1.05, 1.05, 1.7, 14, 1);
  b.add(tank, place(15.4, ROOF + 0.5 + 0.85, -20.8), C.tank);
  const lid = new THREE.CylinderGeometry(0.4, 0.4, 0.18, 10, 1);
  b.add(lid, place(15.4, ROOF + 0.5 + 1.79, -20.8), C.tank);
  tank.dispose();
  lid.dispose();
  yield;
  const panel = new THREE.BoxGeometry(2.4, 0.06, 1.4);
  const panelFrame = new THREE.BoxGeometry(2.55, 0.05, 1.55);
  for (let i = 0; i < 7; i++) {
    const x = -19 + i * 2.75;
    const m = new THREE.Matrix4().makeRotationX(-0.36).premultiply(new THREE.Matrix4().makeTranslation(x, ROOF + 0.75, -21.2));
    b.add(panelFrame, m.clone().multiply(new THREE.Matrix4().makeTranslation(0, -0.04, 0)), C.solarFrame);
    b.add(panel, m, C.solar);
    b.box(x - 1, ROOF, -21.75, x - 0.92, ROOF + 0.55, -21.67, C.metal, { skip: ['ny', 'py'] });
    b.box(x + 0.92, ROOF, -21.75, x + 1, ROOF + 0.55, -21.67, C.metal, { skip: ['ny', 'py'] });
  }
  panel.dispose();
  panelFrame.dispose();

  yield;
  // ---- right wing: outer facade (x = 22) carries the target window --------------
  const rightOuter = facade([RIGHT.x1, 0, RIGHT.z1], [0, 0, -1], [1, 0, 0]);
  windowWall(b, glass, rightOuter, 0, RIGHT.z1 - (BACK.z1 - VERANDA), [2, 6, 10, 14, 18], { skip: [1, 2], warm: [4, 21] });
  // back wing's right end, continuing the same facade
  const backRight = facade([BACK.x1, 0, BACK.z1 - VERANDA], [0, 0, -1], [1, 0, 0]);
  windowWall(b, glass, backRight, 0, BACK.z1 - VERANDA - BACK.z0, [3.25], {});
  // right wing front end (z = 5)
  const rightEnd = facade([RIGHT.x0, 0, RIGHT.z1], [1, 0, 0], [0, 0, 1]);
  bandsOn(b, rightEnd, VERANDA, RIGHT.x1 - RIGHT.x0);
  for (const y of FLOORS) windowOn(b, glass, rightEnd, VERANDA + 3.25, y + WIN.sill, WIN.w, WIN.h);

  yield;
  // ---- left wing --------------------------------------------------------------------
  const leftOuter = facade([LEFT.x0, 0, BACK.z1 - VERANDA], [0, 0, 1], [-1, 0, 0]);
  windowWall(b, glass, leftOuter, 0, LEFT.z1 - (BACK.z1 - VERANDA), [4.5, 8.5, 12.5, 16.5, 20.5]);
  const backLeft = facade([BACK.x0, 0, BACK.z0], [0, 0, 1], [-1, 0, 0]);
  windowWall(b, glass, backLeft, 0, BACK.z1 - VERANDA - BACK.z0, [3.25]);
  const leftEnd = facade([LEFT.x0, 0, LEFT.z1], [1, 0, 0], [0, 0, 1]);
  bandsOn(b, leftEnd, 0, LEFT.x1 - LEFT.x0 - VERANDA);
  for (const y of FLOORS) windowOn(b, glass, leftEnd, 3.25, y + WIN.sill, WIN.w, WIN.h, { warm: y === FLOORS[0] });

  yield;
  // ---- back wing outer facade (faces away from the camera: plain windows) -----------
  const backOuter = facade([BACK.x1, 0, BACK.z0], [-1, 0, 0], [0, 0, -1]);
  bandsOn(b, backOuter, 0, BACK.x1 - BACK.x0);
  for (const y of FLOORS) for (let s = 3; s < 44; s += 4) windowOn(b, glass, backOuter, s, y + WIN.sill, WIN.w, WIN.h, { grill: false });

  yield;
  // ---- verandas (facing the assembly ground) -----------------------------------------
  const backWall = facade([BACK.x0, 0, BACK.z1 - VERANDA], [1, 0, 0], [0, 0, 1]);
  const bx = (x: number) => x - BACK.x0;
  veranda(b, glass, backWall, [bx(LEFT.x1 - VERANDA), bx(TOWER.x0)], [bx(-13.22), bx(-9.95), bx(-6.7), bx(-3.72)]);
  veranda(b, glass, backWall, [bx(TOWER.x1), bx(RIGHT.x0 + VERANDA)], [bx(3.72), bx(6.7), bx(9.95), bx(13.22)]);
  yield;
  const leftWall = facade([LEFT.x1 - VERANDA, 0, BACK.z1], [0, 0, 1], [1, 0, 0]);
  veranda(b, glass, leftWall, [0, LEFT.z1 - BACK.z1], [-0.225, 3.8, 7.8, 11.8, 15.8, 19.78], { shared: 'first' });
  yield;
  const rightWall = facade([RIGHT.x0 + VERANDA, 0, RIGHT.z1], [0, 0, -1], [-1, 0, 0]);
  veranda(b, glass, rightWall, [0, RIGHT.z1 - BACK.z1], [0.22, 4.2, 8.2, 12.2, 16.2, 20.225], { shared: 'last', detail: false });
  // veranda ends at the wing fronts: railings across the open end
  for (const x0 of [LEFT.x1 - VERANDA, RIGHT.x0]) {
    for (const y of [FLOORS[1], FLOORS[2]]) b.box(x0 + 0.1, y + 0.94, LEFT.z1 - 0.32, x0 + VERANDA - 0.1, y + 1.04, LEFT.z1 - 0.12, C.white);
    b.box(x0, ROOF, LEFT.z1 - 0.25, x0 + VERANDA, ROOF + 0.9, LEFT.z1, C.wall, { skip: ['ny'] });
  }

  yield;
  // ---- entrance tower: doorway on the stage, windows, signboard frame, pennant --------
  const towerF = facade([TOWER.x0, 0, TOWER.z1], [1, 0, 0], [0, 0, 1]);
  const tw = TOWER.x1 - TOWER.x0;
  bandsOn(b, towerF, 0, tw);
  fbox(b, towerF, tw / 2 - 1.2, 0.8, -0.02, tw / 2 + 1.2, 3.3, 0.02, C.doorway);
  fbox(b, towerF, tw / 2 - 1.4, 3.3, 0, tw / 2 + 1.4, 3.45, 0.5, C.band);
  for (const y of [FLOORS[1], FLOORS[2]]) windowOn(b, glass, towerF, tw / 2, y + 0.8, 3.0, 1.6);
  fbox(b, towerF, 0.4, ROOF + 0.35, 0, tw - 0.4, ROOF + 1.95, 0.08, C.board);
  b.box(-0.05, TOWER.top, -16.2, 0.05, TOWER.top + 3.2, -16.1, C.metal);
  const pennant = new THREE.BufferGeometry();
  pennant.setAttribute(
    'position',
    new THREE.Float32BufferAttribute([0, 0, 0, 1.5, -0.38, 0, 0, -0.76, 0, 0, 0, 0, 0, -0.76, 0, 1.5, -0.38, 0], 3),
  );
  pennant.computeVertexNormals();
  b.add(pennant, place(0.05, TOWER.top + 3.15, -16.15), C.gold);
  pennant.dispose();

  // ---- assembly ground and stage ---------------------------------------------------------
  rect(b, GROUND, 0.05, C.ground, C.kerb);
  b.box(STAGE_AREA.x0, 0, STAGE_AREA.z0, STAGE_AREA.x1, 0.8, STAGE_AREA.z1, C.stageSkirt, { top: C.stage, skip: ['ny'] });
  b.box(-1.6, 0, STAGE_AREA.z1, 1.6, 0.53, STAGE_AREA.z1 + 0.35, C.stage, { skip: ['ny'] });
  b.box(-1.6, 0, STAGE_AREA.z1 + 0.35, 1.6, 0.27, STAGE_AREA.z1 + 0.7, C.stage, { skip: ['ny'] });
}

// ---- grounds ---------------------------------------------------------------------------
function* grounds(b: Builder) {
  // paths
  rect(b, CROSS_PATH, 0.05, C.path);
  rect(b, DRIVE, 0.05, C.path);
  rect(b, SIDE_PATH, 0.05, C.path);
  rect(b, BUS_LANE, 0.05, C.path);
  rect(b, { x0: -26, x1: -24, z0: -26, z1: CROSS_PATH.z0 }, 0.05, C.path);

  yield;
  // sports court with lines and two basketball hoops
  rect(b, COURT, 0.07, C.court, C.kerb);
  const L = 0.1;
  const y = 0.085;
  const { x0, x1, z0, z1 } = { x0: COURT.x0 + 0.6, x1: COURT.x1 - 0.6, z0: COURT.z0 + 0.6, z1: COURT.z1 - 0.6 };
  const cx = (x0 + x1) / 2;
  const cz = (z0 + z1) / 2;
  b.box(x0, 0, z0, x1, y, z0 + L, C.line, { skip: ['ny'] });
  b.box(x0, 0, z1 - L, x1, y, z1, C.line, { skip: ['ny'] });
  b.box(x0, 0, z0, x0 + L, y, z1, C.line, { skip: ['ny'] });
  b.box(x1 - L, 0, z0, x1, y, z1, C.line, { skip: ['ny'] });
  b.box(cx - L / 2, 0, z0, cx + L / 2, y, z1, C.line, { skip: ['ny'] });
  const ring = new THREE.RingGeometry(1.55, 1.65, 28);
  ring.rotateX(-Math.PI / 2);
  b.add(ring, place(cx, y, cz), C.line);
  for (const side of [-1, 1]) {
    const ex = side < 0 ? x0 : x1;
    // key (lane) and free-throw circle
    const kx = ex - side * 4.2;
    b.box(Math.min(ex, kx), 0, cz - 1.6, Math.max(ex, kx), y, cz - 1.5, C.line, { skip: ['ny'] });
    b.box(Math.min(ex, kx), 0, cz + 1.5, Math.max(ex, kx), y, cz + 1.6, C.line, { skip: ['ny'] });
    b.box(kx - L / 2, 0, cz - 1.6, kx + L / 2, y, cz + 1.6, C.line, { skip: ['ny'] });
    b.add(ring, place(kx, y + 0.001, cz, 0, 0.98), C.line);
    // hoop: pole, arm, backboard, rim
    const px = ex + side * 0.45;
    b.box(px - 0.08, 0, cz - 0.08, px + 0.08, 3.3, cz + 0.08, C.metal, { skip: ['ny'] });
    b.box(Math.min(px, px - side * 0.8), 3.05, cz - 0.06, Math.max(px, px - side * 0.8), 3.17, cz + 0.06, C.metal);
    const bx = px - side * 0.8;
    b.box(bx - 0.04, 2.8, cz - 0.62, bx + 0.04, 3.6, cz + 0.62, C.white);
    const rim = new THREE.TorusGeometry(0.24, 0.025, 4, 12);
    rim.rotateX(-Math.PI / 2);
    b.add(rim, place(bx - side * 0.3, 3.0, cz), C.rim);
    rim.dispose();
  }
  ring.dispose();

  yield;
  // bus bay with two parked yellow school buses
  rect(b, BUS_BAY, 0.05, C.pad, C.kerb);
  for (const bxc of [-25.6, -19.4]) {
    b.box(bxc - 1.6, 0, BUS_BAY.z0 + 0.6, bxc - 1.5, 0.062, BUS_BAY.z1 - 0.6, C.line, { skip: ['ny'] });
    bus(b, bxc, 13.6, 22.6);
  }

  yield;
  // flower beds
  const r = rng(29);
  const beds: [number, number, number, number][] = [
    [LEFT.x0 + 0.6, LEFT.z1 + 0.15, LEFT.x1 - VERANDA - 0.4, CROSS_PATH.z0 - 0.08],
    [RIGHT.x0 + VERANDA + 0.4, RIGHT.z1 + 0.15, RIGHT.x1 - 0.6, CROSS_PATH.z0 - 0.08],
    [DRIVE.x0 - 1.0, 9.0, DRIVE.x0 - 0.15, 20.5],
    [DRIVE.x1 + 0.15, 9.0, DRIVE.x1 + 1.0, 20.5],
    [-11, 25.4, -5, 26.4],
    [5, 25.9, 9.5, 26.6],
    [-6.6, -12.3, -5.0, -10.8],
    [5.0, -12.3, 6.6, -10.8],
  ];
  for (const [a, c, d, e] of beds) {
    b.box(a, 0, c, d, 0.2, e, C.bedEdge, { top: C.bedSoil, skip: ['ny'] });
    const n = Math.round(((d - a) * (e - c)) / 0.45);
    for (let i = 0; i < n; i++) {
      const fx = a + 0.15 + r() * (d - a - 0.3);
      const fz = c + 0.15 + r() * (e - c - 0.3);
      const s = 0.09 + r() * 0.06;
      const col = C.flowers[Math.floor(r() * C.flowers.length)];
      b.box(fx - s, 0.2, fz - s, fx + s, 0.2 + s * 2.2, fz + s, col, { skip: ['ny'] });
    }
  }

  yield;
  // benches facing the court
  for (const x of [12.5, 16.5, 20.5, 24.5]) bench(b, x, COURT.z0 - 1.2, Math.PI);
  for (const z of [-6, 0]) {
    bench(b, GROUND.x0 + 1.3, z, -Math.PI / 2);
    bench(b, GROUND.x1 - 1.3, z, Math.PI / 2);
  }

  // lamp posts along the drive and the cross path
  for (const z of [10.5, 15.5, 20.5]) {
    lamp(b, DRIVE.x0 - 0.55, z, 1);
    lamp(b, DRIVE.x1 + 0.55, z, -1);
  }
  for (const x of [-30, -20, -8, 8, 30]) lamp(b, x, CROSS_PATH.z1 + 0.45, 0);
}

function bench(b: Builder, x: number, z: number, ry: number) {
  const parts: [number, number, number, number, number, number, Rgb][] = [
    [-0.8, 0.42, -0.22, 0.8, 0.5, 0.22, C.bench],
    [-0.8, 0.55, 0.18, 0.8, 0.95, 0.24, C.bench],
    [-0.7, 0, -0.18, -0.6, 0.42, 0.2, C.metal],
    [0.6, 0, -0.18, 0.7, 0.42, 0.2, C.metal],
  ];
  const g = new THREE.BoxGeometry(1, 1, 1);
  for (const [a, c, d, e, f, h, col] of parts) {
    const m = place(x, 0, z, ry).multiply(new THREE.Matrix4().compose(
      new THREE.Vector3((a + e) / 2, (c + f) / 2, (d + h) / 2),
      new THREE.Quaternion(),
      new THREE.Vector3(e - a, f - c, h - d),
    ));
    b.add(g, m, col);
  }
  g.dispose();
}

function lamp(b: Builder, x: number, z: number, armDir: number) {
  b.box(x - 0.06, 0, z - 0.06, x + 0.06, 3.3, z + 0.06, C.metal, { skip: ['ny'] });
  b.box(x - 0.18, 0, z - 0.18, x + 0.18, 0.35, z + 0.18, C.metal, { skip: ['ny'] });
  const ax = armDir === 0 ? 0 : armDir * 0.45;
  b.box(Math.min(x, x + ax) - 0.03, 3.2, z - 0.03, Math.max(x, x + ax) + 0.03, 3.26, z + 0.03, C.metal);
  b.box(x + ax - 0.2, 3.02, z - 0.14, x + ax + 0.2, 3.22, z + 0.14, C.lampHead);
}

/** A yellow school bus along z, front towards +z. */
function bus(b: Builder, x: number, z0: number, z1: number) {
  const w = 2.5;
  const g = new RoundedBoxGeometry(w, 2.25, z1 - z0, 2, 0.28);
  b.add(g, place(x, 0.55 + 1.125, (z0 + z1) / 2), (_, n) => (n.y > 0.7 ? C.busRoof : C.bus));
  g.dispose();
  const xs = [x - w / 2 - 0.01, x + w / 2 + 0.01];
  for (const sx of xs) {
    const out = sx < x ? -0.03 : 0.03;
    b.box(sx, 1.65, z0 + 0.7, sx + out, 2.4, z1 - 1.4, C.busDark);
    b.box(sx, 1.32, z0 + 0.3, sx + out, 1.44, z1 - 0.3, C.busStripe);
  }
  b.box(x - w / 2 + 0.2, 1.6, z1 - 0.01, x + w / 2 - 0.2, 2.45, z1 + 0.03, C.busDark);
  b.box(x - w / 2 + 0.1, 0.5, z1 - 0.05, x + w / 2 - 0.1, 0.75, z1 + 0.12, C.metal);
  b.box(x - w / 2 + 0.1, 0.5, z0 - 0.12, x + w / 2 - 0.1, 0.75, z0 + 0.05, C.metal);
  const wheel = new THREE.CylinderGeometry(0.46, 0.46, 0.32, 10, 1);
  wheel.rotateZ(Math.PI / 2);
  for (const wz of [z0 + 1.7, z1 - 1.9]) for (const wx of [x - w / 2 + 0.12, x + w / 2 - 0.12]) b.add(wheel, place(wx, 0.46, wz), C.tyre);
  wheel.dispose();
}

// ---- boundary wall with railings and the arched main gate ---------------------------------
function boundary(b: Builder) {
  const h = 1.0;
  const t = 0.32;
  const gate = WALL.gate + 0.5;
  const runs: [number, number, number, number][] = [
    [-WALL.x, -WALL.z, WALL.x, -WALL.z], // back
    [-WALL.x, -WALL.z, -WALL.x, WALL.z], // left
    [WALL.x, -WALL.z, WALL.x, WALL.z], // right
    [-WALL.x, WALL.z, -gate, WALL.z], // front left of the gate
    [gate, WALL.z, WALL.x, WALL.z], // front right
  ];
  for (const [ax, az, cx, cz] of runs) {
    const alongX = az === cz;
    const len = alongX ? Math.abs(cx - ax) : Math.abs(cz - az);
    const x0 = Math.min(ax, cx);
    const z0 = Math.min(az, cz);
    const seg = (s0: number, s1: number, y0: number, y1: number, th: number, col: Rgb, skip?: ('py' | 'ny')[]) => {
      if (alongX) b.box(x0 + s0, y0, az - th / 2, x0 + s1, y1, az + th / 2, col, { skip });
      else b.box(ax - th / 2, y0, z0 + s0, ax + th / 2, y1, z0 + s1, col, { skip });
    };
    seg(0, len, 0, h, t, C.wall, ['ny']);
    seg(0, len, h, h + 0.08, t + 0.1, C.band, ['ny']);
    const posts = Math.max(1, Math.round(len / 4));
    for (let i = 0; i <= posts; i++) {
      const s = (len * i) / posts;
      seg(s - 0.28, s + 0.28, 0, h + 0.75, 0.56, C.wall, ['ny']);
      seg(s - 0.32, s + 0.32, h + 0.75, h + 0.85, 0.62, C.band, ['ny']);
      if (i === posts) break;
      const a = s + 0.28;
      const c = (len * (i + 1)) / posts - 0.28;
      seg(a, c, h + 0.62, h + 0.68, 0.05, C.rail);
      const n = Math.round((c - a) / 0.5);
      for (let k = 1; k < n; k++) {
        const bs = a + ((c - a) * k) / n;
        seg(bs - 0.025, bs + 0.025, h + 0.08, h + 0.62, 0.05, C.rail, ['py', 'ny']);
      }
    }
  }
  // gate pillars and the arch
  for (const sx of [-1, 1]) b.box(sx * WALL.gate - 0.45, 0, WALL.z - 0.45, sx * WALL.gate + 0.45, 4.2, WALL.z + 0.45, C.wall, { top: C.band, skip: ['ny'] });
  const R = 5.075;
  const arc = 2 * Math.asin(WALL.gate / R);
  const arch = new THREE.TorusGeometry(R, 0.3, 6, 18, arc);
  arch.rotateZ(Math.PI / 2 - arc / 2);
  b.add(arch, place(0, 4.2 - Math.sqrt(R * R - WALL.gate * WALL.gate), WALL.z), C.band);
  arch.dispose();
}

export interface CampusGeometry {
  main: THREE.BufferGeometry;
  glass: THREE.BufferGeometry;
}

/**
 * Builds the whole campus (except trees, clouds and the target window) in
 * small steps, so it can be spread over idle time without long tasks.
 */
export function* buildCampusSteps(): Generator<void, CampusGeometry> {
  const b = new Builder();
  const glass = new Builder();
  base(b);
  yield;
  yield* school(b, glass);
  yield;
  yield* grounds(b);
  yield;
  boundary(b);
  yield;
  const main = b.build();
  yield;
  return { main, glass: glass.build() };
}

/** All steps at once (tests, tools). */
export function buildCampus(): CampusGeometry {
  const steps = buildCampusSteps();
  let r = steps.next();
  while (!r.done) r = steps.next();
  return r.value;
}

/** Signboard plane on the entrance tower ("YOUR SCHOOL"), campus-local. */
export const SIGN = {
  center: new THREE.Vector3(0, ROOF + 1.15, TOWER.z1 + 0.09),
  width: TOWER.x1 - TOWER.x0 - 1.0,
  height: 1.4,
};

/** World-space outline of the main block (for keeping text off it). */
export const BUILDING_BOX = new THREE.Box3(new THREE.Vector3(BACK.x0, 0, BACK.z0), new THREE.Vector3(BACK.x1, TOWER.top + 3, RIGHT.z1 + 0.6));

export { TARGET, STOREY };
