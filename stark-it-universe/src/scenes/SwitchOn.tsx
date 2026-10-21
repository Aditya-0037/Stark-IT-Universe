import { useEffect, useRef, useState } from 'react';
import { en } from '../content/en';
import { serviceById } from '../content/services';
import { ArcSlider } from '../components/ArcSlider';
import { Button } from '../components/Button';
import { Icon } from '../components/Icons';
import { ClassroomIllustration, type Power } from '../components/illustrations/ClassroomIllustration';
import { LazyVisual } from '../components/LazyVisual';
import { Scene, SceneTitle } from '../components/Scene';
import { prefersReducedMotion } from '../hooks/useReducedMotion';
import { classroom } from '../lib/classroomState';

const toStage = (v: number): Power => (v >= 100 ? 4 : (Math.floor(v / 25) as Power));

/**
 * Scene 6: switch on the classroom (the signature moment).
 * The room starts dark. The arc slider (or the Switch on button) powers up
 * the smart board, then the projector, the lights, and finally the lesson
 * slide. FULL drives the 3D classroom (lights, screens, projector beam);
 * LITE crossfades between lit states of the 2D classroom.
 * After the first full power-up a Day / Night toggle stays available.
 */
export function SwitchOn() {
  const s = en.switchOn;
  const [value, setValue] = useState(0);
  const [night, setNight] = useState(true);
  const [everOn, setEverOn] = useState(false);
  const [announce, setAnnounce] = useState('');
  const raf = useRef(0);
  const timer = useRef(0);
  const stage = toStage(value);

  useEffect(() => {
    if (stage === 4) setEverOn(true);
  }, [stage]);

  // The 3D classroom follows the slider (smoothly) and the Day / Night toggle.
  useEffect(() => {
    classroom.power = value / 25;
  }, [value]);
  useEffect(() => {
    classroom.night = night;
  }, [night]);

  useEffect(() => () => stop(), []);

  function stop() {
    cancelAnimationFrame(raf.current);
    window.clearInterval(timer.current);
  }

  function play() {
    stop();
    const target = stage === 4 ? 0 : 100;
    const from = value;
    if (prefersReducedMotion()) {
      // Step through the stages with crossfades only.
      let v = Math.round(from / 25) * 25;
      timer.current = window.setInterval(() => {
        v += target > v ? 25 : -25;
        setValue(v);
        setAnnounce(s.stages[toStage(v)]);
        if (v === target) window.clearInterval(timer.current);
      }, 550);
      return;
    }
    const duration = Math.abs(target - from) * 28;
    const start = performance.now();
    let lastStage = toStage(from);
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
      const v = from + (target - from) * eased;
      setValue(v);
      const st = toStage(v);
      if (st !== lastStage) {
        lastStage = st;
        setAnnounce(s.stages[st]);
      }
      if (t < 1) raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
  }

  return (
    <Scene id="switch-on" theme="dark" index="classroom">
      <div className="container switch">
        <div className="switch__head scrim">
          <SceneTitle id="switch-on" eyebrow={s.eyebrow} title={s.title} intro={s.intro} />
        </div>

        <div className="switch__stage" data-stage={stage}>
          <LazyVisual className="lite-visual--room switch__art" ratio="700 / 630" label={s.imageAlt}>
            <ClassroomIllustration
              accent={serviceById('smartclass').color}
              power={stage}
              night={night}
              slideTitle={s.slideTitle}
              slideSub={s.slideSub}
            />
          </LazyVisual>
          <p className="switch__status" aria-hidden="true">
            <span className="switch__led" data-on={stage > 0 || undefined} />
            {s.stages[stage]}
          </p>
        </div>

        <div className="switch__controls scrim">
          <ArcSlider
            value={value}
            onChange={setValue}
            onDragStart={stop}
            label={s.slider}
            valueText={s.stages[stage]}
            ticks={s.ticks}
            hint={s.keyHint}
          />

          <div className="switch__actions">
            <Button variant="primary" icon="power" onClick={play}>
              {stage === 4 ? s.off : s.play}
            </Button>
            {everOn && (
              <div role="group" aria-label={s.dayNight} className="seg-toggle seg-toggle--lg">
                <button type="button" aria-pressed={!night} onClick={() => setNight(false)}>
                  <Icon name="sun" size={18} />
                  {s.day}
                </button>
                <button type="button" aria-pressed={night} onClick={() => setNight(true)}>
                  <Icon name="moon" size={18} />
                  {s.night}
                </button>
              </div>
            )}
          </div>
          <p className="sr-only" aria-live="polite">
            {announce}
          </p>
        </div>
      </div>
    </Scene>
  );
}
