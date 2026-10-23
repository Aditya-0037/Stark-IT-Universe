import { useEffect, useId, useRef } from 'react';
import { services } from '../../content/services';
import { IconShapes, serviceIcon } from '../Icons';
import { SERVICE_ICON_SHAPES, type ServiceIconName } from '../iconShapes';

/**
 * Drawn stand-in for /public/brand/siu-emblem-animated.svg: a gold SIU star
 * with five planets on tilted elliptical orbits. Planets pass behind the
 * star on the far half of each orbit and in front on the near half; inner
 * planets move faster. Each planet carries its service icon and name, and
 * both stay upright while it orbits. Animation is CSS only (see .emblem in
 * global.css) and stops under Reduce Motion. The browser redraws animated
 * SVG parts on the main thread every frame, so the orbits pause while the
 * emblem is off screen.
 */
const ORBITS = [
  { r: 118, k: 0.34, tilt: -14, period: 14, phase: 0.1, size: 19 },
  { r: 156, k: 0.36, tilt: 9, period: 19, phase: 0.6, size: 21 },
  { r: 194, k: 0.32, tilt: -22, period: 24, phase: 0.32, size: 20 },
  { r: 232, k: 0.35, tilt: 16, period: 30, phase: 0.82, size: 22 },
  { r: 270, k: 0.31, tilt: -6, period: 37, phase: 0.46, size: 20, ring: true },
];

export function EmblemPlaceholder({ className = '' }: { className?: string }) {
  const uid = useId().replace(/:/g, '');
  const id = (s: string) => `${uid}-${s}`;
  const svg = useRef<SVGSVGElement>(null);
  useEffect(() => {
    const el = svg.current;
    if (!el || !('IntersectionObserver' in window)) return;
    const io = new IntersectionObserver(([e]) => el.toggleAttribute('data-offscreen', !e.isIntersecting));
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const half = (side: 'back' | 'front') =>
    ORBITS.map((o, i) => {
      const s = services[i];
      const style = {
        animationDuration: `${o.period}s`,
        animationDelay: `${-o.phase * o.period}s`,
        ['--ik' as string]: String(1 / o.k),
        ['--nt' as string]: `${-o.tilt}deg`,
      };
      return (
        <g key={`${side}-${s.id}`} transform={`rotate(${o.tilt}) scale(1 ${o.k})`}>
          <g clipPath={`url(#${id(side)})`}>
            <circle
              r={o.r}
              fill="none"
              stroke="#6F86FF"
              strokeWidth={side === 'back' ? 1 : 1.4}
              strokeOpacity={side === 'back' ? 0.35 : 0.6}
              strokeDasharray={i % 2 ? '2 6' : undefined}
              vectorEffect="non-scaling-stroke"
            />
            <g className="emblem__spin" style={style}>
              <g transform={`translate(${o.r} 0)`}>
                <g className="emblem__counter" style={style}>
                  {o.ring && (
                    <path
                      d={`M ${-o.size * 2} 0 A ${o.size * 2} ${o.size * 0.6} 0 0 1 ${o.size * 2} 0`}
                      fill="none"
                      stroke="#9FF2D2"
                      strokeWidth="2.5"
                      transform="rotate(-18)"
                      opacity="0.85"
                    />
                  )}
                  <circle r={o.size} fill={`url(#${id(`p${i}`)})`} />
                  <PlanetIcon name={serviceIcon[s.id] as ServiceIconName} size={o.size * 1.15} />
                  {o.ring && (
                    <path
                      d={`M ${-o.size * 2} 0 A ${o.size * 2} ${o.size * 0.6} 0 0 0 ${o.size * 2} 0`}
                      fill="none"
                      stroke="#9FF2D2"
                      strokeWidth="2.5"
                      transform="rotate(-18)"
                    />
                  )}
                  <text className="emblem__label" y={o.size + 22} textAnchor="middle">
                    {s.shortName}
                  </text>
                </g>
              </g>
            </g>
          </g>
        </g>
      );
    });

  return (
    <svg
      ref={svg}
      viewBox="-300 -300 600 600"
      className={`emblem ${className}`}
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <radialGradient id={id('glow')}>
          <stop offset="0" stopColor="#FFB52E" stopOpacity="0.55" />
          <stop offset="0.35" stopColor="#FFB52E" stopOpacity="0.16" />
          <stop offset="1" stopColor="#FFB52E" stopOpacity="0" />
        </radialGradient>
        <radialGradient id={id('sun')} cx="38%" cy="34%" r="75%">
          <stop offset="0" stopColor="#FFF1C9" />
          <stop offset="0.35" stopColor="#FFC94F" />
          <stop offset="0.75" stopColor="#FFB52E" />
          <stop offset="1" stopColor="#F08A00" />
        </radialGradient>
        <linearGradient id={id('rays')} x1="0" y1="-1" x2="0" y2="1">
          <stop offset="0" stopColor="#FFD57A" />
          <stop offset="1" stopColor="#F59E0B" />
        </linearGradient>
        {services.map((s, i) => (
          <radialGradient key={s.id} id={id(`p${i}`)} cx="35%" cy="32%" r="80%">
            <stop offset="0" stopColor="#ffffff" stopOpacity="0.9" />
            <stop offset="0.18" stopColor={s.color} />
            <stop offset="1" stopColor="#0B1640" stopOpacity="0.9" />
          </radialGradient>
        ))}
        <clipPath id={id('back')} clipPathUnits="userSpaceOnUse">
          <rect x="-400" y="-900" width="800" height="900" />
        </clipPath>
        <clipPath id={id('front')} clipPathUnits="userSpaceOnUse">
          <rect x="-400" y="0" width="800" height="900" />
        </clipPath>
      </defs>

      <circle r="230" fill={`url(#${id('glow')})`} />
      {half('back')}

      <g className="emblem__rays">
        <path
          d={starPath(16, 96, 80)}
          fill={`url(#${id('rays')})`}
          opacity="0.9"
        />
      </g>
      <circle r="74" fill={`url(#${id('sun')})`} />
      <circle r="74" fill="none" stroke="#FFE3A3" strokeOpacity="0.6" strokeWidth="1.5" />
      <text
        y="3"
        textAnchor="middle"
        dominantBaseline="middle"
        fontFamily="Unbounded, sans-serif"
        fontWeight={800}
        fontSize="40"
        letterSpacing="1"
        fill="#0B1640"
      >
        SIU
      </text>

      {half('front')}
    </svg>
  );
}

/** The service icon on a planet: white strokes over a dark outline. */
function PlanetIcon({ name, size }: { name: ServiceIconName; size: number }) {
  const shapes = SERVICE_ICON_SHAPES[name];
  const scale = size / 24;
  return (
    <g transform={`translate(${-size / 2} ${-size / 2}) scale(${scale})`} fill="none" strokeLinecap="round" strokeLinejoin="round">
      <g stroke="#0B1640" strokeOpacity={0.55} strokeWidth={3.6}>
        <IconShapes shapes={shapes} />
      </g>
      <g stroke="#FFFFFF" strokeWidth={1.9}>
        <IconShapes shapes={shapes} />
      </g>
    </g>
  );
}

function starPath(points: number, outer: number, inner: number) {
  const step = Math.PI / points;
  let d = '';
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 === 0 ? outer : inner;
    const a = i * step - Math.PI / 2;
    d += `${i === 0 ? 'M' : 'L'}${(Math.cos(a) * r).toFixed(1)} ${(Math.sin(a) * r).toFixed(1)}`;
  }
  return d + 'Z';
}
