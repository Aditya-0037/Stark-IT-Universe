import { useThree } from '@react-three/fiber';
import { useEffect, useRef, type ReactNode } from 'react';
import * as THREE from 'three';
import { compiling, prewarm, type PrewarmRegion } from './stage';

/**
 * A region of the world (space, campus, classroom). It stays mounted and on
 * the GPU for the whole visit (only its visibility changes), and once its
 * shaders have compiled it is drawn once, small and offscreen, with every
 * object in it shown (also the ones that only appear later, such as the
 * satellite's beam), so no first draw ever happens in the middle of a move:
 * buffers and textures are uploaded and every shader variant exists.
 * `warmKey` draws it again when its content changes (the campus is built in
 * steps); `prewarm` records when each region is ready (the story waits).
 */
export function Park({
  name,
  warmKey = 0,
  warmCamera,
  beforeWarm,
  children,
}: {
  name: PrewarmRegion;
  warmKey?: number;
  /** A camera that sees the whole region (for the offscreen draw). */
  warmCamera: () => THREE.Camera;
  beforeWarm?: () => void;
  children: ReactNode;
}) {
  const group = useRef<THREE.Group>(null);
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);

  useEffect(() => {
    const g = group.current;
    if (!g) return;
    let cancel = () => {};
    const tryWarm = () => {
      if (compiling.pending > 0 || compiling.finished === 0) {
        cancel = onIdle(tryWarm);
        return;
      }
      warmDraw(gl, scene, g, warmCamera(), beforeWarm);
      if (warmKey >= 0) prewarm.set({ [name]: true } as Partial<Record<PrewarmRegion, boolean>>);
    };
    cancel = onIdle(tryWarm);
    return () => cancel();
  }, [warmKey]); // eslint-disable-line react-hooks/exhaustive-deps

  return <group ref={group}>{children}</group>;
}

/** Draws a subtree once into a tiny target (everything in it shown for that one draw). */
export function warmDraw(gl: THREE.WebGLRenderer, scene: THREE.Scene, root: THREE.Object3D, camera: THREE.Camera, before?: () => void) {
  const saved: [THREE.Object3D, boolean][] = [];
  root.traverse((o) => {
    saved.push([o, o.visible]);
    o.visible = true;
  });
  // only this subtree: hide the rest of the scene for the draw
  const others: [THREE.Object3D, boolean][] = scene.children.filter((c) => !c.getObjectById(root.id) && c !== root && !(c as THREE.Light).isLight).map((c) => [c, c.visible]);
  others.forEach(([c]) => (c.visible = false));
  if (before) {
    before();
    gl.shadowMap.needsUpdate = true;
  }
  const target = new THREE.WebGLRenderTarget(64, 40, { type: THREE.HalfFloatType });
  const prev = gl.getRenderTarget();
  gl.setRenderTarget(target);
  gl.render(scene, camera);
  gl.setRenderTarget(prev);
  target.dispose();
  others.forEach(([c, v]) => (c.visible = v));
  saved.forEach(([o, v]) => (o.visible = v));
}

export function onIdle(cb: () => void) {
  const w = window as Window & typeof globalThis;
  if (typeof w.requestIdleCallback === 'function') {
    const id = w.requestIdleCallback(cb, { timeout: 2500 });
    return () => w.cancelIdleCallback(id);
  }
  const id = window.setTimeout(cb, 120);
  return () => window.clearTimeout(id);
}
