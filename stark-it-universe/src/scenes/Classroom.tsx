import { useCallback, useEffect, useRef, useState } from 'react';
import { en } from '../content/en';
import { services, serviceById, type ServiceId } from '../content/services';
import { Button } from '../components/Button';
import { ClassroomIllustration, CLASSROOM_HOTSPOTS, toPercent } from '../components/illustrations/ClassroomIllustration';
import { LazyVisual } from '../components/LazyVisual';
import { Scene, SceneTitle } from '../components/Scene';
import { useFullLayout } from '../hooks/useFullLayout';
import { stickyScrollY, useStickyProgress } from '../hooks/useStickyProgress';
import { classroom } from '../lib/classroomState';
import { activeIndex, HOTSPOT_COUNT, progressFor } from '../lib/journey';
import { goToQuote } from '../lib/quoteStore';
import { registerAnchorResolver, scrollToId } from '../lib/scroll';

/**
 * Scene 5: the classroom diorama.
 *
 * FULL: the scene is pinned over the 3D classroom. Scrolling (or a numbered
 * hotspot button, the HTML twin of each 3D hotspot) moves the camera to
 * each device in turn and the panel shows that device.
 *
 * LITE: a still illustrated classroom with five numbered buttons placed on
 * the devices; choosing one opens its panel.
 *
 * Both: colour dots switch the scene's accent between the planet colours.
 */
export function Classroom() {
  const c = en.classroom;
  const full = useFullLayout();
  const sectionRef = useRef<HTMLElement>(null);
  const [selected, setSelected] = useState(0);
  const [accent, setAccent] = useState<ServiceId>('smartclass');
  const lock = useRef<{ i: number; until: number } | null>(null);
  const spot = c.hotspots[selected];

  // The 3D classroom reads the accent colour from the shared state.
  useEffect(() => {
    classroom.accent = serviceById(accent).color;
  }, [accent]);

  const onProgress = useCallback((p: number) => {
    const i = activeIndex(p, HOTSPOT_COUNT);
    const l = lock.current;
    if (l && performance.now() < l.until && i !== l.i) return;
    lock.current = null;
    setSelected(i);
  }, []);
  useStickyProgress(sectionRef, 'classroom', full, onProgress);

  // FULL: #hotspot-<n> scrolls to that device's place in the pinned scene.
  useEffect(() => {
    if (!full) return;
    return registerAnchorResolver((id) => {
      const m = /^hotspot-(\d)$/.exec(id);
      const section = sectionRef.current;
      if (!m || !section) return null;
      const i = Number(m[1]) - 1;
      if (i < 0 || i >= HOTSPOT_COUNT) return null;
      lock.current = { i, until: performance.now() + 2200 };
      setSelected(i);
      return {
        y: stickyScrollY(section, progressFor(i, HOTSPOT_COUNT)),
        focus: document.querySelector<HTMLElement>(`#hotspot-${i + 1} .hotspot`),
      };
    });
  }, [full]);

  const choose = (i: number) => {
    if (full) scrollToId(`hotspot-${i + 1}`, false);
    setSelected(i);
  };

  return (
    <Scene id="classroom" theme="light" index="classroom" ref={sectionRef}>
      <div className="scene__pin">
        <div className="container classroom-wrap">
          <div className="classroom__head scrim">
            <SceneTitle id="classroom" eyebrow={c.eyebrow} title={c.title} intro={c.intro} />
          </div>

          <div className="classroom">
            <div className="classroom__stage" data-3d-passthrough>
              <LazyVisual className="lite-visual--room classroom__art" ratio="700 / 630" label={c.imageAlt}>
                <ClassroomIllustration
                  accent={serviceById(accent).color}
                  power={3}
                  slideTitle={en.switchOn.slideTitle}
                  slideSub={en.switchOn.slideSub}
                />
              </LazyVisual>
              <ol className="hotspots" aria-label={c.hotspotsLabel}>
                {c.hotspots.map((h, i) => (
                  <li
                    key={h.id}
                    id={`hotspot-${i + 1}`}
                    className="hotspots__item"
                    style={toPercent(CLASSROOM_HOTSPOTS[h.id])}
                  >
                    <button
                      type="button"
                      className="hotspot"
                      aria-expanded={selected === i}
                      aria-controls="classroom-panel"
                      onClick={() => choose(i)}
                    >
                      <span aria-hidden="true">{i + 1}</span>
                      <span className="sr-only">{h.title}</span>
                    </button>
                  </li>
                ))}
              </ol>
            </div>

            <div className="classroom__side">
              <div
                id="classroom-panel"
                className="hotspot-panel"
                role="region"
                aria-live="polite"
                aria-labelledby="classroom-panel-title"
              >
                <p className="hotspot-panel__count">
                  <span>{String(selected + 1).padStart(2, '0')}</span> / 05
                </p>
                <h3 id="classroom-panel-title" className="hotspot-panel__title">
                  {spot.title}
                </h3>
                {spot.lines.map((line) => (
                  <p key={line} className="hotspot-panel__line">
                    {line}
                  </p>
                ))}
                <Button iconEnd="arrowRight" onClick={() => goToQuote({ service: serviceById(spot.service).name })}>
                  {c.quote}
                </Button>
              </div>

              <fieldset className="accent-picker">
                <legend>{c.accentLabel}</legend>
                <div className="accent-picker__dots">
                  {services.map((s) => (
                    <label key={s.id} className="accent-dot" style={{ ['--dot' as string]: s.color }}>
                      <input
                        type="radio"
                        name="classroom-accent"
                        value={s.id}
                        checked={accent === s.id}
                        onChange={() => setAccent(s.id)}
                      />
                      <span className="accent-dot__swatch" aria-hidden="true" />
                      <span className="sr-only">{c.accentNames[s.id]}</span>
                    </label>
                  ))}
                </div>
              </fieldset>
            </div>
          </div>
        </div>
      </div>
    </Scene>
  );
}
