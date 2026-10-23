import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import palette from '../art/palette.json';
import { NIGHT as BRAND_NIGHT, keyDirection, LIGHT, preNeutral } from '../art/styleBible';
import { CAMPUS, levels, refs, ROOM, ROOM_LAYER, shadowRequests, smooth, stage } from './stage';

/**
 * Fog by horizontal distance (x/z) from the camera instead of view depth:
 * looking down from high above, the ground right below stays clear while the
 * town fades into the haze towards the horizon. The vertex shader passes the
 * world-space offset from the camera (the transposed view rotation applied
 * to mvPosition) and the distance is taken per pixel, so big ground
 * triangles fog correctly.
 */
THREE.ShaderChunk.fog_pars_vertex = /* glsl */ `
#ifdef USE_FOG
  varying vec3 vFogOffset;
#endif
`;
THREE.ShaderChunk.fog_vertex = /* glsl */ `
#ifdef USE_FOG
  vFogOffset = transpose( mat3( viewMatrix ) ) * mvPosition.xyz;
#endif
`;
THREE.ShaderChunk.fog_pars_fragment = THREE.ShaderChunk.fog_pars_fragment.replace('varying float vFogDepth;', 'varying vec3 vFogOffset;');
THREE.ShaderChunk.fog_fragment = THREE.ShaderChunk.fog_fragment.replace('#ifdef USE_FOG', '#ifdef USE_FOG\n\tfloat vFogDepth = length( vFogOffset.xz );');

const NIGHT = new THREE.Color(BRAND_NIGHT.top);

/** The brand night behind space: the same top-to-bottom gradient as every dark HTML scene. */
function nightTexture() {
  const c = document.createElement('canvas');
  c.width = 2;
  c.height = 256;
  const g = c.getContext('2d')!;
  const grad = g.createLinearGradient(0, 0, 0, 256);
  // pre-compensated for the Neutral tone mapper's toe, so the result is the brand night
  grad.addColorStop(0, `#${preNeutral(BRAND_NIGHT.top).getHexString()}`);
  grad.addColorStop(1, `#${preNeutral(BRAND_NIGHT.bottom).getHexString()}`);
  g.fillStyle = grad;
  g.fillRect(0, 0, 2, 256);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
const PAPER = new THREE.Color('#F5F7FC');
const ROOM_DARK = new THREE.Color('#050A1F');
const ROOM_NIGHT_LIT = new THREE.Color('#0D1A4A');

/**
 * The sky by altitude on the way down (descent progress, see dive.ts): the
 * brand night (#060A22) with Earth's edge glowing a thin gold and cyan below
 * it, then #1B2A6B, universe blue, the white of the cloud deck, and the
 * morning over the campus: a pale warm haze on the horizon (the same colour
 * as the fog and everything below the horizon, so the ground melts into it)
 * up through a clear blue to universe blue overhead. Only blues, the cloud
 * white and the haze: no mauve. Per key: top, mid (30 % of the way up),
 * horizon, below the horizon (Earth), the edge glow and how far Earth's edge
 * sits below the horizontal.
 */
const HAZE_HEX = palette.surface.haze[1];
const UNIVERSE = palette.brand.universeBlue[1];
const CLOUD = '#E3E8F1';
const SKY_KEYS = [
  { p: 0, top: '#060A22', mid: '#0B1640', horizon: '#0D1A4C', bottom: '#0A1238', limb: 0, dip: 0.12 },
  { p: 0.09, top: '#060A22', mid: '#101C50', horizon: '#1B2A6B', bottom: '#24367A', limb: 1, dip: 0.11 },
  { p: 0.2, top: '#1B2A6B', mid: '#2D45A8', horizon: '#4F6CC8', bottom: '#6F86C8', limb: 0.75, dip: 0.07 },
  { p: 0.31, top: UNIVERSE, mid: '#6A88EC', horizon: '#A9B9DD', bottom: '#B8C6E0', limb: 0, dip: 0.02 },
  { p: 0.355, top: CLOUD, mid: CLOUD, horizon: CLOUD, bottom: CLOUD, limb: 0, dip: 0 },
  { p: 0.42, top: CLOUD, mid: CLOUD, horizon: CLOUD, bottom: CLOUD, limb: 0, dip: 0 },
  { p: 0.53, top: UNIVERSE, mid: '#9FBDF0', horizon: HAZE_HEX, bottom: HAZE_HEX, limb: 0, dip: 0 },
].map((k) => ({ ...k, top: new THREE.Color(k.top), mid: new THREE.Color(k.mid), horizon: new THREE.Color(k.horizon), bottom: new THREE.Color(k.bottom) }));

/** Direction towards the morning sun over the campus: front left, 30 deg up (the style bible's key). */
export const SUN_DIR = keyDirection();
/**
 * The morning sun's colour on the campus: the key's warm gold, a little
 * lighter so the off-white walls stay cream (lit and shadow sides of a wall
 * differ by about half their brightness).
 */
const CAMPUS_SUN = new THREE.Color(LIGHT.key.color).lerp(new THREE.Color('#FFFFFF'), 0.3);
/**
 * Hemisphere fill: cool sky blue over the campus, the neutral daylight in
 * the room. Over the campus its ground colour is the warm bounce off the
 * sunlit earth, so walls turned away from the sun sit at about half the
 * brightness of the lit ones (the tone mapper's toe would crush them).
 */
const FILL_CAMPUS = new THREE.Color('#A9BEEB');
const FILL_ROOM = new THREE.Color('#EEF4FF');
const BOUNCE_CAMPUS = new THREE.Color('#E8D2B0');
const BOUNCE_ROOM = new THREE.Color('#C9BFA8');

const domeVertex = /* glsl */ `
  varying vec3 vDir;
  void main() {
    vDir = position;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;
const domeFragment = /* glsl */ `
  uniform vec3 uTop;
  uniform vec3 uMid;
  uniform vec3 uHorizon;
  uniform vec3 uBottom;
  uniform float uLimb;
  uniform float uDip;
  uniform float uOpacity;
  varying vec3 vDir;
  void main() {
    vec3 d = normalize(vDir);
    // height above Earth's edge (below the horizontal while high up; seen
    // from a tilted camera the edge curves like a planet's limb)
    float h = d.y + uDip;
    float t = pow(clamp(h / (1.0 + uDip), 0.0, 1.0), 0.55);
    vec3 sky = t < 0.3 ? mix(uHorizon, uMid, t / 0.3) : mix(uMid, uTop, (t - 0.3) / 0.7);
    vec3 earth = mix(uHorizon, uBottom, pow(clamp(-h, 0.0, 1.0), 0.45));
    vec3 c = mix(earth, sky, smoothstep(-0.002, 0.002, h));
    // Earth's edge: a thin gold line (brand gold) with a cyan glow above it
    float gold = exp(-pow(h / 0.005, 2.0));
    float cyan = exp(-pow((h - 0.02) / 0.018, 2.0));
    c += uLimb * vec3(0.12, 0.62, 0.78) * 0.55 * cyan;
    c = mix(c, vec3(1.15, 0.6, 0.06), uLimb * gold * 0.9);
    gl_FragColor = vec4(c, uOpacity);
  }
`;

/** Sky colours at descent progress p (blending between the keys). */
function skyAt(p: number, out: { top: THREE.Color; mid: THREE.Color; horizon: THREE.Color; bottom: THREE.Color }) {
  let i = 0;
  while (i < SKY_KEYS.length - 2 && p > SKY_KEYS[i + 1].p) i++;
  const a = SKY_KEYS[i];
  const b = SKY_KEYS[i + 1];
  const f = THREE.MathUtils.smoothstep(p, a.p, b.p);
  out.top.copy(a.top).lerp(b.top, f);
  out.mid.copy(a.mid).lerp(b.mid, f);
  out.horizon.copy(a.horizon).lerp(b.horizon, f);
  out.bottom.copy(a.bottom).lerp(b.bottom, f);
  return { limb: a.limb + (b.limb - a.limb) * f, dip: a.dip + (b.dip - a.dip) * f };
}

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
  const nightBg = useMemo(nightTexture, []);
  const fog = useMemo(() => new THREE.Fog(NIGHT.clone(), 1000, 2000), []);
  const tmp = useMemo(() => new THREE.Color(), []);
  const sky = useMemo(() => ({ top: new THREE.Color(), mid: new THREE.Color(), horizon: new THREE.Color(), bottom: new THREE.Color() }), []);
  const dome = useRef<THREE.Mesh>(null);
  const domeMat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: {
          uTop: { value: new THREE.Color() },
          uMid: { value: new THREE.Color() },
          uHorizon: { value: new THREE.Color() },
          uBottom: { value: new THREE.Color() },
          uLimb: { value: 0 },
          uDip: { value: 0 },
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
  const was = useRef({ config: false });

  // Light intensities and room background for the main view and for the room view.
  const levelsFor = useMemo(
    () => ({
      main: { ambient: 0, spaceHemi: 0, star: 0, dayHemi: 0, campusSun: 0, roomSun: 0, lamp: 0, fill: FILL_ROOM.clone(), bounce: BOUNCE_ROOM.clone() },
      room: { ambient: 0, spaceHemi: 0, star: 0, dayHemi: 0, campusSun: 0, roomSun: 0, lamp: 0, fill: FILL_ROOM.clone(), bounce: BOUNCE_ROOM.clone() },
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
      if (dayHemi.current) {
        dayHemi.current.intensity = v.dayHemi;
        dayHemi.current.color.copy(v.fill);
        dayHemi.current.groundColor.copy(v.bounce);
      }
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
      // the campus and the town around it (beyond that the haze takes over)
      const cam = campus.shadow.camera as THREE.OrthographicCamera;
      Object.assign(cam, { left: -135, right: 135, top: 135, bottom: -135, near: 40, far: 480 });
      cam.updateProjectionMatrix();
    }
  }, []);

  useFrame(({ camera }) => {
    const L = levels(stage.power);
    const dh = Math.hypot(camera.position.x - CAMPUS.x, camera.position.z - CAMPUS.z);
    const night = stage.night;
    const s = stage.sky;
    // Reduce Motion shows stills: the sky of the moment each one shows
    const p = stage.still === 'sky' ? 0.47 : stage.still === 'campus' ? 0.68 : stage.descent;

    // Room background (paper by day, dark by night) for the room and the window view
    tmp.copy(ROOM_DARK).lerp(ROOM_NIGHT_LIT, L.lights);
    levelsFor.roomBg.copy(PAPER).lerp(tmp, night);

    // Sky colours by altitude
    const u = domeMat.uniforms;
    const edge = skyAt(p, sky);
    (u.uTop.value as THREE.Color).copy(sky.top);
    (u.uMid.value as THREE.Color).copy(sky.mid);
    (u.uHorizon.value as THREE.Color).copy(sky.horizon);
    (u.uBottom.value as THREE.Color).copy(sky.bottom);
    u.uLimb.value = edge.limb;
    u.uDip.value = edge.dip;

    // Background and fog for the main view
    const mf = levelsFor.mainFog;
    if (stage.room) {
      levelsFor.mainBg.copy(levelsFor.roomBg);
      mf.near = 400;
      mf.far = 1200;
      mf.color.copy(levelsFor.roomBg);
    } else {
      levelsFor.mainBg.copy(NIGHT).lerp(sky.horizon, s);
      // Fog in the sky's colour below the horizon (also the background):
      // none in space; a far haze over the cloud deck on the way in; thick
      // inside the deck (the frame fully clouded while space swaps to the
      // campus); then it opens so the town appears out of the haze. Over the
      // town it starts just past the campus wall (seen from the camera) and
      // is solid at 2.5 times that distance, before the far plane.
      mf.color.copy(sky.bottom);
      const town = dh + 48;
      let near = THREE.MathUtils.lerp(1000, 110, smooth(0.04, 0.24, p));
      let far = THREE.MathUtils.lerp(2000, 380, smooth(0.04, 0.24, p));
      const thick = smooth(0.31, 0.355, p);
      near = THREE.MathUtils.lerp(near, 3, thick);
      far = THREE.MathUtils.lerp(far, 18, thick);
      const clearing = smooth(0.38, 0.44, p);
      near = THREE.MathUtils.lerp(near, 10, clearing);
      far = THREE.MathUtils.lerp(far, 70, clearing);
      const open = smooth(0.42, 0.52, p);
      mf.near = THREE.MathUtils.lerp(near, town, open);
      mf.far = THREE.MathUtils.lerp(far, Math.min(town * 2.5, 820), open);
    }

    // In space the background is the brand night gradient; elsewhere a colour
    const wantBg = !stage.room && s < 0.0005 ? nightBg : bg;
    if (scene.background !== wantBg) scene.background = wantBg;

    // Sky dome (follows the camera)
    if (dome.current) {
      dome.current.position.copy(camera.position);
      u.uOpacity.value = Math.min(1, s * 25);
      dome.current.visible = !stage.room && s > 0.0005;
    }

    // Lights (main view)
    const m = levelsFor.main;
    const space = stage.space ? 1 : 0;
    m.ambient = 0.22 * space;
    m.spaceHemi = 0.45 * space;
    m.star = 3.4 * space;
    const campus = stage.campus ? 1 : 0;
    m.campusSun = 2.1 * campus;
    const day = 1 - night;
    const roomHemi = day * 1.05 + night * (0.04 + L.lights * 0.4);
    m.dayHemi = Math.max(stage.room ? roomHemi : 0, campus * 0.75);
    m.fill.copy(stage.room ? FILL_ROOM : FILL_CAMPUS);
    m.bounce.copy(stage.room ? BOUNCE_ROOM : BOUNCE_CAMPUS);
    m.roomSun = stage.room ? day * 2.1 : 0;
    m.lamp = stage.room ? L.lights * 26 : 0;
    // ... and the room as seen through the window
    const r = levelsFor.room;
    r.dayHemi = roomHemi;
    r.roomSun = day * 2.1;
    r.lamp = L.lights * 26;
    refs.roomLighting?.(false);
  }, -2);

  // Shadow maps are static: rendered once when each region is warmed up
  // (Park, CampusScene), never again on entering a scene. Only the room's is
  // refreshed when Build swaps its setup in or out (that changes the casters).
  // Requests run after every object has updated, before the frame renders.
  useFrame(() => {
    if (stage.config !== was.current.config) shadowRequests.room = true;
    was.current.config = stage.config;
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

  const sunPos = CAMPUS.clone().addScaledVector(SUN_DIR, 220);
  return (
    <>
      <mesh ref={dome} material={domeMat} frustumCulled={false} renderOrder={-10} visible={false}>
        <sphereGeometry args={[800, 32, 16]} />
      </mesh>
      <ambientLight ref={spaceAmbient} intensity={0.22} color="#7f90e0" />
      <hemisphereLight ref={spaceHemi} args={['#9DB0FF', '#0B1640', 0.45]} />
      <pointLight ref={starLight} position={[0, 0, 0]} intensity={3.4} decay={0} color="#FFD9A0" />
      <hemisphereLight ref={dayHemi} args={['#EEF4FF', '#C9BFA8', 0]} />
      <directionalLight
        ref={campusSun}
        position={[sunPos.x, sunPos.y, sunPos.z]}
        intensity={0}
        color={CAMPUS_SUN}
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
