import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Bloom, EffectComposer, N8AO, ToneMapping, Vignette } from '@react-three/postprocessing';
import { ToneMappingMode, type EffectComposer as PPComposer, type Pass, type VignetteEffect } from 'postprocessing';
import { Component, lazy, Suspense, useEffect, useReducer, useRef, useState, type ReactNode, type RefObject } from 'react';
import * as THREE from 'three';
import { reportLowFrameRate, reportWebGLFailure, tierStore } from '../hooks/useDeviceTier';
import { useReducedMotion } from '../hooks/useReducedMotion';
import { introStore } from '../lib/introState';
import { readStore, writeStore } from '../lib/storage';
import { trackPointer } from '../lib/pointer';
import { setWorldReady, worldStore } from '../lib/worldState';
import { Atmosphere } from './Atmosphere';
import { CameraRig } from './CameraRig';
import { ClassroomModel } from './ClassroomModel';
import { Director } from './Director';
import { Starfield } from './Particles';
import { RouteScene } from './RouteScene';
import { startScrollDriver } from './scrollDriver';
import { SolarSystem } from './SolarSystem';
import { compiling, crossfade, smooth, stage } from './stage';

// The campus (school, trees, clouds) is its own chunk, loaded while the
// orbit route is on screen.
const CampusScene = lazy(() => import('./campus/CampusScene'));

/**
 * The 3D layer: one fixed canvas behind the HTML (aria-hidden), loaded with
 * a dynamic import after first paint, FULL tier only. It is an enhancement:
 * every heading, button and form works without it.
 *
 * Performance guards
 *  - devicePixelRatio capped at 1.75
 *  - rendering pauses when no 3D scene is on screen or the tab is hidden
 *  - if the frame rate stays under 45 fps for 2 s, the page drops to LITE
 *  - WebGL errors or a lost context also drop to LITE
 */
/** Timing marks for `?debug` (load, compile and first-frame phases). */
export const mark = (name: string) => {
  if (typeof location === 'undefined' || !location.search.includes('debug')) return;
  const w = window as unknown as { __siuT?: Record<string, number> };
  (w.__siuT ??= {})[name] = Math.round(performance.now());
};
mark('chunk-evaluated');
const DEBUG_FLAGS = typeof location !== 'undefined' && location.search.includes('debug') ? location.search : '';

// The post-processing composer, so its shaders can be precompiled too.
let composerInstance: PPComposer | null = null;

// True while the 3D layer is mounted. Unmounting disposes the WebGL context
// (which fires "context lost"); that must not count as a WebGL failure.
let mounted = false;

export function World() {
  const reduced = useReducedMotion();
  const fadeRef = useRef<HTMLDivElement>(null);
  const stillRef = useRef<HTMLCanvasElement>(null);
  const [onScreen, setOnScreen] = useState(true);
  // Rendering starts only once every shader has compiled (in parallel, off
  // the main thread), so the intro and scrolling never freeze.
  const [compiled, setCompiled] = useState(false);
  // Shader preparation and the first frame block the main thread for a few
  // hundred ms on a cold GPU cache, so both wait until the intro has
  // finished (the 3D code itself still downloads during the intro).
  const introPlaying = introStore.useStore((s) => s.playing);
  const ready = worldStore.useStore((s) => s.ready);
  const regions = useStagedRegions(ready);
  // Precompile runs again whenever a region has been added to the scene.
  const [compileKey, recompile] = useReducer((k: number) => k + 1, 0);
  useEffect(() => {
    if (regions.room) recompile();
  }, [regions.room]);
  const [tabVisible, setTabVisible] = useState(() => document.visibilityState === 'visible');

  useEffect(() => trackPointer(), []);
  useEffect(() => startScrollDriver({ smooth: !reduced }), [reduced]);

  // Pause when the 3D zone is scrolled away (sections there are opaque).
  useEffect(() => {
    const zone = document.querySelector('[data-world-zone]');
    if (!zone || !('IntersectionObserver' in window)) return;
    const io = new IntersectionObserver(([e]) => setOnScreen(e.isIntersecting), { rootMargin: '0px 0px 0px 0px' });
    io.observe(zone);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    const onVis = () => setTabVisible(document.visibilityState === 'visible');
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, []);

  useEffect(() => {
    mounted = true;
    return () => {
      mounted = false;
      setWorldReady(false);
    };
  }, []);

  const running = onScreen && tabVisible && !introPlaying;

  return (
    <div className="world" aria-hidden="true" ref={fadeRef}>
      <WorldErrorBoundary>
        <Canvas
          dpr={[1, 1.75]}
          shadows={!DEBUG_FLAGS.includes('noshadow')}
          gl={{ antialias: false, powerPreference: 'high-performance', stencil: false, alpha: false }}
          camera={{ fov: 38, near: 0.1, far: 600, position: [0, 1.7, 17.5] }}
          frameloop={running && compiled ? 'always' : 'never'}
          eventSource={document.getElementById('root')!}
          eventPrefix="client"
          onCreated={({ gl }) => {
            mark('canvas-created');
            gl.domElement.addEventListener('webglcontextlost', (e) => {
              e.preventDefault();
              // Checked after the current commit, so our own unmount is ignored.
              window.setTimeout(() => mounted && reportWebGLFailure(), 0);
            });
          }}
        >
          <Director reduced={reduced} />
          <Atmosphere />
          <Suspense fallback={null}>
            <Starfield reduced={reduced} />
            <SpaceOnly>
              <SolarSystem reduced={reduced} />
              <RouteScene reduced={reduced} />
            </SpaceOnly>
            {regions.room && <ClassroomModel />}
            <CameraRig reduced={reduced} fadeRef={fadeRef} />
            <ReadySignal />
            {!introPlaying && <Precompile key={compileKey} onDone={() => setCompiled(true)} />}
          </Suspense>
          {regions.campus && (
            <Suspense fallback={null}>
              <CampusScene reduced={reduced} onBuilt={recompile} />
            </Suspense>
          )}
          <Snapshot canvasRef={stillRef} />
          <FrameRateGuard running={running} />
          {DEBUG_FLAGS && <FrameStats />}
          {!DEBUG_FLAGS.includes('nofx') && <Effects />}
        </Canvas>
      </WorldErrorBoundary>
      <canvas ref={stillRef} className="world__still" />
    </div>
  );
}

export default World;

/** Draws the star system and route only while the camera is in space. */
function SpaceOnly({ children }: { children: ReactNode }) {
  const group = useRef<THREE.Group>(null);
  useFrame(() => {
    if (group.current) group.current.visible = stage.space;
  }, -4);
  return <group ref={group}>{children}</group>;
}

const AO_INTENSITY = 1.6;
const AO_OFF_KEY = 'siu-no-ao';
interface AoConfig {
  transparencyAware: boolean;
  denoiseIterations: number;
  intensity: number;
}

/**
 * Light ambient occlusion on the campus only (N8AO, half resolution, low
 * intensity), bloom (star, screens, lamps, the gold route, the glowing
 * classroom window), neutral tone mapping (keeps the light classroom close
 * to the page's paper colour) and a vignette, lighter by day.
 */
function Effects() {
  const vignette = useRef<VignetteEffect>(null);
  const ao = useRef<Pass>(null);
  useEffect(() => {
    // N8AO would otherwise detect the transparent objects (stars, clouds,
    // sprites) and render them twice more every frame.
    const pass = aoPass();
    if (pass) {
      pass.autoDetectTransparency = false;
      pass.configuration.transparencyAware = false;
      // one blur pass is enough at this low intensity (it is a third of the cost)
      pass.configuration.denoiseIterations = 1;
    }
  }, []);
  const aoPass = () => ao.current as (Pass & { autoDetectTransparency: boolean; configuration: AoConfig }) | null;
  // AO is the first thing to go on a slow GPU: if the campus view runs
  // under 55 fps with it for two seconds, it fades out for the session.
  const warm = useRef(3);
  const budget = useRef(
    (() => {
      const off = readStore('session', AO_OFF_KEY) === '1';
      return { time: 0, frames: 0, slow: 0, off, fade: off ? 0 : 1 };
    })(),
  );
  useFrame((_, dt) => {
    if (vignette.current) vignette.current.darkness = stage.vignette;
    const pass = aoPass();
    if (!pass) return;
    const b = budget.current;
    // AO on the campus only; it fades out as the facade fills the view
    let k = stage.campus && !stage.room && !DEBUG_FLAGS.includes('noao') ? 1 - smooth(0.84, 0.9, stage.descent) : 0;
    if (k > 0.01 && !b.off) {
      b.time += Math.min(dt, 0.25);
      b.frames += 1;
      if (b.time >= 1) {
        b.slow = b.frames / b.time < 55 ? b.slow + 1 : 0;
        b.time = 0;
        b.frames = 0;
        if (b.slow >= 2) {
          b.off = true;
          writeStore('session', AO_OFF_KEY, '1');
        }
      }
    }
    b.fade = Math.max(0, Math.min(1, b.fade + (b.off ? -dt : dt) / 0.6));
    k *= b.fade;
    pass.enabled = k > 0.01;
    // Its first frame sets up its buffers (a long frame): do that while the
    // 3D layer is still fading in, at no visible strength.
    if (warm.current > 0) {
      warm.current -= 1;
      pass.enabled = true;
      k = 0.0005 / AO_INTENSITY;
    }
    const intensity = AO_INTENSITY * k;
    if (Math.abs(pass.configuration.intensity - intensity) > 0.02) pass.configuration.intensity = intensity;
  });
  return (
    <EffectComposer
      multisampling={4}
      ref={(c) => {
        composerInstance = c as unknown as PPComposer | null;
        if (DEBUG_FLAGS) (window as unknown as { __siuComposer: unknown }).__siuComposer = c;
      }}
    >
      <N8AO ref={ao as never} halfRes quality="performance" aoRadius={2.2} distanceFalloff={0.8} intensity={AO_INTENSITY} color="#1B2433" />
      <Bloom mipmapBlur intensity={1.05} luminanceThreshold={0.95} luminanceSmoothing={0.12} radius={0.72} />
      <ToneMapping mode={ToneMappingMode.NEUTRAL} />
      {/* the wrapper types its ref as the class; it is the effect instance */}
      <Vignette ref={vignette as never} offset={0.28} darkness={0.5} />
    </EffectComposer>
  );
}

/**
 * The hero only needs the star system, so the classroom is built
 * afterwards, in idle time (smaller main-thread tasks, so clicks right
 * after load stay responsive). The campus chunk loads once the orbit route
 * comes near the screen. Both load at once if the visitor jumps further
 * down the page.
 */
function useStagedRegions(ready: boolean) {
  const [room, setRoom] = useState(false);
  const [campus, setCampus] = useState(false);
  useEffect(() => {
    if (!ready || room) return;
    // Safari has no requestIdleCallback: fall back to a short timeout.
    const w = window as Window & typeof globalThis;
    if (typeof w.requestIdleCallback === 'function') {
      const id = w.requestIdleCallback(() => setRoom(true), { timeout: 3000 });
      return () => w.cancelIdleCallback(id);
    }
    const id = w.setTimeout(() => setRoom(true), 300);
    return () => w.clearTimeout(id);
  }, [ready, room]);
  useEffect(() => {
    if (!('IntersectionObserver' in window)) {
      setCampus(true);
      setRoom(true);
      return;
    }
    const watch = (id: string, margin: string, then: () => void) => {
      const el = document.getElementById(id);
      if (!el) return () => {};
      const io = new IntersectionObserver(([e]) => e.isIntersecting && then(), { rootMargin: margin });
      io.observe(el);
      return () => io.disconnect();
    };
    const stopRoute = watch('route', '100% 0px', () => setCampus(true));
    const stopDescent = watch('descent', '250% 0px', () => {
      setCampus(true);
      setRoom(true);
    });
    return () => {
      stopRoute();
      stopDescent();
    };
  }, []);
  return { room, campus };
}

/**
 * Reduce Motion crossfade between the descent's stills: when the camera rig
 * asks, this copies the frame that was just drawn onto a 2D canvas over the
 * 3D layer (it runs after the post-processing render), the rig then cuts
 * underneath, and the copy fades out over 400 ms.
 */
function Snapshot({ canvasRef }: { canvasRef: RefObject<HTMLCanvasElement> }) {
  const gl = useThree((s) => s.gl);
  useFrame(() => {
    if (!crossfade.request) return;
    crossfade.request = false;
    const out = canvasRef.current;
    const ctx = out?.getContext('2d');
    if (out && ctx) {
      const src = gl.domElement;
      if (out.width !== src.width || out.height !== src.height) {
        out.width = src.width;
        out.height = src.height;
      }
      ctx.drawImage(src, 0, 0);
      out.style.transition = 'none';
      out.style.opacity = '1';
      requestAnimationFrame(() =>
        requestAnimationFrame(() => {
          out.style.transition = 'opacity 400ms linear';
          out.style.opacity = '0';
        }),
      );
    }
    crossfade.ready = true;
  }, 2);
  return null;
}

/**
 * Compiles every material in the world (space, campus and classroom, even
 * the hidden ones) with KHR_parallel_shader_compile, and uploads textures,
 * before the first frame. Without this the first frame blocks the main
 * thread for about a second, and the descent hitches when the campus and
 * classroom first appear.
 */
function Precompile({ onDone }: { onDone: () => void }) {
  // Re-runs (by key) when the campus and classroom are added; only the
  // first run gates rendering.
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const camera = useThree((s) => s.camera);
  const done = useRef(onDone);
  done.current = onDone;
  useEffect(() => {
    let alive = true;
    compiling.pending += 1;
    let counted = true;
    const finish = () => {
      if (counted) {
        compiling.pending -= 1;
        compiling.finished += 1;
      }
      counted = false;
    };
    const timer = window.setTimeout(async () => {
      mark('compile-start');
      try {
        scene.traverse((o) => {
          const mat = (o as THREE.Mesh).material as THREE.Material & { map?: THREE.Texture | null };
          if (mat && !Array.isArray(mat) && mat.map) gl.initTexture(mat.map);
        });
        mark('textures-uploaded');
        // The scene renders into the post-processing buffer, not the screen,
        // and three.js compiles a different shader variant for that (linear
        // output, no tone mapping). Compile against an offscreen target so
        // the variants match what is actually drawn.
        const target = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType });
        const previous = gl.getRenderTarget();
        gl.setRenderTarget(target);
        const ready = [gl.compileAsync(scene, camera)];
        // The shadow maps' depth shaders (plain and instanced meshes) are
        // only made on the first shadow render: compile them now too, with
        // the scene's lights but no fog (as the shadow pass draws them).
        const fog = scene.fog;
        scene.fog = null;
        ready.push(gl.compileAsync(shadowDepthScene(), camera, scene));
        scene.fog = fog;
        // Post-processing passes: bloom internals draw into buffers, the
        // final pass draws to the screen; compile each for its target.
        const pp = postprocessingScenes(composerInstance);
        if (pp) {
          const quadCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
          ready.push(gl.compileAsync(pp.toTarget, quadCam));
          gl.setRenderTarget(null);
          ready.push(gl.compileAsync(pp.toScreen, quadCam));
        }
        gl.setRenderTarget(previous);
        await Promise.all(ready);
        target.dispose();
        mark('compile-done');
      } catch {
        /* fall through: the first frame compiles whatever is left */
      }
      finish();
      if (alive) done.current();
    }, 0);
    return () => {
      alive = false;
      window.clearTimeout(timer);
      finish();
    };
  }, [gl, scene, camera]);
  return null;
}

/** Meshes carrying the depth material three.js uses for directional-light shadow maps. */
function shadowDepthScene() {
  const s = new THREE.Scene();
  const geo = new THREE.BoxGeometry();
  // shadow side of a front-sided material is its back side
  const mat = () => new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, side: THREE.BackSide });
  s.add(new THREE.Mesh(geo, mat()));
  const inst = new THREE.InstancedMesh(geo, mat(), 1);
  inst.setColorAt(0, new THREE.Color(1, 1, 1));
  s.add(inst);
  return s;
}

/** Fullscreen-quad scenes holding every post-processing material. */
function postprocessingScenes(composer: PPComposer | null) {
  if (!composer) return null;
  type AnyPass = {
    fullscreenMaterial?: THREE.Material;
    renderToScreen?: boolean;
    effects?: {
      luminancePass?: { fullscreenMaterial?: THREE.Material };
      mipmapBlurPass?: { downsamplingMaterial?: THREE.Material; upsamplingMaterial?: THREE.Material };
    }[];
  };
  const quad = new THREE.PlaneGeometry(2, 2);
  const toTarget = new THREE.Scene();
  const toScreen = new THREE.Scene();
  const add = (s: THREE.Scene, m?: THREE.Material) => m && s.add(new THREE.Mesh(quad, m));
  for (const pass of composer.passes as unknown as AnyPass[]) {
    add(pass.renderToScreen ? toScreen : toTarget, pass.fullscreenMaterial);
    // N8AO keeps its materials on full-screen helpers (the ...Quad fields)
    for (const value of Object.values(pass as unknown as Record<string, unknown>)) {
      const m = (value as { material?: { isMaterial?: boolean } } | null)?.material;
      if (m?.isMaterial && value !== pass) add(toTarget, m as THREE.Material);
    }
    for (const e of pass.effects ?? []) {
      add(toTarget, e.luminancePass?.fullscreenMaterial);
      add(toTarget, e.mipmapBlurPass?.downsamplingMaterial);
      add(toTarget, e.mipmapBlurPass?.upsamplingMaterial);
    }
  }
  return { toTarget, toScreen };
}

/** Marks the world ready once the first frame has rendered. */
function ReadySignal() {
  const done = useRef(false);
  const frames = useRef(0);
  const three = useThree();
  useEffect(() => {
    // `?debug` exposes the camera and shared positions for testing.
    if (!location.search.includes('debug')) return;
    import('./system').then(({ shared }) => {
      (window as unknown as { __siu: unknown }).__siu = { three, shared };
    });
  }, [three]);
  useFrame(() => {
    if (done.current) return;
    if (frames.current === 0) mark('first-frame');
    if (++frames.current < 2) return;
    mark('second-frame');
    done.current = true;
    requestAnimationFrame(() => setWorldReady(true));
  });
  return null;
}

/**
 * `?debug`: per-frame renderer totals over every pass (scene, shadows,
 * post-processing, the window view) in window.__siuStats.
 */
function FrameStats() {
  const gl = useThree((s) => s.gl);
  useEffect(() => {
    gl.info.autoReset = false;
    return () => {
      gl.info.autoReset = true;
    };
  }, [gl]);
  const start = useRef(0);
  useFrame(() => {
    gl.info.reset();
    start.current = performance.now();
  }, -100);
  useFrame(() => {
    const w = window as unknown as { __siuStats?: { calls: number; triangles: number; frame: number; js: number } };
    w.__siuStats = { calls: gl.info.render.calls, triangles: gl.info.render.triangles, frame: gl.info.render.frame, js: performance.now() - start.current };
  }, 100);
  return null;
}

/**
 * The brief's frame-rate rule: under 45 fps for 2 seconds -> LITE.
 * Measured in 0.5 s buckets after a 2.5 s warm-up, only while rendering.
 * Not applied when the visitor explicitly switched Lite mode off.
 */
function FrameRateGuard({ running }: { running: boolean }) {
  const state = useRef({ warm: 0, bucketTime: 0, bucketFrames: 0, slow: 0, reported: false });
  const invalidate = useThree((s) => s.invalidate);

  useEffect(() => {
    // Restart the warm-up whenever rendering resumes.
    state.current.warm = 0;
    state.current.slow = 0;
    state.current.bucketTime = 0;
    state.current.bucketFrames = 0;
    if (running) invalidate();
  }, [running, invalidate]);

  useFrame((_, dt) => {
    const s = state.current;
    // Pauses (scene off screen, tab hidden) reset the guard via `running`,
    // so a long frame here really is a slow device.
    if (s.reported) return;
    if (s.warm < 2.5) {
      s.warm += dt;
      return;
    }
    s.bucketTime += dt;
    s.bucketFrames += 1;
    if (s.bucketTime >= 0.5) {
      const fps = s.bucketFrames / s.bucketTime;
      s.slow = fps < 45 ? s.slow + 1 : 0;
      s.bucketTime = 0;
      s.bucketFrames = 0;
      if (s.slow >= 4 && tierStore.get().override !== 'off') {
        s.reported = true;
        reportLowFrameRate();
      }
    }
  });
  return null;
}

class WorldErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch() {
    reportWebGLFailure();
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}
