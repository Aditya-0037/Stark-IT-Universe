import { useEffect, useRef, useState } from 'react';
import { en } from '../content/en';
import { services } from '../content/services';
import { tierStore, useDeviceTier } from '../hooks/useDeviceTier';
import { INTRO_DONE_EVENT, introRequested, introStore } from '../lib/introState';
import { writeStore } from '../lib/storage';

const TOTAL_MS = 1750; // animation; the fade-out ends before 2 s
const FADE_MS = 300;

/**
 * Scene 0: the intro. Particles in a dark sky gather into the SIU star, the
 * five planets snap into tilted orbits, and a small % counter runs.
 *
 * - FULL tier only, once per session, never under Reduce Motion or on a
 *   deep link (decided before first paint by the inline script).
 * - Drawn on a lightweight 2D canvas, so it never waits for the 3D layer.
 *   The star forms exactly where the 3D star sits in the hero, then the
 *   overlay fades into the real scene.
 * - Under 2 seconds; a visible Skip button ends it at once. The real page is
 *   already rendered underneath and returns after 3 s even without JS.
 */
export function Intro() {
  const [show, setShow] = useState(false);
  const [pct, setPct] = useState(0);
  const [leaving, setLeaving] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const finishRef = useRef<() => void>(() => {});
  const { tier } = useDeviceTier();

  useEffect(() => {
    if (!introRequested()) return;
    writeStore('session', 'siu-intro-seen', '1');
    introStore.set({ playing: true, done: false });
    setShow(true);
  }, []);

  useEffect(() => {
    if (!show) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    let finished = false;
    let raf = 0;

    const finish = () => {
      if (finished) return;
      finished = true;
      cancelAnimationFrame(raf);
      setPct(100);
      setLeaving(true);
      delete document.documentElement.dataset.intro;
      introStore.set({ playing: false, done: true });
      window.dispatchEvent(new Event(INTRO_DONE_EVENT));
      window.setTimeout(() => setShow(false), FADE_MS + 50);
    };
    finishRef.current = finish;
    if (!canvas || !ctx) {
      finish();
      return;
    }

    const dpr = Math.min(window.devicePixelRatio || 1, 1.75);
    const W = window.innerWidth;
    const H = window.innerHeight;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    ctx.scale(dpr, dpr);

    // Where the 3D star sits in the hero (see three/CameraRig heroPose).
    const wide = W >= 900;
    const cx = W * (wide ? 0.71 : 0.5);
    const cy = H * (wide ? 0.505 : 0.42);
    const R = H * (wide ? 0.132 : 0.1);

    let seed = 5;
    const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    const N = Math.round(Math.min(1100, (W * H) / 1100));
    const parts = Array.from({ length: N }, () => {
      const a = rnd() * Math.PI * 2;
      const r = Math.sqrt(rnd()) * R * (rnd() > 0.85 ? 1.35 : 0.98);
      return {
        sx: rnd() * W,
        sy: rnd() * H,
        tx: cx + Math.cos(a) * r,
        ty: cy + Math.sin(a) * r,
        delay: rnd() * 0.3,
        size: 0.6 + rnd() * 1.5,
        warm: rnd(),
      };
    });
    const stars = Array.from({ length: 160 }, () => ({ x: rnd() * W, y: rnd() * H, r: 0.4 + rnd() * 0.9, o: 0.2 + rnd() * 0.5 }));
    const orbits = services.map((s, i) => ({
      color: s.color,
      rx: R * (1.9 + i * 0.55),
      ry: R * (1.9 + i * 0.55) * 0.3,
      tilt: [-0.22, 0.14, -0.3, 0.2, -0.08][i],
      angle: [0.6, 2.4, 4.1, 1.3, 3.3][i],
      size: R * [0.13, 0.15, 0.14, 0.16, 0.14][i],
    }));

    const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(2 - 2 * t, 3) / 2);
    const clamp01 = (t: number) => Math.min(1, Math.max(0, t));
    const backOut = (t: number) => {
      const c = 1.8;
      return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2);
    };

    const t0 = performance.now();
    let lastPct = -1;
    const frame = (now: number) => {
      const t = Math.min(1, (now - t0) / TOTAL_MS);
      const p = Math.round(t * 100);
      if (p !== lastPct) {
        lastPct = p;
        setPct(p);
      }

      ctx.clearRect(0, 0, W, H);
      for (const s of stars) {
        ctx.globalAlpha = s.o;
        ctx.fillStyle = '#fff';
        ctx.fillRect(s.x, s.y, s.r, s.r);
      }

      // 1. particles gather (0 -> 0.62)
      const gather = clamp01(t / 0.62);
      const sunIn = clamp01((t - 0.48) / 0.2);
      for (const q of parts) {
        const k = ease(clamp01((gather - q.delay) / 0.7));
        const x = q.sx + (q.tx - q.sx) * k;
        const y = q.sy + (q.ty - q.sy) * k;
        ctx.globalAlpha = (0.35 + 0.65 * k) * (1 - sunIn * 0.9);
        ctx.fillStyle = k > 0.6 ? (q.warm > 0.4 ? '#FFC94F' : '#FFF1C9') : '#BFD0FF';
        ctx.beginPath();
        ctx.arc(x, y, q.size * (1.4 - 0.5 * k), 0, Math.PI * 2);
        ctx.fill();
      }

      // 2. the star forms (0.48 -> 0.68)
      if (sunIn > 0) {
        const s = backOut(sunIn);
        ctx.globalAlpha = sunIn;
        const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, R * 3.2);
        glow.addColorStop(0, 'rgba(255,181,46,0.45)');
        glow.addColorStop(1, 'rgba(255,181,46,0)');
        ctx.fillStyle = glow;
        ctx.fillRect(cx - R * 3.2, cy - R * 3.2, R * 6.4, R * 6.4);
        const sun = ctx.createRadialGradient(cx - R * 0.3, cy - R * 0.35, R * 0.1, cx, cy, R * s);
        sun.addColorStop(0, '#FFF1C9');
        sun.addColorStop(0.5, '#FFB52E');
        sun.addColorStop(1, '#F08A00');
        ctx.fillStyle = sun;
        ctx.beginPath();
        ctx.arc(cx, cy, R * s, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#0B1640';
        ctx.font = `800 ${Math.round(R * 0.62 * s)}px Unbounded, "Arial Black", sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('SIU', cx, cy + R * 0.04);
      }

      // 3. planets snap into tilted orbits (0.62 -> 0.9)
      orbits.forEach((o, i) => {
        const k = clamp01((t - 0.62 - i * 0.045) / 0.16);
        if (k <= 0) return;
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(o.tilt);
        ctx.globalAlpha = 0.55 * k;
        ctx.strokeStyle = '#6F86FF';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.ellipse(0, 0, o.rx, o.ry, 0, 0, Math.PI * 2);
        ctx.stroke();
        const a = o.angle + t * 0.8;
        ctx.globalAlpha = k;
        ctx.fillStyle = o.color;
        ctx.beginPath();
        ctx.arc(Math.cos(a) * o.rx, Math.sin(a) * o.ry, o.size * backOut(k), 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      });
      ctx.globalAlpha = 1;

      if (t < 1) raf = requestAnimationFrame(frame);
      else finish();
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [show]);

  // Dropping to LITE mid-intro ends it. (Reads the live tier: during
  // hydration `tier` briefly holds the server value.)
  useEffect(() => {
    if (tierStore.get().tier !== 'full') finishRef.current();
  }, [tier]);

  if (!show) return null;
  return (
    <section id="intro" className="intro" data-leaving={leaving || undefined} aria-label={en.intro.loading}>
      <canvas ref={canvasRef} className="intro__canvas" aria-hidden="true" />
      <p className="intro__counter" aria-hidden="true">
        <span>{en.intro.loading}</span>
        <strong>{String(pct).padStart(2, '0')}%</strong>
      </p>
      <button type="button" className="btn btn--secondary intro__skip" onClick={() => finishRef.current()}>
        {en.intro.skip}
      </button>
    </section>
  );
}
