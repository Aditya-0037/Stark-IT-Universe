import { createStore } from './createStore';

/** Whether the 3D layer has rendered its first frame. */
export const worldStore = createStore({ ready: false });

export function setWorldReady(ready: boolean) {
  worldStore.set({ ready });
  const d = document.documentElement;
  if (ready) d.dataset.world = 'ready';
  else delete d.dataset.world;
}
