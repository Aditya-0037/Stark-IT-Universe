import { prefersReducedMotion } from '../hooks/useReducedMotion';

/**
 * In-page navigation. FULL mode registers Lenis as the smooth scroller;
 * otherwise native scrolling is used. Sections carry scroll-margin-top so
 * the sticky header never covers the target.
 */
type SmoothScroller = (y: number) => void;
let smooth: SmoothScroller | null = null;

export function registerSmoothScroller(fn: SmoothScroller | null) {
  smooth = fn;
}

/**
 * The page's scroll position for code that runs every frame. FULL mode
 * registers its own reader (Lenis's value): reading window.scrollY inside a
 * frame makes the browser lay the page out first whenever anything changed.
 */
const nativeScroll = () => window.scrollY;
let readScroll: () => number = nativeScroll;

export function registerScrollReader(fn: (() => number) | null) {
  readScroll = fn ?? nativeScroll;
}

export const scrollPosition = () => readScroll();

/** Scroll the page to a Y position (smoothly unless Reduce Motion). */
export function scrollToY(y: number) {
  const top = Math.max(0, Math.round(y));
  if (prefersReducedMotion()) window.scrollTo({ top, behavior: 'auto' });
  else if (smooth) smooth(top);
  else window.scrollTo({ top, behavior: 'smooth' });
}

/**
 * Some targets live inside pinned (sticky) scenes in FULL mode, e.g. a
 * service card. A resolver turns such an id into the scroll position that
 * shows it, plus the element that should receive focus.
 */
type Resolver = (id: string) => { y: number; focus?: HTMLElement | null } | null;
const resolvers = new Set<Resolver>();

export function registerAnchorResolver(r: Resolver) {
  resolvers.add(r);
  return () => {
    resolvers.delete(r);
  };
}

/**
 * Scrolls to an element by id and moves keyboard focus there, so keyboard
 * and screen-reader users land where the page scrolled to.
 * @param focus element (or selector) to focus; `false` leaves focus alone.
 *   Defaults to the target itself when it is focusable, else its heading.
 */
export function scrollToId(id: string, focus?: HTMLElement | string | false) {
  let y: number | null = null;
  let resolvedFocus: HTMLElement | null | undefined;
  for (const r of resolvers) {
    const hit = r(id);
    if (hit) {
      y = hit.y;
      resolvedFocus = hit.focus;
      break;
    }
  }

  const el = document.getElementById(id);
  if (!el && y === null) return;
  if (y === null && el) {
    const margin = parseFloat(getComputedStyle(el).scrollMarginTop) || 0;
    y = el.getBoundingClientRect().top + window.scrollY - margin;
  }
  scrollToY(y!);

  if (focus !== false) {
    const target =
      typeof focus === 'string'
        ? document.querySelector<HTMLElement>(focus)
        : focus ??
          resolvedFocus ??
          (el?.hasAttribute('tabindex') ? el : el?.querySelector<HTMLElement>('h1, h2, [data-focus-target]'));
    target?.focus({ preventScroll: true });
  }
  if (history.replaceState) history.replaceState(null, '', `#${id}`);
}
