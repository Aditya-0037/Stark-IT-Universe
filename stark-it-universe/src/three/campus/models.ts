import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

/**
 * The CC0 Kenney models (public/models/<pack>/<pack>.glb, built by
 * scripts/models.mjs): one mesh per model, already re-coloured to the
 * palette as vertex colours, feet at y = 0. Loaded with the campus chunk.
 */
export type ModelName =
  | 'building-a'
  | 'building-b'
  | 'building-c'
  | 'building-d'
  | 'building-e'
  | 'building-h'
  | 'building-i'
  | 'building-k'
  | 'sedan'
  | 'van'
  | 'tree_tall'
  | 'tree_cone'
  | 'tree_default'
  | 'tree_oak'
  | 'tree_fat'
  | 'tree_plateau'
  | 'plant_bushLarge';

export type Models = Record<ModelName, THREE.BufferGeometry>;

const PACKS = ['kenney-city', 'kenney-cars', 'kenney-nature'];

let loading: Promise<Models> | null = null;

export function loadModels(): Promise<Models> {
  loading ??= Promise.all(
    PACKS.map((pack) => new GLTFLoader().loadAsync(`${import.meta.env.BASE_URL}models/${pack}/${pack}.glb`)),
  ).then((files) => {
    const out = {} as Models;
    for (const gltf of files) {
      gltf.scene.traverse((o) => {
        const mesh = o as THREE.Mesh;
        if (!mesh.isMesh) return;
        mesh.geometry.computeBoundingBox();
        out[mesh.name as ModelName] = mesh.geometry;
      });
    }
    return out;
  });
  return loading;
}

/** Footprint size (x, z) and height of a model at scale 1. */
export function modelSize(g: THREE.BufferGeometry) {
  const b = g.boundingBox!;
  return { w: b.max.x - b.min.x, d: b.max.z - b.min.z, h: b.max.y - b.min.y, cx: (b.max.x + b.min.x) / 2, cz: (b.max.z + b.min.z) / 2 };
}
