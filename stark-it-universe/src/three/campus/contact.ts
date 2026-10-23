import * as THREE from 'three';

/**
 * Contact shadows, drawn once: the footprint of everything that stands on
 * the ground (school wings, walls, parked buses, houses, cars, tree
 * crowns), blurred, on one transparent decal just above the ground. This is
 * what drei's <ContactShadows frames={1}> does, but from the plan instead of
 * a depth render from below (most models here have no bottom faces, and a
 * canvas texture survives the GPU parking of the campus).
 */
export interface Footprints {
  rects: { x: number; z: number; w: number; d: number; rot: number; k: number }[];
  discs: { x: number; z: number; r: number; k: number }[];
}

export const CONTACT = { size: 300, res: 1024 };

export function* contactShadowSteps(fp: Footprints): Generator<void, THREE.CanvasTexture> {
  const { size, res } = CONTACT;
  const c = document.createElement('canvas');
  c.width = c.height = res;
  const g = c.getContext('2d')!;
  const px = res / size;
  // Shapes are drawn far off the canvas; only their blurred shadow lands on it.
  const off = res * 4;
  g.shadowOffsetX = off;
  g.shadowOffsetY = 0;
  const toPx = (v: number) => (v + size / 2) * px;
  let n = 0;
  for (const r of fp.rects) {
    g.save();
    g.shadowColor = `rgba(0,0,0,${(0.62 * r.k).toFixed(3)})`;
    g.shadowBlur = Math.max(3, Math.min(r.w, r.d) * 0.22 * px);
    g.translate(toPx(r.x) - off, toPx(r.z));
    g.rotate(-r.rot);
    g.fillStyle = '#000';
    g.fillRect((-r.w / 2) * px, (-r.d / 2) * px, r.w * px, r.d * px);
    g.restore();
    if (++n % 120 === 0) yield;
  }
  for (const d of fp.discs) {
    g.shadowColor = `rgba(0,0,0,${(0.36 * d.k).toFixed(3)})`;
    g.shadowBlur = d.r * 0.7 * px;
    g.beginPath();
    g.arc(toPx(d.x) - off, toPx(d.z), d.r * 0.55 * px, 0, Math.PI * 2);
    g.fillStyle = '#000';
    g.fill();
    if (++n % 120 === 0) yield;
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.NoColorSpace;
  t.anisotropy = 4;
  return t;
}

/** The decal plane (campus-local, just above the ground and the paths). */
export function contactDecal(texture: THREE.Texture) {
  const geo = new THREE.PlaneGeometry(CONTACT.size, CONTACT.size);
  geo.rotateX(-Math.PI / 2);
  const mat = new THREE.MeshBasicMaterial({
    color: '#241B2E',
    alphaMap: texture,
    transparent: true,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -4,
    polygonOffsetUnits: -4,
  });
  // the canvas is black with the shadow in its alpha: use alpha as the alpha map's green
  mat.onBeforeCompile = (s) => {
    s.fragmentShader = s.fragmentShader.replace('#include <alphamap_fragment>', 'diffuseColor.a *= texture2D( alphaMap, vAlphaMapUv ).a;');
  };
  mat.customProgramCacheKey = () => 'siu-contact';
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.y = 0.1;
  mesh.renderOrder = -1;
  mesh.receiveShadow = false;
  return mesh;
}
