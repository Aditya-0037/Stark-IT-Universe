import { useEffect, useRef } from 'react';
import { en } from '../content/en';
import { Button } from '../components/Button';
import { EmblemPlaceholder } from '../components/illustrations/EmblemPlaceholder';
import { Rich } from '../components/Placeholder';
import { Scene } from '../components/Scene';
import { tierStore } from '../hooks/useDeviceTier';
import { prefersReducedMotion } from '../hooks/useReducedMotion';
import { brand } from '../lib/brand';
import { useUi } from '../lib/i18n';
import { INTRO_DONE_EVENT, introRequested } from '../lib/introState';
import { scramble } from '../lib/scramble';

/**
 * Scene 1: the space hero. The H1 and all copy are plain HTML.
 * LITE shows the animated SVG emblem in the stage; FULL leaves the stage
 * empty so the 3D star and planets (canvas layer) show through.
 * The H1 decodes in with a ~600 ms text scramble in FULL mode (not under
 * Reduce Motion). On phones and in LITE the H1 shows at once: hiding it
 * while it decodes would delay the Largest Contentful Paint.
 */
export function SpaceHero() {
  const ui = useUi();
  const h1 = ui('heroTitle');
  const primary = ui('heroPrimary');
  const secondary = ui('heroSecondary');
  const h = en.hero;
  const h1Ref = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    const el = h1Ref.current;
    if (!el || prefersReducedMotion() || tierStore.get().tier !== 'full') return;
    let cancel = () => {};
    let timer = 0;
    const run = () => {
      // Wait for the heading font so the overlay lines up exactly.
      const fonts = document.fonts?.ready ?? Promise.resolve();
      Promise.race([fonts, new Promise((r) => (timer = window.setTimeout(r, 400)))]).then(() => {
        if (h1Ref.current && !h1Ref.current.lang) cancel = scramble(h1Ref.current, 600);
      });
    };
    if (introRequested()) window.addEventListener(INTRO_DONE_EVENT, run, { once: true });
    else run();
    return () => {
      window.removeEventListener(INTRO_DONE_EVENT, run);
      window.clearTimeout(timer);
      cancel();
    };
  }, []);

  return (
    <Scene id="space" theme="dark" index="space">
      <div className="container hero">
        <div className="hero__copy scrim">
          <p className="eyebrow">{h.eyebrow}</p>
          <h1 ref={h1Ref} className="h1" lang={h1.lang} tabIndex={-1}>
            <Rich text={h1.text} />
          </h1>
          <p className="hero__sub">{h.sub}</p>
          <div className="hero__actions">
            <Button href="#quote" size="lg" iconEnd="arrowRight" lang={primary.lang}>
              {primary.text}
            </Button>
            <Button href="#planets" size="lg" variant="secondary" lang={secondary.lang}>
              {secondary.text}
            </Button>
          </div>
          <ul className="hero__trust">
            {h.trust.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
        </div>

        <div className="hero__stage" data-3d-passthrough aria-hidden="true">
          <div className="hero__emblem lite-visual--space">
            {brand.emblemAnimated ? (
              <img src={brand.emblemAnimated} alt="" width={560} height={560} />
            ) : (
              <EmblemPlaceholder />
            )}
          </div>
        </div>
      </div>
    </Scene>
  );
}
