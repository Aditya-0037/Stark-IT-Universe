import { startTransition, useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';

interface Props {
  /** Accessible description; the box is announced as one image. */
  label?: string;
  /** CSS aspect-ratio of the box (keeps the layout stable before drawing). */
  ratio?: string;
  className?: string;
  style?: CSSProperties;
  /** How early to draw, before the box scrolls into view. */
  rootMargin?: string;
  children: ReactNode;
}

/**
 * Draws a heavy decorative illustration only when it comes near the
 * viewport. Until then an empty box of the same size holds its place (no
 * layout shift) and carries its description. Keeps the initial page small
 * so the first paint is fast on phones. It is also drawn ahead, in idle time
 * a few seconds after load in LITE (React renders it in slices), so it
 * rarely has to mount in the middle of a scroll, where it is one long frame
 * on a slow phone. A box hidden with display: none (e.g. when the 3D layer replaces
 * it) never draws at all.
 */
export function LazyVisual({ label, ratio, className = '', style, rootMargin = '800px 0px', children }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [show, setShow] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (!('IntersectionObserver' in window)) {
      setShow(true);
      return;
    }
    const draw = () => {
      io.disconnect();
      startTransition(() => setShow(true));
    };
    const io = new IntersectionObserver(([entry]) => entry.isIntersecting && draw(), { rootMargin });
    io.observe(el);
    const w = window as Window & typeof globalThis;
    // (not in FULL, where the 3D layer replaces it once loaded)
    const ahead = () => document.documentElement.dataset.tier === 'lite' && el.getClientRects().length > 0 && draw();
    const delay = window.setTimeout(() => {
      if (typeof w.requestIdleCallback === 'function') idle = w.requestIdleCallback(ahead, { timeout: 3000 });
      else ahead();
    }, 2500);
    let idle = 0;
    return () => {
      io.disconnect();
      window.clearTimeout(delay);
      if (idle) w.cancelIdleCallback(idle);
    };
  }, [rootMargin]);

  return (
    <div
      ref={ref}
      className={className}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      style={{ ...style, aspectRatio: ratio }}
    >
      {show && children}
    </div>
  );
}
