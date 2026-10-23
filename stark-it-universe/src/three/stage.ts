import * as THREE from 'three';
import { createStore } from '../lib/createStore';

/**
 * World layout and the per-frame "stage" state shared by every 3D object.
 *
 * Regions (one world, three places):
 *   space    the SIU star system at the origin
 *   campus   a morning school campus far below the star (CAMPUS)
 *   room     the classroom diorama, in its own light space (ROOM)
 * The camera follows one path from space, through the clouds, down to the
 * campus and into one glowing classroom window. The window shows the room
 * (rendered behind its glass) as it fills the screen, so the switch to the
 * room region is invisible.
 */
export const CAMPUS = new THREE.Vector3(0, -200, 0);
export const ROOM = new THREE.Vector3(0, -200, -900);

/** Descent progress at which the window fills the screen and the room takes over. */
export const DESCENT_CUT = 0.985;

/** Camera layer that only the classroom (and every light) is on: used to draw it into the window. */
export const ROOM_LAYER = 2;

export const stage = {
  /** Space objects are drawn. */
  space: true,
  /** Campus is drawn. */
  campus: false,
  /** Room is drawn. */
  room: false,
  /** Cloud layers are drawn. */
  clouds: false,
  /** Smoothed descent progress 0..1 (the camera path parameter). */
  descent: 0,
  /** Star field opacity (fades as the camera dives). */
  stars: 1,
  /** Star streaks 0..1 while the camera starts to fall. */
  stretch: 0,
  /** Sky phase: 0 night, 0.5 deep blue, 1 soft morning sky. */
  sky: 0,
  /** Cloud opacity 0..1. */
  cloudOpacity: 0,
  /** How far the classroom shows through the target window 0..1. */
  portal: 0,
  /** The satellite's light on the target window 0..1 (it glows from then on). */
  windowLit: 0,
  /** Reduce Motion: which still of the descent is shown ('', 'sky', 'campus', 'room'). */
  still: '' as '' | 'sky' | 'campus' | 'room',
  /** Vignette darkness. */
  vignette: 0.2,
  /** Effective room power 0..4 (smoothed). */
  power: 3,
  /** Effective room night 0..1 (smoothed). */
  night: 0,
  /** The room shows the configurator's setup instead of the full room. */
  config: false,
};

/**
 * Shared references between the 3D modules (the campus is its own chunk):
 * the classroom group and the two suns, and pending shadow-map refreshes.
 * Shadows are static, so each sun's map is re-rendered only on request.
 */
export const refs = {
  room: null as THREE.Group | null,
  campusSun: null as THREE.DirectionalLight | null,
  roomSun: null as THREE.DirectionalLight | null,
  /** Sets every light, the background and the fog for the room (true) or back for the main view. */
  roomLighting: null as ((room: boolean) => void) | null,
};
export const shadowRequests = { campus: false, room: false };
export const refreshShadow = (which: 'campus' | 'room') => {
  shadowRequests[which] = true;
};

/**
 * Which regions are fully warmed up (built, compiled and drawn once
 * offscreen with everything shown), and whether the story text has been
 * drawn once (scrollDriver). The story's first move waits for all of them,
 * so no upload or shader compile ever lands in a move.
 */
export type PrewarmRegion = 'space' | 'room' | 'campus';
export const prewarm = createStore({ space: false, room: false, campus: false, text: false });
export const prewarmDone = () => {
  const p = prewarm.get();
  return p.space && p.room && p.campus && p.text;
};

/**
 * Shader compiles in flight (World's Precompile). Drawing with a program
 * that is still compiling blocks until it is done, so warm-up draws wait.
 */
export const compiling = { pending: 0, finished: 0 };

/**
 * Crossfade: the frame is copied onto a 2D canvas over the 3D layer, the
 * camera cuts underneath, and the copy fades out over `fadeMs` (Reduce
 * Motion stills, and fast travel to a step that is not the next one).
 */
export const crossfade = { request: false, ready: false, fadeMs: 400 };

export const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
export const smooth = (a: number, b: number, x: number) => THREE.MathUtils.smoothstep(x, a, b);

/** Power stages as 0..1 levels: board, projector, lights, lesson slide. */
export const levels = (power: number) => ({
  board: clamp01(power),
  projector: clamp01(power - 1),
  lights: clamp01(power - 2),
  slide: clamp01(power - 3),
});
