import * as THREE from 'three';

/**
 * Plan of the campus diorama, in campus units (about one metre), relative
 * to CAMPUS (stage.ts). y is up, the base top is y = 0, +z is the front
 * (main gate), +x is the right-hand side. A typical North Indian private
 * school: a three-storey U-shaped block with open verandas facing the
 * assembly ground, an entrance tower, a sports court, a bus bay and a
 * boundary wall with railings and an arched main gate.
 */
export const BASE = { x0: -38, x1: 38, z0: -30, z1: 30, r: 6 };
/** Boundary wall centre lines. */
export const WALL = { x: 36, z: 28, gate: 3.5 };

export const PLINTH = 0.45;
export const STOREY = 3.2;
/** Floor levels of the three storeys. */
export const FLOORS = [PLINTH, PLINTH + STOREY, PLINTH + 2 * STOREY];
export const ROOF = PLINTH + 3 * STOREY;
export const VERANDA = 2.5;

export interface Rect {
  x0: number;
  x1: number;
  z0: number;
  z1: number;
}

/** Wing footprints. Verandas face the assembly ground (the courtyard). */
export const BACK: Rect = { x0: -22, x1: 22, z0: -24, z1: -15 };
export const LEFT: Rect = { x0: -22, x1: -13, z0: -15, z1: 5 };
export const RIGHT: Rect = { x0: 13, x1: 22, z0: -15, z1: 5 };
export const TOWER: Rect & { top: number } = { x0: -3.5, x1: 3.5, z0: -17.5, z1: -12.5, top: ROOF + STOREY };

export const GROUND: Rect = { x0: -13, x1: 13, z0: -15, z1: 5 }; // assembly ground
export const STAGE_AREA: Rect = { x0: -4, x1: 4, z0: -12.5, z1: -9.6 };
export const CROSS_PATH: Rect = { x0: -34, x1: 34, z0: 5.8, z1: 8.2 };
export const DRIVE: Rect = { x0: -2.5, x1: 2.5, z0: 8.2, z1: 27.6 };
export const COURT: Rect = { x0: 9.5, x1: 27.5, z0: 11.5, z1: 21.5 };
export const BUS_BAY: Rect = { x0: -31, x1: -13, z0: 12, z1: 24 };
export const SIDE_PATH: Rect = { x0: 25, x1: 27, z0: -26, z1: 5.8 };
/** Lane from the gate to the bus bay. */
export const BUS_LANE: Rect = { x0: -13, x1: -2.5, z0: 21.6, z1: 24.4 };

/** Window sizes on the outer facades (one per 4 m bay). */
export const WIN = { w: 2.0, h: 1.5, sill: 0.95 };

/**
 * The glowing first-floor classroom window the camera flies into: right
 * wing, outer facade (x = 22, facing +x), middle bay.
 */
export const TARGET = {
  center: new THREE.Vector3(RIGHT.x1, FLOORS[1] + WIN.sill + WIN.h / 2, -5),
  normal: new THREE.Vector3(1, 0, 0),
  width: WIN.w,
  height: WIN.h,
};

/**
 * Areas trees must keep out of (plus their canopy radius): buildings,
 * courts, paths, the bus bay, and the corridor the camera flies through on
 * its way to the target window.
 */
export const NO_TREES: Rect[] = [
  { x0: BACK.x0 - 1, x1: BACK.x1 + 1, z0: BACK.z0 - 1, z1: BACK.z1 },
  { x0: LEFT.x0 - 1, x1: RIGHT.x1 + 1, z0: -15, z1: 5.6 },
  CROSS_PATH,
  { x0: DRIVE.x0 - 0.4, x1: DRIVE.x1 + 0.4, z0: DRIVE.z0, z1: 30 },
  { x0: COURT.x0 - 0.8, x1: COURT.x1 + 0.8, z0: COURT.z0 - 0.8, z1: COURT.z1 + 0.8 },
  { x0: BUS_BAY.x0 - 0.5, x1: BUS_BAY.x1, z0: BUS_BAY.z0 - 0.5, z1: BUS_BAY.z1 + 0.5 },
  SIDE_PATH,
  { x0: 22, x1: 40, z0: -12.5, z1: 2.5 }, // flight corridor to the target window
  BUS_LANE,
];

export const insideRect = (x: number, z: number, r: Rect, m = 0) =>
  x > r.x0 - m && x < r.x1 + m && z > r.z0 - m && z < r.z1 + m;
