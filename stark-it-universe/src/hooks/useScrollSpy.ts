import { createStore } from '../lib/createStore';

/**
 * One passive scroll listener for the whole page. It works out
 *  - which colour theme is behind the sticky header (dark or light logo),
 *  - which section index item is current.
 * Sections declare data-theme (and optionally data-index to map several
 * scenes onto one index item).
 */
interface SpyState {
  headerTheme: 'dark' | 'light';
  current: string;
}

export const spyStore = createStore<SpyState>({ headerTheme: 'dark', current: 'space' });

export function startScrollSpy(): () => void {
  let timer = 0;
  let last = 0;
  let themed: HTMLElement[] = [];
  let indexed: HTMLElement[] = [];
  let headerY = 42;

  const collect = () => {
    themed = Array.from(document.querySelectorAll<HTMLElement>('main [data-theme], footer[data-theme]'));
    indexed = Array.from(document.querySelectorAll<HTMLElement>('main [data-index]'));
    const styles = getComputedStyle(document.documentElement);
    headerY = parseFloat(styles.getPropertyValue('--header-top')) + parseFloat(styles.getPropertyValue('--header-h')) / 2 || 42;
  };

  const update = () => {
    timer = 0;
    last = performance.now();

    // Later elements in document order are nested deeper, so they win.
    let theme: 'dark' | 'light' = 'dark';
    for (const el of themed) {
      const r = el.getBoundingClientRect();
      if (r.top <= headerY && r.bottom > headerY) theme = el.dataset.theme === 'light' ? 'light' : 'dark';
    }

    const mid = window.innerHeight * 0.45;
    let current = indexed[0]?.dataset.index ?? 'space';
    for (const el of indexed) {
      if (el.getBoundingClientRect().top <= mid) current = el.dataset.index!;
    }
    spyStore.set({ headerTheme: theme, current });
  };

  // At most every 120 ms (it reads the sections' positions), and once more after scrolling stops.
  const schedule = () => {
    if (timer) return;
    timer = window.setTimeout(update, Math.max(0, 120 - (performance.now() - last)));
  };
  const onResize = () => {
    collect();
    schedule();
  };

  collect();
  update();
  window.addEventListener('scroll', schedule, { passive: true });
  window.addEventListener('resize', onResize, { passive: true });
  return () => {
    window.removeEventListener('scroll', schedule);
    window.removeEventListener('resize', onResize);
    window.clearTimeout(timer);
  };
}

export const useScrollSpy = () => spyStore.useStore();
