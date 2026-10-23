import { useFrame, useThree } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { stage } from './stage';
import { nebulaTexture } from './textures';

function rng(seed: number) {
  let s = seed;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

const starVertex = /* glsl */ `
  attribute float aSize;
  attribute float aPhase;
  attribute vec3 aColor;
  uniform float uTime;
  uniform float uPixelRatio;
  uniform float uTwinkle;
  uniform float uStretch;
  varying vec3 vColor;
  varying float vAlpha;
  varying vec2 vDir;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mv;
    float tw = 1.0 - uTwinkle * 0.5 * (0.5 + 0.5 * sin(uTime * (0.5 + aPhase * 1.6) + aPhase * 40.0));
    // While the camera starts to fall, stars streak away from the centre.
    float k = 1.0 + uStretch * 2.2;
    gl_PointSize = aSize * uPixelRatio * tw * (260.0 / -mv.z) * k;
    vec2 ndc = gl_Position.xy / max(gl_Position.w, 0.0001);
    vDir = normalize(ndc + vec2(0.0001));
    vColor = aColor;
    vAlpha = tw / sqrt(k);
  }
`;
const pointFragment = /* glsl */ `
  uniform float uOpacity;
  uniform float uStretch;
  varying vec3 vColor;
  varying float vAlpha;
  varying vec2 vDir;
  void main() {
    vec2 q = gl_PointCoord - 0.5;
    q.y = -q.y;
    float k = 1.0 + uStretch * 2.2;
    float along = dot(q, vDir);
    float across = dot(q, vec2(-vDir.y, vDir.x)) * k;
    float d = length(vec2(along, across));
    float a = 1.0 - smoothstep(0.0, 0.5, d);
    gl_FragColor = vec4(vColor, a * a * vAlpha * uOpacity);
  }
`;

/**
 * Far-away stars on a shell around the scene, plus soft nebula clouds.
 * Fades out (and streaks a little) as the camera dives toward the campus
 * (stage.stars, stage.stretch).
 */
export function Starfield({ reduced, count = 2200 }: { reduced: boolean; count?: number }) {
  const dpr = useThree((s) => s.viewport.dpr);
  const geo = useMemo(() => {
    const r = rng(11);
    const pos = new Float32Array(count * 3);
    const col = new Float32Array(count * 3);
    const size = new Float32Array(count);
    const phase = new Float32Array(count);
    const palette = [new THREE.Color('#ffffff'), new THREE.Color('#FFE3A8'), new THREE.Color('#BFD0FF')];
    for (let i = 0; i < count; i++) {
      const u = r() * 2 - 1;
      const th = r() * Math.PI * 2;
      const rad = 70 + r() * 130;
      const s = Math.sqrt(1 - u * u);
      pos.set([Math.cos(th) * s * rad, u * rad * 0.7, Math.sin(th) * s * rad], i * 3);
      const c = palette[r() > 0.82 ? 1 : r() > 0.75 ? 2 : 0];
      col.set([c.r, c.g, c.b], i * 3);
      size[i] = r() > 0.94 ? 3.4 + r() * 2 : 1.1 + r() * 1.6;
      phase[i] = r();
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('aColor', new THREE.BufferAttribute(col, 3));
    g.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
    g.setAttribute('aPhase', new THREE.BufferAttribute(phase, 1));
    return g;
  }, [count]);

  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: {
          uTime: { value: 0 },
          uPixelRatio: { value: dpr },
          uTwinkle: { value: reduced ? 0 : 1 },
          uOpacity: { value: 1 },
          uStretch: { value: 0 },
        },
        vertexShader: starVertex,
        fragmentShader: pointFragment,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    [],
  );
  mat.uniforms.uPixelRatio.value = dpr;
  mat.uniforms.uTwinkle.value = reduced ? 0 : 1;

  const nebulae = useMemo(
    () => [
      // tints over the brand night, kept faint so every night reads the same
      { pos: [70, 30, -150], scale: 170, color: '#3152F5', seed: 3, opacity: 0.17 },
      { pos: [-110, -10, -120], scale: 150, color: '#8B5CF6', seed: 7, opacity: 0.1 },
      { pos: [20, -60, -160], scale: 130, color: '#06B6D4', seed: 9, opacity: 0.07 },
      { pos: [-40, 70, 120], scale: 160, color: '#3152F5', seed: 5, opacity: 0.12 },
    ],
    [],
  );

  const group = useRef<THREE.Group>(null);
  const nebulaMats = useRef<(THREE.SpriteMaterial | null)[]>([]);

  useFrame((_, dt) => {
    mat.uniforms.uTime.value += dt;
    mat.uniforms.uOpacity.value = stage.stars;
    mat.uniforms.uStretch.value = reduced ? 0 : stage.stretch;
    if (group.current) group.current.visible = stage.stars > 0.005;
    nebulaMats.current.forEach((m, i) => {
      if (m) m.opacity = nebulae[i].opacity * stage.stars;
    });
  }, -2);

  return (
    <group ref={group}>
      <points geometry={geo} material={mat} frustumCulled={false} />
      {nebulae.map((n, i) => (
        <sprite key={n.seed} position={n.pos as [number, number, number]} scale={[n.scale, n.scale, 1]}>
          <spriteMaterial
            ref={(el) => {
              nebulaMats.current[i] = el;
            }}
            map={nebulaTexture(n.color, n.seed)}
            transparent
            opacity={n.opacity}
            depthWrite={false}
            blending={THREE.AdditiveBlending}
          />
        </sprite>
      ))}
    </group>
  );
}
