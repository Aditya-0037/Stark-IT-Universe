import { LazyMotion, MotionConfig, domAnimation } from 'motion/react';
import { useEffect, useState, type ComponentType } from 'react';
import { en } from './content/en';
import { Cursor } from './components/Cursor';
import { Footer } from './components/Footer';
import { Header } from './components/Header';
import { MobileBar } from './components/MobileBar';
import { SectionIndex } from './components/SectionIndex';
import { reportWebGLFailure, useDeviceTier, watchTier } from './hooks/useDeviceTier';
import { startScrollSpy } from './hooks/useScrollSpy';
import { LangProvider } from './lib/i18n';
import { introStore } from './lib/introState';
import { scrollToId } from './lib/scroll';
import { Classroom } from './scenes/Classroom';
import { Configurator } from './scenes/Configurator';
import { Descent } from './scenes/Descent';
import { Intro } from './scenes/Intro';
import { Planets } from './scenes/Planets';
import { Proof } from './scenes/Proof';
import { Quote } from './scenes/Quote';
import { Route } from './scenes/Route';
import { SpaceHero } from './scenes/SpaceHero';
import { SwitchOn } from './scenes/SwitchOn';

/**
 * Loads the 3D layer (FULL tier only) with a dynamic import once the page
 * has painted. The code downloads during the intro, but the scene is only
 * built once the intro has finished, so the intro never stutters. If the
 * chunk or WebGL fails, the page drops to LITE.
 */
function useWorld(): ComponentType | null {
  const { tier } = useDeviceTier();
  const introPlaying = introStore.useStore((s) => s.playing);
  const [World, setWorld] = useState<ComponentType | null>(null);
  useEffect(() => {
    if (tier !== 'full') return;
    let cancelled = false;
    let raf = requestAnimationFrame(() => {
      raf = requestAnimationFrame(() => {
        import('./three/World')
          .then((m) => !cancelled && setWorld(() => m.World))
          .catch(() => !cancelled && reportWebGLFailure());
      });
    });
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
    };
  }, [tier]);
  return tier === 'full' && !introPlaying ? World : null;
}

/** In-page links scroll (smoothly unless Reduce Motion) and move focus. */
function useInPageLinks() {
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element | null)?.closest?.('a[href^="#"]');
      if (!a) return;
      const id = a.getAttribute('href')!.slice(1);
      if (!id || !document.getElementById(id)) return;
      e.preventDefault();
      scrollToId(id);
    };
    document.addEventListener('click', onClick);
    return () => document.removeEventListener('click', onClick);
  }, []);
}

export function App() {
  useEffect(() => {
    const stopTier = watchTier();
    const stopSpy = startScrollSpy();
    document.documentElement.dataset.hydrated = 'true';
    return () => {
      stopTier();
      stopSpy();
    };
  }, []);
  useInPageLinks();
  const World = useWorld();

  return (
    <LangProvider>
      <MotionConfig reducedMotion="user">
        <LazyMotion features={domAnimation} strict>
          <Intro />
          <a href="#main" className="skip-link">
            {en.a11y.skip}
          </a>
          {World && <World />}
          <Header />
          <SectionIndex />
          <main id="main" tabIndex={-1}>
            {/* Everything the 3D layer draws behind; rendering pauses outside it. */}
            <div className="world-zone" data-world-zone>
              <div className="space-zone">
                <SpaceHero />
                <Planets />
                <Route />
              </div>
              <Descent />
              <Classroom />
              <SwitchOn />
              <Configurator />
            </div>
            <Proof />
            <Quote />
          </main>
          <Footer />
          <MobileBar />
          <Cursor />
        </LazyMotion>
      </MotionConfig>
    </LangProvider>
  );
}
