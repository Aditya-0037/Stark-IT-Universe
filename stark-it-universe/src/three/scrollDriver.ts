import gsap from 'gsap';
import { Observer } from 'gsap/Observer';
import Lenis from 'lenis';
import { registerScrollReader, registerSmoothScroller } from '../lib/scroll';
import { TEXT_ZONE_SELECTOR, textZones, updateTextZones } from '../lib/textZones';
import { inStory, measure, measured, nearestStep, storyPosition } from '../lib/timeline';
import { worldOut } from '../lib/worldState';
import { startHud } from '../story/hud';
import { easeFn, LAST_STEP, STEPS } from '../story/steps';
import { story } from '../story/store';
import { crossfade, prewarm, prewarmDone } from './stage';

/**
 * FULL mode scrolling.
 *
 * The 3D story (hero to Switch on) moves through named steps, one at a time
 * (src/story/steps.ts): one gesture (a wheel notch, a trackpad swipe, a phone
 * swipe, an arrow key) plays exactly one move, at that move's fixed speed,
 * by animating the real scroll position with Lenis. The scroll position stays
 * the single source of truth (the scrollbar, anchors and reloads keep
 * working); the 3D follows it exactly every frame.
 *
 * Gating: input is ignored while a move plays until it is 75 % done; after
 * that one new gesture in the same direction queues one more move (at most
 * one); a gesture the other way reverses the move smoothly; for 200 ms after
 * a move lands input is ignored. Trackpad inertia tails never count as a new
 * gesture (a new one needs 150 ms without wheel events, or a sharp rise in
 * the wheel deltas after they had decayed).
 *
 * Outside the story (Build, Proof, Quote) scrolling is normal Lenis smooth
 * scrolling. Text tied to a step appears when the step lands and goes when
 * the next move starts (never scrubbed). Links and jumps further than one
 * step travel there at once behind a 250 ms crossfade.
 *
 * Under Reduce Motion there is no scroll control: native scrolling, and the
 * 3D cuts between steps with crossfades (camera rig).
 */
const WIDE = '(min-width: 768px)';
const GESTURE_GAP = 150; // ms without wheel events before a new gesture can start
const LAND_LOCK = 200; // ms after a move lands
const QUEUE_AT = 0.75; // a move must be this far before a gesture can queue the next one
const SWIPE = 50; // px of vertical travel for one touch step
const SAVE_KEY = 'siu-scroll-y';

const COPY: { scene: string; sel: string }[] = [
  { scene: 'space', sel: '#space .hero__copy' },
  { scene: 'planets', sel: '#planets .scene__pin > .container' },
  { scene: 'route', sel: '#route .scene__pin > .container' },
  { scene: 'descent', sel: '#descent .descent__panel' },
  { scene: 'classroom', sel: '#classroom .scene__pin > .container' },
  { scene: 'switch-on', sel: '#switch-on .scene__pin > .container' },
];

interface Move {
  from: number;
  to: number;
  dir: 1 | -1 | 0;
  start: number;
  dur: number;
}

export function startScrollDriver({ smooth }: { smooth: boolean }) {
  gsap.registerPlugin(Observer);
  const html = document.documentElement;
  const wide = window.matchMedia(WIDE);
  const debug = location.search.includes('debug');

  // ---- state ---------------------------------------------------------------------------
  let control = false; // the story owns the input (pinned story, FULL, wide, motion allowed)
  const ctl = { current: 0, move: null as Move | null, queue: 0 as 0 | 1 | -1, landedAt: 0, inputs: 0, accepted: 0, travelling: false };
  const stepY = (i: number) => measured().stepY[i];

  // ---- Lenis: the only smoothing layer, driven by GSAP's ticker ----------------------
  let lenis: Lenis | null = null;
  const tick = (time: number) => lenis?.raf(time * 1000);
  if (smooth) {
    lenis = new Lenis({
      lerp: 0.1,
      wheelMultiplier: 1,
      touchMultiplier: 1,
      smoothWheel: true,
      syncTouch: false,
      autoRaf: false,
      // in the story the input is ours (the Observer below takes it)
      virtualScroll: () => !control,
    });
    gsap.ticker.add(tick, false, true);
    gsap.ticker.lagSmoothing(0);
  }
  // The scroll position is read from Lenis (or, with native scrolling, kept from the
  // scroll events): reading window.scrollY inside a frame makes the browser lay the
  // page out first whenever anything on it changed.
  let nativeY = window.scrollY;
  const trackNative = () => (nativeY = window.scrollY);
  if (!lenis) window.addEventListener('scroll', trackNative, { passive: true });
  const scrollNow = () => (lenis ? lenis.scroll : nativeY);
  registerScrollReader(scrollNow);
  const jump = (y: number) => {
    if (lenis) lenis.scrollTo(y, { immediate: true, force: true });
    else {
      window.scrollTo({ top: y, behavior: 'auto' });
      trackNative();
    }
  };

  // ---- overlays: shown on arrival, hidden when a move starts ----------------------------
  let copyEls: { scene: string; els: HTMLElement[] }[] = [];
  let zoneEls: HTMLElement[] = [];
  let shownScene = '';
  const collect = () => {
    copyEls = COPY.map((c) => ({ scene: c.scene, els: [...document.querySelectorAll<HTMLElement>(c.sel)] }));
    copyEls.forEach((c) => c.els.forEach((el) => el.classList.add('story-copy')));
    zoneEls = [...document.querySelectorAll<HTMLElement>(TEXT_ZONE_SELECTOR)];
  };
  const showScene = (scene: string) => {
    if (scene === shownScene) return;
    shownScene = scene;
    for (const c of copyEls)
      for (const el of c.els) {
        if (c.scene === scene) el.setAttribute('data-story-shown', '');
        else el.removeAttribute('data-story-shown');
      }
  };
  const storyAttrs = (on: boolean) => {
    if (on) html.dataset.story = '';
    else {
      delete html.dataset.story;
      delete html.dataset.storyMoving;
    }
  };
  /** A move starts: per-step text fades out; the scene's text too if the move leaves the scene. */
  const moveStarts = (from: number, to: number) => {
    html.dataset.storyMoving = '';
    if (STEPS[from]?.scene !== STEPS[to]?.scene) showScene('');
    story.set({ moving: true, target: to });
  };
  /** A step has landed: its text fades in. */
  const landed = (step: number) => {
    delete html.dataset.storyMoving;
    showScene(STEPS[step].scene);
    story.set({ step, target: step, moving: false });
    window.setTimeout(() => updateTextZones(zoneEls), 450);
  };

  // ---- moves ------------------------------------------------------------------------------
  const lockedMove = (y: number, dur: number, ease: (t: number) => number, done: () => void) => {
    if (!lenis) {
      jump(y);
      done();
      return;
    }
    if (Math.abs(scrollNow() - y) < 1 || dur <= 0) {
      jump(y);
      done();
      return;
    }
    lenis.scrollTo(y, { duration: dur, easing: ease, lock: true, force: true, onComplete: done });
  };
  const arrive = (to: number) => {
    const mv = ctl.move;
    if (!mv || mv.to !== to) return; // a newer move took over
    ctl.move = null;
    ctl.current = to;
    ctl.landedAt = performance.now();
    landed(to);
    if (ctl.queue) {
      const q = ctl.queue;
      ctl.queue = 0;
      go(to + q);
    }
  };
  const startMove = (from: number, to: number, dur: number) => {
    const dir = to > from ? 1 : to < from ? -1 : 0;
    ctl.move = { from, to, dir, start: performance.now(), dur };
    moveStarts(from, to);
    lockedMove(stepY(to), dur, easeFn, () => arrive(to));
  };
  /** One step forward or back from the current step. */
  const go = (to: number) => {
    const from = ctl.current;
    if (to < 0) return false;
    if (to > LAST_STEP) {
      release();
      return true;
    }
    // the move into a step takes that step's duration; the move back out of it the same
    startMove(from, to, to > from ? STEPS[to].duration : STEPS[from].duration);
    return true;
  };
  /** A gesture in the opposite direction mid-move: glide back to where the move came from. */
  const reverse = () => {
    const mv = ctl.move!;
    const t = Math.min(1, (performance.now() - mv.start) / (mv.dur * 1000));
    const back = mv.from;
    ctl.queue = 0;
    ctl.move = { from: mv.to, to: back, dir: (mv.dir * -1) as 1 | -1, start: performance.now(), dur: Math.max(0.35, mv.dur * t) };
    story.set({ moving: true, target: back });
    lockedMove(stepY(back), ctl.move.dur, easeFn, () => arrive(back));
  };

  // The first time Chrome draws a kind of thing on the page (the cards'
  // gradients, the scrim's mask, the dial) it compiles GPU shaders for it,
  // which held the screen for up to half a second when a scene's text first
  // appeared. So once the 3D regions are warm (the two never compete for the
  // GPU while loading), every scene's text is drawn for a few frames, moved
  // into view and almost transparent (0.4 %), before the story's first move
  // (which waits for it).
  let warmed = false;
  let warmRaf = 0;
  /** Calls `done` once the GPU has caught up with what was drawn (a few quick frames in a row). */
  const caughtUp = (done: () => void) => {
    let frames = 0;
    let quick = 0;
    let last = performance.now();
    const t0 = last;
    const check = (now: number) => {
      frames += 1;
      quick = now - last < 25 ? quick + 1 : 0;
      last = now;
      if ((frames < 4 || quick < 3) && now - t0 < 3000) warmRaf = requestAnimationFrame(check);
      else done();
    };
    warmRaf = requestAnimationFrame(check);
  };
  const regionsWarm = () => {
    const p = prewarm.get();
    return p.space && p.room && p.campus;
  };
  let fontsReady = !document.fonts;
  const warmText = () => {
    if (warmed || !fontsReady || !regionsWarm()) return;
    warmed = true;
    const els = copyEls.flatMap((c) => c.els).filter((el) => !el.hasAttribute('data-story-shown'));
    if (!html.hasAttribute('data-story') || !els.length) {
      prewarm.set({ text: true });
      return;
    }
    html.dataset.storyWarm = '';
    // each text moved to the top of the viewport
    const tops = els.map((el) => el.getBoundingClientRect().top);
    els.forEach((el, i) => el.style.setProperty('--warm-y', `${Math.round(-tops[i])}px`));
    caughtUp(() => {
      els.forEach((el) => {
        el.style.transition = 'none';
        el.style.removeProperty('--warm-y');
      });
      delete html.dataset.storyWarm;
      void html.offsetWidth; // hidden again at once, without the fade
      els.forEach((el) => (el.style.transition = ''));
      prewarm.set({ text: true });
    });
  };

  // The first move waits until every region is built, compiled and warmed
  // (a gesture made before that plays as soon as it is).
  let pending: 0 | 1 | -1 = 0;
  const stopPrewarm = prewarm.subscribe(() => {
    warmText();
    if (!prewarmDone() || !pending) return;
    const d = pending;
    pending = 0;
    ctl.inputs -= 1;
    gesture(d);
  });

  /** One input gesture (+1 forward, -1 back). */
  const gesture = (dir: 1 | -1) => {
    ctl.inputs += 1;
    if (!control || ctl.travelling) return;
    if (!prewarmDone()) {
      pending = dir;
      return;
    }
    const now = performance.now();
    const mv = ctl.move;
    if (mv) {
      const t = (now - mv.start) / (mv.dur * 1000);
      if (mv.dir !== 0 && dir !== mv.dir) {
        ctl.accepted += 1;
        reverse();
      } else if (mv.dir === dir && t >= QUEUE_AT && !ctl.queue) {
        ctl.queue = dir;
        ctl.accepted += 1;
      }
      return;
    }
    if (now - ctl.landedAt < LAND_LOCK) return;
    if (go(ctl.current + dir)) ctl.accepted += 1;
  };

  // ---- entering and leaving the story ----------------------------------------------------
  const setControl = (on: boolean) => {
    if (on === control) return;
    control = on;
    html.classList.toggle('story-control', on);
    if (on) observer?.enable();
    else observer?.disable();
  };
  /** At the last step a forward gesture carries on into Build as normal scrolling (no dead gesture). */
  const release = () => {
    setControl(false);
    ctl.move = null;
    ctl.queue = 0;
    const vh = measured().vh;
    lenis?.scrollTo(stepY(LAST_STEP) + vh * 0.55, { duration: 0.9, easing: (t) => 1 - Math.pow(1 - t, 3) });
  };
  /** Scrolling back up from Build into the story: settle on its last step, in control again. */
  const reenter = () => {
    setControl(true);
    ctl.current = LAST_STEP;
    ctl.queue = 0;
    ctl.move = { from: LAST_STEP, to: LAST_STEP, dir: 0, start: performance.now(), dur: 0.45 };
    lockedMove(stepY(LAST_STEP), 0.45, (t) => 1 - Math.pow(1 - t, 3), () => arrive(LAST_STEP));
  };

  // ---- external scrolling (scrollbar drag, find in page, focus): settle on the nearest step ----
  let settleTimer = 0;
  const settle = () => {
    settleTimer = 0;
    if (!control || ctl.move || ctl.travelling) return;
    const y = scrollNow();
    if (!inStory(y)) {
      setControl(false);
      return;
    }
    const n = nearestStep(y);
    if (Math.abs(y - stepY(n)) < 1.5) {
      if (n !== ctl.current) {
        ctl.current = n;
        landed(n);
      }
      return;
    }
    const d = Math.abs(y - stepY(n)) / measured().vh;
    ctl.move = { from: ctl.current, to: n, dir: 0, start: performance.now(), dur: Math.min(0.6, 0.25 + d * 0.5) };
    moveStarts(ctl.current, n);
    lockedMove(stepY(n), ctl.move.dur, easeFn, () => arrive(n));
  };
  const onScroll = () => {
    const y = scrollNow();
    if (!wide.matches) return;
    if (!smooth) {
      // Reduce Motion: native scrolling; the text follows the nearest step
      if (inStory(y)) {
        const n = nearestStep(y);
        if (n !== ctl.current || !shownScene) {
          ctl.current = n;
          landed(n);
        }
      }
      return;
    }
    if (ctl.travelling) return;
    if (!control) {
      if (inStory(y, -2) && !releasing()) reenter();
      return;
    }
    if (!ctl.move && lenis?.isScrolling === 'native' && Math.abs(y - stepY(ctl.current)) > 1.5) {
      window.clearTimeout(settleTimer);
      settleTimer = window.setTimeout(settle, 160);
    }
  };
  const releasing = () => !!lenis && lenis.isScrolling === 'smooth' && scrollNow() > stepY(LAST_STEP) - 2;
  if (lenis) lenis.on('scroll', onScroll);
  else window.addEventListener('scroll', onScroll, { passive: true });

  // ---- input: wheel and touch (GSAP Observer), keys ---------------------------------------
  // Wheel gestures, Lethargy-style: a new gesture after 150 ms of silence (a weak event
  // after a short pause is still the old gesture's inertia tail), a change of direction, or a
  // sharp rise in |delta| after the deltas had decayed (a new swipe during a trackpad's
  // inertia tail). Everything else belongs to the gesture already counted. Times are the
  // events' own time stamps, so a busy main thread never splits one gesture into two.
  const wheel = { last: -1e9, dir: 0, peak: 0, mags: [] as number[] };
  const onWheel = (e: WheelEvent) => {
    const k = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? window.innerHeight : 1;
    const dy = e.deltaY * k;
    const a = Math.abs(dy);
    if (a < 0.5 || Math.abs(e.deltaX * k) > a) return;
    const now = e.timeStamp || performance.now();
    const gap = now - wheel.last;
    wheel.last = now;
    const dir = dy > 0 ? 1 : -1;
    const m = wheel.mags;
    let fresh = dir !== wheel.dir || (gap > GESTURE_GAP && (gap > 400 || a >= wheel.peak * 0.5));
    if (!fresh && m.length >= 3) {
      const recent = (m[m.length - 1] + m[m.length - 2] + m[m.length - 3]) / 3;
      const decayed = recent < wheel.peak * 0.55;
      fresh = decayed && a > recent * 1.6 && a > 12;
    }
    if (fresh) {
      wheel.dir = dir;
      wheel.peak = a;
      m.length = 0;
      m.push(a);
      gesture(dir as 1 | -1);
    } else {
      m.push(a);
      if (m.length > 12) m.shift();
      wheel.peak = Math.max(wheel.peak, a);
    }
  };
  const touch = { fired: false };
  let observer: Observer | null = null;
  if (smooth) {
    observer = Observer.create({
      target: window,
      type: 'wheel,touch',
      tolerance: 10,
      preventDefault: true,
      allowClicks: true,
      ignoreCheck: (e) => e.target instanceof Element && !!e.target.closest('[data-lenis-prevent], .site-menu'),
      onWheel: (self) => onWheel(self.event as WheelEvent),
      onPress: () => {
        touch.fired = false;
      },
      onDrag: (self) => {
        if (touch.fired) return;
        const dy = (self.y ?? 0) - (self.startY ?? 0);
        const dx = (self.x ?? 0) - (self.startX ?? 0);
        // a mostly vertical swipe of 50 px = one step (finger up = forward)
        if (Math.abs(dy) >= SWIPE && Math.abs(dy) > Math.abs(dx) * 1.3) {
          touch.fired = true;
          gesture(dy < 0 ? 1 : -1);
        }
      },
      onRelease: () => {
        touch.fired = false;
      },
    });
    observer.disable();
  }
  const formFocus = (t: EventTarget | null) =>
    t instanceof HTMLElement && !!t.closest('input, textarea, select, [contenteditable="true"], [role="slider"], [role="dialog"]');
  const onKey = (e: KeyboardEvent) => {
    if (!control || e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey || formFocus(e.target)) return;
    let dir: 0 | 1 | -1 = 0;
    if (e.key === 'ArrowDown' || e.key === 'PageDown') dir = 1;
    else if (e.key === 'ArrowUp' || e.key === 'PageUp') dir = -1;
    else if (e.key === ' ' || e.key === 'Spacebar') {
      const t = e.target as HTMLElement | null;
      if (t?.closest?.('button, a, summary, label, [role="button"], [role="tab"]')) return;
      dir = e.shiftKey ? -1 : 1;
    } else if (e.key === 'Home') {
      e.preventDefault();
      travel(0);
      return;
    } else if (e.key === 'End') {
      e.preventDefault();
      travel(document.documentElement.scrollHeight);
      return;
    }
    if (!dir) return;
    e.preventDefault();
    if (e.repeat) return; // holding a key is one gesture
    gesture(dir);
  };
  window.addEventListener('keydown', onKey);

  // ---- jumps that are not single steps: fast travel behind a short crossfade ---------------
  const travel = (yIn: number) => {
    const mm = measured();
    const limit = document.documentElement.scrollHeight - mm.vh;
    let y = Math.max(0, Math.min(limit, Math.round(yIn)));
    const into = wide.matches && smooth && inStory(y);
    const n = into ? nearestStep(y) : -1;
    if (into) y = stepY(n);
    const from = scrollNow();
    // one step away inside the story: just play that move
    if (control && into && !ctl.move && Math.abs(n - ctl.current) === 1) {
      gesture(n > ctl.current ? 1 : -1);
      return;
    }
    if (Math.abs(y - from) < 2) {
      if (into && control && n !== ctl.current) {
        ctl.current = n;
        landed(n);
      }
      return;
    }
    if (!lenis) {
      jump(y);
      return;
    }
    // Snapshot the frame, cut under it, fade the snapshot out over 250 ms.
    ctl.travelling = true;
    ctl.move = null;
    ctl.queue = 0;
    moveStarts(ctl.current, into ? n : LAST_STEP);
    crossfade.fadeMs = 250;
    crossfade.ready = false;
    crossfade.request = true;
    const t0 = performance.now();
    const cut = () => {
      if (!crossfade.ready && performance.now() - t0 < 200) return; // the 3D layer copies its frame
      gsap.ticker.remove(cut);
      crossfade.ready = false;
      jump(y);
      setControl(into);
      ctl.travelling = false;
      if (into) {
        ctl.current = n;
        ctl.landedAt = performance.now();
        landed(n);
      } else delete html.dataset.storyMoving;
    };
    gsap.ticker.add(cut);
  };
  if (smooth) registerSmoothScroller(travel);

  // ---- Proof parallax: the ghost numbers drift and the glass project cards float past at
  // different speeds. Played from the frame loop below against positions measured once
  // (and again on resize), so nothing is read from the page while scrolling. Not under
  // Reduce Motion (smooth=false).
  const parallax: { sel: string; tweens: gsap.core.Tween[]; start: number; span: number; p: number }[] = [];
  if (smooth && wide.matches) {
    const tween = (target: string, from: gsap.TweenVars, to: gsap.TweenVars) => gsap.fromTo(target, from, { ...to, ease: 'none', paused: true });
    parallax.push(
      {
        sel: '#proof',
        tweens: [tween('.ghost-number:nth-child(1)', { xPercent: 6 }, { xPercent: -12 }), tween('.ghost-number:nth-child(2)', { xPercent: -10 }, { xPercent: 8 })],
        start: 0,
        span: 1,
        p: -1,
      },
      {
        sel: '.projects:first-of-type',
        tweens: [
          [70, -50],
          [140, -10],
          [30, -90],
        ].map(([from, to], i) => tween(`.projects:first-of-type > li:nth-child(${i + 1})`, { y: from }, { y: to })),
        start: 0,
        span: 1,
        p: -1,
      },
    );
  }
  /** Each parallax runs from its element's top at the bottom of the viewport to its bottom at the top. */
  const measureParallax = () => {
    const vh = measured().vh;
    for (const g of parallax) {
      const el = document.querySelector<HTMLElement>(g.sel);
      if (!el) continue;
      g.start = el.getBoundingClientRect().top + window.scrollY - vh;
      g.span = el.offsetHeight + vh;
      g.p = -1;
    }
  };

  // ---- the 3D layer bows out before Proof (normal scrolling there) --------------------------
  let worldLayer: HTMLElement | null = null;
  let lastWorld = -1;
  const frame = () => {
    const mm = measured();
    const y = scrollNow();
    const proof = mm.tops.proof;
    const out = proof === undefined ? 1 : 1 - smoothstep(proof - 1.25 * mm.vh, proof - mm.vh, y);
    if (worldLayer && Math.abs(out - lastWorld) > 0.002) {
      worldLayer.style.opacity = out > 0.998 ? '' : out.toFixed(3);
      lastWorld = out;
    }
    worldOut.set({ hidden: out < 0.002 });
    for (const g of parallax) {
      const p = Math.min(1, Math.max(0, (y - g.start) / g.span));
      if (Math.abs(p - g.p) < 0.0002) continue;
      g.p = p;
      for (const t of g.tweens) t.progress(p);
    }
  };
  gsap.ticker.add(frame);

  // ---- measuring, start-up and scroll restoration --------------------------------------------
  const applyMode = () => {
    const on = wide.matches;
    storyAttrs(on);
    if (!on) {
      setControl(false);
      showScene('');
      return;
    }
    const y = scrollNow();
    if (smooth && inStory(y)) {
      setControl(true);
      const n = nearestStep(y);
      ctl.current = n;
      if (Math.abs(y - stepY(n)) > 1) jump(stepY(n));
      landed(n);
    } else if (!smooth && inStory(y)) {
      ctl.current = nearestStep(y);
      landed(ctl.current);
    } else {
      setControl(false);
      showScene('switch-on');
    }
  };
  let timer = 0;
  const remeasure = () => {
    window.clearTimeout(timer);
    timer = window.setTimeout(() => {
      measure();
      collect();
      measureParallax();
      // resting in the story: stay on the step at its new position
      if (control && !ctl.move && !ctl.travelling && Math.abs(scrollNow() - stepY(ctl.current)) > 1) jump(stepY(ctl.current));
      if (!wide.matches || !control) applyMode();
    }, 60);
  };
  measure();
  collect();
  worldLayer = document.querySelector<HTMLElement>('.world__layer');
  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
  const saved = Number(sessionStorage.getItem(SAVE_KEY) || 0);
  if (!location.hash && saved > 0) {
    // a reload lands on the nearest resting step, never halfway through a move
    const y = wide.matches && inStory(saved) ? stepY(nearestStep(saved)) : saved;
    jump(y);
  }
  applyMode();
  document.fonts?.ready.then(() => {
    fontsReady = true;
    warmText();
  });
  const save = () => sessionStorage.setItem(SAVE_KEY, String(Math.round(scrollNow())));
  window.addEventListener('pagehide', save);
  const ro = new ResizeObserver(remeasure);
  ro.observe(document.body);
  window.addEventListener('resize', remeasure);
  wide.addEventListener('change', remeasure);

  // measured now and once more after the fonts (never during a move)
  measureParallax();
  if (document.fonts?.ready) document.fonts.ready.then(measureParallax);

  const stopHud = debug
    ? startHud(() => ({
        step: ctl.current,
        target: ctl.move ? ctl.move.to : ctl.current,
        position: storyPosition(scrollNow()),
        control,
        inputs: ctl.inputs,
        accepted: ctl.accepted,
      }))
    : null;
  if (debug)
    (window as unknown as { __story: unknown }).__story = {
      steps: STEPS.map((s) => s.id),
      get current() {
        return ctl.current;
      },
      get moving() {
        return !!ctl.move || ctl.travelling;
      },
      get control() {
        return control;
      },
      get ready() {
        return prewarmDone();
      },
      get counts() {
        return { inputs: ctl.inputs, accepted: ctl.accepted };
      },
      stepY: () => [...measured().stepY],
      travel: (y: number) => travel(y),
      warm: () => prewarm.get(),
    };

  return () => {
    stopPrewarm();
    cancelAnimationFrame(warmRaf);
    delete html.dataset.storyWarm;
    stopHud?.();
    gsap.ticker.remove(frame);
    observer?.kill();
    window.removeEventListener('keydown', onKey);
    window.removeEventListener('pagehide', save);
    if (!lenis) window.removeEventListener('scroll', onScroll);
    window.clearTimeout(settleTimer);
    window.clearTimeout(timer);
    for (const c of copyEls)
      for (const el of c.els) {
        el.classList.remove('story-copy');
        el.removeAttribute('data-story-shown');
      }
    storyAttrs(false);
    html.classList.remove('story-control');
    textZones.length = 0;
    if (worldLayer) worldLayer.style.opacity = '';
    worldOut.set({ hidden: false });
    ro.disconnect();
    window.removeEventListener('resize', remeasure);
    wide.removeEventListener('change', remeasure);
    parallax.forEach((g) => g.tweens.forEach((t) => t.kill()));
    gsap.set('.ghost-number, .projects > li', { clearProps: 'transform' });
    registerSmoothScroller(null);
    registerScrollReader(null);
    window.removeEventListener('scroll', trackNative);
    gsap.ticker.remove(tick);
    lenis?.destroy();
    lenis = null;
  };
}

function smoothstep(a: number, b: number, x: number) {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}
