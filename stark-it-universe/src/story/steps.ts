import gsap from 'gsap';
import { journey, type JourneyKey } from '../lib/journey';

/**
 * The 3D story as named steps (FULL mode). Every step is a resting frame;
 * one scroll gesture (wheel notch, trackpad or phone swipe, arrow key)
 * plays exactly one move to the next or previous step, at a fixed speed
 * (see src/three/scrollDriver.ts).
 *
 * Each step rests at a known scroll position: its scene's section top plus
 * `offset` screens. Every move is exactly one screen of scroll, so there are
 * no holds or dead zones: a resting frame is simply where a move ends. The
 * journey values (what the 3D reads) are linear in scroll between two steps;
 * the move's ease comes from the scroll animation alone.
 */
export type StoryScene = 'space' | 'planets' | 'route' | 'descent' | 'classroom' | 'switch-on';

export interface StoryStep {
  /** Stable id (the label of this resting frame). */
  id: string;
  /** Human-readable label (debug HUD, notes). */
  label: string;
  /** The section that holds the resting frame. */
  scene: StoryScene;
  /** Screens into that section's scroll where the frame rests. */
  offset: number;
  /** Seconds the move into this step takes (the move back out of it takes the same). */
  duration: number;
  /** GSAP ease name of the move. */
  ease: string;
  /** The text and UI that appear once the step has landed. */
  overlay: string;
  /** Item within the scene: planet, station or device number (0-based). */
  item?: number;
  /** Journey values that change at this step (the others carry over from the step before). */
  journey: Partial<Record<JourneyKey, number>>;
}

export const EASE = 'power2.inOut';
/** The one ease every move uses (as a function, for Lenis). */
export const easeFn = gsap.parseEase(EASE) as (t: number) => number;

const planet = (i: number): StoryStep => ({
  id: `planet-${i + 1}`,
  label: `Planet ${i + 1}`,
  scene: 'planets',
  offset: i,
  duration: i === 0 ? 1.6 : 1.4,
  ease: EASE,
  overlay: `Planets heading, tabs and service card ${i + 1}`,
  item: i,
  journey: i === 0 ? { toPlanets: 1, planets: 0 } : { planets: i / 4 },
});
const station = (i: number): StoryStep => ({
  id: `station-${i + 1}`,
  label: `Route station ${i + 1}`,
  scene: 'route',
  offset: i,
  duration: i === 0 ? 1.6 : 1.1,
  ease: EASE,
  overlay: `Route heading and station list, station ${i + 1} active`,
  item: i,
  journey: i === 0 ? { toRoute: 1, route: 0 } : { route: i / 4 },
});
const device = (i: number): StoryStep => ({
  id: `device-${i + 1}`,
  label: `Classroom device ${i + 1}`,
  scene: 'classroom',
  offset: i,
  duration: i === 0 ? 1.4 : 1.2,
  ease: EASE,
  overlay: `Classroom heading and device panel ${i + 1}`,
  item: i,
  journey: i === 0 ? { toClassroom: 1, classroom: 0 } : { classroom: i / 4 },
});

export const STEPS: StoryStep[] = [
  { id: 'hero-sun', label: 'Hero: the SIU sun', scene: 'space', offset: 0, duration: 0, ease: EASE, overlay: 'Hero heading, buttons and trust line', journey: {} },
  ...[0, 1, 2, 3, 4].map(planet),
  ...[0, 1, 2, 3, 4].map(station),
  {
    id: 'satellite-dives',
    label: 'The satellite dives to the cloud deck',
    scene: 'descent',
    offset: 0,
    duration: 2.0,
    ease: EASE,
    overlay: 'none (the 3D only)',
    journey: { descent: 0.27 },
  },
  {
    id: 'campus',
    label: 'Through the clouds to the campus',
    scene: 'descent',
    offset: 1,
    duration: 2.2,
    ease: EASE,
    overlay: 'Descent panel: Down to your campus',
    journey: { descent: 0.68 },
  },
  {
    id: 'window',
    label: 'In through the glowing window',
    scene: 'descent',
    offset: 2,
    duration: 2.0,
    ease: EASE,
    overlay: 'none (the classroom overview)',
    journey: { descent: 1 },
  },
  ...[0, 1, 2, 3, 4].map(device),
  {
    id: 'switch-on',
    label: 'Switch on the classroom (story end)',
    scene: 'switch-on',
    offset: 0,
    duration: 1.4,
    ease: EASE,
    overlay: 'Switch on heading, dial and buttons',
    journey: { toSwitch: 1 },
  },
];

export const LAST_STEP = STEPS.length - 1;

/** The keys the story steps drive (toBuild follows the Build section, after the story). */
export const STORY_KEYS = (Object.keys(journey) as JourneyKey[]).filter((k) => k !== 'toBuild');

/** The full journey state at every resting frame. */
export const STEP_STATES: Record<JourneyKey, number>[] = (() => {
  const out: Record<JourneyKey, number>[] = [];
  let cur = Object.fromEntries((Object.keys(journey) as JourneyKey[]).map((k) => [k, 0])) as Record<JourneyKey, number>;
  for (const s of STEPS) {
    cur = { ...cur, ...s.journey };
    out.push(cur);
  }
  return out;
})();

export const stepIndex = (id: string) => STEPS.findIndex((s) => s.id === id);
