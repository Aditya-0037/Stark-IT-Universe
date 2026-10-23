import { LAST_STEP, STEP_STATES, STEPS, STORY_KEYS } from '../story/steps';
import { journey } from './journey';

/**
 * The master timeline: the scene table (section scroll budgets and the 3D
 * regions each scene needs) and the mapping from the scroll position to the
 * journey values the 3D layer reads.
 *
 * In FULL mode the story (hero to Switch on) is a chain of named steps
 * (src/story/steps.ts). Every step rests at a known scroll position and every
 * move between two steps is exactly one screen of scroll, so a pinned scene
 * is (its moves + 1) screens tall. The scroll position is the single source
 * of truth: the journey follows it exactly, with no damping of its own (Lenis
 * is the only smoothing layer).
 */
export type Region = 'space' | 'campus' | 'room';

export interface SceneSpec {
  id: string;
  /** FULL: section height in viewport heights (pinned scenes only). */
  budget?: number;
  /** 3D regions this scene draws. */
  regions: Region[];
}

export const SCENES: SceneSpec[] = [
  { id: 'space', regions: ['space'] },
  // planet 1 -> 5: 4 moves
  { id: 'planets', budget: 500, regions: ['space'] },
  // station 1 -> 5: 4 moves
  { id: 'route', budget: 500, regions: ['space'] },
  // (the dive happens while it scrolls in) clouds -> campus -> window: 2 moves
  { id: 'descent', budget: 300, regions: ['space', 'campus', 'room'] },
  // device 1 -> 5: 4 moves
  { id: 'classroom', budget: 500, regions: ['room'] },
  // the story's last resting frame
  { id: 'switch-on', budget: 100, regions: ['room'] },
  { id: 'build', regions: ['room'] },
  { id: 'proof', regions: [] },
  { id: 'quote', regions: [] },
];

export const sceneById = (id: string) => SCENES.find((s) => s.id === id);

interface Measured {
  vh: number;
  tops: Record<string, number>;
  heights: Record<string, number>;
  /** Scroll position of every story step's resting frame. */
  stepY: number[];
  /** #build scrolling into view (after the story): the lit room turns into the configurator view. */
  build: { start: number; end: number } | null;
}

let m: Measured | null = null;

/** Reads the section positions (call on load, resize and layout changes). */
export function measure(): Measured {
  const vh = window.innerHeight;
  const tops: Record<string, number> = {};
  const heights: Record<string, number> = {};
  for (const s of SCENES) {
    const el = document.getElementById(s.id);
    if (!el) continue;
    tops[s.id] = el.getBoundingClientRect().top + window.scrollY;
    heights[s.id] = el.offsetHeight;
  }
  const stepY = STEPS.map((s) => Math.round((tops[s.scene] ?? 0) + s.offset * vh));
  const build = tops.build === undefined ? null : { start: tops.build - vh, end: tops.build };
  m = { vh, tops, heights, stepY, build };
  return m;
}

export const measured = () => m ?? measure();

/** Story position at scroll y: a float step index (2.5 = halfway from step 2 to step 3), clamped to the story. */
export function storyPosition(y: number) {
  const ys = measured().stepY;
  if (y <= ys[0]) return 0;
  if (y >= ys[LAST_STEP]) return LAST_STEP;
  let i = 0;
  while (i < LAST_STEP - 1 && y >= ys[i + 1]) i++;
  const span = ys[i + 1] - ys[i];
  return i + (span > 0 ? (y - ys[i]) / span : 0);
}

/** The step whose resting frame is nearest to scroll y. */
export const nearestStep = (y: number) => Math.round(storyPosition(y));

/** Is scroll y inside the story (the top of the page to the last step, plus a little)? */
export const inStory = (y: number, slack = 2) => y <= measured().stepY[LAST_STEP] + slack;

/** Sets every journey value from a scroll position. */
export function writeJourney(y: number) {
  const s = storyPosition(y);
  const i = Math.min(Math.floor(s), LAST_STEP - 1);
  const f = s - i;
  const a = STEP_STATES[i];
  const b = STEP_STATES[i + 1];
  for (const k of STORY_KEYS) journey[k] = a[k] + (b[k] - a[k]) * f;
  const bld = measured().build;
  journey.toBuild = bld && bld.end > bld.start ? Math.min(1, Math.max(0, (y - bld.start) / (bld.end - bld.start))) : 0;
}

/** The scene whose range holds the middle of the screen. */
export function activeScene(y: number) {
  const mm = measured();
  const mid = y + mm.vh / 2;
  let idx = 0;
  SCENES.forEach((s, i) => {
    const top = mm.tops[s.id];
    if (top !== undefined && top <= mid) idx = i;
  });
  return idx;
}

/** Regions needed by the active scene and its neighbours. */
export function regionsNear(index: number) {
  const out = new Set<Region>();
  for (let i = index - 1; i <= index + 1; i++) SCENES[i]?.regions.forEach((r) => out.add(r));
  return out;
}
