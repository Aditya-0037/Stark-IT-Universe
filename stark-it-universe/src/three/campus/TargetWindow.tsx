import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { poseRoomOverview } from '../CameraRig';
import { compiling, refs, ROOM_LAYER, stage } from '../stage';
import { redrawOnFonts } from '../textures';
import { Builder } from './builder';
import { TARGET } from './layout';

/**
 * The one glowing first-floor classroom window: warm glass behind a softly
 * pulsing SIU-gold outline, with a small "Your classroom" label.
 *
 * As the camera glides in and the window fills the screen, its glass fades
 * out and the classroom diorama appears behind it: the room is drawn (from
 * the camera pose that follows the window) into a render target, and the
 * glass shows that image in screen space, like a portal. When the window
 * covers the whole screen the frame already equals the room view, so the
 * switch to the room region (stage.room) shows no cut.
 */
const vertex = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;
const fragment = /* glsl */ `
  uniform sampler2D uRoom;
  uniform vec2 uRes;
  uniform float uReveal;
  uniform float uHasRoom;
  uniform float uGlow;
  uniform float uLit;
  varying vec2 vUv;
  float bar(float x, float c, float w) {
    float d = abs(x - c);
    float aa = fwidth(x) * 1.5;
    return 1.0 - smoothstep(w, w + aa, d);
  }
  void main() {
    // warm, lit classroom glass (HDR: it blooms), lighter at the top
    vec3 glass = mix(vec3(1.05, 0.62, 0.24), vec3(1.25, 0.95, 0.58), smoothstep(0.0, 1.0, vUv.y)) * uGlow;
    glass += vec3(0.16, 0.12, 0.08) * (1.0 - smoothstep(0.0, 0.22, abs(vUv.x - vUv.y * 0.6 - 0.12)));
    // until the satellite's light reaches it, plain glass like its neighbours
    vec3 plain = mix(vec3(0.2, 0.29, 0.4), vec3(0.43, 0.55, 0.66), vUv.y);
    glass = mix(plain, glass, uLit);
    float grill = max(max(bar(vUv.x, 0.25, 0.01), bar(vUv.x, 0.75, 0.01)), bar(vUv.y, 0.35, 0.012));
    float frame = max(bar(vUv.x, 0.5, 0.018), bar(vUv.y, 0.68, 0.02));
    vec3 c = mix(glass, vec3(0.2, 0.22, 0.26), grill * 0.9);
    c = mix(c, vec3(0.78, 0.76, 0.72), frame);
    if (uHasRoom > 0.5) {
      vec3 room = texture2D(uRoom, gl_FragCoord.xy / uRes).rgb;
      c = mix(c, room, uReveal);
    }
    gl_FragColor = vec4(c, 1.0);
  }
`;

function labelTexture() {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 128;
  const g = c.getContext('2d')!;
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  const draw = () => {
    g.clearRect(0, 0, 512, 128);
    const r = 46;
    g.beginPath();
    g.roundRect(8, 18, 496, 92, r);
    g.fillStyle = 'rgba(11, 22, 64, 0.94)';
    g.fill();
    g.lineWidth = 5;
    g.strokeStyle = '#FFB52E';
    g.stroke();
    g.fillStyle = '#FFFFFF';
    g.font = '600 50px Poppins, "Segoe UI", Arial, sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText('Your classroom', 256, 66);
    t.needsUpdate = true;
  };
  draw();
  redrawOnFonts(draw, t);
  return t;
}

/** Fraction of the screen covered by a convex quad given in NDC (clipped to the screen). */
function coverage(pts: THREE.Vector2[]) {
  let poly = pts;
  const clip = (keep: (p: THREE.Vector2) => number) => {
    const out: THREE.Vector2[] = [];
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i];
      const b = poly[(i + 1) % poly.length];
      const da = keep(a);
      const db = keep(b);
      if (da >= 0) out.push(a);
      if (da >= 0 !== db >= 0) out.push(a.clone().lerp(b, da / (da - db)));
    }
    poly = out;
  };
  clip((p) => 1 - p.x);
  clip((p) => p.x + 1);
  clip((p) => 1 - p.y);
  clip((p) => p.y + 1);
  let area = 0;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % poly.length];
    area += a.x * b.y - b.x * a.y;
  }
  return Math.abs(area) / 2 / 4;
}

export function TargetWindow({ reduced }: { reduced: boolean }) {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  const size = useThree((s) => s.size);

  const glassMat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: {
          uRoom: { value: null },
          uRes: { value: new THREE.Vector2(1, 1) },
          uReveal: { value: 0 },
          uHasRoom: { value: 0 },
          uGlow: { value: 1 },
          uLit: { value: 0 },
        },
        vertexShader: vertex,
        fragmentShader: fragment,
        fog: false,
      }),
    [],
  );
  const outlineMat = useMemo(() => new THREE.MeshBasicMaterial({ color: new THREE.Color(1.6, 1.0, 0.25), fog: false, transparent: true }), []);
  const label = useMemo(() => labelTexture(), []);
  const labelMat = useMemo(
    () =>
      new THREE.SpriteMaterial({ map: label, transparent: true, depthWrite: false, depthTest: false, sizeAttenuation: false, fog: false }),
    [label],
  );

  const geo = useMemo(() => {
    const { width: w, height: h } = TARGET;
    const glass = new THREE.PlaneGeometry(w, h);
    glass.rotateY(Math.PI / 2); // faces +x, like the facade
    // gold outline just outside the white window frame
    const o = 0.24;
    const t = 0.06;
    const b = new Builder();
    const c = new THREE.Color(1, 1, 1);
    const W = w / 2 + o;
    const H = h / 2 + o;
    b.box(-0.015, H, -W - t, 0.015, H + t, W + t, c);
    b.box(-0.015, -H - t, -W - t, 0.015, -H, W + t, c);
    b.box(-0.015, -H, W, 0.015, H, W + t, c);
    b.box(-0.015, -H, -W - t, 0.015, H, -W, c);
    return { glass, outline: b.build() };
  }, []);

  useEffect(
    () => () => {
      geo.glass.dispose();
      geo.outline.dispose();
      glassMat.dispose();
      outlineMat.dispose();
      labelMat.dispose();
      label.dispose();
    },
    [geo, glassMat, outlineMat, labelMat, label],
  );

  const rt = useRef<THREE.WebGLRenderTarget | null>(null);
  const roomCam = useMemo(() => {
    const c = new THREE.PerspectiveCamera(30, 1, 0.1, 600);
    c.layers.set(ROOM_LAYER);
    return c;
  }, []);
  const corners = useMemo(() => {
    const { width: w, height: h, center } = TARGET;
    // campus-local corners of the glass (the facade faces +x)
    return [
      [0, -h / 2, w / 2],
      [0, -h / 2, -w / 2],
      [0, h / 2, -w / 2],
      [0, h / 2, w / 2],
    ].map(([x, y, z]) => new THREE.Vector3(center.x + x + 0.012, center.y + y, center.z + z));
  }, []);
  const tmp = useMemo(() => ({ v: new THREE.Vector3(), ndc: [0, 1, 2, 3].map(() => new THREE.Vector2()), size: new THREE.Vector2() }), []);
  const group = useRef<THREE.Group>(null);
  const roomReady = useRef(false);

  useEffect(() => () => rt.current?.dispose(), []);

  // Draw the classroom once, small, in idle time, a few parts per idle
  // period: its buffers and shadow map are then ready before the window
  // first shows it.
  useEffect(() => {
    let timer = 0;
    let idle = 0;
    const w = window as Window & typeof globalThis;
    const target = new THREE.WebGLRenderTarget(64, 40, { type: THREE.HalfFloatType });
    let part = 0;
    const PARTS = 4;
    const warm = () => {
      const room = refs.room;
      if (!room || !refs.roomLighting || compiling.pending > 0) {
        timer = window.setTimeout(schedule, 1000);
        return;
      }
      room.traverse((o) => o.layers.enable(ROOM_LAYER));
      const kids = room.children;
      const shown = kids.map((k) => k.visible);
      const last = part === PARTS;
      // a slice of the room's parts per pass; the last pass draws it all with its shadow map
      kids.forEach((k, i) => (k.visible = last ? shown[i] : shown[i] && i % PARTS === part));
      if (last && refs.roomSun) {
        refs.roomSun.shadow.needsUpdate = true;
        gl.shadowMap.needsUpdate = true;
      }
      poseRoomOverview(roomCam, size.width, size.height);
      const wasVisible = room.visible;
      room.visible = true;
      refs.roomLighting(true);
      const prev = gl.getRenderTarget();
      gl.setRenderTarget(target);
      gl.render(scene, roomCam);
      gl.setRenderTarget(prev);
      refs.roomLighting(false);
      room.visible = wasVisible;
      kids.forEach((k, i) => (k.visible = shown[i]));
      part += 1;
      if (part <= PARTS) schedule();
      else {
        target.dispose();
        // the full-size target the window shows the room through: allocated
        // and drawn once now, not at the window approach
        gl.getDrawingBufferSize(tmp.size);
        rt.current ??= new THREE.WebGLRenderTarget(tmp.size.x, tmp.size.y, { type: THREE.HalfFloatType });
        room.visible = true;
        refs.roomLighting(true);
        const before = gl.getRenderTarget();
        gl.setRenderTarget(rt.current);
        gl.render(scene, roomCam);
        gl.setRenderTarget(before);
        refs.roomLighting(false);
        room.visible = wasVisible;
      }
    };
    const schedule = () => {
      if (typeof w.requestIdleCallback === 'function') idle = w.requestIdleCallback(warm, { timeout: 4000 });
      else timer = window.setTimeout(warm, 500);
    };
    schedule();
    return () => {
      window.clearTimeout(timer);
      if (idle && typeof w.cancelIdleCallback === 'function') w.cancelIdleCallback(idle);
      target.dispose();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    const pulse = reduced ? 0.6 : 0.5 + 0.5 * Math.sin(t * 2.2);
    outlineMat.color.setRGB(1.0, 0.71, 0.18).multiplyScalar(1.35 + pulse * 0.9);

    const d = stage.descent;
    const lit = stage.windowLit;
    glassMat.uniforms.uLit.value = lit;
    outlineMat.opacity = lit;
    // brighter from afar (a small warm bloom over the campus), softer up close
    if (group.current) {
      group.current.localToWorld(tmp.v.copy(TARGET.center));
      glassMat.uniforms.uGlow.value = THREE.MathUtils.lerp(1, 1.7, THREE.MathUtils.smoothstep(camera.position.distanceTo(tmp.v), 12, 70));
    }
    // label: shown over the campus, gone before the camera reaches the window
    labelMat.opacity = reduced ? (stage.still === 'campus' ? 1 : 0) : lit * (1 - THREE.MathUtils.smoothstep(d, 0.84, 0.89));

    let reveal = 0;
    if (stage.campus && !reduced && d > 0.8 && group.current) {
      camera.updateMatrixWorld();
      let behind = false;
      corners.forEach((c, i) => {
        tmp.v.copy(c);
        group.current!.localToWorld(tmp.v);
        tmp.v.applyMatrix4(camera.matrixWorldInverse);
        if (tmp.v.z > -camera.near) behind = true;
        tmp.v.applyMatrix4(camera.projectionMatrix);
        tmp.ndc[i].set(tmp.v.x, tmp.v.y);
      });
      const cov = behind ? 1 : coverage(tmp.ndc);
      reveal = THREE.MathUtils.smoothstep(cov, 0.22, 0.72);
    }
    stage.portal = reveal;
    glassMat.uniforms.uReveal.value = reveal;

    if (reveal <= 0) {
      // (the target stays allocated for the visit: no allocation mid-move)
      roomReady.current = false;
      glassMat.uniforms.uHasRoom.value = 0;
      return;
    }

    // Draw the classroom for the window, from the pose the camera lands on
    // (pulled back a little until the window is fully open).
    const room = refs.room;
    if (!room || !refs.roomLighting) return;
    gl.getDrawingBufferSize(tmp.size);
    if (!rt.current) rt.current = new THREE.WebGLRenderTarget(tmp.size.x, tmp.size.y, { type: THREE.HalfFloatType });
    else if (rt.current.width !== tmp.size.x || rt.current.height !== tmp.size.y) rt.current.setSize(tmp.size.x, tmp.size.y);
    if (!roomReady.current) {
      room.traverse((o) => o.layers.enable(ROOM_LAYER));
      if (refs.roomSun) {
        refs.roomSun.shadow.needsUpdate = true;
        gl.shadowMap.needsUpdate = true;
      }
      roomReady.current = true;
    }
    poseRoomOverview(roomCam, size.width, size.height, (1 - reveal) * 0.12);
    const wasVisible = room.visible;
    room.visible = true;
    refs.roomLighting(true);
    const prev = gl.getRenderTarget();
    gl.setRenderTarget(rt.current);
    gl.clear();
    gl.render(scene, roomCam);
    gl.setRenderTarget(prev);
    refs.roomLighting(false);
    room.visible = wasVisible;
    glassMat.uniforms.uRoom.value = rt.current.texture;
    (glassMat.uniforms.uRes.value as THREE.Vector2).copy(tmp.size);
    glassMat.uniforms.uHasRoom.value = 1;
  }, 0.5);

  const c = TARGET.center;
  return (
    <group ref={group}>
      <mesh geometry={geo.glass} material={glassMat} position={[c.x + 0.012, c.y, c.z]} />
      <mesh geometry={geo.outline} material={outlineMat} position={[c.x + 0.04, c.y, c.z]} />
      <sprite material={labelMat} renderOrder={10} position={[c.x + 0.45, c.y + TARGET.height / 2 + 1.05, c.z]} scale={[0.076, 0.019, 1]} center={new THREE.Vector2(0.5, 0)} />
    </group>
  );
}
