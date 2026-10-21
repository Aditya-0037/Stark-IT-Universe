import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { CAMPUS, levels, refs, ROOM, ROOM_LAYER, shadowRequests, stage } from './stage';

const NIGHT = new THREE.Color('#060A22');
const PAPER = new THREE.Color('#F5F7FC');
const ROOM_DARK = new THREE.Color('#050A1F');
const ROOM_NIGHT_LIT = new THREE.Color('#0D1A4A');

/**
 * The sky on the way down: night (the page's space colour) -> deep blue ->
 * soft morning sky. Top, horizon and below-horizon colours per phase; never
 * flat white.
 */
const SKY = [
  { top: '#060A22', horizon: '#0D1A4C', bottom: '#09113A' },
  { top: '#0B2466', horizon: '#2F5BB8', bottom: '#1E3E8E' },
  { top: '#BFD8F5', horizon: '#F6E9D7', bottom: '#C4D5EE' },
].map((p) => ({ top: new THREE.Color(p.top), horizon: new THREE.Color(p.horizon), bottom: new THREE.Color(p.bottom) }));
const HAZE = new THREE.Color('#E3E8EF');

/** Direction towards the morning sun over the campus (front left, about 44 deg up). */
export const SUN_DIR = new THREE.Vector3(-0.52, 0.7, 0.49).normalize();
/** Where the dawn glows on the horizon (ahead of the camera as it starts to fall). */
const DAWN_DIR = new THREE.Vector3(-0.25, 0.06, -1).normalize();

const domeVertex = /* glsl */ `
  varying vec3 vDir;
  void main() {
    vDir = position;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;
const domeFragment = /* glsl */ `
  uniform vec3 uTop;
  uniform vec3 uHorizon;
  uniform vec3 uBottom;
  uniform vec3 uSunDir;
  uniform float uSun;
  uniform float uOpacity;
  varying vec3 vDir;
  void main() {
    vec3 d = normalize(vDir);
    float h = d.y;
    vec3 c = h > 0.0
      ? mix(uHorizon, uTop, pow(clamp(h, 0.0, 1.0), 0.55))
      : mix(uHorizon, uBottom, pow(clamp(-h, 0.0, 1.0), 0.45));
    // warm dawn glow low on the horizon
    float s = max(dot(d, uSunDir), 0.0);
    float band = 1.0 - smoothstep(0.0, 0.45, abs(h - 0.04));
    c += vec3(0.42, 0.2, 0.1) * (pow(s, 4.0) * band * 0.8 + pow(s, 40.0) * 0.5) * uSun;
    gl_FragColor = vec4(c, uOpacity);
  }
`;

/**
 * Background, fog, sky and every light in the world. Each region's lights
 * are always present and only change intensity (adding/removing lights
 * would recompile shaders mid-scroll). Every light is also on ROOM_LAYER,
 * so the classroom can be drawn into the target window with the same
 * shaders; `refs.roomLighting` switches the intensities for that.
 */
export function Atmosphere() {
  const scene = useThree((s) => s.scene);
  const gl = useThree((s) => s.gl);
  const bg = useMemo(() => NIGHT.clone(), []);
  const fog = useMemo(() => new THREE.Fog(NIGHT.clone(), 1000, 2000), []);
  const tmp = useMemo(() => new THREE.Color(), []);
  const dome = useRef<THREE.Mesh>(null);
  const domeMat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: {
          uTop: { value: new THREE.Color() },
          uHorizon: { value: new THREE.Color() },
          uBottom: { value: new THREE.Color() },
          uSunDir: { value: DAWN_DIR },
          uSun: { value: 0 },
          uOpacity: { value: 0 },
        },
        vertexShader: domeVertex,
        fragmentShader: domeFragment,
        side: THREE.BackSide,
        transparent: true,
        depthWrite: false,
        fog: false,
      }),
    [],
  );

  const spaceAmbient = useRef<THREE.AmbientLight>(null);
  const spaceHemi = useRef<THREE.HemisphereLight>(null);
  const starLight = useRef<THREE.PointLight>(null);
  const dayHemi = useRef<THREE.HemisphereLight>(null);
  const campusSun = useRef<THREE.DirectionalLight>(null);
  const roomSun = useRef<THREE.DirectionalLight>(null);
  const lampA = useRef<THREE.PointLight>(null);
  const lampB = useRef<THREE.PointLight>(null);
  const was = useRef({ campus: false, room: false });

  // Light intensities and room background for the main view and for the room view.
  const levelsFor = useMemo(
    () => ({
      main: { ambient: 0, spaceHemi: 0, star: 0, dayHemi: 0, campusSun: 0, roomSun: 0, lamp: 0 },
      room: { ambient: 0, spaceHemi: 0, star: 0, dayHemi: 0, campusSun: 0, roomSun: 0, lamp: 0 },
      roomBg: new THREE.Color(),
      mainBg: new THREE.Color(),
      mainFog: { near: 1000, far: 2000, color: new THREE.Color() },
    }),
    [],
  );

  useEffect(() => {
    scene.background = bg;
    scene.fog = fog;
    // Static shadows: each sun's map is rendered only when asked.
    gl.shadowMap.autoUpdate = false;
    gl.shadowMap.needsUpdate = true;
    for (const l of [spaceAmbient, spaceHemi, starLight, dayHemi, campusSun, roomSun, lampA, lampB]) {
      l.current?.layers.enable(ROOM_LAYER);
    }
    const apply = (room: boolean) => {
      const v = room ? levelsFor.room : levelsFor.main;
      if (spaceAmbient.current) spaceAmbient.current.intensity = v.ambient;
      if (spaceHemi.current) spaceHemi.current.intensity = v.spaceHemi;
      if (starLight.current) starLight.current.intensity = v.star;
      if (dayHemi.current) dayHemi.current.intensity = v.dayHemi;
      if (campusSun.current) campusSun.current.intensity = v.campusSun;
      if (roomSun.current) roomSun.current.intensity = v.roomSun;
      if (lampA.current) lampA.current.intensity = v.lamp;
      if (lampB.current) lampB.current.intensity = v.lamp;
      if (room) {
        bg.copy(levelsFor.roomBg);
        fog.near = 400;
        fog.far = 1200;
        fog.color.copy(bg);
      } else {
        bg.copy(levelsFor.mainBg);
        fog.near = levelsFor.mainFog.near;
        fog.far = levelsFor.mainFog.far;
        fog.color.copy(levelsFor.mainFog.color);
      }
    };
    refs.roomLighting = apply;
    refs.campusSun = campusSun.current;
    refs.roomSun = roomSun.current;
    return () => {
      scene.background = null;
      scene.fog = null;
      refs.roomLighting = null;
      refs.campusSun = null;
      refs.roomSun = null;
    };
  }, [scene, gl, bg, fog, levelsFor]);

  useEffect(() => {
    const sun = roomSun.current;
    if (sun) {
      sun.shadow.autoUpdate = false;
      sun.target.position.copy(ROOM).add(new THREE.Vector3(6, 0, 5));
      sun.target.updateMatrixWorld();
      const cam = sun.shadow.camera as THREE.OrthographicCamera;
      Object.assign(cam, { left: -12, right: 12, top: 12, bottom: -12, near: 1, far: 80 });
      cam.updateProjectionMatrix();
    }
    const campus = campusSun.current;
    if (campus) {
      campus.shadow.autoUpdate = false;
      campus.target.position.copy(CAMPUS);
      campus.target.updateMatrixWorld();
      const cam = campus.shadow.camera as THREE.OrthographicCamera;
      Object.assign(cam, { left: -50, right: 50, top: 50, bottom: -50, near: 20, far: 300 });
      cam.updateProjectionMatrix();
    }
  }, []);

  useFrame(({ camera }) => {
    const L = levels(stage.power);
    const night = stage.night;
    const s = stage.sky;

    // Room background (paper by day, dark by night) for the room and the window view
    tmp.copy(ROOM_DARK).lerp(ROOM_NIGHT_LIT, L.lights);
    levelsFor.roomBg.copy(PAPER).lerp(tmp, night);

    // Sky phase colours
    const u = domeMat.uniforms;
    const a = s < 0.5 ? SKY[0] : SKY[1];
    const b = s < 0.5 ? SKY[1] : SKY[2];
    const f = THREE.MathUtils.smoothstep(s < 0.5 ? s * 2 : s * 2 - 1, 0, 1);
    (u.uTop.value as THREE.Color).copy(a.top).lerp(b.top, f);
    (u.uHorizon.value as THREE.Color).copy(a.horizon).lerp(b.horizon, f);
    (u.uBottom.value as THREE.Color).copy(a.bottom).lerp(b.bottom, f);
    u.uSun.value = THREE.MathUtils.smoothstep(s, 0.08, 0.45) * (1 - 0.6 * THREE.MathUtils.smoothstep(s, 0.6, 1));

    // Background and fog for the main view
    const mf = levelsFor.mainFog;
    if (stage.room) {
      levelsFor.mainBg.copy(levelsFor.roomBg);
      mf.near = 400;
      mf.far = 1200;
      mf.color.copy(levelsFor.roomBg);
    } else {
      levelsFor.mainBg.copy(NIGHT).lerp(u.uHorizon.value as THREE.Color, s);
      // a light aerial haze over the campus, none in space
      const k = s * s;
      mf.color.copy(u.uBottom.value as THREE.Color).lerp(HAZE, s);
      mf.near = THREE.MathUtils.lerp(1000, 170, k);
      mf.far = THREE.MathUtils.lerp(2000, 640, k);
    }

    // Sky dome (follows the camera)
    if (dome.current) {
      dome.current.position.copy(camera.position);
      u.uOpacity.value = Math.min(1, s * 25);
      dome.current.visible = !stage.room && s > 0.0005;
    }

    // Lights (main view)
    const m = levelsFor.main;
    const space = stage.space ? 1 - s : 0;
    m.ambient = 0.22 * space;
    m.spaceHemi = 0.45 * space;
    m.star = 3.4 * space;
    const campus = stage.campus ? s : 0;
    m.campusSun = 2.05 * campus;
    const day = 1 - night;
    const roomHemi = day * 1.05 + night * (0.04 + L.lights * 0.4);
    m.dayHemi = Math.max(stage.room ? roomHemi : 0, campus * 1.55);
    m.roomSun = stage.room ? day * 2.1 : 0;
    m.lamp = stage.room ? L.lights * 26 : 0;
    // ... and the room as seen through the window
    const r = levelsFor.room;
    r.dayHemi = roomHemi;
    r.roomSun = day * 2.1;
    r.lamp = L.lights * 26;
    refs.roomLighting?.(false);
  }, -2);

  // Shadow refreshes asked for this frame (a region appeared): after every
  // object has updated, before the frame renders.
  useFrame(() => {
    if (stage.campus && !was.current.campus) shadowRequests.campus = true;
    if (stage.room && !was.current.room) shadowRequests.room = true;
    was.current.campus = stage.campus;
    was.current.room = stage.room;
    if (shadowRequests.campus && campusSun.current) {
      campusSun.current.shadow.needsUpdate = true;
      gl.shadowMap.needsUpdate = true;
      shadowRequests.campus = false;
    }
    if (shadowRequests.room && roomSun.current) {
      roomSun.current.shadow.needsUpdate = true;
      gl.shadowMap.needsUpdate = true;
      shadowRequests.room = false;
    }
  }, 0.9);

  const sunPos = CAMPUS.clone().addScaledVector(SUN_DIR, 150);
  return (
    <>
      <mesh ref={dome} material={domeMat} frustumCulled={false} renderOrder={-10} visible={false}>
        <sphereGeometry args={[420, 32, 16]} />
      </mesh>
      <ambientLight ref={spaceAmbient} intensity={0.22} color="#7f90e0" />
      <hemisphereLight ref={spaceHemi} args={['#9DB0FF', '#0B1640', 0.45]} />
      <pointLight ref={starLight} position={[0, 0, 0]} intensity={3.4} decay={0} color="#FFD9A0" />
      <hemisphereLight ref={dayHemi} args={['#EEF4FF', '#C9BFA8', 0]} />
      <directionalLight
        ref={campusSun}
        position={[sunPos.x, sunPos.y, sunPos.z]}
        intensity={0}
        color="#FFF1DA"
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.0005}
        shadow-normalBias={0.05}
      />
      <directionalLight
        ref={roomSun}
        position={[ROOM.x - 22, ROOM.y + 30, ROOM.z + 16]}
        intensity={0}
        color="#FFF1D6"
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-bias={-0.0004}
        shadow-normalBias={0.02}
      />
      <pointLight ref={lampA} position={[ROOM.x + 5, ROOM.y + 5.2, ROOM.z + 4.2]} intensity={0} decay={2} color="#FFE7BF" />
      <pointLight ref={lampB} position={[ROOM.x + 7, ROOM.y + 5.2, ROOM.z + 7.6]} intensity={0} decay={2} color="#FFE7BF" />
    </>
  );
}
