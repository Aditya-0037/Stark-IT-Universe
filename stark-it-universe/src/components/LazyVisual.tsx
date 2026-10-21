import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';

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
 * so the first paint is fast on phones. A box hidden with display: none
 * (e.g. when the 3D layer replaces it) never draws at all.
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
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setShow(true);
          io.disconnect();
        }
      },
      { rootMargin },
    );
    io.observe(el);
    return () => io.disconnect();
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
