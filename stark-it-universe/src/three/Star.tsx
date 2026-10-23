import { Billboard } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { pointer } from '../lib/pointer';
import { STAR_RADIUS } from './system';
import { glowTexture, siuLabelTexture } from './textures';

const vertexShader = /* glsl */ `
  varying vec3 vPos;
  varying vec3 vNormal;
  varying vec3 vView;
  void main() {
    vPos = position;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vNormal = normalize(normalMatrix * normal);
    vView = normalize(-mv.xyz);
    gl_Position = projectionMatrix * mv;
  }
`;

const fragmentShader = /* glsl */ `
  uniform float uTime;
  uniform float uIntensity;
  uniform vec3 uHot;
  uniform vec3 uGold;
  uniform vec3 uDeep;
  varying vec3 vPos;
  varying vec3 vNormal;
  varying vec3 vView;

  float hash(vec3 p) {
    p = fract(p * 0.3183099 + 0.1);
    p *= 17.0;
    return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
  }
  float noise(vec3 x) {
    vec3 i = floor(x);
    vec3 f = fract(x);
    f = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(mix(hash(i), hash(i + vec3(1, 0, 0)), f.x), mix(hash(i + vec3(0, 1, 0)), hash(i + vec3(1, 1, 0)), f.x), f.y),
      mix(mix(hash(i + vec3(0, 0, 1)), hash(i + vec3(1, 0, 1)), f.x), mix(hash(i + vec3(0, 1, 1)), hash(i + vec3(1, 1, 1)), f.x), f.y),
      f.z);
  }
  float fbm(vec3 p) {
    float v = 0.0;
    float a = 0.5;
    for (int i = 0; i < 5; i++) {
      v += a * noise(p);
      p *= 2.03;
      a *= 0.5;
    }
    return v;
  }

  void main() {
    vec3 p = vPos * 1.35;
    float n = fbm(p + vec3(0.0, uTime * 0.07, uTime * 0.04));
    float n2 = fbm(p * 2.6 - vec3(uTime * 0.09, 0.0, uTime * 0.05));
    float t = clamp(n * 0.75 + n2 * 0.45 - 0.05, 0.0, 1.0);
    vec3 col = mix(uDeep, uGold, smoothstep(0.25, 0.6, t));
    col = mix(col, uHot, smoothstep(0.62, 0.9, t));
    // clamp: dot() can round to just above 1, and pow() of a negative base is NaN
    float fres = pow(clamp(1.0 - dot(normalize(vNormal), normalize(vView)), 0.0, 1.0), 2.2);
    col += fres * uGold * 0.9;
    gl_FragColor = vec4(col * uIntensity, 1.0);
  }
`;

function starShape(points: number, outer: number, inner: number) {
  const s = new THREE.Shape();
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 === 0 ? outer : inner;
    const a = (i / (points * 2)) * Math.PI * 2 + Math.PI / 2;
    if (i === 0) s.moveTo(Math.cos(a) * r, Math.sin(a) * r);
    else s.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  s.closePath();
  return s;
}

/**
 * The SIU star: an animated plasma sphere (bright enough to bloom), a gold
 * corona echoing the logo's rays, a soft glow that leans toward the cursor,
 * and "SIU" lettering that always faces the camera.
 */
export function Star({ reduced }: { reduced: boolean }) {
  const group = useRef<THREE.Group>(null);
  const corona = useRef<THREE.Mesh>(null);
  const glow = useRef<THREE.Sprite>(null);
  const labelMat = useRef<THREE.MeshBasicMaterial>(null);
  const glowMat = useRef<THREE.SpriteMaterial>(null);
  const haloMat = useRef<THREE.SpriteMaterial>(null);
  const [label, setLabel] = useState<THREE.Texture | null>(null);

  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: {
          uTime: { value: 0 },
          uIntensity: { value: 1.55 },
          uHot: { value: new THREE.Color('#FFF1C9') },
          uGold: { value: new THREE.Color('#FFB52E') },
          uDeep: { value: new THREE.Color('#F08A00') },
        },
        vertexShader,
        fragmentShader,
      }),
    [],
  );
  const coronaGeo = useMemo(() => new THREE.ShapeGeometry(starShape(16, STAR_RADIUS * 1.36, STAR_RADIUS * 1.08)), []);
  const glowMap = useMemo(() => glowTexture(), []);

  useEffect(() => {
    let alive = true;
    siuLabelTexture().then((t) => alive && setLabel(t));
    return () => {
      alive = false;
    };
  }, []);

  useFrame((state, dt) => {
    if (!reduced) material.uniforms.uTime.value += dt;
    // Close to the star (planet close-ups) the lettering and the big glow
    // fade, so the star never washes over the whole frame.
    const dist = state.camera.position.length();
    if (labelMat.current) labelMat.current.opacity = THREE.MathUtils.smoothstep(dist, 7, 11);
    const near = THREE.MathUtils.smoothstep(dist, 5, 13);
    if (glowMat.current) glowMat.current.opacity = 0.75 * near;
    if (haloMat.current) haloMat.current.opacity = 0.14 * near;
    if (corona.current && !reduced) corona.current.rotation.z += dt * 0.05;
    if (glow.current) {
      const tx = !reduced && pointer.active ? pointer.x * 0.45 : 0;
      const ty = !reduced && pointer.active ? pointer.y * 0.3 : 0;
      const k = 1 - Math.exp(-dt * 3);
      glow.current.position.x += (tx - glow.current.position.x) * k;
      glow.current.position.y += (ty - glow.current.position.y) * k;
    }
  }, -2);

  return (
    <group ref={group}>
      <sprite ref={glow} scale={[11, 11, 1]}>
        <spriteMaterial
          ref={glowMat}
          map={glowMap}
          color={[1.1, 0.62, 0.12]}
          transparent
          opacity={0.75}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </sprite>
      <sprite scale={[18, 18, 1]}>
        <spriteMaterial
          ref={haloMat}
          map={glowMap}
          color={[0.7, 0.45, 0.12]}
          transparent
          opacity={0.14}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </sprite>
      <Billboard>
        <mesh ref={corona} geometry={coronaGeo} position={[0, 0, -0.02]}>
          {/* above 1.0 so it passes the bloom threshold */}
          <meshBasicMaterial color={[2.0, 1.02, 0.14]} />
        </mesh>
      </Billboard>
      <mesh material={material}>
        <sphereGeometry args={[STAR_RADIUS, 64, 48]} />
      </mesh>
      <Billboard>
        {label && (
          <mesh position={[0, -0.02, STAR_RADIUS + 0.04]}>
            <planeGeometry args={[2.3, 1.15]} />
            <meshBasicMaterial ref={labelMat} map={label} transparent depthWrite={false} />
          </mesh>
        )}
      </Billboard>
    </group>
  );
}
