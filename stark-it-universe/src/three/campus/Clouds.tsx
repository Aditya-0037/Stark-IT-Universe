import { Cloud, Clouds } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { descentCameraAt } from '../CameraRig';
import { DIVE, whiteAt } from '../dive';
import { CAMPUS, stage } from '../stage';
import { rng } from './builder';

/**
 * The cloud deck the camera falls into behind the satellite (drei <Clouds>,
 * one instanced draw for all of it): three layers of a few big clouds, warm
 * white on top (#FFF7EC) and cool blue underneath (#B8C6E0), that dissolve
 * as the camera passes through them (fade distance), plus three clouds
 * right on the camera's path that sweep past the lens. Inside the deck the
 * frame whites out completely (a cloudy full-screen veil): that is where
 * space swaps to the campus. Positions are campus-local.
 */
const TOP = '#FFF7EC';
const UNDER = '#B8C6E0';
const VEIL = new THREE.Color('#E3E8F1');

/** A soft, billowy cloud puff (white, density in alpha, lighter on top) as a data URL for drei's loader. */
let puffUrl: string | null = null;
export function* prepareCloudSteps(): Generator<void, void> {
  if (puffUrl) return;
  const size = 256;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d')!;
  const img = g.createImageData(size, size);
  const r = rng(91);
  const G = 12;
  const grid = new Float32Array((G + 1) * (G + 1) * 3).map(() => r());
  const vnoise = (u: number, v: number, o: number) => {
    const x = u * G;
    const y = v * G;
    const i = Math.min(G - 1, x | 0);
    const j = Math.min(G - 1, y | 0);
    const fx = x - i;
    const fy = y - j;
    const sx = fx * fx * (3 - 2 * fx);
    const sy = fy * fy * (3 - 2 * fy);
    const k = o * (G + 1) * (G + 1) + j * (G + 1) + i;
    const a = grid[k] * (1 - sx) + grid[k + 1] * sx;
    const b = grid[k + G + 1] * (1 - sx) + grid[k + G + 2] * sx;
    return a * (1 - sy) + b * sy;
  };
  // a few overlapping round lumps, flatter underneath
  const lumps = [
    [0.5, 0.52, 0.3],
    [0.33, 0.58, 0.2],
    [0.67, 0.57, 0.21],
    [0.43, 0.42, 0.2],
    [0.6, 0.4, 0.18],
  ];
  for (let y = 0; y < size; y++) {
    const v = (y + 0.5) / size;
    for (let x = 0; x < size; x++) {
      const u = (x + 0.5) / size;
      let d = 0;
      for (const [cx, cy, rad] of lumps) {
        const dx = (u - cx) / rad;
        const dy = (v - cy) / (rad * (v > cy ? 0.7 : 1));
        d = Math.max(d, 1 - Math.sqrt(dx * dx + dy * dy));
      }
      const n = vnoise(u, v, 0) * 0.6 + vnoise((u * 2.3) % 1, (v * 2.3) % 1, 1) * 0.3 + vnoise((u * 4.7) % 1, (v * 4.7) % 1, 2) * 0.1;
      // soft, billowy edge; nothing at all near the square's border (or its edges show as lines)
      const edge = Math.min(1, Math.max(0, Math.min(u, 1 - u, v, 1 - v) * 9 - 0.2));
      const body = Math.min(1, Math.max(0, d / 0.32));
      const a = Math.min(1, Math.max(0, body * (0.95 + (n - 0.5) * 0.7))) * edge * edge;
      const lit = 0.86 + 0.14 * (1 - v) - (n - 0.5) * 0.08;
      const i = (y * size + x) * 4;
      const l = Math.round(Math.min(1, lit) * 255);
      img.data[i] = l;
      img.data[i + 1] = l;
      img.data[i + 2] = l;
      img.data[i + 3] = Math.round(a * a * (3 - 2 * a) * 255);
    }
    if (y % 64 === 63) yield;
  }
  g.putImageData(img, 0, 0);
  puffUrl = c.toDataURL('image/png');
}

interface Bank {
  key: string;
  pos: [number, number, number];
  bounds: [number, number, number];
  volume: number;
  segments: number;
  color: string;
  fade: number;
  seed: number;
}

/** The deck: three layers of fewer, bigger clouds; each bank a warm top and a cool underside. */
function makeBanks(): Bank[] {
  const r = rng(314);
  const out: Bank[] = [];
  const layers = [
    { y: 158, count: 13, radius: 250, cx: 30, cz: 40, size: 52, volume: 44 },
    { y: 136, count: 9, radius: 180, cx: 50, cz: 70, size: 40, volume: 34 },
    { y: 121, count: 7, radius: 130, cx: 70, cz: 100, size: 30, volume: 26 },
  ];
  layers.forEach((L, li) => {
    for (let k = 0; k < L.count; k++) {
      const a = r() * Math.PI * 2;
      const d = Math.sqrt(r()) * L.radius;
      const x = L.cx + Math.cos(a) * d;
      const z = L.cz + Math.sin(a) * d;
      const s = L.size * (0.75 + r() * 0.5);
      const seed = Math.floor(r() * 1000);
      out.push({ key: `t${li}-${k}`, pos: [x, L.y + s * 0.1, z], bounds: [s * 0.7, s * 0.12, s * 0.7], volume: L.volume, segments: 10, color: TOP, fade: L.volume * 1.4, seed });
      out.push({ key: `u${li}-${k}`, pos: [x, L.y - s * 0.12, z], bounds: [s * 0.6, s * 0.05, s * 0.6], volume: L.volume * 0.85, segments: 5, color: UNDER, fade: L.volume * 1.4, seed: seed + 7 });
    }
  });
  // three clouds right on the camera's path: two above the deck, one inside it
  const cam = new THREE.Vector3();
  [
    [0.21, 1.6, -1.4],
    [0.3, -1.8, -1.2],
    [0.46, 2.4, -2.2],
  ].forEach(([p, side, down], i) => {
    descentCameraAt(p, cam).sub(CAMPUS);
    const big = p > DIVE.swap ? 2.4 : 1;
    out.push({ key: `lens${i}`, pos: [cam.x + side * big, cam.y + down * big, cam.z], bounds: [3 * big, 1.2 * big, 3 * big], volume: 5 * big, segments: 6, color: i === 2 ? UNDER : TOP, fade: 9 * big, seed: 50 + i });
  });
  return out;
}

const veilVertex = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy * 2.0, 0.0, 1.0);
  }
`;
const veilFragment = /* glsl */ `
  uniform float uAmount;
  uniform float uTime;
  uniform vec3 uColor;
  varying vec2 vUv;
  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
  }
  void main() {
    vec2 q = vUv * vec2(3.2, 2.0) + vec2(uTime * 0.04, uTime * 0.02);
    float n = noise(q) * 0.55 + noise(q * 2.1) * 0.3 + noise(q * 4.3) * 0.15;
    // as it thins, it opens in cloudy holes rather than as a flat fade
    float a = smoothstep(0.0, 0.3, uAmount * 1.4 - n * 0.4);
    gl_FragColor = vec4(uColor * (0.95 + 0.08 * n), a);
  }
`;

export function CloudLayers({ reduced }: { reduced: boolean }) {
  const banks = useMemo(makeBanks, []);
  const group = useRef<THREE.Group>(null);
  const clouds = useRef<THREE.Group>(null);
  const material = useRef<THREE.Material | null>(null);
  const veil = useMemo(() => {
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(1, 1),
      new THREE.ShaderMaterial({
        uniforms: { uAmount: { value: 0 }, uTime: { value: 0 }, uColor: { value: VEIL } },
        vertexShader: veilVertex,
        fragmentShader: veilFragment,
        transparent: true,
        depthTest: false,
        depthWrite: false,
        fog: false,
      }),
    );
    m.frustumCulled = false;
    m.renderOrder = 9999;
    m.visible = false;
    return m;
  }, []);
  useEffect(
    () => () => {
      veil.geometry.dispose();
      (veil.material as THREE.Material).dispose();
    },
    [veil],
  );

  useFrame((_, dt) => {
    const g = group.current;
    if (!g) return;
    g.visible = stage.clouds;
    if (!material.current && clouds.current) {
      clouds.current.traverse((o) => {
        if ((o as THREE.InstancedMesh).isInstancedMesh) material.current = (o as THREE.InstancedMesh).material as THREE.Material;
      });
    }
    if (material.current) material.current.opacity = stage.cloudOpacity;
    const w = reduced ? 0 : whiteAt(stage.descent);
    veil.visible = stage.clouds && w > 0.002;
    const u = (veil.material as THREE.ShaderMaterial).uniforms;
    u.uAmount.value = w;
    u.uTime.value += Math.min(dt, 0.1);
  });

  return (
    <group ref={group} visible={false}>
      <Clouds ref={clouds} material={THREE.MeshBasicMaterial} texture={puffUrl!} limit={480} frustumCulled={false}>
        {banks.map((b) => (
          <Cloud
            key={b.key}
            position={b.pos}
            bounds={b.bounds}
            volume={b.volume}
            segments={b.segments}
            color={b.color}
            fade={b.fade}
            seed={b.seed}
            speed={reduced ? 0 : 0.06}
            growth={b.volume * 0.12}
            concentrate="inside"
          />
        ))}
      </Clouds>
      <primitive object={veil} />
    </group>
  );
}
