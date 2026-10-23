import { Billboard } from '@react-three/drei';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import { forwardRef, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { services } from '../content/services';
import { activeIndex, journey, PLANET_COUNT } from '../lib/journey';
import { scrollToId } from '../lib/scroll';
import { ModelOr } from './models';
import { stage } from './stage';
import type { OrbitDef } from './system';
import { serviceIcon } from '../components/Icons';
import type { ServiceIconName } from '../components/iconShapes';
import { shared } from './system';
import { overText } from '../lib/textZones';
import { planetIconTexture, planetLabelTexture, planetTexture, ringTexture } from './textures';

const atmosphereVertex = /* glsl */ `
  varying vec3 vN;
  varying vec3 vV;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vN = normalize(normalMatrix * normal);
    vV = normalize(-mv.xyz);
    gl_Position = projectionMatrix * mv;
  }
`;
const atmosphereFragment = /* glsl */ `
  uniform vec3 uColor;
  uniform float uOpacity;
  varying vec3 vN;
  varying vec3 vV;
  void main() {
    float f = pow(clamp(1.0 - dot(normalize(vN), normalize(vV)), 0.0, 1.0), 2.6);
    gl_FragColor = vec4(uColor * f * 1.4, f * uOpacity);
  }
`;

/** A ring geometry with radial UVs (u runs from inner to outer edge). */
function radialRing(inner: number, outer: number) {
  const geo = new THREE.RingGeometry(inner, outer, 128, 1);
  const pos = geo.attributes.position;
  const uv = geo.attributes.uv;
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    uv.setXY(i, (v.length() - inner) / (outer - inner), 0.5);
  }
  return geo;
}


/** Only react to clicks on empty 3D areas, never through HTML panels. */
export const isPassthrough = (e: ThreeEvent<MouseEvent | PointerEvent>) =>
  !!(e.nativeEvent.target as Element | null)?.closest?.('[data-3d-passthrough]');

interface Props {
  index: number;
  def: OrbitDef;
  reduced: boolean;
}

const LABEL_H = 0.5;
const labelPos = new THREE.Vector3();
const camUp = new THREE.Vector3();

/**
 * One service planet, with its service icon on the face and its name below,
 * both always facing the camera while it orbits. The name fades out in the
 * planet close-ups (the service card names it there). Click (or the HTML
 * tab twin) jumps to its card. Swap in a real model by adding
 * public/models/planet-<service id>.glb.
 */
export const Planet = forwardRef<THREE.Group, Props>(function Planet({ index, def, reduced }, ref) {
  const service = services[index];
  const body = useRef<THREE.Group>(null);
  const highlight = useRef<THREE.Mesh>(null);
  const hlMat = useRef<THREE.MeshBasicMaterial>(null);
  const labelMat = useRef<THREE.MeshBasicMaterial>(null);
  const iconTex = useMemo(() => planetIconTexture(serviceIcon[service.id] as ServiceIconName), [service.id]);
  const label = useMemo(() => planetLabelTexture(service.shortName), [service.shortName]);

  const map = useMemo(() => planetTexture(service.color, index + 1), [service.color, index]);
  const ringGeo = useMemo(() => (def.ring ? radialRing(def.size * 1.45, def.size * 2.3) : null), [def]);
  const ringMap = useMemo(() => (def.ring ? ringTexture() : null), [def.ring]);
  const atmosphere = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: { uColor: { value: new THREE.Color(service.color) }, uOpacity: { value: 0.9 } },
        vertexShader: atmosphereVertex,
        fragmentShader: atmosphereFragment,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    [service.color],
  );
  const hdr = useMemo(() => new THREE.Color(service.color).multiplyScalar(2.2), [service.color]);

  const avoid = useRef(1);
  useFrame((state, dt) => {
    if (body.current && !reduced) body.current.rotation.y += dt * (0.25 - index * 0.03);
    if (labelMat.current) {
      const p = shared.planets[index];
      const dist = state.camera.position.distanceTo(p);
      // never over copy: fade where the label would sit over a text panel
      labelPos.copy(p).addScaledVector(camUp.set(0, 1, 0).applyQuaternion(state.camera.quaternion), -(def.size * 1.65 + LABEL_H / 2)).project(state.camera);
      const sx = ((labelPos.x + 1) / 2) * state.size.width;
      const sy = ((1 - labelPos.y) / 2) * state.size.height;
      const target = overText(sx, sy, 24) ? 0 : 1;
      avoid.current += (target - avoid.current) * (1 - Math.exp(-dt * 12));
      // ... and gone once the satellite dives away from the system
      labelMat.current.opacity = THREE.MathUtils.smoothstep(dist, def.size * 9, def.size * 15) * avoid.current * (1 - THREE.MathUtils.smoothstep(stage.descent, 0, 0.03));
    }

    // Highlight ring on the planet whose card is showing.
    const inPlanets = journey.toPlanets > 0.6 && journey.toRoute < 0.35;
    const active = inPlanets && activeIndex(journey.planets, PLANET_COUNT) === index;
    if (hlMat.current && highlight.current) {
      const target = active ? 0.95 : 0;
      const k = 1 - Math.exp(-dt * 6);
      hlMat.current.opacity += (target - hlMat.current.opacity) * k;
      const s = 1 + (1 - hlMat.current.opacity) * 0.25;
      highlight.current.scale.setScalar(s);
      highlight.current.visible = hlMat.current.opacity > 0.01;
    }
  }, -2);

  const onClick = (e: ThreeEvent<MouseEvent>) => {
    if (!isPassthrough(e)) return;
    e.stopPropagation();
    scrollToId(`service-${service.id}`);
  };
  const onOver = (e: ThreeEvent<PointerEvent>) => {
    if (!isPassthrough(e)) return;
    document.documentElement.classList.add('cursor-3d');
  };
  const onOut = () => document.documentElement.classList.remove('cursor-3d');

  return (
    <group ref={ref}>
      <group>
        <group ref={body} rotation={[0.35, 0, 0.12]} onClick={onClick} onPointerOver={onOver} onPointerOut={onOut}>
          <ModelOr name={`planet-${service.id}`} scale={def.size}>
            <mesh>
              <sphereGeometry args={[def.size, 48, 32]} />
              <meshStandardMaterial
                map={map}
                roughness={0.82}
                metalness={0}
                emissive={service.color}
                emissiveIntensity={0.07}
              />
            </mesh>
          </ModelOr>
        </group>
        {ringGeo && (
          <mesh geometry={ringGeo} rotation={[Math.PI / 2 - 0.35, 0.1, 0]} onClick={onClick}>
            <meshBasicMaterial map={ringMap} color="#C9F7E4" transparent side={THREE.DoubleSide} depthWrite={false} />
          </mesh>
        )}
        <mesh material={atmosphere} scale={1.16}>
          <sphereGeometry args={[def.size, 32, 24]} />
        </mesh>
        <Billboard>
          {/* service icon on the planet's face (kept below the bloom threshold) */}
          <mesh position={[0, 0, def.size * 1.02]}>
            <planeGeometry args={[def.size * 1.15, def.size * 1.15]} />
            <meshBasicMaterial map={iconTex} color={[0.92, 0.92, 0.92]} transparent depthWrite={false} />
          </mesh>
          {/* service name below the planet */}
          <mesh position={[0, -(def.size * 1.65 + LABEL_H / 2), 0]}>
            <planeGeometry args={[LABEL_H * label.aspect, LABEL_H]} />
            <meshBasicMaterial
              ref={labelMat}
              map={label.texture}
              color={[0.92, 0.92, 0.92]}
              transparent
              depthWrite={false}
            />
          </mesh>
          <mesh ref={highlight} visible={false}>
            <torusGeometry args={[def.size * 1.5, 0.014, 8, 128]} />
            <meshBasicMaterial ref={hlMat} color={hdr} transparent opacity={0} depthWrite={false} />
          </mesh>
        </Billboard>
      </group>
    </group>
  );
});
