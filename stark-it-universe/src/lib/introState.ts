import { createStore } from './createStore';

/**
 * The intro (FULL mode only, once per session, never under Reduce Motion).
 * `playing` is true while the overlay is up.
 */
export const introStore = createStore({ playing: false, done: true });

/** Did the inline script in index.html decide to play the intro? */
export function introRequested(): boolean {
  return typeof document !== 'undefined' && document.documentElement.dataset.intro === 'play';
}

/** Fired on window when the intro ends (the hero H1 scramble waits for it). */
export const INTRO_DONE_EVENT = 'siu:intro-done';
