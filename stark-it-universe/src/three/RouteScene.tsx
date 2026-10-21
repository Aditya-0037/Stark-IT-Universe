import { useFrame, type ThreeEvent } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { activeIndex, dwell, journey, STATION_COUNT } from '../lib/journey';
import { scrollToId } from '../lib/scroll';
import { isPassthrough } from './Planet';
import { Satellite } from './Satellite';
import { shared } from './system';

/**
 * The orbit route: an outer orbit arcing across the front of the system,
 * with five stations (Consult, Demo, Install, Train, Support). The gold
 * satellite travels along it with scroll; the active station glows.
 */
function buildRoute() {
  const pts: THREE.Vector3[] = [];
  const R = 9.6;
  for (let i = 0; i <= 64; i++) {
    const t = i / 64;
    const a = THREE.MathUtils.degToRad(152 - 124 * t);
    pts.push(new THREE.Vector3(Math.cos(a) * R, Math.sin(t * Math.PI * 2) * 0.6, Math.sin(a) * R * 0.9 + 0.6));
  }
  return new THREE.CatmullRomCurve3(pts);
}

export const ROUTE = buildRoute();
export const STATION_POINTS = Array.from({ length: STATION_COUNT }, (_, i) => ROUTE.getPointAt(i / (STATION_COUNT - 1)));
export const ROUTE_CENTER = new THREE.Vector3(0, 0, 6);

const BLUE = new THREE.Color('#6F86FF');
const GOLD_HDR = new THREE.Color(2.4, 1.35, 0.22);
const GOLD = new THREE.Color('#FFB52E');

const smoothstep = (a: number, b: number, x: number) => THREE.MathUtils.smoothstep(x, a, b);

export function RouteScene({ reduced }: { reduced: boolean }) {
  const group = useRef<THREE.Group>(null);
  const sat = useRef<THREE.Group>(null);
  const stations = useRef<(THREE.Group | null)[]>([]);
  const satU = useRef(0);
  const tmp = useMemo(() => new THREE.Vector3(), []);

  const tube = useMemo(() => new THREE.TubeGeometry(ROUTE, 360, 0.03, 8, false), []);
  const progress = useMemo(() => new THREE.TubeGeometry(ROUTE, 360, 0.055, 8, false), []);
  const baseMat = useMemo(
    () => new THREE.MeshBasicMaterial({ color: BLUE, transparent: true, opacity: 0, depthWrite: false }),
    [],
  );
  const progMat = useMemo(
    () => new THREE.MeshBasicMaterial({ color: GOLD_HDR, transparent: true, opacity: 0, depthWrite: false }),
    [],
  );
  const stationMats = useMemo(
    () =>
      STATION_POINTS.map(() => ({
        core: new THREE.MeshBasicMaterial({ color: BLUE.clone(), transparent: true }),
        halo: new THREE.MeshBasicMaterial({ color: BLUE.clone(), transparent: true, depthWrite: false }),
      })),
    [],
  );

  useFrame((state, dt) => {
    const g = group.current;
    if (!g) return;
    const vis = smoothstep(0.12, 0.85, journey.toRoute);
    g.visible = vis > 0.002;
    if (!g.visible) return;

    const f = reduced ? activeIndex(journey.route, STATION_COUNT) : dwell(journey.route, STATION_COUNT);
    const target = f / (STATION_COUNT - 1);
    satU.current = reduced ? target : satU.current + (target - satU.current) * (1 - Math.exp(-dt * 6));
    const u = THREE.MathUtils.clamp(satU.current, 0, 1);

    baseMat.opacity = vis * 0.55;
    progMat.opacity = vis;
    const idx = progress.index!.count;
    progress.setDrawRange(0, Math.floor((idx * u) / 3) * 3);

    // satellite
    const s = sat.current;
    if (s) {
      ROUTE.getPointAt(u, tmp);
      const bob = reduced ? 0 : Math.sin(state.clock.elapsedTime * 2) * 0.05;
      s.position.set(tmp.x, tmp.y + 0.42 + bob, tmp.z);
      ROUTE.getTangentAt(Math.min(u, 0.999), shared.satelliteTangent);
      s.lookAt(tmp.add(shared.satelliteTangent).setY(s.position.y));
      s.scale.setScalar(vis * 1.4);
      s.getWorldPosition(shared.satellite);
    }

    // stations
    const active = Math.round(f);
    stations.current.forEach((st, i) => {
      if (!st) return;
      const m = stationMats[i];
      const isActive = i === active;
      const passed = i < f - 0.01;
      const col = isActive ? GOLD_HDR : passed ? GOLD : BLUE;
      const k = 1 - Math.exp(-dt * 8);
      m.core.color.lerp(col, k);
      m.halo.color.lerp(col, k);
      m.core.opacity = vis;
      m.halo.opacity = vis * (isActive ? 0.9 : 0.4);
      const sc = isActive ? 1.45 : 1;
      st.scale.setScalar(st.scale.x + (sc - st.scale.x) * k);
    });
  }, -3);

  const onStation = (i: number) => (e: ThreeEvent<MouseEvent>) => {
    if (!isPassthrough(e)) return;
    e.stopPropagation();
    scrollToId(`station-${i + 1}`);
  };
  const onOver = (e: ThreeEvent<PointerEvent>) => {
    if (isPassthrough(e)) document.documentElement.classList.add('cursor-3d');
  };
  const onOut = () => document.documentElement.classList.remove('cursor-3d');

  return (
    <group ref={group} visible={false}>
      <mesh geometry={tube} material={baseMat} />
      <mesh geometry={progress} material={progMat} />
      {STATION_POINTS.map((p, i) => (
        <group
          key={i}
          ref={(el) => {
            stations.current[i] = el;
          }}
          position={p}
          onClick={onStation(i)}
          onPointerOver={onOver}
          onPointerOut={onOut}
        >
          <mesh material={stationMats[i].core}>
            <sphereGeometry args={[0.2, 24, 16]} />
          </mesh>
          <mesh material={stationMats[i].halo} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.46, 0.02, 8, 64]} />
          </mesh>
        </group>
      ))}
      <Satellite ref={sat} />
    </group>
  );
}
