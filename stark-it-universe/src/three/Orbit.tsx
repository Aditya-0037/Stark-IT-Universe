import { Line } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import type { Line2 } from 'three/examples/jsm/lines/Line2.js';
import { activeIndex, journey, PLANET_COUNT } from '../lib/journey';
import { orbitPoint, type OrbitDef } from './system';

const ORBIT_BLUE = new THREE.Color('#6F86FF');

/** A tilted elliptical orbit line. Brightens in its planet's colour when active. */
export function Orbit({ def, index, color }: { def: OrbitDef; index: number; color: string }) {
  const line = useRef<Line2>(null);
  const points = useMemo(() => {
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i <= 160; i++) pts.push(orbitPoint(def, (i / 160) * Math.PI * 2));
    return pts;
  }, [def]);
  const planetColor = useMemo(() => new THREE.Color(color), [color]);
  const level = useRef(0);

  useFrame((_, dt) => {
    const mat = line.current?.material;
    if (!mat) return;
    const inPlanets = journey.toPlanets > 0.6 && journey.toRoute < 0.35;
    const active = inPlanets && activeIndex(journey.planets, PLANET_COUNT) === index ? 1 : 0;
    level.current += (active - level.current) * (1 - Math.exp(-dt * 5));
    mat.opacity = 0.3 + level.current * 0.6;
    mat.color.copy(ORBIT_BLUE).lerp(planetColor, level.current);
  }, -2);

  return (
    <group rotation={[def.tiltX, 0, def.tiltZ]}>
      <Line
        ref={line}
        points={points}
        color="#6F86FF"
        lineWidth={1.2}
        transparent
        opacity={0.3}
        depthWrite={false}
        dashed={index % 2 === 1}
        dashSize={0.25}
        gapSize={0.18}
      />
    </group>
  );
}
