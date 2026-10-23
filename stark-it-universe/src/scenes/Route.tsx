import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { en } from '../content/en';
import { Satellite2D } from '../components/illustrations/Satellite2D';
import { Rich } from '../components/Placeholder';
import { Scene, SceneTitle } from '../components/Scene';
import { useFullLayout } from '../hooks/useFullLayout';
import { STATION_COUNT } from '../lib/journey';
import { registerAnchorResolver, scrollToId } from '../lib/scroll';
import { measured } from '../lib/timeline';
import { stepIndex } from '../story/steps';
import { itemFor, story } from '../story/store';

const useIsoLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;

/**
 * Scene 3: how we work, the orbit route.
 *
 * FULL: pinned. Each scroll gesture moves the gold 3D satellite along the
 * orbit route to the next station; the station buttons (HTML twins of the
 * 3D stations) jump to a station.
 *
 * LITE: a numbered vertical list on an orbit line. The 2D satellite moves
 * to the active station when a station is chosen or scrolled to.
 */
export function Route() {
  const r = en.route;
  const full = useFullLayout();
  const sectionRef = useRef<HTMLElement>(null);
  const listRef = useRef<HTMLOListElement>(null);
  const [liteActive, setActive] = useState(0);
  const [satTop, setSatTop] = useState<number | null>(null);
  const lastClick = useRef(0);
  // FULL: the station the story rests on (changes when a move lands).
  const step = story.useStore((s) => s.step);
  const active = full ? itemFor('route', step) : liteActive;

  // FULL: #station-<n> travels to that station's step.
  useEffect(() => {
    if (!full) return;
    return registerAnchorResolver((id) => {
      const m = /^station-(\d)$/.exec(id);
      if (!m) return null;
      const i = Number(m[1]) - 1;
      if (i < 0 || i >= STATION_COUNT) return null;
      return {
        y: measured().stepY[stepIndex(`station-${i + 1}`)],
        focus: document.querySelector<HTMLElement>(`#station-${i + 1} .station__btn`),
      };
    });
  }, [full]);

  // Position the 2D satellite next to the active station's node.
  useIsoLayoutEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const track = list.parentElement!;
    const place = () => {
      const node = list.querySelectorAll<HTMLElement>('.station__node')[active];
      if (!node) return;
      const nr = node.getBoundingClientRect();
      setSatTop(nr.top + nr.height / 2 - track.getBoundingClientRect().top);
    };
    place();
    const ro = new ResizeObserver(place);
    ro.observe(list);
    return () => ro.disconnect();
  }, [active, full]);

  // LITE: scrolling a station into the middle of the screen makes it active.
  useEffect(() => {
    const list = listRef.current;
    if (full || !list || !('IntersectionObserver' in window)) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (Date.now() - lastClick.current < 1200) return;
        for (const e of entries) {
          if (e.isIntersecting) setActive(Number((e.target as HTMLElement).dataset.step));
        }
      },
      { rootMargin: '-45% 0px -45% 0px' },
    );
    list.querySelectorAll<HTMLElement>('[data-step]').forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [full]);

  const choose = (i: number) => {
    lastClick.current = Date.now();
    if (full) scrollToId(`station-${i + 1}`, false);
    setActive(i);
  };

  return (
    <Scene id="route" theme="dark" index="route" ref={sectionRef}>
      <div className="scene__pin">
        <div className="container route">
          <div className="route__intro scrim">
            <SceneTitle id="route" eyebrow={r.eyebrow} title={r.title} intro={r.intro} />
          </div>

          <div className="route__track scrim">
            <span className="route__line lite-visual--space" aria-hidden="true" />
            <ol ref={listRef} className="route__list" aria-label={r.stationsLabel}>
              {r.stations.map((st, i) => (
                <li
                  key={st.code}
                  id={`station-${i + 1}`}
                  data-step={i}
                  className="station"
                  data-active={i === active || undefined}
                  aria-current={i === active ? 'step' : undefined}
                >
                  <span className="station__node" aria-hidden="true" />
                  <h3 className="station__title">
                    <button type="button" className="station__btn" onClick={() => choose(i)}>
                      <span className="station__code">{st.code}</span>
                      <span className="station__name">{st.name}</span>
                    </button>
                  </h3>
                  <p className="station__text">
                    <Rich text={st.text} />
                  </p>
                </li>
              ))}
            </ol>
            <div
              className="route__satellite lite-visual--space"
              aria-hidden="true"
              style={{ transform: `translate3d(0, ${satTop ?? 0}px, 0)`, opacity: satTop === null ? 0 : 1 }}
            >
              <Satellite2D width={64} />
            </div>
          </div>
          <div className="route__stage" data-3d-passthrough aria-hidden="true" />
        </div>
      </div>
    </Scene>
  );
}
