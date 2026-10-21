import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { journey } from '../../lib/journey';
import { CAMPUS, compiling, refreshShadow, refs, stage } from '../stage';
import { redrawOnFonts } from '../textures';
import { CloudLayers, prepareCloudSteps } from './Clouds';
import { BUILDING_BOX, buildCampusSteps, SIGN, type CampusGeometry } from './school';
import { TARGET } from './layout';
import { TargetWindow } from './TargetWindow';
import { buildTreeSteps, CANOPY, contactShadowTexture, swayUniforms, treeMaterial, type Species, type TreeSet } from './trees';

/**
 * The campus the camera lands on (its own chunk, loaded while the orbit
 * route is on screen): one merged, vertex-coloured school model, three
 * instanced tree species with contact shadows, the signboard, the glowing
 * target window and the cloud layers. Drawn only around the descent; the
 * clouds are disposed once the camera is inside the classroom.
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

const SPECIES: Species[] = ['ashoka', 'neem', 'gulmohar'];
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
}

export default function CampusScene({ reduced, onBuilt }: { reduced: boolean; onBuilt: () => void }) {
  const [built, setBuilt] = useState<Built | null>(null);
  useEffect(
    () =>
      runInIdle(
        (function* () {
          const campus = yield* buildCampusSteps();
          const trees = yield* buildTreeSteps();
          yield* prepareCloudSteps();
          return { campus, trees };
        })(),
        setBuilt,
      ),
    [],
  );
  return built ? <Campus built={built} reduced={reduced} onBuilt={onBuilt} /> : null;
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
      blob: new THREE.MeshBasicMaterial({
        map: contactShadowTexture(),
        color: '#1F2B1C',
        transparent: true,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: -2,
        polygonOffsetUnits: -2,
      }),
    }),
    [],
  );
  const signGeo = useMemo(() => new THREE.PlaneGeometry(SIGN.width, SIGN.height), []);

  // Trees: one InstancedMesh per species + one for all the contact shadows.
  const trees = useMemo(() => {
    const { placed, geometry } = built.trees;
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const up = new THREE.Vector3(0, 1, 0);
    const c = new THREE.Color();
    const meshes = SPECIES.map((sp) => {
      const list = placed[sp];
      const mesh = new THREE.InstancedMesh(geometry[sp], mats.tree, list.length);
      list.forEach((t, i) => {
        m.compose(new THREE.Vector3(t.x, 0, t.z), q.setFromAxisAngle(up, t.rot), new THREE.Vector3(t.scale, t.scale, t.scale));
        mesh.setMatrixAt(i, m);
        mesh.setColorAt(i, c.setScalar(1 + t.tint));
      });
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.computeBoundingSphere();
      return mesh;
    });
    const all = SPECIES.flatMap((sp) => placed[sp].map((t) => ({ ...t, r: CANOPY[sp] * t.scale })));
    const blobGeo = new THREE.PlaneGeometry(1, 1);
    blobGeo.rotateX(-Math.PI / 2);
    const blobs = new THREE.InstancedMesh(blobGeo, mats.blob, all.length);
    all.forEach((t, i) => {
      const s = t.r * 2.3;
      m.compose(new THREE.Vector3(t.x + 0.25, 0.02, t.z - 0.2), q.identity(), new THREE.Vector3(s, 1, s));
      blobs.setMatrixAt(i, m);
    });
    blobs.computeBoundingSphere();
    blobs.renderOrder = -1;
    return { meshes, blobs, count: all.length };
  }, [built, mats]);

  // The clouds are only needed around the descent: dispose them once the
  // classroom has taken over, build them again when scrolling back up.
  const [cloudsOn, setCloudsOn] = useState(true);
  const cloudsRef = useRef(true);
  const was = useRef(false);

  useEffect(() => {
    swayUniforms.uSway.value = reduced ? 0 : 0.0175;
  }, [reduced]);

  // Draw the campus once, small and offscreen, in idle time, one part per
  // idle period: buffers, textures and the shadow map are then ready before
  // it first comes into view (otherwise the first frames of the dive would
  // stall on the uploads).
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  useEffect(() => {
    const root = group.current?.parent;
    const parts = group.current ? [...group.current.children] : [];
    if (!root) return;
    const cam = new THREE.PerspectiveCamera(30, 1.6, 0.1, 600);
    cam.position.set(82, 77, 82).add(CAMPUS);
    cam.lookAt(CAMPUS);
    cam.updateMatrixWorld();
    const target = new THREE.WebGLRenderTarget(64, 40, { type: THREE.HalfFloatType });
    const school = (o: THREE.Object3D) => o === parts[0] || o === parts[1] || o === parts[2];
    const isTree = (o: THREE.Object3D) => (o as THREE.InstancedMesh).isInstancedMesh && o !== parts[6];
    const passes: (() => void)[] = [
      // the school, the trees, the window and contact shadows, the clouds, then the sun's shadow map
      () => draw(school),
      () => draw(isTree),
      () => draw((o) => !school(o) && !isTree(o)),
      () => draw(() => false, true),
      () => draw(() => true, false, true),
      () => target.dispose(),
    ];
    function draw(keep: (o: THREE.Object3D) => boolean, clouds = false, shadows = false) {
      if (!root || stage.campus) return;
      const campusGroup = group.current!;
      const shown = root.children.map((c) => c.visible);
      const partShown = campusGroup.children.map((c) => c.visible);
      root.children.forEach((c) => (c.visible = c === campusGroup ? !clouds || shadows : clouds));
      campusGroup.children.forEach((c) => (c.visible = keep(c)));
      if (shadows && refs.campusSun) {
        refs.campusSun.shadow.needsUpdate = true;
        gl.shadowMap.needsUpdate = true;
      }
      const prev = gl.getRenderTarget();
      gl.setRenderTarget(target);
      gl.render(scene, cam);
      gl.setRenderTarget(prev);
      campusGroup.children.forEach((c, i) => (c.visible = partShown[i]));
      root.children.forEach((c, i) => (c.visible = shown[i]));
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
    refreshShadow('campus');
    if (location.search.includes('debug')) {
      const tri = (g: THREE.BufferGeometry, n = 1) => ((g.index ? g.index.count : g.getAttribute('position').count) / 3) * n;
      (window as unknown as { __siuCampus: unknown }).__siuCampus = {
        triangles: {
          model: tri(geo.main),
          glass: tri(geo.glass),
          trees: trees.meshes.reduce((sum, mesh) => sum + tri(mesh.geometry, mesh.count), 0),
          treeCount: trees.count,
          shadows: tri(trees.blobs.geometry, trees.blobs.count),
        },
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
      trees.meshes.forEach((mesh) => {
        mesh.geometry.dispose();
        mesh.dispose();
      });
      trees.blobs.geometry.dispose();
      trees.blobs.dispose();
      mats.sign.map?.dispose();
      mats.blob.map?.dispose();
      Object.values(mats).forEach((mat) => mat.dispose());
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useFrame((_, dt) => {
    const g = group.current;
    if (g) {
      g.visible = stage.campus;
      if (stage.campus && !was.current) refreshShadow('campus');
      was.current = stage.campus;
    }
    if (stage.campus && !reduced) swayUniforms.uTime.value += Math.min(dt, 0.1);
    const want = !stage.room || journey.toClassroom < 0.2;
    if (want !== cloudsRef.current) {
      cloudsRef.current = want;
      setCloudsOn(want);
    }
  });

  return (
    <group position={CAMPUS}>
      <group ref={group} visible={false}>
        <mesh geometry={geo.main} material={mats.main} castShadow receiveShadow />
        <mesh geometry={geo.glass} material={mats.glass} receiveShadow />
        <mesh geometry={signGeo} material={mats.sign} position={SIGN.center} />
        {trees.meshes.map((mesh, i) => (
          <primitive key={SPECIES[i]} object={mesh} />
        ))}
        <primitive object={trees.blobs} />
        <TargetWindow reduced={reduced} />
      </group>
      {cloudsOn && !NO_CLOUDS && <CloudLayers />}
    </group>
  );
}
