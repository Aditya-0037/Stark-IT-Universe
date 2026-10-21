import { RoundedBox } from '@react-three/drei';
import { forwardRef, useMemo } from 'react';
import * as THREE from 'three';
import { ModelOr } from './models';

function panelTexture() {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 80;
  const g = c.getContext('2d')!;
  g.fillStyle = '#2442D6';
  g.fillRect(0, 0, 128, 80);
  g.strokeStyle = '#93ACFF';
  g.lineWidth = 3;
  for (let x = 0; x <= 128; x += 32) {
    g.beginPath();
    g.moveTo(x, 0);
    g.lineTo(x, 80);
    g.stroke();
  }
  g.beginPath();
  g.moveTo(0, 40);
  g.lineTo(128, 40);
  g.stroke();
  g.strokeRect(1.5, 1.5, 125, 77);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/**
 * The SIU satellite (original design): a rounded gold body with two small
 * solar panels and an antenna. Its local +Z axis is "forward".
 * Swap in public/models/satellite.glb to replace it.
 */
export const Satellite = forwardRef<THREE.Group>(function Satellite(_, ref) {
  const panelMap = useMemo(() => panelTexture(), []);
  return (
    <group ref={ref}>
      <ModelOr name="satellite" scale={0.6}>
        <RoundedBox args={[0.42, 0.52, 0.42]} radius={0.13} smoothness={4}>
          <meshStandardMaterial color="#FFB52E" metalness={0.35} roughness={0.35} emissive="#FFB52E" emissiveIntensity={0.12} />
        </RoundedBox>
        <mesh position={[0, -0.06, 0]}>
          <boxGeometry args={[0.435, 0.07, 0.435]} />
          <meshStandardMaterial color="#F08A00" metalness={0.3} roughness={0.4} />
        </mesh>
        <mesh position={[0, 0.08, 0.215]}>
          <circleGeometry args={[0.085, 24]} />
          <meshStandardMaterial color="#0B1640" roughness={0.2} metalness={0.4} />
        </mesh>
        {[-1, 1].map((side) => (
          <group key={side} position={[side * 0.21, 0, 0]}>
            <mesh position={[side * 0.08, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
              <cylinderGeometry args={[0.025, 0.025, 0.16, 8]} />
              <meshStandardMaterial color="#B9C4EE" metalness={0.6} roughness={0.3} />
            </mesh>
            <mesh position={[side * 0.47, 0, 0]}>
              <boxGeometry args={[0.62, 0.025, 0.36]} />
              <meshStandardMaterial
                map={panelMap}
                metalness={0.2}
                roughness={0.35}
                emissive="#3152F5"
                emissiveIntensity={0.35}
              />
            </mesh>
          </group>
        ))}
        <mesh position={[0, 0.33, 0]}>
          <cylinderGeometry args={[0.012, 0.012, 0.16, 6]} />
          <meshStandardMaterial color="#FFB52E" />
        </mesh>
        <mesh position={[0, 0.42, 0]}>
          <sphereGeometry args={[0.035, 12, 8]} />
          <meshBasicMaterial color={[2.2, 1.7, 0.9]} />
        </mesh>
      </ModelOr>
    </group>
  );
});
