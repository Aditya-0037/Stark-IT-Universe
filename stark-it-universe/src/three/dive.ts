import * as THREE from 'three';
import { CAMPUS, smooth } from './stage';

/**
 * The descent as one move: we follow the satellite down through the clouds
 * to one glowing window. Times are descent progress (0..1).
 *
 *   0-8 %    the satellite leaves route station 05 and the camera tips in above it
 *   8-35 %   it dives toward Earth (camera close behind, Earth's edge glowing
 *            cyan to gold on the horizon), down onto the cloud deck
 *   ~37 %    inside the deck the frame is fully clouded: space swaps to the campus
 *   37-52 %  down through the clouds, the fog opens, the town appears
 *   52-64 %  the satellite flies ahead to the school and shines its gold light on
 *            one first-floor window, which glows from then on
 *   76-86 %  it rises away before the camera glides in to that window
 *
 * The space half of the path is in world units around the star system; the
 * campus half is campus-local (metres). They never show together.
 */
export const DIVE = {
  /** Space -> campus, inside the cloud deck. */
  swap: 0.37,
  /** Whiteout: in, full, full, out. */
  white: [0.33, 0.355, 0.385, 0.43] as const,
  /** The beam: on, full, fading, off. */
  beam: [0.58, 0.62, 0.76, 0.8] as const,
  /** The window lights up. */
  lit: [0.6, 0.64] as const,
};

const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

// ---- space half (world) ------------------------------------------------------------
/** Where the route left the satellite (station 05), set by the route scene. */
const START = v(8.48, 0.42, 4.66);
export const setDiveStart = (p: THREE.Vector3) => START.copy(p);

const A_KEYS = [0, 0.07, 0.17, 0.27, DIVE.swap];
const A_PATH = new THREE.CatmullRomCurve3(
  [START.clone(), v(8.7, -2.2, 6.8), v(8.4, -9.5, 10.5), v(7.0, -21, 15.5), v(5.0, -37, 21)],
  false,
  'centripetal',
);
/** The route satellite's scale (1.4) growing as it nears Earth. */
const scaleA = (p: number) => 1.4 * (1 + 1.0 * smooth(0, DIVE.swap, p));

function keyed(keys: number[], p: number) {
  const q = THREE.MathUtils.clamp(p, keys[0], keys[keys.length - 1]);
  let i = 0;
  while (i < keys.length - 2 && q > keys[i + 1]) i++;
  const f = (q - keys[i]) / (keys[i + 1] - keys[i]);
  return (i + f) / (keys.length - 1);
}

/** The satellite in space (world): position, travel direction and scale. */
export function diveSpace(p: number, pos: THREE.Vector3, dir: THREE.Vector3) {
  A_PATH.points[0].copy(START);
  const t = keyed(A_KEYS, p);
  A_PATH.getPoint(t, pos);
  A_PATH.getTangent(Math.min(t, 0.999), dir);
  return scaleA(p);
}

const back = new THREE.Vector3();
const sat = new THREE.Vector3();
const dir = new THREE.Vector3();
/**
 * The camera above and just in front of the falling satellite (on the side
 * the route camera was), looking down past it toward Earth, so the horizon
 * (Earth's edge) stays in the top third of the frame and the star system
 * drops out of view above.
 */
export function followSpace(p: number, camPos: THREE.Vector3, look: THREE.Vector3) {
  const k = diveSpace(p, sat, dir);
  const d = 6 * (k / 1.4);
  camPos.copy(sat).add(back.set(-0.12, 0.72, 1.3).multiplyScalar(d));
  look.copy(sat).add(back.set(0, -0.25, -1.45).multiplyScalar(d));
  return camPos;
}

// ---- campus half (campus-local) ---------------------------------------------------
/** The target window the satellite lights (TARGET in campus/layout.ts). */
export const WINDOW_POINT = v(22.05, 5.35, -5);
/** Where it hovers while its light is on the window. */
export const HOVER = v(42, 15, 1);
const B_KEYS = [DIVE.swap, 0.43, 0.49, 0.55, 0.6, 0.64, 0.76, 0.8, 0.86];
const B_PATH = new THREE.CatmullRomCurve3(
  [v(88, 150, 132), v(76, 128, 112), v(64, 98, 86), v(54, 58, 46), v(47, 24, 12), HOVER.clone(), HOVER.clone().add(v(0.4, 0.3, 0.3)), v(45, 26, 6), v(46, 72, 20)],
  false,
  'centripetal',
);
/** Campus satellite scale (metres: its panels span about 8 m, so it reads from the air). */
export const SCALE_B = 7;

/** The satellite over the campus (campus-local): position and travel direction. */
export function diveCampus(p: number, pos: THREE.Vector3, dir: THREE.Vector3) {
  const t = keyed(B_KEYS, p);
  B_PATH.getPoint(t, pos);
  B_PATH.getTangent(Math.min(t, 0.999), dir);
  return pos;
}

/** Beam strength 0..1 and window light 0..1 at descent progress p. */
export const beamAt = (p: number) => smooth(DIVE.beam[0], DIVE.beam[1], p) * (1 - smooth(DIVE.beam[2], DIVE.beam[3], p));
export const litAt = (p: number) => smooth(DIVE.lit[0], DIVE.lit[1], p);
/** Whiteout 0..1 (the frame fully clouded at the swap). */
export const whiteAt = (p: number) => smooth(DIVE.white[0], DIVE.white[1], p) * (1 - smooth(DIVE.white[2], DIVE.white[3], p));

/** World position of a campus-local point. */
export const campusToWorld = (p: THREE.Vector3, out = new THREE.Vector3()) => out.copy(p).add(CAMPUS);
