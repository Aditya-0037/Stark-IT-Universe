import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { stage } from '../stage';
import { rng } from './builder';

/**
 * The cloud layers the camera falls through on the way down, plus a thin
 * sea of clouds below the campus. Each puff is a camera-facing quad (the
 * billboarding happens in the vertex shader, so no per-frame matrix work)
 * with a soft noise texture. Puffs are warm on top and blue-shaded
 * underneath, fade out as the camera gets close (so the screen never fills
 * with one flat white) and fade into the haze far away.
 * All positions are campus-local.
 */

/**
 * Four puff shapes in one 256 x 256 texture. Alpha is the density; red is
 * the light on a soft "height field" of overlapping blobs, lit from above
 * (so each puff reads as a rounded, sunlit lump).
 */
function* puffAtlasSteps(): Generator<void, THREE.DataTexture> {
  const size = 256;
  const cell = 128;
  const data = new Uint8Array(size * size * 4);
  const r = rng(91);
  const grid = 10;
  const G = grid + 1;
  const noise = new Float32Array(G * G * 4).map(() => r());
  const vnoise = (u: number, v: number, k: number) => {
    const x = u * grid;
    const y = v * grid;
    const i = Math.min(grid - 1, x | 0);
    const j = Math.min(grid - 1, y | 0);
    const fx = x - i;
    const fy = y - j;
    const sx = fx * fx * (3 - 2 * fx);
    const sy = fy * fy * (3 - 2 * fy);
    const o = k * G * G + j * G + i;
    const a = noise[o] * (1 - sx) + noise[o + 1] * sx;
    const b = noise[o + G] * (1 - sx) + noise[o + G + 1] * sx;
    return a * (1 - sy) + b * sy;
  };
  // light from the upper left, towards the viewer
  const ll = Math.hypot(0.35, 0.75, 0.55);
  const lx = -0.35 / ll;
  const ly = -0.75 / ll;
  const lz = 0.55 / ll;
  const dens = new Float32Array(cell * cell);
  for (let v = 0; v < 4; v++) {
    const ox = (v % 2) * cell;
    const oy = Math.floor(v / 2) * cell;
    const blobs: number[] = [];
    for (let k = 0; k < 9; k++) {
      const x = 0.5 + (r() - 0.5) * 0.5;
      blobs.push(x, 0.5 + (r() - 0.5) * 0.24 - (0.25 - Math.abs(x - 0.5)) * 0.3, 0.11 + r() * 0.11);
    }
    // density on the grid once, then light from its slope
    for (let py = 0; py < cell; py++) {
      const w = (py + 0.5) / cell; // 0 = top row
      for (let px = 0; px < cell; px++) {
        const u = (px + 0.5) / cell;
        let d = 0;
        for (let k = 0; k < blobs.length; k += 3) {
          const rad = blobs[k + 2];
          const dx = (u - blobs[k]) / rad;
          const dy = (w - blobs[k + 1]) / (rad * (w > blobs[k + 1] ? 0.65 : 1)); // flatter base
          d += Math.exp(-(dx * dx + dy * dy) * 1.6);
        }
        dens[py * cell + px] = d;
      }
    }
    yield;
    const at = (x: number, y: number) => dens[(y < 0 ? 0 : y >= cell ? cell - 1 : y) * cell + (x < 0 ? 0 : x >= cell ? cell - 1 : x)];
    for (let py = 0; py < cell; py++) {
      const w = (py + 0.5) / cell;
      for (let px = 0; px < cell; px++) {
        const u = (px + 0.5) / cell;
        const d = at(px, py);
        const nx = -(at(px + 1, py) - at(px - 1, py)) * 2.5;
        const ny = -(at(px, py + 1) - at(px, py - 1)) * 2.5;
        const dot = (nx * lx + ny * ly + lz) / Math.sqrt(nx * nx + ny * ny + 1);
        const nz = vnoise(u, w, v) * 0.65 + vnoise((u * 2) % 1, (w * 2) % 1, (v + 1) % 4) * 0.35;
        const edge = Math.max(0, Math.min(1, u * 10, (1 - u) * 10, w * 10, (1 - w) * 10));
        const t = Math.min(1, Math.max(0, (d - nz * 0.35 - 0.18) / 0.57));
        const a = t * t * (3 - 2 * t) * edge;
        const lit = Math.min(1, Math.max(0, 0.5 + dot * 0.8)) * 0.85 + nz * 0.15;
        const i = ((oy + py) * size + ox + px) * 4;
        const l = Math.round(lit * 255);
        data[i] = l;
        data[i + 1] = l;
        data[i + 2] = l;
        data[i + 3] = Math.round(a * 255);
      }
    }
    yield;
  }
  const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  tex.flipY = false;
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.needsUpdate = true;
  return tex;
}

interface Puff {
  x: number;
  y: number;
  z: number;
  size: number;
  rot: number;
  variant: number;
  base: number;
}

/**
 * Cumulus banks (domes of puffs, flat underneath) in three layers around
 * the camera's way down, with gaps between them; a wide outer ring for the
 * horizon; and a thin sea of clouds far below the campus island.
 */
let cachedPuffs: Puff[] | null = null;
function makePuffs(): Puff[] {
  const r = rng(314);
  const puffs: Puff[] = [];
  const layers = [
    { y: 150, banks: 24, r0: 0, r1: 78, R: [11, 19], cx: 8, cz: 36 },
    { y: 128, banks: 22, r0: 0, r1: 70, R: [10, 17], cx: 11, cz: 44 },
    { y: 110, banks: 18, r0: 0, r1: 62, R: [9, 15], cx: 14, cz: 52 },
    { y: 150, banks: 20, r0: 110, r1: 330, R: [18, 30], cx: 0, cz: 0 }, // horizon
    { y: -34, banks: 16, r0: 70, r1: 230, R: [22, 36], cx: 0, cz: 0 }, // below the island
  ];
  for (const L of layers) {
    for (let k = 0; k < L.banks; k++) {
      const a = r() * Math.PI * 2;
      const d = L.r0 + Math.sqrt(r()) * (L.r1 - L.r0);
      const bx = L.cx + Math.cos(a) * d;
      const bz = L.cz + Math.sin(a) * d;
      const R = L.R[0] + r() * (L.R[1] - L.R[0]);
      const n = 7 + Math.floor(r() * 6);
      for (let i = 0; i < n; i++) {
        const pa = r() * Math.PI * 2;
        const t = Math.sqrt(r());
        const lift = (1 - t * t) * R * 0.5 * (0.5 + 0.5 * r());
        const size = R * (0.62 + r() * 0.3) * (1 - 0.35 * t);
        puffs.push({
          x: bx + Math.cos(pa) * t * R,
          y: L.y + lift,
          z: bz + Math.sin(pa) * t * R * 0.8,
          size,
          rot: (r() - 0.5) * 0.4,
          variant: Math.floor(r() * 4),
          base: L.y - R * 0.12,
        });
      }
    }
  }
  return puffs;
}

const vertex = /* glsl */ `
  attribute vec3 aCenter;
  attribute vec4 aData; // size, rotation, atlas cell, bank base height
  uniform float uOpacity;
  uniform float uDown;
  varying vec2 vUv;
  varying float vAlpha;
  varying float vHeight;
  varying float vHaze;
  void main() {
    vec4 mvCenter = modelViewMatrix * vec4(aCenter, 1.0);
    float size = aData.x;
    float c = cos(aData.y);
    float s = sin(aData.y);
    vec2 p = position.xy;
    vec2 q = vec2(c * p.x - s * p.y, s * p.x + c * p.y) * vec2(size, size * 0.78);
    vec4 mv = mvCenter;
    mv.xy += q;
    gl_Position = projectionMatrix * mv;
    float cell = aData.z;
    vUv = vec2(mod(cell, 2.0), floor(cell / 2.0)) * 0.5 + vec2(p.x + 0.5, 0.5 - p.y) * 0.5;
    float dist = length(mvCenter.xyz);
    // gone before the camera reaches it, faded into haze far away
    float nearFade = smoothstep(size * 0.35, size * 1.15, dist);
    float farFade = 1.0 - smoothstep(460.0, 590.0, dist);
    vAlpha = uOpacity * nearFade * farFade;
    float h = clamp((aCenter.y - aData.w) / (size * 0.6), 0.0, 1.0);
    // seen from above the tops show; from the side, light top, blue base
    vHeight = mix(h * 0.6 + (p.y + 0.5) * 0.4, 0.55 + h * 0.45, uDown);
    vHaze = smoothstep(160.0, 480.0, dist);
  }
`;

const fragment = /* glsl */ `
  uniform sampler2D uMap;
  uniform vec3 uUnder;
  uniform vec3 uMid;
  uniform vec3 uTop;
  uniform vec3 uHaze;
  varying vec2 vUv;
  varying float vAlpha;
  varying float vHeight;
  varying float vHaze;
  void main() {
    vec4 t = texture2D(uMap, vUv);
    float a = t.a * vAlpha;
    if (a < 0.004) discard;
    float s = clamp(vHeight * 0.45 + t.r * 0.75 - 0.15, 0.0, 1.0);
    vec3 col = mix(uUnder, uMid, smoothstep(0.0, 0.55, s));
    col = mix(col, uTop, smoothstep(0.5, 1.0, s));
    col = mix(col, uHaze, vHaze * 0.6);
    gl_FragColor = vec4(col, a);
  }
`;

// Cloud colours through the sky phases: night, dawn (warm tops), morning.
const PHASES = [
  { under: new THREE.Color('#141E48'), mid: new THREE.Color('#25356E'), top: new THREE.Color('#3A4C88') },
  { under: new THREE.Color('#4A5A9A'), mid: new THREE.Color('#9A9CC8'), top: new THREE.Color('#F4C29A') },
  { under: new THREE.Color('#9DB0D4'), mid: new THREE.Color('#E3E9F4'), top: new THREE.Color('#FBF0DE') },
];
const HAZE = new THREE.Color('#E9E6E4');

let shared: { tex: THREE.DataTexture; mat: THREE.ShaderMaterial } | null = null;

/** Prepares the puffs, texture and material in small steps (idle time). */
export function* prepareCloudSteps(): Generator<void, void> {
  cachedPuffs ??= makePuffs();
  yield;
  if (shared) return;
  const tex = yield* puffAtlasSteps();
  shared = { tex, mat: makeCloudMaterial(tex) };
}

function cloudMaterial() {
  if (!shared) {
    const steps = prepareCloudSteps();
    while (!steps.next().done);
  }
  return shared!;
}

function makeCloudMaterial(tex: THREE.DataTexture) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uMap: { value: tex },
      uOpacity: { value: 0 },
      uDown: { value: 1 },
      uUnder: { value: new THREE.Color() },
      uMid: { value: new THREE.Color() },
      uTop: { value: new THREE.Color() },
      uHaze: { value: HAZE },
    },
    vertexShader: vertex,
    fragmentShader: fragment,
    transparent: true,
    depthWrite: false,
    fog: false,
  });
}

export function CloudLayers() {
  const camera = useThree((s) => s.camera);
  const puffs = useMemo(() => (cachedPuffs ??= makePuffs()), []);
  const geo = useMemo(() => {
    const g = new THREE.InstancedBufferGeometry();
    const quad = new THREE.PlaneGeometry(1, 1);
    g.index = quad.index;
    g.setAttribute('position', quad.getAttribute('position'));
    g.setAttribute('aCenter', new THREE.InstancedBufferAttribute(new Float32Array(puffs.length * 3), 3));
    g.setAttribute('aData', new THREE.InstancedBufferAttribute(new Float32Array(puffs.length * 4), 4));
    g.instanceCount = puffs.length;
    return g;
  }, [puffs]);
  const { tex, mat } = useMemo(cloudMaterial, []);
  // Unmounting frees the GPU buffers and the texture; the material (and so
  // its compiled shader) is kept, so coming back up never recompiles.
  useEffect(
    () => () => {
      geo.dispose();
      tex.dispose();
    },
    [geo, tex],
  );

  // Back-to-front order for the soft alpha blending, re-sorted when the camera moves.
  const order = useMemo(() => puffs.map((_, i) => i), [puffs]);
  const last = useRef(new THREE.Vector3(Infinity, 0, 0));
  const local = useMemo(() => new THREE.Vector3(), []);
  const fwd = useMemo(() => new THREE.Vector3(), []);
  const group = useRef<THREE.Group>(null);
  const dist = useMemo(() => new Float32Array(puffs.length), [puffs]);

  useFrame(() => {
    const g = group.current;
    if (!g) return;
    const visible = stage.clouds;
    g.visible = visible;
    if (!visible) return;
    const sky = stage.sky;
    const u = mat.uniforms;
    const a = sky < 0.5 ? PHASES[0] : PHASES[1];
    const b = sky < 0.5 ? PHASES[1] : PHASES[2];
    const f = THREE.MathUtils.smoothstep(sky < 0.5 ? sky * 2 : sky * 2 - 1, 0, 1);
    (u.uUnder.value as THREE.Color).copy(a.under).lerp(b.under, f);
    (u.uMid.value as THREE.Color).copy(a.mid).lerp(b.mid, f);
    (u.uTop.value as THREE.Color).copy(a.top).lerp(b.top, f);
    u.uOpacity.value = stage.cloudOpacity;
    camera.getWorldDirection(fwd);
    u.uDown.value = THREE.MathUtils.clamp(-fwd.y * 1.4 - 0.2, 0, 1);

    g.worldToLocal(local.copy(camera.position));
    if (local.distanceToSquared(last.current) < 0.25) return;
    last.current.copy(local);
    for (let i = 0; i < puffs.length; i++) {
      const p = puffs[i];
      dist[i] = (p.x - local.x) ** 2 + (p.y - local.y) ** 2 + (p.z - local.z) ** 2;
    }
    order.sort((a, b) => dist[b] - dist[a]);
    const c = geo.getAttribute('aCenter') as THREE.InstancedBufferAttribute;
    const d = geo.getAttribute('aData') as THREE.InstancedBufferAttribute;
    order.forEach((idx, k) => {
      const p = puffs[idx];
      c.setXYZ(k, p.x, p.y, p.z);
      d.setXYZW(k, p.size, p.rot, p.variant, p.base);
    });
    c.needsUpdate = true;
    d.needsUpdate = true;
  });

  return (
    <group ref={group} visible={false}>
      <mesh geometry={geo} material={mat} frustumCulled={false} renderOrder={1} />
    </group>
  );
}
