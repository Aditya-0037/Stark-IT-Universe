import { useFrame, type ThreeEvent } from '@react-three/fiber';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import * as THREE from 'three';
import { en } from '../content/en';
import { classroom } from '../lib/classroomState';
import { activeIndex, HOTSPOT_COUNT, journey } from '../lib/journey';
import { useReducedMotion } from '../hooks/useReducedMotion';
import { scrollToId } from '../lib/scroll';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { cableTube, mergedBoxes, type BoxSpec } from './geometry';
import { ModelOr } from './models';
import { isPassthrough } from './Planet';
import { badgeTexture, boardTexture, screenTexture, slideTexture } from './roomTextures';
import { levels, refs, ROOM, stage } from './stage';

/**
 * The 3D classroom diorama (isometric, soft matte, low-poly), built from
 * primitives in room units (x along the front wall, y up, z into the room):
 *   interactive flat panel on the front wall, ceiling projector with a
 *   pull-down screen, desks with laptops, a desktop on the teacher's table,
 *   a network rack with CAT-6 cables along the walls, ceiling lamps.
 * Its lights, screens and windows follow the stage state (power, night) set
 * by the Classroom and Switch on scenes. In the Build scene each device
 * group springs in or out to match the configurator (stage.config).
 * Replace it with public/models/classroom.glb if you have a real model.
 */
export const DESK_X = [3.3, 6.1, 8.9];
export const DESK_Z = [4.0, 6.9];

/** Hotspot anchors (room-local), in the order of en.classroom.hotspots. */
export const HOTSPOT_ANCHORS: [number, number, number][] = [
  [6.45, 2.35, 0.5], // interactive flat panel
  [10.95, 5.45, 6.0], // projector
  [4.2, 2.4, 7.2], // laptops
  [1.5, 3.05, 1.85], // teacher's desktop
  [0.7, 3.2, 9.0], // network rack
];

const LENS = new THREE.Vector3(9.9, 4.95, 5.5);
const SHEET = { x0: 7.75, x1: 11.25, y0: 2.6, y1: 5.25, z: 0.07 };

function floorTexture() {
  const c = document.createElement('canvas');
  c.width = 480;
  c.height = 400;
  const g = c.getContext('2d')!;
  g.fillStyle = '#D9E0F2';
  g.fillRect(0, 0, 480, 400);
  g.strokeStyle = '#C6CEE7';
  g.lineWidth = 2;
  for (let x = 0; x <= 480; x += 40) {
    g.beginPath();
    g.moveTo(x, 0);
    g.lineTo(x, 400);
    g.stroke();
  }
  for (let y = 0; y <= 400; y += 40) {
    g.beginPath();
    g.moveTo(0, y);
    g.lineTo(480, y);
    g.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

function beamGeometry() {
  const c = [
    [SHEET.x0, SHEET.y1],
    [SHEET.x1, SHEET.y1],
    [SHEET.x1, SHEET.y0],
    [SHEET.x0, SHEET.y0],
  ].map(([x, y]) => new THREE.Vector3(x, y, SHEET.z + 0.01));
  const verts: number[] = [];
  for (let i = 0; i < 4; i++) {
    const a = c[i];
    const b = c[(i + 1) % 4];
    verts.push(LENS.x, LENS.y, LENS.z, a.x, a.y, a.z, b.x, b.y, b.z);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  return g;
}

const LAPTOP_SLOTS = DESK_X.length * DESK_Z.length;
const FIRST_LAPTOP = 7;
const DEVICE_COUNT = FIRST_LAPTOP + LAPTOP_SLOTS;

/** Scales its children about a point (`at`, room units) through `innerRef`. */
function Pivot({
  at,
  innerRef,
  children,
}: {
  at: [number, number, number];
  innerRef: (el: THREE.Group | null) => void;
  children: ReactNode;
}) {
  return (
    <group position={at}>
      <group ref={innerRef}>
        <group position={[-at[0], -at[1], -at[2]]}>{children}</group>
      </group>
    </group>
  );
}

/** Gold "AMC" shield badge. */
function amcBadgeTexture() {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 256;
  const g = c.getContext('2d')!;
  g.translate(128, 128);
  g.beginPath();
  g.moveTo(0, -100);
  g.lineTo(84, -66);
  g.lineTo(84, 6);
  g.bezierCurveTo(84, 60, 44, 92, 0, 112);
  g.bezierCurveTo(-44, 92, -84, 60, -84, 6);
  g.lineTo(-84, -66);
  g.closePath();
  g.fillStyle = '#FFB52E';
  g.fill();
  g.lineWidth = 10;
  g.strokeStyle = '#0B1640';
  g.stroke();
  g.fillStyle = '#0B1640';
  g.font = '800 50px Unbounded, "Arial Black", sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText('AMC', 0, 8);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function ClassroomModel() {
  const group = useRef<THREE.Group>(null);
  // the campus window draws this group (see campus/TargetWindow)
  useEffect(() => {
    refs.room = group.current;
    return () => {
      refs.room = null;
    };
  }, []);

  // ---- materials ------------------------------------------------------------
  const m = useMemo(
    () => ({
      wallFront: new THREE.MeshStandardMaterial({ color: '#EEF1FA', roughness: 0.95 }),
      wallLeft: new THREE.MeshStandardMaterial({ color: '#E1E7F6', roughness: 0.95 }),
      slab: new THREE.MeshStandardMaterial({ color: '#A9B4D6', roughness: 0.95 }),
      floor: new THREE.MeshStandardMaterial({ map: floorTexture(), roughness: 0.9 }),
      skirting: new THREE.MeshStandardMaterial({ color: '#C9D2EC', roughness: 0.9 }),
      white: new THREE.MeshStandardMaterial({ color: '#FFFFFF', roughness: 0.8 }),
      accent: new THREE.MeshStandardMaterial({ color: classroom.accent, roughness: 0.75 }),
      rug: new THREE.MeshStandardMaterial({ color: classroom.accent, roughness: 1, transparent: true, opacity: 0.16 }),
      wood: new THREE.MeshStandardMaterial({ color: '#F0DDB8', roughness: 0.85 }),
      woodDark: new THREE.MeshStandardMaterial({ color: '#D8BF93', roughness: 0.85 }),
      leg: new THREE.MeshStandardMaterial({ color: '#7E89AD', roughness: 0.6, metalness: 0.3 }),
      device: new THREE.MeshStandardMaterial({ color: '#1C2448', roughness: 0.5, metalness: 0.2 }),
      shell: new THREE.MeshStandardMaterial({ color: '#C9D0E3', roughness: 0.5, metalness: 0.3 }),
      light: new THREE.MeshStandardMaterial({ color: '#EEF1F9', roughness: 0.6 }),
      cable: new THREE.MeshStandardMaterial({ color: '#10B981', roughness: 0.5, transparent: true }),
      trunking: new THREE.MeshStandardMaterial({ color: '#BFC8E3', roughness: 0.9, transparent: true }),
      rack: new THREE.MeshStandardMaterial({ color: '#1F2A55', roughness: 0.6, metalness: 0.2 }),
      port: new THREE.MeshStandardMaterial({ color: '#8E9CCB', roughness: 0.5 }),
      plantPot: new THREE.MeshStandardMaterial({ color: '#D3DAEE', roughness: 0.9 }),
      leaf: new THREE.MeshStandardMaterial({ color: '#3FB984', roughness: 0.9, flatShading: true }),
      // things that glow (MeshBasic, HDR colour drives the bloom)
      glass: new THREE.MeshBasicMaterial({ color: '#BFE3FF' }),
      board: new THREE.MeshBasicMaterial({ map: boardTexture() }),
      screens: new THREE.MeshBasicMaterial({ map: screenTexture() }),
      sheet: new THREE.MeshStandardMaterial({ color: '#F2F4FA', roughness: 0.9, emissive: '#ffffff', emissiveIntensity: 0 }),
      slide: new THREE.MeshBasicMaterial({ transparent: true, opacity: 0 }),
      beam: new THREE.MeshBasicMaterial({
        color: '#E6F2FF',
        transparent: true,
        opacity: 0,
        depthWrite: false,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
      }),
      lamp: new THREE.MeshStandardMaterial({ color: '#E4E9F6', roughness: 0.6, emissive: '#FFE7BF', emissiveIntensity: 0 }),
      led: new THREE.MeshBasicMaterial({ color: '#7C88AE' }),
      ledGreen: new THREE.MeshBasicMaterial({ color: new THREE.Color(0.3, 2.2, 1.1) }),
    }),
    [],
  );

  useEffect(() => {
    let alive = true;
    slideTexture(en.switchOn.slideTitle, en.switchOn.slideSub).then((t) => {
      if (!alive) return;
      m.slide.map = t;
      m.slide.needsUpdate = true;
    });
    return () => {
      alive = false;
    };
  }, [m]);

  // ---- geometry -------------------------------------------------------------
  const g = useMemo(() => {
    const windows = [
      [2.2, 4.4],
      [5.6, 7.8],
    ];
    const frames: BoxSpec[] = [];
    for (const [z0, z1] of windows) {
      const zc = (z0 + z1) / 2;
      frames.push(
        [0, 2.3, z0 - 0.08, 0.1, 2.4, z1 + 0.08],
        [0, 4.8, z0 - 0.08, 0.1, 4.9, z1 + 0.08],
        [0, 2.4, z0 - 0.08, 0.1, 4.8, z0],
        [0, 2.4, z1, 0.1, 4.8, z1 + 0.08],
        [0, 2.4, zc - 0.03, 0.08, 4.8, zc + 0.03],
        [0, 3.57, z0, 0.08, 3.63, z1],
        [0, 2.22, z0 - 0.1, 0.26, 2.3, z1 + 0.1],
      );
    }
    frames.push([1.08, 4.68, 0.02, 1.92, 4.72, 0.05]); // (clock base hidden behind face)

    const legs: BoxSpec[] = [
      [0.55, 0, 1.55, 0.63, 1.33, 1.63],
      [2.37, 0, 1.55, 2.45, 1.33, 1.63],
      [3.6, 5.7, 4.55, 3.64, 6.4, 4.59], // lamp wires
      [9.36, 5.7, 4.55, 9.4, 6.4, 4.59],
      [3.6, 5.7, 7.45, 3.64, 6.4, 7.49],
      [9.36, 5.7, 7.45, 9.4, 6.4, 7.49],
    ];

    const cablePaths: [number, number, number][][] = [
      [
        [0.06, 0.12, 8.45],
        [0.06, 0.12, 0.06],
        [11.85, 0.12, 0.06],
      ],
      [
        [4.5, 0.12, 0.06],
        [4.5, 2.0, 0.06],
      ],
      [
        [11.85, 0.12, 0.06],
        [11.85, 5.95, 0.06],
      ],
      [
        [1.7, 0.12, 0.06],
        [1.7, 0.04, 0.06],
        [1.7, 0.04, 1.6],
      ],
      [
        [0.06, 0.12, 6.4],
        [0.06, 0.09, 6.4],
        [10.9, 0.09, 6.4],
      ],
      ...DESK_X.flatMap((dx) => [
        [
          [dx + 0.9, 0.04, 6.3],
          [dx + 0.9, 0.04, 5.0],
        ] as [number, number, number][],
        [
          [dx + 0.9, 0.04, 6.5],
          [dx + 0.9, 0.04, 7.0],
        ] as [number, number, number][],
      ]),
      [
        [0.7, 2.5, 8.9],
        [0.06, 2.5, 8.9],
        [0.06, 0.12, 8.9],
      ],
    ];
    const cableGeos = cablePaths.map((p) => cableTube(p));
    const ports: BoxSpec[] = [];
    const leds: BoxSpec[] = [];
    for (let r = 0; r < 5; r++) {
      const y = 2.25 - r * 0.42;
      for (let p = 0; p < 4; p++) ports.push([1.2, y - 0.04, 8.62 + p * 0.15, 1.24, y + 0.06, 8.72 + p * 0.15]);
      leds.push([1.2, y - 0.02, 9.3, 1.25, y + 0.03, 9.35]);
    }

    return {
      frames: mergedBoxes(frames),
      legs: mergedBoxes(legs),
      cables: mergeGeometries(cableGeos, false)!,
      teacherWood: mergedBoxes([[0.5, 1.33, 1.5, 2.5, 1.45, 2.5]]),
      teacherPanel: mergedBoxes([[0.55, 0.3, 2.38, 2.45, 1.33, 2.44]]),
      teacherChair: mergedBoxes([
        [1.05, 0.78, 0.62, 1.95, 0.88, 1.34],
        [1.05, 0.88, 0.55, 1.95, 1.78, 0.65],
      ]),
      desktop: mergedBoxes([
        [1.3, 1.45, 1.62, 1.7, 1.48, 1.92],
        [1.45, 1.48, 1.72, 1.55, 1.78, 1.8],
        [1.0, 1.75, 1.8, 2.0, 2.45, 1.88],
        [2.05, 1.45, 1.65, 2.37, 2.15, 2.27],
      ]),
      keyboard: mergedBoxes([[1.05, 1.45, 2.02, 1.9, 1.485, 2.3]]),
      roller: mergedBoxes([
        [7.6, 5.25, 0, 11.4, 5.5, 0.25],
        [SHEET.x0 - 0.05, SHEET.y0 - 0.08, 0.03, SHEET.x1 + 0.05, SHEET.y0, 0.09],
      ]),
      ifp: mergedBoxes([
        [2.8, 2.0, 0, 6.2, 4.0, 0.2],
        [3.3, 1.9, 0.2, 5.7, 1.96, 0.32],
      ]),
      projector: mergedBoxes([
        [9.35, 4.75, 5.55, 10.45, 5.15, 6.45],
        [9.85, 5.15, 5.95, 9.95, 6.4, 6.05], // pole
      ]),
      lamps: mergedBoxes([
        [3.4, 5.55, 4.4, 9.6, 5.7, 4.75],
        [3.4, 5.55, 7.3, 9.6, 5.7, 7.65],
      ]),
      rack: mergedBoxes([[0.15, 0, 8.45, 1.2, 2.5, 9.5]]),
      ports: mergedBoxes(ports),
      leds: mergedBoxes(leds),
      trunking: mergedBoxes([[0.05, 0, 6.3, 10.95, 0.07, 6.5]]),
      skirting: mergedBoxes([
        [0, 0, 0, 12, 0.22, 0.025],
        [0, 0, 0, 0.025, 0.22, 10],
      ]),
      dado: mergedBoxes([
        [0, 0.95, 0, 12, 1.12, 0.03],
        [0, 0.95, 0, 0.03, 1.12, 10],
      ]),
      beam: beamGeometry(),
    };
  }, []);

  const seats = useMemo(() => DESK_Z.flatMap((dz) => DESK_X.map((dx) => ({ dx, dz }))), []);
  const seatGeo = useMemo(() => {
    const desk = mergedBoxes([[0, 1.28, 0, 1.8, 1.4, 1.0]]);
    const legs = mergedBoxes([
      [0.06, 0, 0.06, 0.14, 1.28, 0.14],
      [1.66, 0, 0.06, 1.74, 1.28, 0.14],
      [0.06, 0, 0.86, 0.14, 1.28, 0.94],
      [1.66, 0, 0.86, 1.74, 1.28, 0.94],
      [0.5, 0, 1.2, 0.56, 0.78, 1.26],
      [1.25, 0, 1.2, 1.31, 0.78, 1.26],
      [0.5, 0, 1.85, 0.56, 0.78, 1.91],
      [1.25, 0, 1.85, 1.31, 0.78, 1.91],
    ]);
    const chair = mergedBoxes([
      [0.45, 0.78, 1.15, 1.35, 0.88, 1.95],
      [0.45, 0.88, 1.9, 1.35, 1.83, 2.0],
    ]);
    const laptop = mergedBoxes([
      [0.5, 1.4, 0.25, 1.3, 1.43, 0.75],
      [0.5, 1.43, 0.2, 1.3, 1.95, 0.25],
    ]);
    return { desk, legs, chair, laptop };
  }, []);

  const badges = useMemo(
    () => HOTSPOT_ANCHORS.map((_, i) => ({ normal: badgeTexture(i + 1, false), active: badgeTexture(i + 1, true) })),
    [],
  );
  const badgeMats = useMemo(
    () =>
      badges.map(
        (b) => new THREE.SpriteMaterial({ map: b.normal, depthTest: false, depthWrite: false, transparent: true }),
      ),
    [badges],
  );
  const badgeRefs = useRef<(THREE.Sprite | null)[]>([]);

  // Device groups that spring in and out in the Build scene.
  const reduced = useReducedMotion();
  const springs = useRef(
    // everything starts shown except the AMC badge (index 6)
    Array.from({ length: DEVICE_COUNT }, (_, i) => ({ x: i === 6 ? 0 : 1, v: 0, ref: null as THREE.Group | null })),
  );
  // Stable ref callbacks (one per device) so re-renders never detach them.
  const springRefs = useMemo(
    () =>
      Array.from({ length: DEVICE_COUNT }, (_, i) => (el: THREE.Group | null) => {
        springs.current[i].ref = el;
      }),
    [],
  );
  const setSpring = (i: number) => springRefs[i];
  const amcMap = useMemo(() => amcBadgeTexture(), []);
  useEffect(() => {
    if (location.search.includes('debug')) {
      (window as unknown as { __siuRoom: unknown }).__siuRoom = { springs: springs.current, classroom, stage };
    }
  }, []);
  const [hover, setHover] = useState(-1);

  // ---- per frame --------------------------------------------------------------
  const accentTarget = useMemo(() => new THREE.Color(), []);
  const DAY_SKY = useMemo(() => new THREE.Color('#BFE3FF'), []);
  const NIGHT_SKY = useMemo(() => new THREE.Color('#16224F'), []);

  useFrame((state, dt) => {
    const grp = group.current;
    if (!grp) return;
    grp.visible = stage.room;
    // also kept up to date while it shows through the campus window
    if (!stage.room && stage.portal <= 0) return;

    const L = levels(stage.power);
    const k = 1 - Math.exp(-Math.min(dt, 0.1) * 6);

    accentTarget.set(classroom.accent);
    m.accent.color.lerp(accentTarget, k);
    m.rug.color.copy(m.accent.color);

    // screens
    const on = (v: number, lo: number, hi: number) => lo + (hi - lo) * v;
    m.board.color.setScalar(on(L.board, 0.05, 1.45));
    m.screens.color.setScalar(on(L.board, 0.05, 1.2));
    m.sheet.emissiveIntensity = L.projector * 0.95;
    m.beam.opacity = L.projector * 0.16;
    m.slide.opacity = L.slide;
    m.slide.color.setScalar(1.25);
    // lamps
    m.lamp.emissiveIntensity = L.lights * 1.35;
    // windows: day sky or night sky
    m.glass.color.copy(DAY_SKY).lerp(NIGHT_SKY, stage.night);
    // rack LEDs blink softly
    const blink = 0.6 + 0.4 * Math.sin(state.clock.elapsedTime * 3);
    m.ledGreen.color.setRGB(0.3 * blink, 2.2 * blink, 1.1 * blink);

    // device springs (Build scene); every device is shown elsewhere
    const setup = classroom.setup;
    const full = !stage.config;
    const perRoomLaptops = Math.min(LAPTOP_SLOTS, setup.laptops);
    const targets = [
      full || setup.display !== 'projector', // 0 IFP
      full || setup.display !== 'ifp', // 1 projector
      full || setup.display !== 'ifp', // 2 screen
      full || setup.desktops > 0, // 3 desktop
      full || setup.networking, // 4 rack
      full || setup.networking, // 5 cabling (fades)
      !full && setup.amc, // 6 AMC badge
      ...Array.from({ length: LAPTOP_SLOTS }, (_, i) => full || i < perRoomLaptops), // 7.. laptops
    ];
    const step = Math.min(dt, 1 / 30);
    springs.current.forEach((sp, i) => {
      const target = targets[i] ? 1 : 0;
      if (reduced) {
        sp.x = target;
        sp.v = 0;
      } else {
        // a small spring: slight overshoot when a device appears
        const a = 260 * (target - sp.x) - 22 * sp.v;
        sp.v += a * step;
        sp.x += sp.v * step;
      }
      const g = sp.ref;
      if (!g) return;
      if (i === 5) {
        const o = THREE.MathUtils.clamp(sp.x, 0, 1);
        m.cable.opacity = o;
        m.trunking.opacity = o;
        g.visible = o > 0.01;
        return;
      }
      const sc = Math.max(0, sp.x);
      g.scale.setScalar(Math.max(0.0001, sc));
      g.visible = sc > 0.01;
    });
    const amc = springs.current[6].ref;
    if (amc) amc.position.y = 7.2 + Math.sin(state.clock.elapsedTime * 1.6) * (reduced ? 0 : 0.12);

    // hotspot badges: shown in the Classroom scene, hidden in Switch on and Build
    const showBadges = journey.toSwitch < 0.3;
    const active = activeIndex(journey.classroom, HOTSPOT_COUNT);
    badgeRefs.current.forEach((s, i) => {
      if (!s) return;
      s.visible = showBadges;
      const mat = badgeMats[i];
      const want = i === active ? badges[i].active : badges[i].normal;
      if (mat.map !== want) {
        mat.map = want;
        mat.needsUpdate = true;
      }
      const sc = (i === active ? 0.8 : 0.6) * (hover === i ? 1.12 : 1);
      s.scale.setScalar(s.scale.x + (sc - s.scale.x) * k);
    });
  }, -2);

  const onBadge = (i: number) => (e: ThreeEvent<MouseEvent>) => {
    if (!isPassthrough(e)) return;
    e.stopPropagation();
    scrollToId(`hotspot-${i + 1}`);
  };

  const shadow = { castShadow: true, receiveShadow: true };

  return (
    <group ref={group} position={ROOM} visible={false}>
      <ModelOr name="classroom">
        {/* shell */}
        <mesh material={m.slab} position={[5.825, -0.25, 4.825]} receiveShadow>
          <boxGeometry args={[12.35, 0.5, 10.35]} />
        </mesh>
        <mesh material={m.floor} rotation={[-Math.PI / 2, 0, 0]} position={[6, 0.002, 5]} receiveShadow>
          <planeGeometry args={[12, 10]} />
        </mesh>
        <mesh material={m.rug} rotation={[-Math.PI / 2, 0, 0]} position={[7.175, 0.006, 6.45]}>
          <planeGeometry args={[8.95, 6]} />
        </mesh>
        <mesh material={m.wallFront} position={[6, 3, -0.175]} receiveShadow>
          <boxGeometry args={[12, 6, 0.35]} />
        </mesh>
        <mesh material={m.wallLeft} position={[-0.175, 3, 4.825]} receiveShadow>
          <boxGeometry args={[0.35, 6, 10.35]} />
        </mesh>
        <mesh material={m.skirting} geometry={g.skirting} />
        <mesh material={m.accent} geometry={g.dado} />
        <mesh material={m.white} geometry={g.frames} />
        {[3.3, 6.7].map((zc) => (
          <mesh key={zc} material={m.glass} position={[0.02, 3.6, zc]} rotation={[0, Math.PI / 2, 0]}>
            <planeGeometry args={[2.2, 2.4]} />
          </mesh>
        ))}
        {/* clock */}
        <group position={[1.5, 4.7, 0.04]}>
          <mesh material={m.white} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.42, 0.42, 0.05, 32]} />
          </mesh>
          <mesh material={m.device} position={[0, 0.13, 0.03]}>
            <boxGeometry args={[0.04, 0.28, 0.01]} />
          </mesh>
          <mesh material={m.accent} position={[0.09, -0.03, 0.03]} rotation={[0, 0, 1.2]}>
            <boxGeometry args={[0.04, 0.2, 0.01]} />
          </mesh>
        </group>

        {/* interactive flat panel */}
        <Pivot at={[4.5, 2.0, 0.1]} innerRef={setSpring(0)}>
          <mesh material={m.device} geometry={g.ifp} {...shadow} />
          <mesh material={m.board} position={[4.5, 3.0, 0.205]}>
            <planeGeometry args={[3.1, 1.76]} />
          </mesh>
        </Pivot>

        {/* projector and beam */}
        <Pivot at={[9.9, 6.4, 6.0]} innerRef={setSpring(1)}>
          <mesh material={m.light} geometry={g.projector} {...shadow} />
          <mesh material={m.device} position={[LENS.x, LENS.y, LENS.z + 0.04]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.13, 0.13, 0.08, 20]} />
          </mesh>
          <mesh material={m.beam} geometry={g.beam} renderOrder={5} />
        </Pivot>

        {/* pull-down screen and lesson slide */}
        <Pivot at={[9.5, 5.4, 0.1]} innerRef={setSpring(2)}>
          <mesh material={m.white} geometry={g.roller} />
          <mesh material={m.sheet} position={[(SHEET.x0 + SHEET.x1) / 2, (SHEET.y0 + SHEET.y1) / 2, 0.06]}>
            <planeGeometry args={[SHEET.x1 - SHEET.x0, SHEET.y1 - SHEET.y0]} />
          </mesh>
          <mesh material={m.slide} position={[(SHEET.x0 + SHEET.x1) / 2, (SHEET.y0 + SHEET.y1) / 2, SHEET.z]}>
            <planeGeometry args={[(SHEET.x1 - SHEET.x0) * 0.94, (SHEET.y1 - SHEET.y0) * 0.92]} />
          </mesh>
        </Pivot>

        {/* teacher's table and desktop */}
        <mesh material={m.wood} geometry={g.teacherWood} {...shadow} />
        <mesh material={m.woodDark} geometry={g.teacherPanel} {...shadow} />
        <mesh material={m.accent} geometry={g.teacherChair} {...shadow} />
        <Pivot at={[1.6, 1.45, 2.0]} innerRef={setSpring(3)}>
          <mesh material={m.device} geometry={g.desktop} {...shadow} />
          <mesh material={m.shell} geometry={g.keyboard} />
          <mesh material={m.screens} position={[1.5, 2.1, 1.885]}>
            <planeGeometry args={[0.88, 0.58]} />
          </mesh>
        </Pivot>

        {/* student desks, chairs and laptops */}
        {seats.map(({ dx, dz }, i) => (
          <group key={`${dx}-${dz}`} position={[dx, 0, dz]}>
            <mesh material={m.wood} geometry={seatGeo.desk} {...shadow} />
            <mesh material={m.leg} geometry={seatGeo.legs} castShadow />
            <mesh material={m.accent} geometry={seatGeo.chair} {...shadow} />
            <Pivot at={[0.9, 1.4, 0.45]} innerRef={setSpring(FIRST_LAPTOP + i)}>
              <mesh material={m.shell} geometry={seatGeo.laptop} castShadow />
              <mesh material={m.screens} position={[0.9, 1.69, 0.252]}>
                <planeGeometry args={[0.7, 0.42]} />
              </mesh>
            </Pivot>
          </group>
        ))}

        {/* network rack and CAT-6 cabling */}
        <Pivot at={[0.68, 0, 8.97]} innerRef={setSpring(4)}>
          <mesh material={m.rack} geometry={g.rack} {...shadow} />
          <mesh material={m.port} geometry={g.ports} />
          <mesh material={m.ledGreen} geometry={g.leds} />
        </Pivot>
        <group ref={setSpring(5)}>
          <mesh material={m.trunking} geometry={g.trunking} receiveShadow />
          <mesh material={m.cable} geometry={g.cables} />
        </group>

        {/* plant */}
        <mesh material={m.plantPot} position={[0.62, 0.25, 7.77]} castShadow>
          <boxGeometry args={[0.55, 0.5, 0.55]} />
        </mesh>
        {[
          [0.5, 0.95, 7.7, 0.32],
          [0.75, 1.05, 7.85, 0.36],
          [0.6, 1.3, 7.75, 0.3],
        ].map(([x, y, z, r], i) => (
          <mesh key={i} material={m.leaf} position={[x, y, z]} scale={[1, 1.5, 1]} castShadow>
            <icosahedronGeometry args={[r, 0]} />
          </mesh>
        ))}
        {/* teacher's table legs, lamp wires; ceiling lamps */}
        <mesh material={m.leg} geometry={g.legs} />
        <mesh material={m.lamp} geometry={g.lamps} />
      </ModelOr>

      {/* AMC badge (Build scene, when AMC is chosen) */}
      <group ref={setSpring(6)} position={[6, 7.2, 5]} scale={0.0001} visible={false}>
        <sprite scale={[1.6, 1.6, 1]} renderOrder={21}>
          <spriteMaterial map={amcMap} transparent depthWrite={false} />
        </sprite>
      </group>

      {/* numbered hotspots (HTML twins: the numbered buttons in the Classroom scene) */}
      {HOTSPOT_ANCHORS.map((p, i) => (
        <sprite
          key={i}
          ref={(el) => {
            badgeRefs.current[i] = el;
          }}
          material={badgeMats[i]}
          position={p}
          scale={0.72}
          renderOrder={20}
          onClick={onBadge(i)}
          onPointerOver={(e) => {
            if (!isPassthrough(e)) return;
            setHover(i);
            document.documentElement.classList.add('cursor-3d');
          }}
          onPointerOut={() => {
            setHover(-1);
            document.documentElement.classList.remove('cursor-3d');
          }}
        />
      ))}
    </group>
  );
}
