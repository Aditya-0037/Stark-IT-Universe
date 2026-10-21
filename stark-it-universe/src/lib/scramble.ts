/**
 * Text-scramble "decode" effect for the hero H1 (~600 ms).
 *
 * The real heading never changes: it is made transparent while an
 * aria-hidden copy, positioned exactly on top, shows the scrambled letters.
 * Each letter keeps its real width (the random glyph is drawn over it), so
 * nothing reflows and there is no layout shift. Screen readers only ever
 * see the real text.
 */
const GLYPHS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#%&+=/<>*';
const pick = () => GLYPHS[Math.floor(Math.random() * GLYPHS.length)];

export function scramble(el: HTMLElement, duration = 600): () => void {
  const rect = el.getBoundingClientRect();
  if (!rect.width) return () => {};

  const copy = el.cloneNode(true) as HTMLElement;
  copy.removeAttribute('id');
  copy.removeAttribute('tabindex');
  copy.removeAttribute('data-scramble');
  copy.setAttribute('aria-hidden', 'true');
  copy.classList.add('scramble-copy');
  Object.assign(copy.style, {
    position: 'absolute',
    left: `${rect.left + window.scrollX}px`,
    top: `${rect.top + window.scrollY}px`,
    width: `${rect.width}px`,
    margin: '0',
  });

  const letters: { span: HTMLSpanElement; ch: string; at: number }[] = [];
  const walker = document.createTreeWalker(copy, NodeFilter.SHOW_TEXT);
  const texts: Text[] = [];
  while (walker.nextNode()) texts.push(walker.currentNode as Text);
  const total = texts.reduce((n, t) => n + t.data.replace(/\s/g, '').length, 0) || 1;
  let k = 0;
  for (const t of texts) {
    const frag = document.createDocumentFragment();
    for (const ch of t.data) {
      if (/\s/.test(ch)) {
        frag.append(ch);
        continue;
      }
      const span = document.createElement('span');
      span.className = 'scr';
      span.textContent = ch;
      span.dataset.r = pick();
      // Resolve roughly left to right, with a little jitter.
      const at = (k / total) * 0.62 * duration + Math.random() * 0.3 * duration;
      letters.push({ span, ch, at });
      frag.append(span);
      k++;
    }
    t.replaceWith(frag);
  }

  document.body.append(copy);
  // Each letter's colour comes from its own element (white / gold words).
  for (const l of letters) l.span.style.setProperty('--scr-c', getComputedStyle(l.span.parentElement!).color);
  el.dataset.scrambling = 'true';

  const start = performance.now();
  let last = 0;
  let raf = 0;
  const frame = (now: number) => {
    const t = now - start;
    const shuffle = now - last > 45;
    if (shuffle) last = now;
    let pending = 0;
    for (const l of letters) {
      if (t >= l.at) {
        if (!l.span.classList.contains('done')) l.span.classList.add('done');
      } else {
        pending++;
        if (shuffle) l.span.dataset.r = pick();
      }
    }
    if (pending > 0 && t < duration + 200) raf = requestAnimationFrame(frame);
    else cleanup();
  };
  const cleanup = () => {
    cancelAnimationFrame(raf);
    copy.remove();
    delete el.dataset.scrambling;
  };
  raf = requestAnimationFrame(frame);
  return cleanup;
}
