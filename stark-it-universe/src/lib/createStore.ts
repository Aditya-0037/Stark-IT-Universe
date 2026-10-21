import { useSyncExternalStore } from 'react';

/**
 * A tiny external store for state shared between the HTML layer and the
 * lazily loaded 3D layer (which lives outside the React tree's providers).
 */
export function createStore<T extends object>(initial: T, serverState: T = initial) {
  let state = initial;
  const listeners = new Set<() => void>();

  const get = () => state;
  const set = (patch: Partial<T> | ((s: T) => Partial<T>)) => {
    const next = typeof patch === 'function' ? patch(state) : patch;
    let changed = false;
    for (const k in next) {
      if (!Object.is(next[k], state[k as keyof T])) {
        changed = true;
        break;
      }
    }
    if (!changed) return;
    state = { ...state, ...next };
    listeners.forEach((l) => l());
  };
  const subscribe = (l: () => void) => {
    listeners.add(l);
    return () => listeners.delete(l);
  };

  function useStore(): T;
  function useStore<S>(selector: (s: T) => S): S;
  function useStore<S>(selector?: (s: T) => S) {
    const sel = selector ?? ((s: T) => s as unknown as S);
    return useSyncExternalStore(
      subscribe,
      () => sel(state),
      () => sel(serverState),
    );
  }

  return { get, set, subscribe, useStore };
}
