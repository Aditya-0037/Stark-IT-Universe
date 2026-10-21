import * as THREE from 'three';
import { Builder, place, rgb, rng, type Rgb } from './builder';
import { DRIVE, insideRect, NO_TREES, STOREY, WALL } from './layout';

/**
 * Three native North Indian campus trees, low-poly and soft:
 *  Ashoka   tall, narrow and conical (lines the boundary wall and the drive)
 *  Neem     round, layered canopy (around the grounds)
 *  Gulmohar wide umbrella with orange-red flower clusters (by the entrance)
 * One InstancedMesh per species; each tree varies in scale (0.8-1.3),
 * rotation and green tint (±8 % lightness).
 */
export type Species = 'ashoka' | 'neem' | 'gulmohar';

export interface TreeInstance {
  x: number;
  z: number;
  scale: number;
  rot: number;
  tint: number;
}

const TRUNK = rgb('#7A5A3E');
const TRUNK_DARK = rgb('#5E4430');

/** Wobbles vertices a little (by position, so seams stay closed). */
function lumpy(geo: THREE.BufferGeometry, amount: number, seed: number) {
  const p = geo.getAttribute('position') as THREE.BufferAttribute;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i);
    const y = p.getY(i);
    const z = p.getZ(i);
    const n = Math.sin(x * 3.1 + seed) * Math.cos(z * 2.7 - seed) + Math.sin(y * 4.3 + seed * 0.7) * 0.6;
    const k = 1 + n * amount;
    p.setXYZ(i, x * k, y, z * k);
  }
  geo.computeVertexNormals();
  return geo;
}

function shadeByHeight(dark: Rgb, light: Rgb, y0: number, y1: number) {
  const c = new THREE.Color();
  return (p: THREE.Vector3, n: THREE.Vector3) => {
    const t = THREE.MathUtils.clamp((p.y - y0) / (y1 - y0), 0, 1);
    c.copy(dark).lerp(light, t);
    // undersides of the canopy lumps are darker (layered look)
    if (n.y < -0.2) c.multiplyScalar(0.82);
    return c;
  };
}

/** Ashoka (Polyalthia longifolia): about 1.5 storeys, a narrow drooping cone. */
function ashokaGeometry() {
  const b = new Builder();
  const h = STOREY * 1.5;
  b.add(new THREE.CylinderGeometry(0.08, 0.13, 1.1, 6, 1), place(0, 0.55, 0), TRUNK);
  const profile = [
    [0.0, 0.7],
    [0.5, 0.82],
    [0.78, 1.25],
    [0.74, 1.85],
    [0.62, 2.15],
    [0.68, 2.45],
    [0.55, 3.05],
    [0.47, 3.3],
    [0.48, 3.55],
    [0.34, 4.0],
    [0.2, 4.45],
    [0.0, h],
  ].map(([r, y]) => new THREE.Vector2(r, y));
  const canopy = lumpy(new THREE.LatheGeometry(profile, 9), 0.08, 1.7);
  b.add(canopy, new THREE.Matrix4(), shadeByHeight(rgb('#2F5F31'), rgb('#4F8E46'), 0.7, h));
  return b.build();
}

/** Neem (Azadirachta indica): about 1.2 storeys, a round canopy of a few lumps. */
function neemGeometry() {
  const b = new Builder();
  b.add(new THREE.CylinderGeometry(0.13, 0.22, 1.7, 7, 1), place(0, 0.85, 0), TRUNK);
  const branch = new THREE.CylinderGeometry(0.06, 0.1, 1.1, 5, 1);
  b.add(branch, place(0.28, 1.95, 0.05).multiply(new THREE.Matrix4().makeRotationZ(-0.6)), TRUNK_DARK);
  b.add(branch, place(-0.25, 1.9, -0.1).multiply(new THREE.Matrix4().makeRotationZ(0.65)), TRUNK_DARK);
  const lumps: [number, number, number, number, number, string][] = [
    [0, 2.55, 0, 1.55, 1.05, '#5E9E4A'],
    [0.95, 2.2, 0.35, 1.05, 0.78, '#558F43'],
    [-0.85, 2.3, -0.45, 1.1, 0.82, '#62A24E'],
    [0.15, 3.25, -0.1, 1.0, 0.62, '#6CAA55'],
  ];
  lumps.forEach(([x, y, z, r, ry, col], i) => {
    const g = lumpy(new THREE.IcosahedronGeometry(1, 1), 0.07, i * 2.3);
    const c = rgb(col);
    b.add(g, new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion(), new THREE.Vector3(r, ry, r)), shadeByHeight(c.clone().multiplyScalar(0.78), c, y - ry, y + ry));
  });
  return b.build();
}

/** Gulmohar (Delonix regia): a wide, flat umbrella in orange-red bloom. */
function gulmoharGeometry() {
  const b = new Builder();
  b.add(new THREE.CylinderGeometry(0.15, 0.25, 2.2, 7, 1), place(0, 1.1, 0), TRUNK);
  const branch = new THREE.CylinderGeometry(0.07, 0.12, 1.8, 5, 1);
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    b.add(branch, place(Math.cos(a) * 0.55, 2.55, Math.sin(a) * 0.55, -a).multiply(new THREE.Matrix4().makeRotationZ(-0.9)), TRUNK_DARK);
  }
  const green = rgb('#6B9B47');
  const red = rgb('#E4502E');
  const lumps: [number, number, number, number, number, Rgb][] = [
    [0, 3.45, 0, 2.1, 0.75, red],
    [1.75, 3.1, 0.3, 1.45, 0.6, green],
    [-1.6, 3.15, -0.5, 1.45, 0.62, red],
    [0.2, 3.05, 1.7, 1.35, 0.58, red],
    [-0.3, 3.1, -1.7, 1.4, 0.6, green],
  ];
  lumps.forEach(([x, y, z, r, ry, c], i) => {
    const g = lumpy(new THREE.IcosahedronGeometry(1, 1), 0.08, i * 1.9 + 4);
    b.add(g, new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion(), new THREE.Vector3(r, ry, r)), shadeByHeight(c.clone().multiplyScalar(0.75), c, y - ry, y + ry));
  });
  // flower clusters on top
  const r = rng(77);
  const flower = new THREE.IcosahedronGeometry(1, 0);
  const bloom = [rgb('#F0662F'), rgb('#E2402C'), rgb('#F58A3A')];
  for (let i = 0; i < 12; i++) {
    const a = r() * Math.PI * 2;
    const d = 0.4 + r() * 2.2;
    const s = 0.32 + r() * 0.22;
    b.add(flower, place(Math.cos(a) * d, 3.75 + r() * 0.3 - d * 0.12, Math.sin(a) * d, r() * 3, s, s * 0.7, s), bloom[i % 3]);
  }
  return b.build();
}

export const TREE_GEOMETRY: Record<Species, () => THREE.BufferGeometry> = {
  ashoka: ashokaGeometry,
  neem: neemGeometry,
  gulmohar: gulmoharGeometry,
};

/** Canopy radius at scale 1 (for spacing and contact shadows). */
export const CANOPY: Record<Species, number> = { ashoka: 0.8, neem: 2.0, gulmohar: 2.9 };

const free = (x: number, z: number, margin: number) => !NO_TREES.some((r) => insideRect(x, z, r, margin));

/**
 * Places the trees: Ashoka along the boundary wall and the drive (spaced
 * lines with jitter), Gulmohar by the entrance, Neem by Poisson-disk
 * sampling over the open lawns. Never on buildings, courts or paths.
 */
export function placeTrees(): Record<Species, TreeInstance[]> {
  const r = rng(2024);
  const out: Record<Species, TreeInstance[]> = { ashoka: [], neem: [], gulmohar: [] };
  const all: { x: number; z: number; rad: number }[] = [];
  const add = (sp: Species, x: number, z: number) => {
    const scale = 0.8 + r() * 0.5;
    out[sp].push({ x, z, scale, rot: r() * Math.PI * 2, tint: (r() * 2 - 1) * 0.08 });
    all.push({ x, z, rad: CANOPY[sp] * scale });
  };
  const clear = (x: number, z: number, rad: number) => all.every((t) => Math.hypot(t.x - x, t.z - z) > t.rad + rad + 0.3);

  // Gulmohar by the entrance
  add('gulmohar', 6.4, 25.4);
  add('gulmohar', -7.5, 17.0);

  // Ashoka lines along the inside of the boundary wall
  const inset = 1.7;
  const lines: [number, number, number, number][] = [
    [-WALL.x + inset, -WALL.z + inset, WALL.x - inset, -WALL.z + inset],
    [-WALL.x + inset, WALL.z - inset, WALL.x - inset, WALL.z - inset],
    [-WALL.x + inset, -WALL.z + inset + 3, -WALL.x + inset, WALL.z - inset - 3],
    [WALL.x - inset, -WALL.z + inset + 3, WALL.x - inset, WALL.z - inset - 3],
  ];
  for (const [ax, az, bx, bz] of lines) {
    const len = Math.hypot(bx - ax, bz - az);
    const ux = (bx - ax) / len;
    const uz = (bz - az) / len;
    for (let s = 0; s <= len; s += 2.9 + r() * 0.7) {
      const j = (r() - 0.5) * 0.5;
      const x = ax + ux * s - uz * j;
      const z = az + uz * s + ux * j;
      if (Math.abs(x) < 6 && z > 0) continue; // keep the gate clear
      if (free(x, z, CANOPY.ashoka) && clear(x, z, CANOPY.ashoka)) add('ashoka', x, z);
    }
  }
  // ...and both sides of the main drive
  for (const side of [-1, 1]) {
    for (let z = 9.8; z <= 20.2; z += 3.3 + r() * 0.4) {
      const x = side * (DRIVE.x1 + 1.8) + (r() - 0.5) * 0.3;
      if (clear(x, z, CANOPY.ashoka)) add('ashoka', x, z);
    }
  }

  // Neem: Poisson-disk (dart throwing) over the free lawns
  const minDist = 5.6;
  let tries = 0;
  while (out.neem.length < 18 && tries++ < 4000) {
    const x = (r() * 2 - 1) * (WALL.x - 2.6);
    const z = (r() * 2 - 1) * (WALL.z - 2.6);
    const rad = CANOPY.neem * 1.15;
    if (!free(x, z, rad)) continue;
    if (!clear(x, z, rad)) continue;
    if (out.neem.some((t) => Math.hypot(t.x - x, t.z - z) < minDist)) continue;
    add('neem', x, z);
  }
  return out;
}

export interface TreeSet {
  placed: Record<Species, TreeInstance[]>;
  geometry: Record<Species, THREE.BufferGeometry>;
}

/** Placement and the three species' geometries, one step at a time (idle time). */
export function* buildTreeSteps(): Generator<void, TreeSet> {
  const placed = placeTrees();
  yield;
  const geometry = {} as Record<Species, THREE.BufferGeometry>;
  for (const sp of Object.keys(TREE_GEOMETRY) as Species[]) {
    geometry[sp] = TREE_GEOMETRY[sp]();
    yield;
  }
  return { placed, geometry };
}

/**
 * Wind sway in the vertex shader: a tiny lean (at most 1°) that grows with
 * height, with its own phase per tree. uSway = 0 stops it (Reduce Motion).
 */
export const swayUniforms = { uTime: { value: 0 }, uSway: { value: 0.0175 } };

export function treeMaterial() {
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92, metalness: 0 });
  m.onBeforeCompile = (s) => {
    s.uniforms.uTime = swayUniforms.uTime;
    s.uniforms.uSway = swayUniforms.uSway;
    s.vertexShader = s.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uTime;\nuniform float uSway;')
      .replace(
        '#include <begin_vertex>',
        /* glsl */ `#include <begin_vertex>
        #ifdef USE_INSTANCING
          float swPh = instanceMatrix[3].x * 0.37 + instanceMatrix[3].z * 0.53;
        #else
          float swPh = 0.0;
        #endif
        float swH = max(transformed.y - 0.6, 0.0);
        float swA = uSway * (0.7 * sin(uTime * 1.1 + swPh) + 0.3 * sin(uTime * 1.9 + swPh * 1.7));
        transformed.x += swA * swH;
        transformed.z += swA * 0.6 * swH * cos(swPh);`,
      );
  };
  m.customProgramCacheKey = () => 'siu-tree-sway';
  return m;
}

/** Soft round contact shadow under each tree. */
export function contactShadowTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d')!;
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(0,0,0,0.55)');
  grad.addColorStop(0.55, 'rgba(0,0,0,0.25)');
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
