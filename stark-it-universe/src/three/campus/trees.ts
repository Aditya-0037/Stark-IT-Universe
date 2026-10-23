import * as THREE from 'three';
import { rng } from './builder';
import { DRIVE, insideRect, NO_TREES, WALL } from './layout';
import type { ModelName } from './models';
import type { TreeKind } from './town';

/**
 * Native North Indian trees from the Kenney Nature Kit (CC0), re-coloured
 * to the palette:
 *  Ashoka   tall and narrow (tree_tall, tree_cone): the boundary wall, the drive
 *  Neem     round crown (tree_default, tree_oak, tree_fat): lawns and clumps
 *  Gulmohar tiered crown in orange-red bloom (tree_plateau): by the entrance
 * One InstancedMesh per model for the campus and the town together; each
 * tree varies in scale, rotation and green tint (±8 % lightness).
 */
export type Species = 'ashoka' | 'neem' | 'gulmohar';

export interface TreeInstance {
  x: number;
  z: number;
  scale: number;
  rot: number;
  tint: number;
}

/** Model and base scale (x/z, y) for each kind of tree, in metres. */
export const TREE_MODEL: Record<TreeKind, { model: ModelName; xz: number; y: number }> = {
  ashoka: { model: 'tree_tall', xz: 2.7, y: 2.9 },
  ashokaB: { model: 'tree_cone', xz: 2.9, y: 3.2 },
  neem: { model: 'tree_default', xz: 6.2, y: 4.2 },
  neemB: { model: 'tree_oak', xz: 6.4, y: 4.8 },
  neemC: { model: 'tree_fat', xz: 6.0, y: 4.4 },
  gulmohar: { model: 'tree_plateau', xz: 7.0, y: 4.2 },
  bush: { model: 'plant_bushLarge', xz: 5, y: 5 },
};

/** Canopy radius at scale 1 (for spacing and contact shadows). */
export const CANOPY: Record<Species, number> = { ashoka: 0.7, neem: 2.3, gulmohar: 2.3 };

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
}

/** Placement of the campus trees, one step at a time (idle time). */
export function* buildTreeSteps(): Generator<void, TreeSet> {
  const placed = placeTrees();
  yield;
  return { placed };
}

/**
 * Wind sway in the vertex shader: a tiny lean (at most 1°) that grows with
 * height, with its own phase per tree. uSway = 0 stops it (Reduce Motion).
 */
export const swayUniforms = { uTime: { value: 0 }, uSway: { value: 0.0175 } };

export function treeMaterial() {
  const m = new THREE.MeshLambertMaterial({ vertexColors: true });
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
