import { useFrame, useThree } from '@react-three/fiber';
import { useMemo, useRef, type RefObject } from 'react';
import * as THREE from 'three';
import { activeIndex, floatIndex, HOTSPOT_COUNT, journey, PLANET_COUNT, STATION_COUNT } from '../lib/journey';
import { TARGET } from './campus/layout';
import { applyStill } from './Director';
import { ROUTE_CENTER } from './RouteScene';
import { campusToWorld, DIVE, diveCampus, diveSpace, followSpace } from './dive';
import { CAMPUS, crossfade, DESCENT_CUT, ROOM, smooth, stage } from './stage';
import { ORBITS, shared } from './system';

/**
 * One camera through one world. The pose comes from scroll progress:
 *   hero -> planet 1..5 -> route -> the descent (one continuous path down
 *   through the clouds, over the campus and into the glowing classroom
 *   window) -> classroom overview -> devices 1..5 -> the Switch on view ->
 *   the Build view.
 * A pose is { pos, target, offset, fov, region }. `offset` shifts the
 * subject sideways on screen (positive = right) so it sits beside the HTML
 * panels. The region changes (world -> room) only when the target window
 * fills the screen and already shows the room, so the switch is invisible.
 *
 * Under Reduce Motion there are no flights: the camera cuts between fixed
 * poses and the canvas crossfades (the descent's three stills crossfade
 * directly, 400 ms each).
 */
type Region = 'world' | 'room';
interface Pose {
  pos: THREE.Vector3;
  target: THREE.Vector3;
  offset: number;
  fov: number;
  region: Region;
}

const UP = new THREE.Vector3(0, 1, 0);
const newPose = (): Pose => ({ pos: new THREE.Vector3(), target: new THREE.Vector3(), offset: 0, fov: 38, region: 'world' });
const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const set = (out: Pose, pos: number[], target: number[], offset: number, fov: number, region: Region, base?: THREE.Vector3) => {
  out.pos.set(pos[0], pos[1], pos[2]);
  out.target.set(target[0], target[1], target[2]);
  if (base) {
    out.pos.add(base);
    out.target.add(base);
  }
  out.offset = offset;
  out.fov = fov;
  out.region = region;
  return out;
};

// ---- space --------------------------------------------------------------------
function heroPose(out: Pose, wide: boolean) {
  return set(out, [0, 1.7, wide ? 17.5 : 22], [0, 0.15, 0], wide ? 0.21 : 0, 38, 'world');
}

const dir = new THREE.Vector3();
const sideA = new THREE.Vector3();
const sideB = new THREE.Vector3();
const right = new THREE.Vector3();
/** Is the star to the left of the planet, seen from direction `side`? */
function starOnLeft(p: THREE.Vector3, side: THREE.Vector3) {
  right.crossVectors(side, UP).negate(); // camera right when looking along -side
  return -p.dot(right) < 0;
}
function planetPose(i: number, out: Pose, wide: boolean) {
  const p = shared.planets[i];
  const size = ORBITS[i].size;
  // Beside the planet's orbit (about 80 degrees off the line to the star),
  // slightly above, on the side that puts the star on the left behind the
  // card: the planet is lit from the left and the star never fills the frame.
  dir.set(p.x, 0, p.z).normalize();
  sideA.copy(dir).applyAxisAngle(UP, 1.4);
  sideB.copy(dir).applyAxisAngle(UP, -1.4);
  dir.copy(starOnLeft(p, sideA) ? sideA : sideB);
  const dist = size * (wide ? 7.4 : 9.5);
  out.pos.copy(p).addScaledVector(dir, dist).addScaledVector(UP, dist * 0.32);
  out.target.copy(p);
  out.offset = wide ? 0.2 : 0;
  out.fov = 38;
  out.region = 'world';
  return out;
}

function routePose(out: Pose, wide: boolean, s: THREE.Vector3 = shared.satellite) {
  out.pos.set(s.x * 0.5, 9.5, wide ? 22 : 28);
  out.target.copy(ROUTE_CENTER).lerp(s, 0.5);
  out.target.y = -0.4;
  out.offset = wide ? 0.17 : 0;
  out.fov = 38;
  out.region = 'world';
  return out;
}

// ---- descent: we follow the satellite down through the clouds to one window ---------
// Progress p (0..1 over the pinned #descent scene), see dive.ts:
//   0-30 %  in space: from the route pose the camera swings in close behind the
//           satellite and follows it down toward Earth (the horizon, Earth's
//           glowing edge, stays in the top of the frame)
//   ~30 %   inside the cloud deck (whiteout) space swaps to the campus
//   30-50 % down through the clouds behind the satellite; the fog opens
//   50-80 % under the clouds the camera levels out: the town and the campus
//           ahead, the horizon in the top quarter of the frame, the school's
//           front and right facades towards the camera; the satellite lights
//           the window
//   80-100% glide to the glowing first-floor window until it fills the screen
// Key points from the swap on are campus-local (+ CAMPUS).
const T = TARGET.center;
const N = TARGET.normal;
const at = (d: number, dy = 0, dz = 0) => [T.x + N.x * d, T.y + dy, T.z + N.z * d + dz];
const DESCENT: { p: number; pos: number[]; look: number[]; fov: number; offset: number }[] = [
  { p: DIVE.swap, pos: [106, 162, 152], look: [88, 150, 132], fov: 42, offset: 0 },
  { p: 0.42, pos: [100, 144, 142], look: [76, 128, 112], fov: 41, offset: 0.02 },
  { p: 0.47, pos: [94, 126, 132], look: [62, 98, 86], fov: 40, offset: 0.05 },
  { p: 0.52, pos: [90, 112, 124], look: [30, 82, 46], fov: 38, offset: 0.08 },
  { p: 0.58, pos: [118, 92, 142], look: [24, 66, 30], fov: 38, offset: 0.11 },
  { p: 0.68, pos: [84, 46, 100], look: [0, 23, 0], fov: 38, offset: 0.12 },
  { p: 0.8, pos: [60, 24, 52], look: [14, 10, -4], fov: 33, offset: 0.1 },
  { p: 0.86, pos: [40, 15, 10], look: at(-1, 0.05), fov: 28, offset: 0.03 },
  { p: 0.92, pos: at(5.5, 1.25, 1.5), look: at(-1), fov: 29, offset: 0 },
  { p: 0.955, pos: at(2.1, 0.1, 0.25), look: at(-1), fov: 30, offset: 0 },
  { p: DESCENT_CUT, pos: at(1.0), look: at(-1), fov: 30, offset: 0 },
];
const toWorld = (v: number[]) => new THREE.Vector3(v[0], v[1], v[2]).add(CAMPUS);
const posCurve = new THREE.CatmullRomCurve3(DESCENT.map((k) => toWorld(k.pos)), false, 'centripetal');
const lookCurve = new THREE.CatmullRomCurve3(DESCENT.map((k) => toWorld(k.look)), false, 'centripetal');
const routeStart = newPose();
const diveStart = new THREE.Vector3();
const follow = { pos: new THREE.Vector3(), look: new THREE.Vector3(), sat: new THREE.Vector3(), dir: new THREE.Vector3() };

function descentPose(out: Pose, p: number, wide: boolean) {
  out.region = 'world';
  if (p < DIVE.swap) {
    // space: from the route pose (exactly where the route scene left the
    // camera) in behind the diving satellite
    diveSpace(0, diveStart, follow.dir);
    routePose(routeStart, wide, diveStart);
    followSpace(p, follow.pos, follow.look);
    const w = ease(smooth(0, 0.08, p));
    out.pos.lerpVectors(routeStart.pos, follow.pos, w);
    out.target.lerpVectors(routeStart.target, follow.look, w);
    out.fov = 38 + 4 * w;
    out.offset = wide ? routeStart.offset * (1 - w) : 0;
    return out;
  }
  const q = Math.min(p, DESCENT_CUT);
  let i = 0;
  while (i < DESCENT.length - 2 && q > DESCENT[i + 1].p) i++;
  const a = DESCENT[i];
  const b = DESCENT[i + 1];
  const f = (q - a.p) / (b.p - a.p);
  const t = (i + f) / (DESCENT.length - 1);
  posCurve.getPoint(t, out.pos);
  lookCurve.getPoint(t, out.target);
  // through the clouds the camera keeps the satellite in view
  const ws = 1 - smooth(0.46, 0.53, q);
  if (ws > 0) out.target.lerp(campusToWorld(diveCampus(q, follow.sat, follow.dir), follow.sat), ws * 0.8);
  out.fov = a.fov + (b.fov - a.fov) * f;
  out.offset = wide ? a.offset + (b.offset - a.offset) * f : 0;
  return out;
}

// Reduce Motion: the descent as three stills (sky with clouds, campus, classroom).
const skyStill = (out: Pose) => set(out, [70, 124, 112], [20, 96, 40], 0, 40, 'world', CAMPUS);
const campusStill = (out: Pose, wide: boolean) => {
  const k = DESCENT.find((d) => d.p === 0.68)!;
  return set(out, k.pos, k.look, wide ? k.offset : 0, k.fov, 'world', CAMPUS);
};

// ---- classroom (room-local) ----------------------------------------------------
const ROOM_FOV = 30;
const DEVICES: { pos: number[]; target: number[] }[] = [
  { pos: [10.4, 5.2, 12.4], target: [4.4, 2.6, 0.5] }, // interactive flat panel
  { pos: [17, 9, 14.5], target: [9.4, 4.0, 2.8] }, // projector and screen
  { pos: [15, 9.5, 17.5], target: [5.6, 1.6, 6.6] }, // laptops
  { pos: [8.8, 6.6, 10], target: [1.7, 2.0, 2.0] }, // teacher's desktop
  { pos: [9, 6, 16.5], target: [0.9, 1.5, 8.8] }, // network rack
];
const tmpV = new THREE.Vector3();
function roomPose(out: Pose, pos: number[], target: number[], wide: boolean, offset: number) {
  set(out, pos, target, wide ? offset : 0, ROOM_FOV, 'room', ROOM);
  if (!wide) {
    // Narrow screens: step back a little so the subject still fits.
    tmpV.subVectors(out.pos, out.target).multiplyScalar(1.3);
    out.pos.copy(out.target).add(tmpV);
  }
  return out;
}
const overviewPose = (out: Pose, wide: boolean) => roomPose(out, [24, 18, 26], [5.8, 1.6, 4.8], wide, -0.13);

/**
 * Puts `cam` at the classroom overview (what the camera shows right after
 * the window), optionally pulled back a little. Used to draw the room into
 * the target window.
 */
const portalPose = newPose();
const pullV = new THREE.Vector3();
/** Where the camera is at descent progress p (wide screen), for placing things on its path. */
const pathPose = newPose();
export function descentCameraAt(p: number, out: THREE.Vector3) {
  return out.copy(descentPose(pathPose, p, true).pos);
}

export function poseRoomOverview(cam: THREE.PerspectiveCamera, width: number, height: number, pullBack = 0) {
  overviewPose(portalPose, width >= 900);
  if (pullBack) {
    pullV.subVectors(portalPose.pos, portalPose.target).multiplyScalar(1 + pullBack);
    portalPose.pos.copy(portalPose.target).add(pullV);
  }
  cam.position.copy(portalPose.pos);
  cam.lookAt(portalPose.target);
  cam.fov = portalPose.fov;
  cam.aspect = width / height;
  cam.setViewOffset(width, height, -portalPose.offset * width, 0, width, height);
  cam.updateMatrixWorld();
}
const devicePose = (i: number, out: Pose, wide: boolean) => roomPose(out, DEVICES[i].pos, DEVICES[i].target, wide, -0.15);
const switchPose = (out: Pose, wide: boolean) => roomPose(out, [9.5, 10.5, 23], [5.8, 2.6, 2.8], wide, -0.19);
// Build: the whole room on the right, beside the configurator controls.
const buildPose = (out: Pose, wide: boolean) => roomPose(out, [23, 17, 25], [5.6, 1.4, 4.6], wide, 0.2);

function mixPose(a: Pose, b: Pose, t: number, out: Pose, lift = 0) {
  out.pos.lerpVectors(a.pos, b.pos, t);
  out.target.lerpVectors(a.target, b.target, t);
  out.offset = a.offset + (b.offset - a.offset) * t;
  out.fov = a.fov + (b.fov - a.fov) * t;
  out.region = t < 0.5 ? a.region : b.region;
  if (lift) {
    const arc = Math.sin(Math.PI * t);
    out.pos.y += arc * lift;
    out.pos.z += arc * lift * 0.8;
  }
  return out;
}

export function CameraRig({ reduced, fadeRef }: { reduced: boolean; fadeRef: RefObject<HTMLDivElement> }) {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  const size = useThree((s) => s.size);
  const poses = useMemo(() => ({ a: newPose(), b: newPose(), goal: newPose() }), []);
  const cur = useRef<Pose & { ready: boolean }>({ ...newPose(), ready: false });
  const cut = useRef<{ key: string; pending: number }>({ key: '', pending: 0 });

  useFrame(() => {
    const wide = size.width >= 900;
    const j = journey;
    const { a, b, goal } = poses;
    let key = 'hero';

    if (reduced) {
      // Discrete poses only.
      if (j.toBuild >= 0.5) {
        buildPose(goal, wide);
        key = 'build';
      } else if (j.toSwitch >= 0.5) {
        switchPose(goal, wide);
        key = 'switch';
      } else if (j.toClassroom >= 0.5) {
        const i = activeIndex(j.classroom, HOTSPOT_COUNT);
        devicePose(i, goal, wide);
        key = `device-${i}`;
      } else if (j.descent >= 0.9 || j.toClassroom > 0) {
        overviewPose(goal, wide);
        key = 'descent-room';
      } else if (j.descent >= 0.4) {
        campusStill(goal, wide);
        key = 'descent-campus';
      } else if (j.descent >= 0.02) {
        skyStill(goal);
        key = 'descent-sky';
      } else if (j.toRoute >= 0.5) {
        routePose(goal, wide);
        key = `route-${activeIndex(j.route, STATION_COUNT)}`;
      } else if (j.toPlanets >= 0.5) {
        const i = activeIndex(j.planets, PLANET_COUNT);
        planetPose(i, goal, wide);
        key = `planet-${i}`;
      } else heroPose(goal, wide);
    } else if (j.toBuild > 0) {
      mixPose(switchPose(a, wide), buildPose(b, wide), j.toBuild, goal, 1.2);
    } else if (j.toSwitch > 0) {
      mixPose(devicePose(HOTSPOT_COUNT - 1, a, wide), switchPose(b, wide), j.toSwitch, goal, 0.8);
    } else if (stage.room) {
      // through the window: classroom overview, then device 1..5
      if (j.classroom <= 0) {
        mixPose(overviewPose(a, wide), devicePose(0, b, wide), j.toClassroom, goal);
      } else {
        const f = floatIndex(j.classroom, HOTSPOT_COUNT);
        const i = Math.floor(f);
        const t = f - i;
        if (t < 0.001) devicePose(i, goal, wide);
        else mixPose(devicePose(i, a, wide), devicePose(Math.min(i + 1, HOTSPOT_COUNT - 1), b, wide), t, goal, 0.8);
      }
    } else if (stage.descent > 0) {
      descentPose(goal, stage.descent, wide);
      key = 'descent';
    } else if (j.toPlanets < 1) {
      mixPose(heroPose(a, wide), planetPose(0, b, wide), j.toPlanets, goal, 2.2);
    } else if (j.toRoute <= 0) {
      const f = floatIndex(j.planets, PLANET_COUNT);
      const i = Math.floor(f);
      const t = f - i;
      if (t < 0.001) planetPose(i, goal, wide);
      else mixPose(planetPose(i, a, wide), planetPose(Math.min(i + 1, PLANET_COUNT - 1), b, wide), t, goal, 2.6);
    } else if (j.toRoute < 1) {
      mixPose(planetPose(PLANET_COUNT - 1, a, wide), routePose(b, wide), j.toRoute, goal, 3);
    } else {
      routePose(goal, wide);
    }

    const c = cur.current;
    const snap = () => {
      c.pos.copy(goal.pos);
      c.target.copy(goal.target);
      c.offset = goal.offset;
      c.fov = goal.fov;
      c.region = goal.region;
    };
    const isDescent = (k: string) => k.startsWith('descent-');
    const showStill = (k: string) => {
      stage.still = isDescent(k) ? (k.slice(8) as typeof stage.still) : '';
      applyStill(stage.still);
    };
    if (!c.ready || (reduced && cut.current.key === '')) {
      snap();
      c.ready = true;
      cut.current.key = key;
      if (reduced) showStill(key);
    } else if (reduced) {
      if (key !== cut.current.key && !cut.current.pending) {
        if (isDescent(key) || isDescent(cut.current.key)) {
          // Descent stills crossfade: snapshot this frame, cut under it.
          crossfade.request = true;
          cut.current.pending = -1;
        } else {
          // Elsewhere: fade the canvas out, jump, fade back in.
          cut.current.pending = performance.now();
          if (fadeRef.current) fadeRef.current.style.opacity = '0';
        }
      }
      if (cut.current.pending === -1 && crossfade.ready) {
        crossfade.ready = false;
        snap();
        cut.current.key = key;
        cut.current.pending = 0;
        showStill(key);
      } else if (cut.current.pending > 0 && performance.now() - cut.current.pending > 260) {
        snap();
        cut.current.key = key;
        cut.current.pending = 0;
        showStill(key);
        if (fadeRef.current) fadeRef.current.style.opacity = '1';
      }
    } else {
      // The journey is damped by the master timeline's playhead, and every
      // pose is continuous in it: the camera sits exactly on the path (this
      // also makes the switch through the window, which already shows the
      // room, seamless).
      snap();
    }

    camera.position.copy(c.pos);
    camera.lookAt(c.target);
    if (Math.abs(camera.fov - c.fov) > 0.001) camera.fov = c.fov;
    const w = size.width;
    const h = size.height;
    camera.setViewOffset(w, h, -c.offset * w, 0, w, h);
  }, -1);

  return null;
}
