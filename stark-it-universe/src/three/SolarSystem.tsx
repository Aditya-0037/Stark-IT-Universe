import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { journey } from '../lib/journey';
import { pointer } from '../lib/pointer';
import { Orbit } from './Orbit';
import { Planet } from './Planet';
import { Star } from './Star';
import { ORBITS, PLANET_COLORS, orbitMatrix, orbitPoint, shared } from './system';

const TAU = Math.PI * 2;

/**
 * The SIU star with five service planets on tilted elliptical orbits.
 * Inner planets move faster; planets pass behind and in front of the star.
 * The system leans slightly toward the cursor. Orbits slow almost to a stop
 * while the visitor reads the service cards, and stop under Reduce Motion.
 */
export function SolarSystem({ reduced }: { reduced: boolean }) {
  const lean = useRef<THREE.Group>(null);
  const planets = useRef<(THREE.Group | null)[]>([]);
  const matrices = useMemo(() => ORBITS.map(orbitMatrix), []);
  const tmp = useMemo(() => new THREE.Vector3(), []);

  useFrame((_, dt) => {
    const step = Math.min(dt, 0.1);
    const inPlanets = journey.toPlanets * (1 - journey.toRoute);
    const speed = reduced ? 0 : 1 - 0.9 * inPlanets;
    shared.orbitTime += step * speed;

    const g = lean.current;
    if (g) {
      const on = !reduced && pointer.active;
      const tx = on ? -pointer.y * 0.07 : 0;
      const ty = on ? pointer.x * 0.1 : 0;
      const k = 1 - Math.exp(-step * 2.5);
      g.rotation.x += (tx - g.rotation.x) * k;
      g.rotation.y += (ty - g.rotation.y) * k;
    }

    ORBITS.forEach((o, i) => {
      const p = planets.current[i];
      if (!p) return;
      orbitPoint(o, o.phase + (shared.orbitTime * TAU) / o.period, tmp).applyMatrix4(matrices[i]);
      p.position.copy(tmp);
      p.getWorldPosition(shared.planets[i]);
    });
  }, -3);

  return (
    <group ref={lean}>
      <Star reduced={reduced} />
      {ORBITS.map((o, i) => (
        <Orbit key={`orbit-${i}`} def={o} index={i} color={PLANET_COLORS[i]} />
      ))}
      {ORBITS.map((o, i) => (
        <Planet
          key={`planet-${i}`}
          ref={(el) => {
            planets.current[i] = el;
          }}
          index={i}
          def={o}
          reduced={reduced}
        />
      ))}
    </group>
  );
}
