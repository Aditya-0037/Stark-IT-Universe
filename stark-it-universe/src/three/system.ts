import * as THREE from 'three';
import { services } from '../content/services';

/**
 * Layout of the 3D solar system, plus positions shared between the
 * objects and the camera rig (updated every frame, read by the rig).
 */
export const STAR_RADIUS = 1.6;

export interface OrbitDef {
  radius: number;
  /** Minor/major ratio of the ellipse. */
  squash: number;
  /** Orbit plane tilt (radians). */
  tiltX: number;
  tiltZ: number;
  /** Seconds per orbit: inner planets are faster. */
  period: number;
  phase: number;
  size: number;
  ring?: boolean;
}

export const ORBITS: OrbitDef[] = [
  { radius: 3.3, squash: 0.92, tiltX: 0.16, tiltZ: -0.12, period: 16, phase: 2.6, size: 0.42 },
  { radius: 4.55, squash: 0.94, tiltX: -0.1, tiltZ: 0.14, period: 25, phase: 5.2, size: 0.52 },
  { radius: 5.8, squash: 0.93, tiltX: 0.22, tiltZ: 0.06, period: 35, phase: 3.6, size: 0.48 },
  { radius: 7.05, squash: 0.95, tiltX: -0.06, tiltZ: -0.2, period: 47, phase: 0.25, size: 0.56 },
  { radius: 8.3, squash: 0.94, tiltX: 0.12, tiltZ: 0.1, period: 61, phase: 4.4, size: 0.5, ring: true },
];

export const PLANET_COLORS = services.map((s) => s.color);

/** Matrix that places an orbit's local XZ plane in the system. */
export function orbitMatrix(o: OrbitDef) {
  return new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(o.tiltX, 0, o.tiltZ));
}

/** Local (untilted) position on an orbit at angle a. */
export function orbitPoint(o: OrbitDef, a: number, out = new THREE.Vector3()) {
  return out.set(Math.cos(a) * o.radius, 0, Math.sin(a) * o.radius * o.squash);
}

/** World positions, written by the scene each frame. */
export const shared = {
  planets: ORBITS.map(() => new THREE.Vector3()),
  satellite: new THREE.Vector3(),
  satelliteTangent: new THREE.Vector3(1, 0, 0),
  /** Orbit clock (seconds), slowed down while the visitor looks at planets. */
  orbitTime: 0,
};
