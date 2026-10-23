import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import palette from '../../art/palette.json';
import { stage } from '../stage';
import { Builder, place, rgb, rng } from './builder';
import { contactShadowTexture } from './trees';
import { busGeometry } from './school';

/**
 * Morning life on and around the campus: one yellow school bus drives along
 * the main road and in through the gate to the bus lane; an auto-rickshaw
 * passes on the main road (another waits by the gate); a few students in
 * uniform (stylised capsules, no faces) walk across the assembly ground and
 * up the drive. Each has a soft blob shadow (the sun's shadow map is static).
 * Reduce Motion: everything stands still.
 */
const S = palette.surface;

function autoGeometry() {
  const b = new Builder();
  const green = rgb(S.autoGreen[1]);
  const yellow = rgb(S.busYellow[1]);
  const black = rgb(S.slate[2]);
  const tyre = rgb('#23262B');
  // floor pan and lower body (front narrower), canopy, wind screen
  b.box(-0.62, 0.32, -1.25, 0.62, 0.95, 0.55, green, { skip: ['ny'] });
  b.box(-0.42, 0.32, 0.55, 0.42, 1.0, 1.25, green, { skip: ['ny'] });
  b.box(-0.66, 1.62, -1.32, 0.66, 1.78, 0.75, yellow, { skip: ['ny'] });
  b.box(-0.6, 0.95, -1.28, 0.6, 1.62, -1.2, black);
  b.box(-0.04, 0.95, -1.22, 0.04, 1.62, 0.5, black);
  b.box(-0.5, 1.05, 0.68, 0.5, 1.62, 0.74, rgb(S.glass[0]));
  b.box(-0.06, 0.95, 0.7, 0.06, 1.62, 0.76, black);
  const wheel = new THREE.CylinderGeometry(0.27, 0.27, 0.18, 10, 1);
  wheel.rotateZ(Math.PI / 2);
  for (const [x, z] of [[-0.6, -0.85], [0.6, -0.85], [0, 1.0]]) b.add(wheel, place(x, 0.27, z), tyre);
  wheel.dispose();
  return b.build();
}

function studentGeometry() {
  const b = new Builder();
  const shirt = rgb(palette.brand.paper[1]);
  const trousers = rgb(S.slate[1]);
  const skin = rgb(S.skin[1]);
  const bag = rgb(palette.brand.universeBlue[1]);
  const body = new THREE.CapsuleGeometry(0.21, 0.72, 3, 8);
  b.add(body, place(0, 0.57, 0), (p) => (p.y > 0.62 ? shirt : trousers));
  body.dispose();
  const head = new THREE.IcosahedronGeometry(0.17, 1);
  b.add(head, place(0, 1.2, 0), skin);
  head.dispose();
  b.box(-0.16, 0.62, -0.32, 0.16, 1.0, -0.17, bag);
  return b.build();
}

/** The bus route: main road (driving on the left), left turn in through the gate, the bus lane. */
const BUS_PATH = new THREE.CatmullRomCurve3(
  [
    [-125, 41.8],
    [-60, 41.8],
    [-14, 41.8],
    [-5.5, 41.2],
    [-0.6, 37.6],
    [0, 32],
    [0, 27],
    [0, 24.6],
    [-3.6, 23],
    [-8, 23],
    [-10.5, 23],
  ].map(([x, z]) => new THREE.Vector3(x, 0.05, z)),
  false,
  'centripetal',
);
const BUS_TIME = 16; // seconds from first sight to the stop

const STUDENTS = 16;
/** Ping-pong walks: assembly ground, the drive, the cross path. */
const WALKS: [number, number, number, number][] = [
  [-11, -9, 9, 2],
  [-10, 3, 8, -11],
  [-6, -13, 6, 3],
  [10.5, -6, -9, -1],
  [-1, 4.4, -1, -12],
  [1.4, 4, 1.4, -8],
  [-9, -4, 10, -4],
  [0.8, 26.5, 0.8, 9],
  [-0.9, 25, -0.9, 9.5],
  [0.4, 21, 0.4, 7.4],
  [-24, 7, -4, 7],
  [22, 6.6, 3, 6.6],
  [-14, 38.6, -11, 38.6],
  [-5, -2, 5, -7],
  [7, 1, -7, -9],
  [-12.5, 0, -2, -13],
];

export function Life({ reduced, material }: { reduced: boolean; material: THREE.Material }) {
  const parts = useMemo(() => {
    const blobTex = contactShadowTexture();
    const blobMat = new THREE.MeshBasicMaterial({ map: blobTex, color: '#241B2E', transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 });
    const blobGeo = new THREE.PlaneGeometry(1, 1);
    blobGeo.rotateX(-Math.PI / 2);
    const bus = new THREE.Mesh(busGeometry(), material);
    const busBlob = new THREE.Mesh(blobGeo, blobMat);
    busBlob.scale.set(3.6, 1, 10.4);
    const autoGeo = autoGeometry();
    const auto = new THREE.Mesh(autoGeo, material);
    const parked = new THREE.Mesh(autoGeo, material);
    parked.position.set(9, 0.05, 39.2);
    parked.rotation.y = Math.PI / 2;
    const autoBlob = new THREE.Mesh(blobGeo, blobMat);
    autoBlob.scale.set(2, 1, 3.4);
    const parkedBlob = autoBlob.clone();
    parkedBlob.position.set(9, 0.11, 39.2);
    parkedBlob.rotation.y = Math.PI / 2;
    const students = new THREE.InstancedMesh(studentGeometry(), material, STUDENTS);
    const studentBlobs = new THREE.InstancedMesh(blobGeo, blobMat, STUDENTS);
    const r = rng(8);
    const walkers = WALKS.map(([x0, z0, x1, z1]) => ({ x0, z0, x1, z1, len: Math.hypot(x1 - x0, z1 - z0), speed: 1.05 + r() * 0.35, phase: r() * 100, s: 1.1 + r() * 0.15 }));
    for (const m of [bus, auto, parked, students]) {
      m.castShadow = false;
      m.receiveShadow = true;
    }
    for (const m of [busBlob, autoBlob, parkedBlob, studentBlobs]) m.renderOrder = -1;
    students.frustumCulled = false;
    studentBlobs.frustumCulled = false;
    return { bus, busBlob, auto, parked, autoBlob, parkedBlob, students, studentBlobs, walkers, blobTex, blobMat, blobGeo, autoGeo };
  }, [material]);

  useEffect(
    () => () => {
      parts.bus.geometry.dispose();
      parts.autoGeo.dispose();
      parts.students.geometry.dispose();
      parts.students.dispose();
      parts.studentBlobs.dispose();
      parts.blobGeo.dispose();
      parts.blobTex.dispose();
      parts.blobMat.dispose();
    },
    [parts],
  );

  const clock = useRef({ bus: 0, t: 0, was: false });
  const tmp = useMemo(() => ({ p: new THREE.Vector3(), d: new THREE.Vector3(), m: new THREE.Matrix4(), q: new THREE.Quaternion(), s: new THREE.Vector3(), up: new THREE.Vector3(0, 1, 0) }), []);

  useFrame((_, dt) => {
    if (!stage.campus) {
      clock.current.was = false;
      return;
    }
    const c = clock.current;
    const step = reduced ? 0 : Math.min(dt, 0.1);
    // the bus sets off when the campus comes into view (again)
    if (!c.was) c.bus = reduced ? BUS_TIME * 0.7 : 0;
    c.was = true;
    c.bus += step;
    c.t += step;
    const { p, d, m, q, s, up } = tmp;

    // bus: slows down for the turn and stops in the lane
    const u = Math.min(1, c.bus / BUS_TIME);
    const e = 1 - Math.pow(1 - u, 2.2);
    BUS_PATH.getPointAt(e, p);
    BUS_PATH.getTangentAt(Math.min(e, 0.999), d);
    parts.bus.position.copy(p);
    parts.bus.rotation.y = Math.atan2(d.x, d.z);
    parts.busBlob.position.set(p.x, 0.11, p.z);
    parts.busBlob.rotation.y = parts.bus.rotation.y;

    // auto-rickshaw: along the main road, out of the haze and back into it
    const ax = 600 - ((c.t * 9 + 520) % 1100);
    parts.auto.position.set(ax, 0.05, 45.4);
    parts.auto.rotation.y = -Math.PI / 2;
    parts.autoBlob.position.set(ax, 0.11, 45.4);
    parts.autoBlob.rotation.y = -Math.PI / 2;

    // students: walk to and fro (a small bob in the step)
    parts.walkers.forEach((w, i) => {
      const t = (c.t * w.speed + w.phase) % (w.len * 2);
      const back = t > w.len;
      const f = back ? 2 - t / w.len : t / w.len;
      const x = w.x0 + (w.x1 - w.x0) * f;
      const z = w.z0 + (w.z1 - w.z0) * f;
      const dir = Math.atan2((w.x1 - w.x0) * (back ? -1 : 1), (w.z1 - w.z0) * (back ? -1 : 1));
      const bob = reduced ? 0 : Math.abs(Math.sin(c.t * 7 + w.phase)) * 0.06;
      q.setFromAxisAngle(up, dir);
      m.compose(p.set(x, 0.05 + bob, z), q, s.setScalar(w.s));
      parts.students.setMatrixAt(i, m);
      m.compose(p.set(x, 0.11, z), q, s.set(0.9, 1, 0.9));
      parts.studentBlobs.setMatrixAt(i, m);
    });
    parts.students.instanceMatrix.needsUpdate = true;
    parts.studentBlobs.instanceMatrix.needsUpdate = true;
  });

  return (
    <group>
      <primitive object={parts.bus} />
      <primitive object={parts.busBlob} />
      <primitive object={parts.auto} />
      <primitive object={parts.autoBlob} />
      <primitive object={parts.parked} />
      <primitive object={parts.parkedBlob} />
      <primitive object={parts.students} />
      <primitive object={parts.studentBlobs} />
    </group>
  );
}
