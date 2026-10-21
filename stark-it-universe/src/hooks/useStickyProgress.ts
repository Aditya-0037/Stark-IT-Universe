import { useEffect, useRef, type RefObject } from 'react';
import { journey, type JourneyKey } from '../lib/journey';

/**
 * Progress (0..1) through a pinned scene: 0 when the section's top reaches
 * the top of the screen, 1 when its bottom reaches the bottom. Written to
 * the shared journey object (for the 3D camera) and passed to `onProgress`
 * (for the HTML: active card, active station).
 */
export function useStickyProgress(
  ref: RefObject<HTMLElement>,
  key: JourneyKey,
  enabled: boolean,
  onProgress: (p: number) => void,
) {
  const cb = useRef(onProgress);
  cb.current = onProgress;

  useEffect(() => {
    if (!enabled) {
      journey[key] = 0;
      return;
    }
    let raf = 0;
    const update = () => {
      raf = 0;
      const el = ref.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const range = r.height - window.innerHeight;
      const p = range > 0 ? Math.min(1, Math.max(0, -r.top / range)) : 0;
      journey[key] = p;
      cb.current(p);
    };
    const schedule = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };
    update();
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule, { passive: true });
    return () => {
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [enabled, key, ref]);
}

/** Scroll position that puts a pinned scene at progress p. */
export function stickyScrollY(el: HTMLElement, p: number) {
  const top = el.getBoundingClientRect().top + window.scrollY;
  return top + p * (el.offsetHeight - window.innerHeight);
}
