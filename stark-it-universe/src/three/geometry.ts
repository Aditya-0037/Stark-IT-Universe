import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/** An axis-aligned box given by two corners [x0, y0, z0, x1, y1, z1]. */
export type BoxSpec = [number, number, number, number, number, number];

/**
 * Merges many boxes into one geometry, so static furniture that shares a
 * material costs a single draw call.
 */
export function mergedBoxes(boxes: BoxSpec[]): THREE.BufferGeometry {
  const parts = boxes.map(([x0, y0, z0, x1, y1, z1]) => {
    const g = new THREE.BoxGeometry(Math.abs(x1 - x0), Math.abs(y1 - y0), Math.abs(z1 - z0));
    g.translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
    return g;
  });
  const merged = mergeGeometries(parts, false)!;
  parts.forEach((p) => p.dispose());
  return merged;
}

/** A polyline tube (used for CAT-6 cables). */
export function cableTube(points: [number, number, number][], radius = 0.045) {
  const path = new THREE.CurvePath<THREE.Vector3>();
  for (let i = 0; i < points.length - 1; i++) {
    path.add(new THREE.LineCurve3(new THREE.Vector3(...points[i]), new THREE.Vector3(...points[i + 1])));
  }
  return new THREE.TubeGeometry(path as unknown as THREE.Curve<THREE.Vector3>, points.length * 8, radius, 6, false);
}
