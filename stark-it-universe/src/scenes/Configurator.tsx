import { AnimatePresence, m } from 'motion/react';
import { useEffect, useMemo, useState } from 'react';
import { en } from '../content/en';
import { Button } from '../components/Button';
import { Segmented, Stepper, YesNoSwitch } from '../components/FormControls';
import { Icon, type IconName } from '../components/Icons';
import { Scene, SceneTitle } from '../components/Scene';
import { useReducedMotion } from '../hooks/useReducedMotion';
import { classroom, DEFAULT_SETUP, type ClassroomSetup } from '../lib/classroomState';
import { goToQuote } from '../lib/quoteStore';

export type DisplayType = ClassroomSetup['display'];

interface Line {
  key: string;
  icon: IconName;
  text: string;
  count?: number;
}

function summarise(s: ClassroomSetup): Line[] {
  const b = en.build;
  const display = b.displayOptions.find((o) => o.value === s.display)!;
  const lines: Line[] = [
    { key: 'rooms', icon: 'school', text: b.rooms(s.rooms), count: s.rooms },
    { key: 'display', icon: s.display === 'projector' ? 'projector' : 'panel', text: `${b.display}: ${display.long}` },
  ];
  if (s.laptops > 0) lines.push({ key: 'laptops', icon: 'laptop', text: b.laptopsCount(s.laptops), count: s.laptops });
  if (s.desktops > 0) lines.push({ key: 'desktops', icon: 'desktop', text: b.desktopsCount(s.desktops), count: s.desktops });
  if (s.networking) lines.push({ key: 'net', icon: 'router', text: `${b.networking}: ${b.yes}` });
  if (s.amc) lines.push({ key: 'amc', icon: 'shield', text: `${b.amc}: ${b.yes}` });
  return lines;
}

function toMessage(s: ClassroomSetup): string {
  const b = en.build;
  const display = b.displayOptions.find((o) => o.value === s.display)!;
  return [
    b.messageIntro,
    `- ${b.rooms(s.rooms)}`,
    `- ${b.display}: ${display.long}`,
    `- ${b.laptopsCount(s.laptops)}`,
    `- ${b.desktopsCount(s.desktops)}`,
    `- ${b.networking}: ${s.networking ? b.yes : b.no}`,
    `- ${b.amc}: ${s.amc ? b.yes : b.no}`,
  ].join('\n');
}

/** Icon tiles for the LITE preview (the 3D room replaces this in FULL). */
function tiles(s: ClassroomSetup): Line[] {
  const t: Line[] = [{ key: 'rooms', icon: 'school', text: 'Classrooms', count: s.rooms }];
  if (s.display !== 'projector') t.push({ key: 'ifp', icon: 'panel', text: 'IFP', count: s.rooms });
  if (s.display !== 'ifp') t.push({ key: 'projector', icon: 'projector', text: 'Projector', count: s.rooms });
  if (s.laptops) t.push({ key: 'laptops', icon: 'laptop', text: 'Laptops', count: s.laptops });
  if (s.desktops) t.push({ key: 'desktops', icon: 'desktop', text: 'Desktops', count: s.desktops });
  if (s.networking) t.push({ key: 'net', icon: 'router', text: 'CAT-6' });
  if (s.amc) t.push({ key: 'amc', icon: 'shield', text: 'AMC' });
  return t;
}

/**
 * Scene 7: build your classroom. No total price, by design. "Send this
 * setup for a quote" fills the form's message field with the summary.
 * FULL: controls and summary on the left; the 3D classroom on the right
 *       updates live (devices spring in and out).
 * LITE: controls on the left; an icon summary and the summary list on the
 *       right.
 */
export function Configurator() {
  const b = en.build;
  const [setup, setSetup] = useState<ClassroomSetup>(DEFAULT_SETUP);
  const reduced = useReducedMotion();
  const set = <K extends keyof ClassroomSetup>(k: K, v: ClassroomSetup[K]) => setSetup((s) => ({ ...s, [k]: v }));
  const lines = useMemo(() => summarise(setup), [setup]);
  const tileList = useMemo(() => tiles(setup), [setup]);

  // The 3D classroom reads the setup from the shared state.
  useEffect(() => {
    classroom.setup = setup;
  }, [setup]);

  const spring = reduced
    ? { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 }, transition: { duration: 0.2 } }
    : {
        initial: { opacity: 0, scale: 0.6, y: 8 },
        animate: { opacity: 1, scale: 1, y: 0 },
        exit: { opacity: 0, scale: 0.6 },
        transition: { type: 'spring' as const, stiffness: 420, damping: 22 },
      };

  return (
    <Scene id="build" theme="light" index="build">
      <div className="container">
        <div className="build__head scrim">
          <SceneTitle id="build" eyebrow={b.eyebrow} title={b.title} intro={b.intro} />
        </div>

        <div className="build">
          <form className="build__controls card-light" onSubmit={(e) => e.preventDefault()} aria-labelledby="build-title">
            <Stepper
              label={b.classrooms}
              value={setup.rooms}
              min={1}
              max={50}
              onChange={(v) => set('rooms', v)}
              decreaseLabel={b.decrease(b.classrooms)}
              increaseLabel={b.increase(b.classrooms)}
            />
            <Segmented
              legend={b.display}
              name="display"
              value={setup.display}
              options={b.displayOptions.map((o) => ({ ...o, value: o.value as DisplayType }))}
              onChange={(v) => set('display', v)}
            />
            <div className="build__pair">
              <Stepper
                label={b.laptops}
                hint={b.devicesHint}
                value={setup.laptops}
                min={0}
                max={60}
                onChange={(v) => set('laptops', v)}
                decreaseLabel={b.decrease(b.laptops)}
                increaseLabel={b.increase(b.laptops)}
              />
              <Stepper
                label={b.desktops}
                hint={b.devicesHint}
                value={setup.desktops}
                min={0}
                max={60}
                onChange={(v) => set('desktops', v)}
                decreaseLabel={b.decrease(b.desktops)}
                increaseLabel={b.increase(b.desktops)}
              />
            </div>
            <YesNoSwitch label={b.networking} checked={setup.networking} onChange={(v) => set('networking', v)} yes={b.yes} no={b.no} />
            <YesNoSwitch label={b.amc} checked={setup.amc} onChange={(v) => set('amc', v)} yes={b.yes} no={b.no} />
          </form>

          <div className="build__side">
            <div className="build__stage" data-3d-passthrough aria-hidden="true">
              <p className="build__rooms">
                <span>×{setup.rooms}</span> {b.roomsChip(setup.rooms)}
              </p>
            </div>
            <div className="build__preview lite-visual--room" aria-hidden="true">
              <p className="build__preview-title">{b.previewTitle}</p>
              <ul className="build__tiles">
                <AnimatePresence initial={false}>
                  {tileList.map((t) => (
                    <m.li key={t.key} layout={false} className="build__tile" {...spring}>
                      <Icon name={t.icon} size={30} />
                      <span className="build__tile-name">{t.text}</span>
                      {t.count !== undefined && <span className="build__tile-count">×{t.count}</span>}
                      {t.count === undefined && <Icon name="check" size={18} className="build__tile-check" />}
                    </m.li>
                  ))}
                </AnimatePresence>
              </ul>
            </div>

            <div className="build__summary card-dark on-dark">
              <h3 className="build__summary-title">{b.summaryTitle}</h3>
              <ul className="build__lines" aria-live="polite">
                <AnimatePresence initial={false}>
                  {lines.map((l) => (
                    <m.li key={l.key} className="build__line" {...spring}>
                      <Icon name={l.icon} size={20} />
                      <span>{l.text}</span>
                    </m.li>
                  ))}
                </AnimatePresence>
              </ul>
              <p className="build__noprice">{b.noPrice}</p>
              <Button iconEnd="arrowRight" onClick={() => goToQuote({ message: toMessage(setup) })}>
                {b.send}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </Scene>
  );
}
