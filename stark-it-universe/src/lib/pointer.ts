/**
 * Normalised mouse position (-1..1, y up) for the 3D layer's lean toward
 * the cursor. Touch input is ignored, so phones and tablets stay still.
 */
export const pointer = { x: 0, y: 0, active: false };

let started = false;

export function trackPointer() {
  if (started || typeof window === 'undefined') return;
  started = true;
  window.addEventListener(
    'pointermove',
    (e) => {
      if (e.pointerType !== 'mouse') return;
      pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
      pointer.y = -((e.clientY / window.innerHeight) * 2 - 1);
      pointer.active = true;
    },
    { passive: true },
  );
  document.addEventListener('pointerleave', () => {
    pointer.active = false;
  });
}
