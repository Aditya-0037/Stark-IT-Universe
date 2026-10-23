import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { beamAt, diveCampus, SCALE_B, WINDOW_POINT } from '../dive';
import { Satellite } from '../Satellite';
import { stage } from '../stage';

/**
 * The satellite over the campus (campus-local): it comes out of the cloud
 * deck ahead of the camera, flies to the school, hovers in front of one
 * first-floor window and shines its gold light on it (a soft beam and a
 * warm spot on the wall); the window glows from then on (TargetWindow).
 * It rises away before the camera glides in to that window.
 */
const beamVertex = /* glsl */ `
  varying float vAlong;
  varying vec3 vN;
  varying vec3 vV;
  void main() {
    vAlong = position.y;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vN = normalize(normalMatrix * normal);
    vV = normalize(-mv.xyz);
    gl_Position = projectionMatrix * mv;
  }
`;
const beamFragment = /* glsl */ `
  uniform float uAmount;
  uniform vec3 uColor;
  varying float vAlong;
  varying vec3 vN;
  varying vec3 vV;
  void main() {
    // bright down the middle of the cone, soft at its edges
    float facing = abs(dot(normalize(vN), normalize(vV)));
    float a = facing * facing * uAmount * (0.3 + 0.7 * smoothstep(0.0, 0.2, vAlong)) * (1.0 - 0.35 * vAlong);
    gl_FragColor = vec4(uColor, a * 0.85);
  }
`;

function spotTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d')!;
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, 'rgba(255,214,140,0.9)');
  grad.addColorStop(0.45, 'rgba(255,181,46,0.35)');
  grad.addColorStop(1, 'rgba(255,181,46,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

const UP = new THREE.Vector3(0, 1, 0);

export function DiveSatellite({ reduced }: { reduced: boolean }) {
  const sat = useRef<THREE.Group>(null);
  const parts = useMemo(() => {
    const cone = new THREE.CylinderGeometry(1.35, 0.3, 1, 28, 1, true);
    cone.translate(0, 0.5, 0);
    const beam = new THREE.Mesh(
      cone,
      new THREE.ShaderMaterial({
        uniforms: { uAmount: { value: 0 }, uColor: { value: new THREE.Color(1.7, 1.08, 0.26) } },
        vertexShader: beamVertex,
        fragmentShader: beamFragment,
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        fog: false,
      }),
    );
    beam.frustumCulled = false;
    beam.renderOrder = 5;
    const tex = spotTexture();
    const spotGeo = new THREE.PlaneGeometry(9, 7);
    spotGeo.rotateY(Math.PI / 2); // on the facade, facing +x
    const spot = new THREE.Mesh(
      spotGeo,
      new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false, opacity: 0 }),
    );
    spot.position.copy(WINDOW_POINT).add(new THREE.Vector3(0.06, 0, 0));
    spot.renderOrder = 5;
    return { beam, spot, tex, cone, spotGeo };
  }, []);
  useEffect(
    () => () => {
      parts.cone.dispose();
      parts.spotGeo.dispose();
      parts.tex.dispose();
      (parts.beam.material as THREE.Material).dispose();
      (parts.spot.material as THREE.Material).dispose();
    },
    [parts],
  );

  const tmp = useMemo(() => ({ pos: new THREE.Vector3(), dir: new THREE.Vector3(), to: new THREE.Vector3(), q: new THREE.Quaternion() }), []);

  useFrame((state) => {
    const s = sat.current;
    if (!s) return;
    // Reduce Motion: the campus still shows it hovering, its light on the window
    const d = reduced ? (stage.still === 'campus' ? 0.68 : -1) : stage.descent;
    const show = stage.campus && d >= 0 && d < 0.86;
    s.visible = show;
    parts.beam.visible = false;
    parts.spot.visible = false;
    if (!show) return;
    const { pos, dir, to, q } = tmp;
    diveCampus(d, pos, dir);
    if (!reduced) pos.y += Math.sin(state.clock.elapsedTime * 1.6) * 0.18;
    s.position.copy(pos);
    s.scale.setScalar(SCALE_B);
    // flying: nose along its path; lighting the window: turned to face it
    const b = beamAt(d);
    to.subVectors(WINDOW_POINT, pos).normalize();
    dir.lerp(to, Math.min(1, b * 1.5)).normalize();
    s.lookAt(to.copy(pos).add(dir));

    if (b > 0.002) {
      parts.beam.visible = true;
      parts.spot.visible = true;
      to.subVectors(WINDOW_POINT, pos);
      const len = to.length();
      parts.beam.position.copy(pos);
      parts.beam.quaternion.copy(q.setFromUnitVectors(UP, to.normalize()));
      parts.beam.scale.set(1, len, 1);
      (parts.beam.material as THREE.ShaderMaterial).uniforms.uAmount.value = b;
      (parts.spot.material as THREE.MeshBasicMaterial).opacity = b;
    }
  });

  return (
    <group>
      <Satellite ref={sat} />
      <primitive object={parts.beam} />
      <primitive object={parts.spot} />
    </group>
  );
}
