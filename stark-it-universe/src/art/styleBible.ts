import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import palette from './palette.json';

/**
 * The style bible in code (see STYLE_BIBLE.md). Soft-bevel clay low-poly:
 * one bevel rule, four material families, three values per surface, one
 * palette, one light rig, Neutral tone mapping and selective glow.
 * New 3D work takes its numbers from here, not from local constants.
 */

// ---- palette ---------------------------------------------------------------------
export type Shade = 'light' | 'base' | 'shadow';
type Group = Exclude<keyof typeof palette, '_note'>;
type Entry<G extends Group> = keyof (typeof palette)[G];
const SHADES: Shade[] = ['light', 'base', 'shadow'];

/** One palette colour (linear, ready for vertex colours or materials). */
export function tone<G extends Group>(group: G, name: Entry<G>, shade: Shade = 'base') {
  const triad = (palette[group] as Record<string, string[]>)[name as string];
  return new THREE.Color(triad[SHADES.indexOf(shade)]);
}

/**
 * Fake GI for vertex colours: lighter towards the top of a part, darker at
 * its foot (t = 0 bottom, 1 top), from the surface's three values.
 */
export function gi<G extends Group>(group: G, name: Entry<G>, t: number) {
  const c = tone(group, name, 'shadow');
  const b = tone(group, name, 'base');
  const l = tone(group, name, 'light');
  return t < 0.5 ? c.lerp(b, t * 2) : b.lerp(l, (t - 0.5) * 2);
}

const ENTRIES = (Object.keys(palette) as (Group | '_note')[])
  .filter((g): g is Group => g !== '_note')
  .flatMap((g) => Object.keys(palette[g]).map((n) => [g, n] as const));
const CELL = { cols: SHADES.length, rows: 64 };

let paletteTex: THREE.DataTexture | null = null;
/** The shared 64 x 64 palette texture (rows = entries, columns = light/base/shadow). */
export function paletteTexture() {
  if (paletteTex) return paletteTex;
  const size = 64;
  const data = new Uint8Array(size * size * 4);
  ENTRIES.forEach(([g, n], row) => {
    const triad = (palette[g] as Record<string, string[]>)[n];
    for (let x = 0; x < size; x++) {
      const c = new THREE.Color(triad[Math.min(CELL.cols - 1, Math.floor((x / size) * CELL.cols))]);
      const i = (row * size + x) * 4;
      data[i] = Math.round(c.r * 255);
      data[i + 1] = Math.round(c.g * 255);
      data[i + 2] = Math.round(c.b * 255);
      data[i + 3] = 255;
    }
  });
  paletteTex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  paletteTex.colorSpace = THREE.LinearSRGBColorSpace;
  paletteTex.magFilter = THREE.NearestFilter;
  paletteTex.minFilter = THREE.NearestFilter;
  paletteTex.needsUpdate = true;
  return paletteTex;
}

/** UV of a palette cell (for geometry sampling the palette texture). */
export function paletteUV<G extends Group>(group: G, name: Entry<G>, shade: Shade = 'base'): [number, number] {
  const row = ENTRIES.findIndex(([g, n]) => g === group && n === name);
  return [(SHADES.indexOf(shade) + 0.5) / CELL.cols, 1 - (row + 0.5) / CELL.rows];
}

// ---- the brand night ------------------------------------------------------------------
/** Every night on the page (3D space, Proof, contact, footer): top to bottom. */
export const NIGHT = { top: '#060A22', bottom: '#0B1640' };

// ---- bevel rule and exaggeration -------------------------------------------------------
/** Bevel radius: 6 % of the object's smallest dimension (the rule allows 4-8 %). */
export const BEVEL = { ratio: 0.06, segments: 3 };
export const bevelRadius = (w: number, h: number, d: number) => Math.min(w, h, d) * BEVEL.ratio;

/** A box with the house bevel (no raw 90 degree edges). */
export function softBox(w: number, h: number, d: number) {
  return new RoundedBoxGeometry(w, h, d, BEVEL.segments, bevelRadius(w, h, d));
}

/** Hero devices (IFP, projector, rack) read on a phone; secondary props sit back. */
export const SCALE = { hero: 1.3, secondary: 0.92 };

// ---- the four material families -----------------------------------------------------
type ColorIn = THREE.ColorRepresentation;
const clampR = (r: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, r));

/** Matte clay: roughness 0.6-0.9, no metal. Default for almost everything. */
export const clay = (color: ColorIn = '#ffffff', roughness = 0.8, vertexColors = false) =>
  new THREE.MeshStandardMaterial({ color, roughness: clampR(roughness, 0.6, 0.9), metalness: 0, vertexColors });

/** Painted metal: roughness 0.3-0.5 (frames, poles, device shells). */
export const paintedMetal = (color: ColorIn, roughness = 0.4) =>
  new THREE.MeshStandardMaterial({ color, roughness: clampR(roughness, 0.3, 0.5), metalness: 0.35 });

/** Glass and screens: roughness 0.05-0.2. */
export const glass = (color: ColorIn, roughness = 0.12) =>
  new THREE.MeshStandardMaterial({ color, roughness: clampR(roughness, 0.05, 0.2), metalness: 0.1 });

/**
 * Emissive: only things that emit light (sun, screens, LEDs, lit windows,
 * the satellite's nav light, tube lights). `strength` above 1 makes it glow.
 */
export const emissive = (color: ColorIn, strength = 1.4) =>
  new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(strength) });

/** Baked (Blender) textures already carry the view transform: never tone-map them twice. */
export const baked = (map: THREE.Texture) => new THREE.MeshBasicMaterial({ map, toneMapped: false });

// ---- one light rig ------------------------------------------------------------------
/**
 * One warm key (the SIU sun in space, the same colour and direction as the
 * morning sun on Earth) is the only shadow caster; a cool universe-blue
 * hemisphere fills; an optional rim separates silhouettes.
 */
export const LIGHT = {
  key: { color: '#FFD49A', kelvin: 3600, elevationDeg: 30, azimuthDeg: 320 },
  fill: { sky: '#93ACFF', ground: '#0B1640' },
  rim: { color: '#6F86FF' },
};

/** Direction towards the key light at the given elevation and azimuth (y up, azimuth from +z towards +x). */
export function keyDirection(elevationDeg = LIGHT.key.elevationDeg, azimuthDeg = LIGHT.key.azimuthDeg) {
  const e = THREE.MathUtils.degToRad(elevationDeg);
  const a = THREE.MathUtils.degToRad(azimuthDeg);
  return new THREE.Vector3(Math.cos(e) * Math.sin(a), Math.sin(e), Math.cos(e) * Math.cos(a));
}

// ---- tone mapping and glow ---------------------------------------------------------
/**
 * Khronos PBR Neutral keeps the sun gold and CAT-6 green saturated (ACES
 * washes bright yellow, green and cyan out). Glow is selective: only colours
 * above 1.0 pass the bloom threshold.
 */
/**
 * Inverse of the PBR Neutral toe for dark colours: Neutral subtracts an
 * offset from the smallest channel of dark colours (which saturates them).
 * A background passed through this comes out of the tone mapper as the
 * intended colour (used for the brand night behind the 3D).
 */
export function preNeutral(hex: string) {
  const c = new THREE.Color(hex);
  const x = Math.min(c.r, c.g, c.b);
  // Neutral: offset = x < 0.08 ? x - 6.25 x^2 : 0.04, applied to every channel
  const x1 = x < 0.04 ? Math.sqrt(x / 6.25) : x + 0.04;
  const offset = x1 < 0.08 ? x1 - 6.25 * x1 * x1 : 0.04;
  return new THREE.Color(c.r + offset, c.g + offset, c.b + offset);
}

export const RENDER = {
  toneMapping: THREE.NeutralToneMapping,
  bloom: { luminanceThreshold: 1, luminanceSmoothing: 0.08, intensity: 0.6, radius: 0.7 },
};
