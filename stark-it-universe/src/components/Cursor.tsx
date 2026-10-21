import { useEffect, useRef } from 'react';
import { useMediaQuery } from '../hooks/useMediaQuery';
import { useReducedMotion } from '../hooks/useReducedMotion';

const INTERACTIVE = 'a, button, summary, label, select, [role="slider"], [role="switch"], [data-cursor="grow"]';
const TEXT_ENTRY = 'input:not([type="checkbox"]):not([type="radio"]), textarea, select';

/**
 * Desktop-only custom cursor: a small orbit ring that grows over clickable
 * things. Touch devices and Reduce Motion keep the system cursor; text
 * fields always show the system text cursor.
 */
export function Cursor() {
  const fine = useMediaQuery('(hover: hover) and (pointer: fine)');
  const reduced = useReducedMotion();
  const enabled = fine && !reduced;
  const ringRef = useRef<HTMLDivElement>(null);
  const dotRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!enabled) return;
    const ring = ringRef.current!;
    const dot = dotRef.current!;
    const root = document.documentElement;
    root.classList.add('has-cursor');

    let x = -100;
    let y = -100;
    let rx = x;
    let ry = y;
    let scale = 1;
    let targetScale = 1;
    let raf = 0;

    const frame = () => {
      rx += (x - rx) * 0.22;
      ry += (y - ry) * 0.22;
      scale += (targetScale - scale) * 0.2;
      ring.style.transform = `translate3d(${rx}px, ${ry}px, 0) scale(${scale.toFixed(3)})`;
      dot.style.transform = `translate3d(${x}px, ${y}px, 0)`;
      const settled = Math.abs(x - rx) < 0.1 && Math.abs(y - ry) < 0.1 && Math.abs(targetScale - scale) < 0.01;
      raf = settled ? 0 : requestAnimationFrame(frame);
    };
    const kick = () => {
      if (!raf) raf = requestAnimationFrame(frame);
    };

    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse') return;
      x = e.clientX;
      y = e.clientY;
      const target = e.target as Element | null;
      const inText = !!target?.closest?.(TEXT_ENTRY);
      root.classList.toggle('cursor-hidden', inText);
      const over3d = root.classList.contains('cursor-3d');
      targetScale = !inText && (over3d || target?.closest?.(INTERACTIVE)) ? 1.75 : 1;
      root.classList.add('cursor-visible');
      kick();
    };
    const onLeave = () => root.classList.remove('cursor-visible');
    const onDown = () => root.classList.add('cursor-down');
    const onUp = () => root.classList.remove('cursor-down');

    window.addEventListener('pointermove', onMove, { passive: true });
    document.addEventListener('pointerleave', onLeave);
    window.addEventListener('blur', onLeave);
    window.addEventListener('pointerdown', onDown, { passive: true });
    window.addEventListener('pointerup', onUp, { passive: true });
    return () => {
      cancelAnimationFrame(raf);
      root.classList.remove('has-cursor', 'cursor-visible', 'cursor-hidden', 'cursor-down');
      window.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerleave', onLeave);
      window.removeEventListener('blur', onLeave);
      window.removeEventListener('pointerdown', onDown);
      window.removeEventListener('pointerup', onUp);
    };
  }, [enabled]);

  if (!enabled) return null;
  return (
    <div className="cursor" aria-hidden="true">
      <div ref={ringRef} className="cursor__ring" />
      <div ref={dotRef} className="cursor__dot" />
    </div>
  );
}
