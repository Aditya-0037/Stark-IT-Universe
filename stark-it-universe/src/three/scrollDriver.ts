import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';
import { journey } from '../lib/journey';
import { registerSmoothScroller } from '../lib/scroll';

/**
 * FULL mode scrolling:
 *  - Lenis smooth scrolling (not under Reduce Motion), driven by GSAP's ticker.
 *  - ScrollTriggers that scrub the hand-overs between scenes (hero -> planets,
 *    planets -> route, descent -> classroom -> switch on) into the shared
 *    journey object, plus the scrubbed hero exit.
 *  - The descent: progress through the pinned #descent scene (about two
 *    screens of scrolling) drives the camera path; its heading panel shows
 *    only while the campus is in view (55-80 %).
 * The pinned scenes' own progress comes from useStickyProgress in the HTML.
 */
export function startScrollDriver({ smooth }: { smooth: boolean }) {
  gsap.registerPlugin(ScrollTrigger);
  let lenis: Lenis | null = null;
  const tick = (time: number) => lenis?.raf(time * 1000);

  if (smooth) {
    lenis = new Lenis({ lerp: 0.11, smoothWheel: true, wheelMultiplier: 0.9 });
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add(tick);
    gsap.ticker.lagSmoothing(0);
    registerSmoothScroller((y) => lenis?.scrollTo(y, { duration: 1.3 }));
  }

  // Lenis keeps its own scroll position, so a Tab to a control below the
  // screen would not scroll it into view. After a Tab, bring the newly
  // focused control on screen (immediately: keyboard users expect a jump).
  let lastTab = 0;
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Tab') lastTab = performance.now();
  };
  const onFocusIn = (e: FocusEvent) => {
    if (!lenis || performance.now() - lastTab > 200) return;
    const el = e.target as HTMLElement | null;
    if (!el || el === document.body || !el.getBoundingClientRect) return;
    const r = el.getBoundingClientRect();
    const css = getComputedStyle(document.documentElement);
    const top = parseFloat(css.getPropertyValue('--header-space')) || 88;
    if (r.top >= top && r.bottom <= window.innerHeight - 16) return;
    const y = window.scrollY + r.top - Math.max(top, (window.innerHeight - r.height) / 2);
    lenis.scrollTo(Math.max(0, y), { immediate: true, force: true });
  };
  document.addEventListener('keydown', onKey, true);
  document.addEventListener('focusin', onFocusIn);

  const handover = (
    selector: string,
    key: 'toPlanets' | 'toRoute' | 'toClassroom' | 'toSwitch' | 'toBuild',
  ) =>
    ScrollTrigger.create({
      trigger: selector,
      start: 'top bottom',
      end: 'top top',
      onUpdate: (self) => {
        journey[key] = self.progress;
      },
      onRefresh: (self) => {
        journey[key] = self.progress;
      },
    });

  const triggers = [
    handover('#planets', 'toPlanets'),
    handover('#route', 'toRoute'),
    // Starts only once #descent is pinned, so the route scene has left the screen.
    ScrollTrigger.create({
      trigger: '#descent',
      start: 'top top',
      end: 'bottom bottom',
      onUpdate: (self) => {
        journey.descent = self.progress;
      },
      onRefresh: (self) => {
        journey.descent = self.progress;
      },
    }),
    handover('#classroom', 'toClassroom'),
    handover('#switch-on', 'toSwitch'),
    handover('#build', 'toBuild'),
  ];

  // Descent heading: on its panel only while the campus is in view, gone
  // before the camera heads for the window (opacity only, no movement).
  const descentPanel = gsap
    .timeline({
      defaults: { ease: 'none' },
      scrollTrigger: { trigger: '#descent', start: 'top top', end: 'bottom bottom', scrub: true },
    })
    .fromTo('.descent__panel', { opacity: 0 }, { opacity: 1, duration: 0.05 }, 0.55)
    .to('.descent__panel', { opacity: 0, duration: 0.05 }, 0.75)
    .set({}, {}, 1);

  // The hero copy drifts up and fades as the camera leaves for the planets.
  const heroExit = smooth
    ? gsap.to('.hero__copy', {
        yPercent: -12,
        opacity: 0.15,
        ease: 'none',
        scrollTrigger: { trigger: '#space', start: 'top top', end: 'bottom top', scrub: true },
      })
    : null;

  // Proof: the ghost numbers drift and the glass project cards float past
  // at different speeds (parallax). Not under Reduce Motion (smooth=false).
  const proofTweens: gsap.core.Tween[] = [];
  if (smooth && window.matchMedia('(min-width: 768px)').matches) {
    const scrub = (trigger: string) => ({ trigger, start: 'top bottom', end: 'bottom top', scrub: true });
    proofTweens.push(
      gsap.fromTo('.ghost-number:nth-child(1)', { xPercent: 6 }, { xPercent: -12, ease: 'none', scrollTrigger: scrub('#proof') }),
      gsap.fromTo('.ghost-number:nth-child(2)', { xPercent: -10 }, { xPercent: 8, ease: 'none', scrollTrigger: scrub('#proof') }),
    );
    [
      [70, -50],
      [140, -10],
      [30, -90],
    ].forEach(([from, to], i) => {
      proofTweens.push(
        gsap.fromTo(
          `.projects > li:nth-child(${i + 1})`,
          { y: from },
          { y: to, ease: 'none', scrollTrigger: scrub('.projects') },
        ),
      );
    });
  }

  ScrollTrigger.refresh();

  return () => {
    triggers.forEach((t) => t.kill());
    descentPanel.scrollTrigger?.kill();
    descentPanel.kill();
    gsap.set('.descent__panel', { clearProps: 'opacity' });
    journey.descent = 0;
    heroExit?.scrollTrigger?.kill();
    heroExit?.kill();
    gsap.set('.hero__copy', { clearProps: 'transform,opacity' });
    proofTweens.forEach((t) => {
      t.scrollTrigger?.kill();
      t.kill();
    });
    gsap.set('.ghost-number, .projects > li', { clearProps: 'transform' });
    registerSmoothScroller(null);
    document.removeEventListener('keydown', onKey, true);
    document.removeEventListener('focusin', onFocusIn);
    gsap.ticker.remove(tick);
    lenis?.destroy();
    lenis = null;
  };
}
