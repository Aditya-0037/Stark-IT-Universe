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
  let raf = 0;
  let themed: HTMLElement[] = [];
  let indexed: HTMLElement[] = [];

  const collect = () => {
    themed = Array.from(document.querySelectorAll<HTMLElement>('main [data-theme], footer[data-theme]'));
    indexed = Array.from(document.querySelectorAll<HTMLElement>('main [data-index]'));
  };

  const update = () => {
    raf = 0;
    const styles = getComputedStyle(document.documentElement);
    const headerY =
      parseFloat(styles.getPropertyValue('--header-top')) + parseFloat(styles.getPropertyValue('--header-h')) / 2 || 42;

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

  const schedule = () => {
    if (!raf) raf = requestAnimationFrame(update);
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
    if (raf) cancelAnimationFrame(raf);
  };
}

export const useScrollSpy = () => spyStore.useStore();
