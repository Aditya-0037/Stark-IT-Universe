import { createStore } from '../lib/createStore';
import { STEPS } from './steps';

/**
 * Where the story is: the step it rests on (or last rested on), the step a
 * move is heading for, and whether a move is playing. Changed only when a
 * move starts and when it lands, so the HTML re-renders at most once per step.
 */
export const story = createStore({ step: 0, target: 0, moving: false });

/** The item (planet, station, device) a scene shows: its own step's, or its first/last one when the story is before/after it. */
export function itemFor(scene: string, step: number) {
  const s = STEPS[step];
  if (s?.scene === scene && s.item !== undefined) return s.item;
  const first = STEPS.findIndex((x) => x.scene === scene);
  return step < first ? 0 : Math.max(0, ...STEPS.filter((x) => x.scene === scene).map((x) => x.item ?? 0));
}
