import { useCallback, useEffect, useRef, useState, type MouseEvent } from 'react';
import { en } from '../content/en';
import { services, type ServiceId } from '../content/services';
import { Scene, SceneTitle } from '../components/Scene';
import { ServiceCard } from '../components/ServiceCard';
import { useFullLayout } from '../hooks/useFullLayout';
import { prefersReducedMotion } from '../hooks/useReducedMotion';
import { stickyScrollY, useStickyProgress } from '../hooks/useStickyProgress';
import { activeIndex, PLANET_COUNT, progressFor } from '../lib/journey';
import { registerAnchorResolver, scrollToId } from '../lib/scroll';

/**
 * Scene 2: five planets, five services.
 *
 * FULL: the scene is pinned; scrolling flies the 3D camera from planet to
 * planet and shows one service card at a time (the others are inert).
 * Tabs 01-05 (the HTML twins of the planets) jump to any service.
 *
 * LITE: a swipeable deck on phones, a grid on larger screens; the tabs
 * scroll to a card.
 */
export function Planets() {
  const p = en.planets;
  const full = useFullLayout();
  const sectionRef = useRef<HTMLElement>(null);
  const deckRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState<ServiceId>('smartclass');
  // While a tab jump scrolls past other planets, keep its card showing.
  const lock = useRef<{ id: ServiceId; until: number } | null>(null);

  const onProgress = useCallback((prog: number) => {
    const id = services[activeIndex(prog, PLANET_COUNT)].id;
    const l = lock.current;
    if (l && performance.now() < l.until && id !== l.id) return;
    lock.current = null;
    setActive(id);
  }, []);
  useStickyProgress(sectionRef, 'planets', full, onProgress);

  // FULL: links to #service-<id> scroll to that planet's place in the scene.
  useEffect(() => {
    if (!full) return;
    return registerAnchorResolver((id) => {
      const m = /^service-(\w+)$/.exec(id);
      const i = m ? services.findIndex((s) => s.id === m[1]) : -1;
      const section = sectionRef.current;
      if (i < 0 || !section) return null;
      const sid = services[i].id;
      lock.current = { id: sid, until: performance.now() + 2200 };
      setActive(sid);
      const card = document.getElementById(`service-${sid}`);
      // Focus once React has made the card interactive (it is inert until active).
      requestAnimationFrame(() =>
        requestAnimationFrame(() => card?.querySelector<HTMLElement>('.svc-card__flip')?.focus({ preventScroll: true })),
      );
      return { y: stickyScrollY(section, progressFor(i, PLANET_COUNT)), focus: null };
    });
  }, [full]);

  // LITE: track which card is in view (swipe deck or grid).
  useEffect(() => {
    const deck = deckRef.current;
    if (full || !deck || !('IntersectionObserver' in window)) return;
    const io = new IntersectionObserver(
      (entries) => {
        const best = entries.filter((e) => e.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (best) setActive((best.target as HTMLElement).dataset.service as ServiceId);
      },
      { threshold: [0.6, 0.9] },
    );
    deck.querySelectorAll<HTMLElement>('[data-service]').forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [full]);

  const jump = (e: MouseEvent<HTMLAnchorElement>, id: ServiceId) => {
    e.preventDefault();
    if (full) {
      scrollToId(`service-${id}`, false);
      return;
    }
    const card = document.getElementById(`service-${id}`);
    if (!card) return;
    card.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'nearest', inline: 'center' });
    card.querySelector<HTMLElement>('.svc-card__flip')?.focus({ preventScroll: true });
    setActive(id);
  };

  return (
    <Scene id="planets" theme="dark" index="planets" ref={sectionRef}>
      <div className="scene__pin">
        <div className="container planets">
          <div className="planets__head scrim">
            <SceneTitle id="planets" eyebrow={p.eyebrow} title={p.title} intro={p.intro} />
            <nav aria-label={p.tabsLabel} className="svc-tabs">
              <ol>
                {services.map((s) => (
                  <li key={s.id}>
                    <a
                      href={`#service-${s.id}`}
                      onClick={(e) => jump(e, s.id)}
                      aria-current={active === s.id ? 'true' : undefined}
                      className="svc-tab"
                      style={{ ['--planet' as string]: `var(${s.colorVar})` }}
                    >
                      <span className="svc-tab__num">{s.number}</span>
                      <span className="svc-tab__name">{s.shortName}</span>
                    </a>
                  </li>
                ))}
              </ol>
            </nav>
          </div>

          <div ref={deckRef} className="svc-deck">
            {services.map((s) => {
              const isActive = active === s.id;
              return (
                <div
                  key={s.id}
                  className="svc-deck__slot"
                  data-service={s.id}
                  data-active={isActive || undefined}
                  inert={full && !isActive ? '' : undefined}
                >
                  <ServiceCard service={s} />
                </div>
              );
            })}
          </div>
          <p className="svc-deck__hint" aria-hidden="true">
            {p.swipeHint} →
          </p>
          <div className="planets__stage" data-3d-passthrough aria-hidden="true" />
        </div>
      </div>
    </Scene>
  );
}
