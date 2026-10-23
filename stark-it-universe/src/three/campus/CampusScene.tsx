import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { journey } from '../../lib/journey';
import { CAMPUS, compiling, prewarm, refs, stage } from '../stage';
import { redrawOnFonts } from '../textures';
import { CloudLayers, prepareCloudSteps } from './Clouds';
import { contactDecal, contactShadowSteps } from './contact';
import { BACK, BUS_BAY, LEFT, RIGHT, STAGE_AREA, TARGET, TOWER, WALL } from './layout';
import { DiveSatellite } from './DiveSatellite';
import { Life } from './Life';
import { loadModels, type ModelName, type Models } from './models';
import { BUILDING_BOX, buildCampusSteps, SIGN, type CampusGeometry } from './school';
import { TargetWindow } from './TargetWindow';
import { buildGroundSteps, FAR_WALLS, farHouseGeometry, placeTown, type Placed, type TownLayout, type TreeKind } from './town';
import { buildTreeSteps, CANOPY, swayUniforms, TREE_MODEL, treeMaterial, type TreeSet } from './trees';

/**
 * The campus the camera lands on (its own chunk, loaded while the orbit
 * route is on screen): one merged, vertex-coloured school model on the
 * ground of a small town (Kenney houses, cars and trees, instanced; roads,
 * plots and fields out to the haze), contact shadows under everything, the
 * signboard, the glowing target window, the morning life (bus, auto-rickshaw,
 * students) and the cloud layers. Drawn only around the descent; the clouds
 * are disposed once the camera is inside the classroom.
 *
 * Building it and getting it onto the GPU is spread over idle time in small
 * slices, so the scenes on screen meanwhile (planets, route) never stutter.
 */
function signTexture() {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 120;
  const g = c.getContext('2d')!;
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  const draw = () => {
    g.fillStyle = '#0B1640';
    g.fillRect(0, 0, 512, 120);
    g.strokeStyle = '#FFB52E';
    g.lineWidth = 6;
    g.strokeRect(9, 9, 494, 102);
    g.fillStyle = '#FFFFFF';
    g.font = '800 58px Unbounded, "Arial Black", Arial, sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText('YOUR SCHOOL', 256, 64, 460);
  };
  draw();
  redrawOnFonts(draw, t);
  return t;
}

const TREE_KINDS = Object.keys(TREE_MODEL) as TreeKind[];
const WARM_TINTS = [new THREE.Color(1, 1, 1), new THREE.Color(1, 0.96, 0.89), new THREE.Color(1, 0.93, 0.83)];
const NO_CLOUDS = typeof location !== 'undefined' && /debug.*noclouds/.test(location.search);
// `?debug`: how long each build step took (ms), in window.__siuSteps
const STEP_LOG: number[] | null =
  typeof location !== 'undefined' && location.search.includes('debug') ? ((window as unknown as { __siuSteps: number[] }).__siuSteps = []) : null;

type Idle = (cb: (deadline?: IdleDeadline) => void) => () => void;
const onIdle: Idle = (cb) => {
  const w = window as Window & typeof globalThis;
  if (typeof w.requestIdleCallback === 'function') {
    const id = w.requestIdleCallback(cb, { timeout: 2000 });
    return () => w.cancelIdleCallback(id);
  }
  const id = window.setTimeout(() => cb(), 50);
  return () => window.clearTimeout(id);
};

/** Runs a generator a few steps per idle period (about 10 ms each). */
function runInIdle<T>(steps: Generator<void, T>, done: (value: T) => void) {
  let cancel = () => {};
  const tick = (deadline?: IdleDeadline) => {
    const budget = deadline ? Math.min(8, Math.max(3, deadline.timeRemaining() - 2)) : 6;
    const end = performance.now() + budget;
    const step = () => {
      const t0 = performance.now();
      const res = steps.next();
      if (STEP_LOG) STEP_LOG.push(+(performance.now() - t0).toFixed(1));
      return res;
    };
    let r = step();
    while (!r.done && performance.now() < end) r = step();
    if (r.done) done(r.value);
    else cancel = onIdle(tick);
  };
  cancel = onIdle(tick);
  return () => cancel();
}

interface Built {
  campus: CampusGeometry;
  trees: TreeSet;
  town: TownLayout;
  ground: { ground: THREE.BufferGeometry; flats: THREE.BufferGeometry };
  far: THREE.BufferGeometry;
  contact: THREE.CanvasTexture;
  models: Models;
}

/** Footprints of the school, its walls, the parked buses, the trees and the town (for the contact shadows). */
function footprints(trees: TreeSet, town: TownLayout) {
  const rects = [...town.rects];
  const rect = (x0: number, z0: number, x1: number, z1: number, k = 1) => rects.push({ x: (x0 + x1) / 2, z: (z0 + z1) / 2, w: x1 - x0, d: z1 - z0, rot: 0, k });
  for (const w of [BACK, LEFT, RIGHT]) rect(w.x0, w.z0, w.x1, w.z1);
  rect(TOWER.x0, TOWER.z0, TOWER.x1, TOWER.z1);
  rect(STAGE_AREA.x0, STAGE_AREA.z0, STAGE_AREA.x1, STAGE_AREA.z1, 0.5);
  for (const x of [-25.6, -19.4]) rect(x - 1.25, BUS_BAY.z0 + 1.6, x + 1.25, BUS_BAY.z1 - 1.4, 0.8);
  const t = 0.7;
  rect(-WALL.x - t / 2, -WALL.z - t / 2, WALL.x + t / 2, -WALL.z + t / 2, 0.45);
  rect(-WALL.x - t / 2, WALL.z - t / 2, -WALL.gate, WALL.z + t / 2, 0.45);
  rect(WALL.gate, WALL.z - t / 2, WALL.x + t / 2, WALL.z + t / 2, 0.45);
  rect(-WALL.x - t / 2, -WALL.z, -WALL.x + t / 2, WALL.z, 0.45);
  rect(WALL.x - t / 2, -WALL.z, WALL.x + t / 2, WALL.z, 0.45);
  const discs: { x: number; z: number; r: number; k: number }[] = [];
  for (const sp of ['ashoka', 'neem', 'gulmohar'] as const) for (const p of trees.placed[sp]) discs.push({ x: p.x, z: p.z, r: CANOPY[sp] * p.scale, k: 1 });
  for (const kind of TREE_KINDS) {
    const r = kind.startsWith('ashoka') ? 0.7 : kind === 'bush' ? 1.0 : 2.2;
    for (const p of town.trees[kind]) discs.push({ x: p.x, z: p.z, r: r * p.sx, k: 1 });
  }
  return { rects, discs };
}

export default function CampusScene({ reduced, onBuilt }: { reduced: boolean; onBuilt: () => void }) {
  const [built, setBuilt] = useState<Built | null>(null);
  useEffect(() => {
    let cancel = () => {};
    let alive = true;
    loadModels().then((models) => {
      if (!alive) return;
      cancel = runInIdle(
        (function* () {
          const campus = yield* buildCampusSteps();
          const trees = yield* buildTreeSteps();
          const town = placeTown(models);
          yield;
          const ground = yield* buildGroundSteps();
          const far = farHouseGeometry();
          yield;
          const contact = yield* contactShadowSteps(footprints(trees, town));
          yield* prepareCloudSteps();
          return { campus, trees, town, ground, far, contact, models };
        })(),
        setBuilt,
      );
    });
    return () => {
      alive = false;
      cancel();
    };
  }, []);
  return built ? <Campus built={built} reduced={reduced} onBuilt={onBuilt} /> : null;
}

/** One InstancedMesh for a model from placements (x/z, rotation, scale, tint). */
function instanced(
  geometry: THREE.BufferGeometry,
  material: THREE.Material,
  list: Placed[],
  scale: (p: Placed, out: THREE.Vector3) => THREE.Vector3,
  color: (p: Placed, out: THREE.Color) => THREE.Color,
) {
  const mesh = new THREE.InstancedMesh(geometry, material, list.length);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const up = new THREE.Vector3(0, 1, 0);
  const pos = new THREE.Vector3();
  const s = new THREE.Vector3();
  const c = new THREE.Color();
  list.forEach((p, i) => {
    m.compose(pos.set(p.x, 0, p.z), q.setFromAxisAngle(up, p.rot), scale(p, s));
    mesh.setMatrixAt(i, m);
    mesh.setColorAt(i, color(p, c));
  });
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.computeBoundingSphere();
  return mesh;
}

function Campus({ built, reduced, onBuilt }: { built: Built; reduced: boolean; onBuilt: () => void }) {
  const group = useRef<THREE.Group>(null);
  const geo = built.campus;
  const mats = useMemo(
    () => ({
      main: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92, metalness: 0 }),
      glass: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.32, metalness: 0.1 }),
      sign: new THREE.MeshStandardMaterial({ map: signTexture(), roughness: 0.75 }),
      tree: treeMaterial(),
      // The town and its ground fill most of the screen: matte Lambert shading
      // (looks the same as rough clay here, costs much less per pixel).
      ground: new THREE.MeshLambertMaterial({ vertexColors: true }),
      town: new THREE.MeshLambertMaterial({ vertexColors: true }),
    }),
    [],
  );
  const signGeo = useMemo(() => new THREE.PlaneGeometry(SIGN.width, SIGN.height), []);

  // Trees (campus and town), houses, far blocks and parked cars: one InstancedMesh per model.
  const town = useMemo(() => {
    const { placed } = built.trees;
    const lists: Record<TreeKind, Placed[]> = { ...built.town.trees };
    for (const sp of ['ashoka', 'neem', 'gulmohar'] as const) {
      placed[sp].forEach((t, i) => {
        const kind: TreeKind = sp === 'neem' && i % 3 === 1 ? 'neemB' : sp;
        lists[kind] = [...lists[kind], { x: t.x, z: t.z, rot: t.rot, sx: t.scale, sy: t.scale, sz: t.scale, tint: t.tint }];
      });
    }
    const trees = TREE_KINDS.filter((k) => lists[k].length).map((kind) => {
      const tm = TREE_MODEL[kind];
      const mesh = instanced(built.models[tm.model], mats.tree, lists[kind], (p, v) => v.set(tm.xz * p.sx, tm.y * p.sy, tm.xz * p.sz), (p, c) => c.setScalar(1 + p.tint));
      mesh.userData.warm = 2;
      return mesh;
    });
    const houses = (Object.keys(built.town.houses) as ModelName[]).map((model) => {
      const mesh = instanced(
        built.models[model],
        mats.town,
        built.town.houses[model]!,
        (p, v) => v.set(p.sx, p.sy, p.sz),
        (p, c) => c.copy(WARM_TINTS[Math.abs(Math.round(p.x * 7 + p.z * 3)) % 3]).multiplyScalar(1 + p.tint),
      );
      mesh.userData.warm = 2;
      return mesh;
    });
    const far = instanced(built.far, mats.town, built.town.far, (p, v) => v.set(p.sx, p.sy, p.sz), (p, c) => c.copy(FAR_WALLS[p.tint]));
    // in the haze, past the sun's shadow map: no shadow lookups
    far.castShadow = false;
    far.receiveShadow = false;
    far.userData.warm = 2;
    const cars = (Object.keys(built.town.cars) as ModelName[]).map((model) => {
      const mesh = instanced(built.models[model], mats.town, built.town.cars[model]!, (p, v) => v.set(p.sx, p.sy, p.sz), (_, c) => c.setScalar(1));
      mesh.userData.warm = 2;
      return mesh;
    });
    const ground = new THREE.Mesh(built.ground.ground, mats.ground);
    const flats = new THREE.Mesh(built.ground.flats, mats.ground);
    for (const m of [ground, flats]) {
      m.receiveShadow = true;
      m.userData.warm = 1;
    }
    const contact = contactDecal(built.contact);
    contact.userData.warm = 3;
    const counts = {
      trees: TREE_KINDS.reduce((n, k) => n + lists[k].length, 0),
      houses: houses.reduce((n, h) => n + h.count, 0),
      far: far.count,
      cars: cars.reduce((n, h) => n + h.count, 0),
    };
    return { trees, houses, far, cars, ground, flats, contact, counts, all: [...trees, ...houses, far, ...cars] };
  }, [built, mats]);


  useEffect(() => {
    swayUniforms.uSway.value = reduced ? 0 : 0.0175;
  }, [reduced]);

  // Draw the campus once, small and offscreen, in idle time, one part per
  // idle period, with everything in each part shown (also what only appears
  // later: the satellite's beam, the cloud veil): buffers, textures, every
  // shader variant and the sun's shadow map are then ready before the story's
  // first move (which waits for it, see prewarm). The shadow map is static:
  // it is rendered here once and never again.
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  useEffect(() => {
    const root = group.current?.parent;
    const parts = group.current ? [...group.current.children] : [];
    if (!root) return;
    const cam = new THREE.PerspectiveCamera(70, 1.6, 0.3, 900);
    cam.position.set(84, 46, 100).add(CAMPUS);
    cam.lookAt(CAMPUS);
    cam.updateMatrixWorld();
    const target = new THREE.WebGLRenderTarget(64, 40, { type: THREE.HalfFloatType });
    const pass = (o: THREE.Object3D) => (o.userData.warm as number | undefined) ?? 3;
    const school = (o: THREE.Object3D) => o === parts[0] || o === parts[1] || o === parts[2] || pass(o) === 1;
    const passes: (() => void)[] = [
      // the school and the ground, the instanced trees and town, the window,
      // life and contact shadows, the clouds, then the sun's shadow map
      () => draw(school),
      () => draw((o) => pass(o) === 2),
      () => draw((o) => !school(o) && pass(o) === 3),
      () => draw(() => false, true),
      () => draw(() => true, false, true),
      () => {
        target.dispose();
        prewarm.set({ campus: true });
      },
    ];
    function draw(keep: (o: THREE.Object3D) => boolean, clouds = false, shadows = false) {
      if (!root) return;
      const campusGroup = group.current!;
      const saved: [THREE.Object3D, boolean][] = [];
      root.traverse((o) => saved.push([o, o.visible]));
      root.children.forEach((c) => (c.visible = c === campusGroup ? !clouds || shadows : clouds));
      campusGroup.children.forEach((c) => (c.visible = keep(c)));
      // inside each drawn part, everything is shown for the draw
      const show = (o: THREE.Object3D) => o.traverse((d) => (d.visible = true));
      if (clouds) root.children.forEach((c) => c !== campusGroup && show(c));
      else campusGroup.children.forEach((c) => c.visible && show(c));
      if (shadows) {
        // the shadow map sees only the campus casters (no cloud veil, no sprites)
        root.children.forEach((c) => c !== campusGroup && (c.visible = false));
        if (refs.campusSun) {
          refs.campusSun.shadow.needsUpdate = true;
          gl.shadowMap.needsUpdate = true;
        }
      }
      const prev = gl.getRenderTarget();
      gl.setRenderTarget(target);
      gl.render(scene, cam);
      gl.setRenderTarget(prev);
      saved.forEach(([o, v]) => (o.visible = v));
    }
    let i = 0;
    let cancel = () => {};
    const since = compiling.finished;
    const next = () => {
      // wait for the campus shaders (compiled in parallel after mount) first
      if (compiling.pending === 0 && compiling.finished > since) {
        const t0 = performance.now();
        passes[i++]();
        STEP_LOG?.push(-(performance.now() - t0).toFixed(1));
      }
      if (i < passes.length) cancel = onIdle(next);
    };
    cancel = onIdle(next);
    return () => {
      cancel();
      target.dispose();
    };
  }, [gl, scene]);

  useEffect(() => {
    onBuilt();
    if (location.search.includes('debug')) {
      const tri = (g: THREE.BufferGeometry, n = 1) => ((g.index ? g.index.count : g.getAttribute('position').count) / 3) * n;
      (window as unknown as { __siuCampus: unknown }).__siuCampus = {
        triangles: {
          model: tri(geo.main),
          glass: tri(geo.glass),
          trees: town.trees.reduce((sum, mesh) => sum + tri(mesh.geometry, mesh.count), 0),
          houses: town.houses.reduce((sum, mesh) => sum + tri(mesh.geometry, mesh.count), 0),
          far: tri(town.far.geometry, town.far.count),
          ground: tri(town.ground.geometry) + tri(town.flats.geometry),
        },
        counts: town.counts,
        group: group.current,
        buildingBox: BUILDING_BOX.clone().translate(CAMPUS),
        target: TARGET.center.clone().add(CAMPUS),
        stage,
        journey,
      };
    }
    return () => {
      geo.main.dispose();
      geo.glass.dispose();
      signGeo.dispose();
      town.all.forEach((mesh) => {
        mesh.geometry.dispose();
        mesh.dispose();
      });
      town.ground.geometry.dispose();
      town.flats.geometry.dispose();
      town.contact.geometry.dispose();
      (town.contact.material as THREE.Material).dispose();
      built.contact.dispose();
      mats.sign.map?.dispose();
      Object.values(mats).forEach((mat) => mat.dispose());
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useFrame((_, dt) => {
    const g = group.current;
    if (g) g.visible = stage.campus;
    if (stage.campus && !reduced) swayUniforms.uTime.value += Math.min(dt, 0.1);
  });

  return (
    <group position={CAMPUS}>
      <group ref={group} visible={false}>
        <mesh geometry={geo.main} material={mats.main} castShadow receiveShadow />
        <mesh geometry={geo.glass} material={mats.glass} receiveShadow />
        <mesh geometry={signGeo} material={mats.sign} position={SIGN.center} />
        <primitive object={town.ground} />
        <primitive object={town.flats} />
        {town.all.map((mesh) => (
          <primitive key={mesh.uuid} object={mesh} />
        ))}
        <primitive object={town.contact} />
        <TargetWindow reduced={reduced} />
        <DiveSatellite reduced={reduced} />
        <Life reduced={reduced} material={mats.main} />
      </group>
      {/* mounted for the whole visit; only shown around the descent */}
      {!NO_CLOUDS && <CloudLayers reduced={reduced} />}
    </group>
  );
}
