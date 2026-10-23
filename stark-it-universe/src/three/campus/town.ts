import * as THREE from 'three';
import palette from '../../art/palette.json';
import { Builder, rgb, rng, vary } from './builder';
import { WALL, type Rect } from './layout';
import { modelSize, type ModelName, type Models } from './models';

/**
 * The town around the campus, so the school stands on the ground and not
 * on a floating slab: dusty ground and fields out to the horizon (lost in
 * the morning haze), a main road past the main gate with the bus route and
 * a few lanes, flat-roofed two- and three-storey houses (Kenney models,
 * off-white, cream and pale ochre) in rows along the roads, open plots and
 * clumps of neem and Ashoka trees. Far away, where the haze takes over, the
 * houses are simple flat-roofed blocks. Campus-local units (about 1 m).
 */
const S = palette.surface;
const C = {
  dust: S.dust.map((h) => rgb(h)),
  field: S.field.map((h) => rgb(h)),
  grass: S.grass.map((h) => rgb(h)),
  asphalt: S.asphalt.map((h) => rgb(h)),
  plot: rgb(S.dust[0]),
  line: rgb(palette.brand.paper[1]),
  walls: [rgb(S.plaster[0]), rgb(S.plaster[1]), rgb(S.ochre[0]), rgb(S.ochre[1])],
};

/** Main road past the gate (along x), the lane from the gate, and the town's lanes. */
export const MAIN_ROAD: Rect = { x0: -900, x1: 900, z0: 40, z1: 47 };
export const GATE_ROAD: Rect = { x0: -3.6, x1: 3.6, z0: WALL.z, z1: MAIN_ROAD.z0 };
const LANES: Rect[] = [
  MAIN_ROAD,
  GATE_ROAD,
  { x0: -900, x1: 900, z0: -50, z1: -45 }, // behind the campus
  { x0: -64, x1: -59, z0: -900, z1: MAIN_ROAD.z0 }, // west lane
  { x0: 104, x1: 109, z0: -900, z1: 900 }, // east lane
  { x0: -900, x1: 104, z0: 128, z1: 133 }, // in front
  { x0: -900, x1: 900, z0: -168, z1: -163 },
  { x0: -205, x1: -200, z0: -900, z1: 900 },
  { x0: 230, x1: 235, z0: -900, z1: 900 },
];
/** Kept free of houses: the campus, the open ground beside it (the camera flies low over it to the window). */
const KEEP_CLEAR: Rect[] = [
  { x0: -42, x1: 42, z0: -34, z1: 34 },
  { x0: 38, x1: 100, z0: -36, z1: 36 },
  { x0: -12, x1: 12, z0: 34, z1: 40 },
];
/** Bus stop by the gate (the bus route along the main road). */
export const BUS_STOP = new THREE.Vector3(-14, 0, 38.6);

const inRect = (x: number, z: number, r: Rect, m = 0) => x > r.x0 - m && x < r.x1 + m && z > r.z0 - m && z < r.z1 + m;

export interface Placed {
  x: number;
  z: number;
  rot: number;
  sx: number;
  sy: number;
  sz: number;
  tint: number;
}
export type TreeKind = 'ashoka' | 'ashokaB' | 'neem' | 'neemB' | 'neemC' | 'gulmohar' | 'bush';

export interface TownLayout {
  houses: Partial<Record<ModelName, Placed[]>>;
  far: Placed[];
  cars: Partial<Record<ModelName, Placed[]>>;
  trees: Record<TreeKind, Placed[]>;
  /** Footprints for the contact shadows: rects (centre, size, rotation) and discs. */
  rects: { x: number; z: number; w: number; d: number; rot: number; k: number }[];
  discs: { x: number; z: number; r: number; k: number }[];
}

const HOUSE_MODELS: ModelName[] = ['building-a', 'building-b', 'building-c', 'building-d', 'building-e', 'building-h', 'building-i', 'building-k'];
/** Weights: mostly the small two- and three-storey houses. */
const HOUSE_WEIGHT = [3, 3, 3, 3, 2, 3, 1, 1];
const HOUSE_SCALE = 6.4;
/** Kenney houses within this distance of the campus; simple blocks beyond (in the haze). */
const DETAIL_R = 125;
const TOWN_R = 330;

function pick<T>(items: T[], weights: number[], r: number) {
  const total = weights.reduce((a, b) => a + b, 0);
  let t = r * total;
  for (let i = 0; i < items.length; i++) {
    t -= weights[i];
    if (t <= 0) return items[i];
  }
  return items[items.length - 1];
}

/** Distance to the nearest lane edge and the angle that faces it. */
function nearestLane(x: number, z: number) {
  let best = Infinity;
  let rot = 0;
  for (const L of LANES) {
    const alongX = L.x1 - L.x0 > L.z1 - L.z0;
    if (alongX) {
      if (x < L.x0 || x > L.x1) continue;
      const d = z < L.z0 ? L.z0 - z : z > L.z1 ? z - L.z1 : 0;
      if (d < best) {
        best = d;
        rot = z < L.z0 ? 0 : Math.PI; // the front (+z of the model) faces the lane
      }
    } else {
      if (z < L.z0 || z > L.z1) continue;
      const d = x < L.x0 ? L.x0 - x : x > L.x1 ? x - L.x1 : 0;
      if (d < best) {
        best = d;
        rot = x < L.x0 ? Math.PI / 2 : -Math.PI / 2;
      }
    }
  }
  return { d: best, rot };
}

/** Places houses, open plots, tree clumps and parked cars on a jittered grid of plots. */
export function placeTown(models: Models): TownLayout {
  const r = rng(4242);
  const out: TownLayout = {
    houses: {},
    far: [],
    cars: {},
    trees: { ashoka: [], ashokaB: [], neem: [], neemB: [], neemC: [], gulmohar: [], bush: [] },
    rects: [],
    discs: [],
  };
  const cell = 15;
  const n = Math.ceil(TOWN_R / cell);
  const tree = (kind: TreeKind, x: number, z: number, s: number) => {
    out.trees[kind].push({ x, z, rot: r() * Math.PI * 2, sx: s, sy: s * (0.9 + r() * 0.2), sz: s, tint: (r() * 2 - 1) * 0.08 });
  };
  const clump = (cx: number, cz: number, count: number, spread: number) => {
    for (let k = 0; k < count; k++) {
      const a = r() * Math.PI * 2;
      const d = Math.sqrt(r()) * spread;
      const x = cx + Math.cos(a) * d;
      const z = cz + Math.sin(a) * d;
      if (LANES.some((L) => inRect(x, z, L, 1.5))) continue;
      const t = r();
      const kind: TreeKind = t < 0.3 ? 'ashoka' : t < 0.42 ? 'ashokaB' : t < 0.68 ? 'neem' : t < 0.85 ? 'neemB' : t < 0.95 ? 'neemC' : 'bush';
      tree(kind, x, z, 0.85 + r() * 0.4);
    }
  };

  for (let i = -n; i <= n; i++) {
    for (let j = -n; j <= n; j++) {
      const x = i * cell + (r() - 0.5) * 3;
      const z = j * cell + (r() - 0.5) * 3;
      const dist = Math.hypot(x, z);
      if (dist > TOWN_R) continue;
      if (KEEP_CLEAR.some((k) => inRect(x, z, k, 4))) {
        // the open ground beside the school: a few trees at its edges
        if (inRect(x, z, KEEP_CLEAR[1]) && x > 70 && r() < 0.35) clump(x, z, 2 + Math.floor(r() * 3), 5);
        continue;
      }
      if (LANES.some((L) => inRect(x, z, L, 6.5))) continue;
      const lane = nearestLane(x, z);
      const onRoad = lane.d < 16;
      const roll = r();
      // houses mostly in rows along the lanes; open plots and trees in between
      const pHouse = onRoad ? 0.8 : 0.4;
      if (roll < pHouse) {
        const rot = (onRoad ? lane.rot : Math.floor(r() * 4) * (Math.PI / 2)) + (r() - 0.5) * 0.06;
        const tint = (r() * 2 - 1) * 0.05;
        if (dist < DETAIL_R) {
          const model = pick(HOUSE_MODELS, HOUSE_WEIGHT, r());
          const size = modelSize(models[model]);
          const s = HOUSE_SCALE * (0.92 + r() * 0.16);
          (out.houses[model] ??= []).push({ x, z, rot, sx: s, sy: s, sz: s, tint });
          out.rects.push({ x: x + size.cx * s, z: z + size.cz * s, w: size.w * s, d: size.d * s, rot, k: 1 });
        } else {
          // simple flat-roofed block, 2 or 3 storeys (wall colour per instance)
          const w = 7 + r() * 5;
          const d = 8 + r() * 4;
          const h = (r() < 0.55 ? 2 : 3) * 3.1;
          out.far.push({ x, z, rot, sx: w, sy: h, sz: d, tint: Math.floor(r() * C.walls.length) });
          out.rects.push({ x, z, w, d, rot, k: 1 });
        }
        // a car parked in front now and then
        if (onRoad && dist < DETAIL_R + 30 && r() < 0.18) {
          const model: ModelName = r() < 0.6 ? 'sedan' : 'van';
          const fx = Math.sin(rot);
          const fz = Math.cos(rot);
          const cx = x + fx * 7.6 + fz * (r() - 0.5) * 4;
          const cz = z + fz * 7.6 - fx * (r() - 0.5) * 4;
          if (!LANES.some((L) => inRect(cx, cz, L, 0.6))) {
            (out.cars[model] ??= []).push({ x: cx, z: cz, rot: rot + Math.PI / 2, sx: 1.6, sy: 1.6, sz: 1.6, tint: 0 });
            out.rects.push({ x: cx, z: cz, w: 4.2, d: 2.2, rot: rot + Math.PI / 2, k: 0.8 });
          }
        }
      } else if (roll < pHouse + 0.17) {
        clump(x, z, 2 + Math.floor(r() * 4), 6);
      }
      // otherwise an open plot (drawn on the ground)
    }
  }
  // trees along the main road in front of the school
  for (let x = -110; x <= 110; x += 9 + r() * 5) {
    if (Math.abs(x) < 14) continue;
    tree(r() < 0.6 ? 'ashoka' : 'neem', x + (r() - 0.5) * 2, MAIN_ROAD.z1 + 2.2 + r(), 0.9 + r() * 0.3);
  }
  return out;
}

/** Value noise for the ground colour patches (deterministic). */
function noise2(seed: number) {
  const r = rng(seed);
  const N = 64;
  const g = new Float32Array(N * N).map(() => r());
  return (x: number, z: number) => {
    const fx = ((x % N) + N) % N;
    const fz = ((z % N) + N) % N;
    const i = Math.floor(fx);
    const j = Math.floor(fz);
    const tx = fx - i;
    const tz = fz - j;
    const sx = tx * tx * (3 - 2 * tx);
    const sz = tz * tz * (3 - 2 * tz);
    const a = g[j * N + i];
    const b = g[j * N + ((i + 1) % N)];
    const c = g[((j + 1) % N) * N + i];
    const d = g[((j + 1) % N) * N + ((i + 1) % N)];
    return (a * (1 - sx) + b * sx) * (1 - sz) + (c * (1 - sx) + d * sx) * sz;
  };
}

/**
 * The ground: a polar grid (fine near the campus, coarse far away) out to
 * well past the far plane, so the camera never sees an edge; dusty earth
 * with scrub and, further out, green fields. Flat overlays (roads, shoulders,
 * open plots) are a second mesh, each layer a few cm above the one below
 * and never coplanar with it (no z-fighting from far away).
 */
export const GROUND_Y = -0.06;
export function* buildGroundSteps(): Generator<void, { ground: THREE.BufferGeometry; flats: THREE.BufferGeometry }> {
  const nA = noise2(11);
  const nB = noise2(23);
  const rings = 150;
  const segs = 128;
  const radius = (k: number) => (k === 0 ? 0 : 20 + 2400 * Math.pow((k - 1) / (rings - 1), 2.6));
  const col = new THREE.Color();
  const pos: number[] = [];
  const colr: number[] = [];
  for (let k = 0; k <= rings; k++) {
    const R = radius(k);
    for (let s = 0; s < segs; s++) {
      const a = (s / segs) * Math.PI * 2;
      const x = Math.cos(a) * R;
      const z = Math.sin(a) * R;
      pos.push(x, GROUND_Y, z);
      const u = nA(x / 38, z / 38);
      const v = nB(x / 90 + 7, z / 90 - 3);
      const fine = nA(x / 9 + 31, z / 9 + 17);
      // dusty earth, scrub greens, fields in larger patches
      col.copy(C.dust[1]).lerp(C.dust[0], fine * 0.6);
      if (u > 0.5) col.lerp(C.grass[2], Math.min(1, (u - 0.5) * 3) * 0.6);
      if (v > 0.62 && R > 140) col.lerp(C.field[1], Math.min(1, (v - 0.62) * 5) * 0.85);
      if (v < 0.25) col.lerp(C.dust[2], (0.25 - v) * 2);
      colr.push(col.r, col.g, col.b);
    }
    if (k % 25 === 0) yield;
  }
  const idx: number[] = [];
  for (let k = 0; k < rings; k++) {
    for (let s = 0; s < segs; s++) {
      const a = k * segs + s;
      const b = k * segs + ((s + 1) % segs);
      const c = (k + 1) * segs + s;
      const d = (k + 1) * segs + ((s + 1) % segs);
      idx.push(a, b, c, b, d, c);
    }
  }
  const ground = new THREE.BufferGeometry();
  ground.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  ground.setAttribute('normal', new THREE.Float32BufferAttribute(new Float32Array(pos.length).map((_, i) => (i % 3 === 1 ? 1 : 0)), 3));
  ground.setAttribute('color', new THREE.Float32BufferAttribute(colr, 3));
  ground.setIndex(new THREE.Uint32BufferAttribute(idx, 1));
  ground.computeBoundingSphere();
  yield;

  // roads: asphalt between dusty shoulders, a faded centre line on the main road
  const b = new Builder();
  const asphalt = C.asphalt[1];
  for (const L of LANES) {
    const x0 = Math.max(L.x0, -700);
    const x1 = Math.min(L.x1, 700);
    const z0 = Math.max(L.z0, -700);
    const z1 = Math.min(L.z1, 700);
    const alongX = L.x1 - L.x0 > L.z1 - L.z0;
    const sh = 1.4;
    if (alongX) {
      b.flat(x0, z0 - sh, x1, z0, 0, C.dust[2]);
      b.flat(x0, z1, x1, z1 + sh, 0, C.dust[2]);
    } else {
      b.flat(x0 - sh, z0, x0, z1, 0, C.dust[2]);
      b.flat(x1, z0, x1 + sh, z1, 0, C.dust[2]);
    }
    b.flat(x0, z0, x1, z1, 0.05, asphalt);
  }
  for (let x = -700; x < 700; x += 6) if (Math.abs(x) > 6) b.flat(x, 43.4, x + 3, 43.6, 0.08, C.line);
  yield;
  // open plots: bare, lighter earth
  const r = rng(77);
  for (let i = 0; i < 70; i++) {
    const x = (r() - 0.5) * 2 * 260;
    const z = (r() - 0.5) * 2 * 260;
    const w = 12 + r() * 16;
    const d = 12 + r() * 14;
    if (KEEP_CLEAR.some((k) => inRect(x, z, k, 8)) || LANES.some((L) => inRect(x, z, L, Math.max(w, d) / 2 + 2))) continue;
    b.flat(x - w / 2, z - d / 2, x + w / 2, z + d / 2, -0.01, vary(C.plot, (r() - 0.5) * 0.08));
  }
  // the open ground beside the school: a scrubby playing field with a pitch
  b.flat(42, -30, 96, 32, -0.01, vary(C.field[1], -0.04));
  b.flat(66, -7, 72, 13, 0.02, C.dust[0]);
  yield;
  return { ground, flats: b.build() };
}

/** A simple flat-roofed block (unit size, feet at 0) for the far houses: walls, parapet, water tank. */
export function farHouseGeometry() {
  const b = new Builder();
  const wall = new THREE.Color(1, 1, 1);
  const roof = new THREE.Color(0.78, 0.76, 0.72);
  b.box(-0.5, 0, -0.5, 0.5, 1, 0.5, wall, { skip: ['ny'], top: roof });
  const t = 0.04;
  const h = 0.09;
  b.box(-0.5, 1, -0.5, 0.5, 1 + h, -0.5 + t, wall, { skip: ['ny'] });
  b.box(-0.5, 1, 0.5 - t, 0.5, 1 + h, 0.5, wall, { skip: ['ny'] });
  b.box(-0.5, 1, -0.5 + t, -0.5 + t, 1 + h, 0.5 - t, wall, { skip: ['ny'] });
  b.box(0.5 - t, 1, -0.5 + t, 0.5, 1 + h, 0.5 - t, wall, { skip: ['ny'] });
  b.box(0.12, 1, 0.1, 0.32, 1.16, 0.3, new THREE.Color(0.2, 0.22, 0.26), { skip: ['ny'] });
  // window band hints (darker strips on two sides)
  for (const y of [0.32, 0.72]) {
    b.box(-0.36, y, 0.5, 0.36, y + 0.12, 0.505, new THREE.Color(0.55, 0.6, 0.68), { skip: ['ny'] });
    b.box(0.5, y, -0.36, 0.505, y + 0.12, 0.36, new THREE.Color(0.55, 0.6, 0.68), { skip: ['ny'] });
  }
  return b.build();
}

export const FAR_WALLS = C.walls;
