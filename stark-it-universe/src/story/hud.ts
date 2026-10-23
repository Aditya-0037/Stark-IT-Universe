import gsap from 'gsap';
import { prewarmDone } from '../three/stage';
import { STEPS } from './steps';

interface HudState {
  step: number;
  target: number;
  position: number;
  control: boolean;
  inputs: number;
  accepted: number;
}

/**
 * Debug HUD (`?debug=1`): current and target step, timeline position, FPS,
 * the longest frame in the last 5 s, frames over 50 ms since the page
 * finished loading (counting starts once everything is built and warmed,
 * when the story takes its first move),
 * and input gestures received versus moves accepted.
 */
export function startHud(read: () => HudState) {
  const el = document.createElement('div');
  el.setAttribute('aria-hidden', 'true');
  el.style.cssText =
    'position:fixed;left:12px;bottom:12px;z-index:100000;font:12px/1.45 ui-monospace,Consolas,monospace;color:#e8ecff;background:rgba(6,10,34,.88);border:1px solid rgba(147,172,255,.35);border-radius:10px;padding:10px 12px;pointer-events:none;white-space:pre;min-width:260px';
  document.body.appendChild(el);
  const frames: [number, number][] = []; // [time, ms]
  let over50 = 0;
  let worst = 0;
  const long: { at: number; ms: number; y: number }[] = []; // the last 20 frames over 50 ms
  let countFrom = 0;
  let last = performance.now();
  const onTick = () => {
    const now = performance.now();
    const dt = now - last;
    last = now;
    frames.push([now, dt]);
    while (frames.length && now - frames[0][0] > 5000) frames.shift();
    if (!countFrom && prewarmDone()) countFrom = now + 100;
    if (countFrom && now > countFrom && document.visibilityState === 'visible') {
      if (dt > 50) {
        over50 += 1;
        long.push({ at: Math.round(now), ms: Math.round(dt), y: Math.round(window.scrollY) });
        if (long.length > 20) long.shift();
      }
      worst = Math.max(worst, dt);
    }
  };
  gsap.ticker.add(onTick);
  const paint = () => {
    const s = read();
    const now = performance.now();
    const lastSecond = frames.filter((f) => now - f[0] <= 1000);
    const fps = lastSecond.length;
    const longest = frames.reduce((m, f) => Math.max(m, f[1]), 0);
    const cur = STEPS[s.step];
    const tgt = STEPS[s.target];
    el.textContent =
      `step     ${s.step} ${cur?.id ?? ''}\n` +
      `target   ${s.target} ${tgt?.id ?? ''}\n` +
      `progress ${s.position.toFixed(2)} / ${STEPS.length - 1}${s.control ? '' : '  (free scroll)'}\n` +
      `fps      ${fps}\n` +
      `longest  ${longest.toFixed(0)} ms (last 5 s)\n` +
      `>50 ms   ${over50}${countFrom ? '' : ' (counting after load)'}  worst ${worst.toFixed(0)} ms\n` +
      `input    ${s.inputs} gestures, ${s.accepted} moves accepted`;
  };
  const timer = window.setInterval(paint, 200);
  paint();
  (window as unknown as { __hud: unknown }).__hud = {
    get over50() {
      return over50;
    },
    get worst() {
      return worst;
    },
    long,
    reset() {
      over50 = 0;
      worst = 0;
      long.length = 0;
    },
  };
  return () => {
    gsap.ticker.remove(onTick);
    window.clearInterval(timer);
    el.remove();
  };
}
