/**
 * Screen rectangles (CSS px) of the copy panels currently showing. In-world
 * labels fade out where they would sit over text, so labels never cover
 * copy (updated every frame by the scroll driver in FULL mode).
 */
export interface Zone {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}
export const textZones: Zone[] = [];

/** Copy panels that 3D labels must keep out of. */
export const TEXT_ZONE_SELECTOR = [
  '.hero__copy',
  '.planets__head',
  '.svc-deck',
  '.route__intro',
  '.route__track',
  '.descent__panel',
  '.classroom__head',
  '.classroom__side',
  '.switch__head',
  '.switch__controls',
  '.build__head',
  '.build__controls',
  '.build__side',
].join(', ');

export function updateTextZones(els: HTMLElement[]) {
  textZones.length = 0;
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  for (const el of els) {
    if (el.closest('[data-copy-hidden]')) continue;
    const r = el.getBoundingClientRect();
    if (r.bottom < 0 || r.top > vh || r.right < 0 || r.left > vw || r.width < 4) continue;
    textZones.push({ x0: r.left, y0: r.top, x1: r.right, y1: r.bottom });
  }
}

/** Is a screen point (CSS px) over a copy panel (with a margin)? */
export function overText(x: number, y: number, margin = 14) {
  return textZones.some((z) => x > z.x0 - margin && x < z.x1 + margin && y > z.y0 - margin && y < z.y1 + margin);
}
