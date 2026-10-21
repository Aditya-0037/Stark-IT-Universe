import { useId } from 'react';
import { services } from '../../content/services';
import { Box, Line3, VIEW, hull, iso, mix, planeX, planeY, planeZ, pts, type Pt } from './iso';

/**
 * The 2D (LITE) isometric classroom. Original artwork, drawn in code:
 * interactive flat panel on the front wall, ceiling projector with a
 * pull-down screen, desks with laptops, a desktop on the teacher's table and
 * a network rack with CAT-6 cables along the walls.
 *
 * power: 0 dark · 1 smart board · 2 projector · 3 lights · 4 lesson slide
 */
export type Power = 0 | 1 | 2 | 3 | 4;

interface Props {
  accent: string;
  power?: Power;
  night?: boolean;
  slideTitle: string;
  slideSub: string;
  className?: string;
}

/**
 * Hotspot anchor points in viewBox units (shared with the HTML overlay).
 * Each sits just above or beside its device so the device stays visible.
 */
export const CLASSROOM_HOTSPOTS: Record<string, Pt> = {
  ifp: iso(6.25, 0.2, 4.2),
  projector: iso(9.9, 6.0, 5.95),
  laptops: iso(4.2, 7.2, 2.4),
  desktop: iso(1.5, 1.84, 3.0),
  network: iso(0.68, 8.97, 3.15),
};

export const toPercent = ([x, y]: Pt) => ({
  left: `${(((x - VIEW.x) / VIEW.w) * 100).toFixed(2)}%`,
  top: `${(((y - VIEW.y) / VIEW.h) * 100).toFixed(2)}%`,
});

const DESK_X = [3.3, 6.1, 8.9];
const DESK_Y = [4.0, 6.9];
const CABLE = '#10B981';
const WOOD = { top: '#F3E3C3', left: '#DCC59D', right: '#C9B086' };
const LEG = { top: '#8A95BA', left: '#76819F', right: '#68738F' };

const LENS: [number, number, number] = [9.9, 5.55, 4.95];
const SHEET = { u0: 7.75, u1: 11.25, v0: -5.25, v1: -2.6 };

export function ClassroomIllustration({
  accent,
  power = 3,
  night = false,
  slideTitle,
  slideSub,
  className = '',
}: Props) {
  const uid = useId().replace(/:/g, '');
  const id = (s: string) => `${uid}-${s}`;
  const url = (s: string) => `url(#${id(s)})`;

  const a = {
    base: accent,
    light: mix(accent, '#ffffff', 0.3),
    dark: mix(accent, '#0B1640', 0.28),
    darker: mix(accent, '#0B1640', 0.45),
  };

  const boardOn = power >= 1;
  const projOn = power >= 2;
  const lightsOn = power >= 3;
  const lesson = power >= 4;
  const overlay = lightsOn ? (night ? 0.08 : 0) : night ? [0.76, 0.7, 0.64][power] : [0.45, 0.4, 0.36][power];

  const lensPt = iso(...LENS);
  const sheetCorners: Pt[] = [
    iso(SHEET.u0, 0.07, -SHEET.v0),
    iso(SHEET.u1, 0.07, -SHEET.v0),
    iso(SHEET.u1, 0.07, -SHEET.v1),
    iso(SHEET.u0, 0.07, -SHEET.v1),
  ];
  const beam = hull([lensPt, ...sheetCorners]);
  const sheetCenter = iso((SHEET.u0 + SHEET.u1) / 2, 0.07, -(SHEET.v0 + SHEET.v1) / 2);

  const fade = (on: boolean) => ({ opacity: on ? 1 : 0 });

  return (
    <svg
      viewBox={`${VIEW.x} ${VIEW.y} ${VIEW.w} ${VIEW.h}`}
      aria-hidden="true"
      focusable="false"
      className={`classroom-svg ${className}`}
    >
      <defs>
        <linearGradient id={id('sky-day')} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#8CCBFF" />
          <stop offset="1" stopColor="#E3F3FF" />
        </linearGradient>
        <linearGradient id={id('sky-night')} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#0B1640" />
          <stop offset="1" stopColor="#24346F" />
        </linearGradient>
        <linearGradient id={id('ifp')} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#0891B2" />
          <stop offset="1" stopColor="#1E3A8A" />
        </linearGradient>
        <radialGradient id={id('ifp-glow')}>
          <stop offset="0" stopColor="#22D3EE" stopOpacity="0.5" />
          <stop offset="1" stopColor="#22D3EE" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={id('screen')} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#7DD3FC" />
          <stop offset="1" stopColor="#3B82F6" />
        </linearGradient>
        <linearGradient
          id={id('beam')}
          gradientUnits="userSpaceOnUse"
          x1={lensPt[0]}
          y1={lensPt[1]}
          x2={sheetCenter[0]}
          y2={sheetCenter[1]}
        >
          <stop offset="0" stopColor="#FFFFFF" stopOpacity="0.75" />
          <stop offset="1" stopColor="#E0F2FE" stopOpacity="0.12" />
        </linearGradient>
        <linearGradient id={id('wash')} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#FFF4CF" stopOpacity="0.7" />
          <stop offset="1" stopColor="#FFF4CF" stopOpacity="0" />
        </linearGradient>
        <radialGradient id={id('sheet-glow')}>
          <stop offset="0" stopColor="#FFFFFF" stopOpacity="0.55" />
          <stop offset="1" stopColor="#FFFFFF" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* ---------- Floor ---------- */}
      <Box x={-0.35} y={-0.35} z={-0.5} w={12.35} d={10.35} h={0.5} top="#D7DEF1" left="#A9B4D6" right="#8F9BC4" />
      <g transform={planeZ(0)}>
        {Array.from({ length: 11 }, (_, i) => (
          <line key={`gx${i}`} x1={i + 1} y1={0} x2={i + 1} y2={10} stroke="#C6CEE7" strokeWidth={1} vectorEffect="non-scaling-stroke" />
        ))}
        {Array.from({ length: 9 }, (_, i) => (
          <line key={`gy${i}`} x1={0} y1={i + 1} x2={12} y2={i + 1} stroke="#C6CEE7" strokeWidth={1} vectorEffect="non-scaling-stroke" />
        ))}
        <rect x={2.7} y={3.45} width={8.95} height={6.0} rx={0.35} fill={a.base} opacity={0.16} className="cr-accent" />
      </g>

      {/* ---------- Walls ---------- */}
      <Box x={-0.35} y={-0.35} z={0} w={0.35} d={10.35} h={6} top="#FFFFFF" left="#B9C4E3" right="#E1E7F6" />
      <Box x={0} y={-0.35} z={0} w={12} d={0.35} h={6} top="#FFFFFF" left="#EEF1FA" right="#B9C4E3" />
      <g transform={planeX(0.005)}>
        <rect x={0} y={-0.22} width={10} height={0.22} fill="#C9D2EC" />
        <rect x={0} y={-1.12} width={10} height={0.14} fill={a.base} className="cr-accent" />
      </g>
      <g transform={planeY(0.005)}>
        <rect x={0} y={-0.22} width={12} height={0.22} fill="#CDD5EE" />
        <rect x={0} y={-1.12} width={12} height={0.14} fill={a.base} className="cr-accent" />
      </g>

      {/* Windows on the side wall */}
      {[2.2, 5.6].map((wy) => (
        <g key={wy}>
          <g transform={planeX(0.01)}>
            <rect x={wy} y={-4.8} width={2.2} height={2.4} fill={url('sky-day')} />
            <rect x={wy} y={-4.8} width={2.2} height={2.4} fill={url('sky-night')} className="cr-fade" style={fade(night)} />
            <g className="cr-fade" style={fade(!night)}>
              <ellipse cx={wy + 0.7} cy={-4.15} rx={0.42} ry={0.14} fill="#FFFFFF" opacity={0.95} />
              <ellipse cx={wy + 0.95} cy={-4.27} rx={0.26} ry={0.13} fill="#FFFFFF" opacity={0.95} />
            </g>
            <g className="cr-fade" style={fade(night)}>
              {[0.3, 0.9, 1.5, 1.9, 0.6, 1.25].map((sx, i) => (
                <circle key={i} cx={wy + sx} cy={-4.6 + ((i * 0.37) % 1.4)} r={0.035} fill="#FFFFFF" />
              ))}
              {wy > 4 && <circle cx={wy + 1.65} cy={-4.35} r={0.2} fill="#FFE7A8" />}
            </g>
            <rect x={wy} y={-4.8} width={2.2} height={2.4} fill="none" stroke="#FFFFFF" strokeWidth={4} vectorEffect="non-scaling-stroke" />
            <line x1={wy + 1.1} y1={-4.8} x2={wy + 1.1} y2={-2.4} stroke="#FFFFFF" strokeWidth={3} vectorEffect="non-scaling-stroke" />
            <line x1={wy} y1={-3.6} x2={wy + 2.2} y2={-3.6} stroke="#FFFFFF" strokeWidth={3} vectorEffect="non-scaling-stroke" />
          </g>
          <Box x={0} y={wy - 0.1} z={2.28} w={0.24} d={2.4} h={0.12} top="#FFFFFF" left="#D3DAEF" right="#E8ECF8" />
        </g>
      ))}

      {/* Wall clock */}
      <g transform={planeY(0.02)}>
        <circle cx={1.5} cy={-4.7} r={0.42} fill="#FFFFFF" stroke="#0B1640" strokeWidth={2} vectorEffect="non-scaling-stroke" />
        <line x1={1.5} y1={-4.7} x2={1.5} y2={-4.98} stroke="#0B1640" strokeWidth={2} vectorEffect="non-scaling-stroke" />
        <line x1={1.5} y1={-4.7} x2={1.7} y2={-4.62} stroke={a.base} strokeWidth={2} vectorEffect="non-scaling-stroke" className="cr-accent-stroke" />
      </g>

      {/* Wall lights (fixtures) */}
      <Box x={2.9} y={0} z={5.25} w={3.2} d={0.16} h={0.18} top="#FFFFFF" left="#E4E9F6" right="#CBD3EA" />
      <Box x={0} y={2.3} z={5.3} w={0.16} d={2.0} h={0.18} top="#FFFFFF" left="#CBD3EA" right="#E4E9F6" />
      <Box x={0} y={5.7} z={5.3} w={0.16} d={2.0} h={0.18} top="#FFFFFF" left="#CBD3EA" right="#E4E9F6" />

      {/* Interactive flat panel */}
      <Box x={2.8} y={0} z={2.0} w={3.4} d={0.2} h={2.0} top="#2B3566" left="#1A2246" right="#121936" />
      <g transform={planeY(0.205)}>
        <rect x={2.95} y={-3.88} width={3.1} height={1.76} fill="#0B1230" />
      </g>
      <Box x={3.3} y={0.2} z={1.9} w={2.4} d={0.12} h={0.06} top="#3A4577" left="#232C58" right="#1B2349" />

      {/* Pull-down projector screen */}
      <Box x={7.6} y={0} z={5.25} w={3.8} d={0.25} h={0.25} top="#EEF1F9" left="#CBD3EA" right="#B4BEDC" />
      <g transform={planeY(0.06)}>
        <rect x={SHEET.u0} y={SHEET.v0} width={SHEET.u1 - SHEET.u0} height={SHEET.v1 - SHEET.v0} fill="#F4F6FC" stroke="#D3DAEE" strokeWidth={1} vectorEffect="non-scaling-stroke" />
        <rect x={SHEET.u0 - 0.05} y={SHEET.v1 - 0.06} width={SHEET.u1 - SHEET.u0 + 0.1} height={0.08} fill="#AEB8D6" />
      </g>

      {/* ---------- CAT-6 cabling along the walls ---------- */}
      <Line3 points={[[0.06, 8.45, 0.12], [0.06, 0.06, 0.12], [11.85, 0.06, 0.12]]} stroke={CABLE} />
      <Line3 points={[[4.5, 0.06, 0.12], [4.5, 0.06, 2.0]]} stroke={CABLE} />
      <Line3 points={[[11.85, 0.06, 0.12], [11.85, 0.06, 5.95]]} stroke={CABLE} />
      <Line3 points={[[1.7, 0.06, 0.12], [1.7, 0.06, 0.03], [1.7, 1.6, 0.03]]} stroke={CABLE} />
      <Line3 points={[[0.06, 6.4, 0.12], [0.06, 6.4, 0.03]]} stroke={CABLE} />
      <Box x={0.05} y={6.3} z={0} w={10.9} d={0.2} h={0.06} top="#C3CCE6" left="#A6B1D2" right="#98A4C9" />
      <Line3 points={[[0.06, 6.4, 0.065], [10.9, 6.4, 0.065]]} stroke={CABLE} width={2} />
      {DESK_X.map((dx) => (
        <g key={`stub${dx}`}>
          <Line3 points={[[dx + 0.9, 6.3, 0.02], [dx + 0.9, 4.95, 0.02]]} stroke={CABLE} width={2} opacity={0.9} />
          <Line3 points={[[dx + 0.9, 6.5, 0.02], [dx + 0.9, 7.0, 0.02]]} stroke={CABLE} width={2} opacity={0.9} />
        </g>
      ))}

      {/* ---------- Network rack + plant ---------- */}
      <Box x={0.15} y={8.45} z={0} w={1.05} d={1.05} h={2.5} top="#33407A" left="#18214A" right="#212C5C" />
      <g transform={planeX(1.205)}>
        {[0, 1, 2, 3, 4].map((r) => (
          <g key={r}>
            <rect x={8.55} y={-2.3 + r * 0.42} width={0.85} height={0.26} fill="#121A3D" />
            {[0, 1, 2, 3].map((p) => (
              <rect key={p} x={8.62 + p * 0.15} y={-2.25 + r * 0.42} width={0.1} height={0.1} fill="#9AA8D6" />
            ))}
            <circle cx={9.3} cy={-2.17 + r * 0.42} r={0.035} fill={r % 2 ? '#34D399' : '#FFB52E'} />
          </g>
        ))}
      </g>
      <Box x={0.35} y={7.5} z={0} w={0.55} d={0.55} h={0.5} top="#C9D1EA" left="#E9EDF8" right="#D3DAEE" />
      {(() => {
        const [px, py] = iso(0.62, 7.77, 0.5);
        return (
          <g>
            <ellipse cx={px - 8} cy={py - 20} rx={9} ry={20} fill="#2E9E6E" transform={`rotate(-24 ${px - 8} ${py - 20})`} />
            <ellipse cx={px + 9} cy={py - 22} rx={9} ry={21} fill="#3FB984" transform={`rotate(22 ${px + 9} ${py - 22})`} />
            <ellipse cx={px} cy={py - 30} rx={8} ry={24} fill="#4CC995" />
          </g>
        );
      })()}

      {/* ---------- Teacher's table with desktop ---------- */}
      <Box x={1.05} y={0.55} z={0.88} w={0.9} d={0.1} h={0.9} top={a.light} left={a.dark} right={a.darker} className="cr-accent-box" />
      <Box x={1.05} y={0.62} z={0.78} w={0.9} d={0.72} h={0.1} top={a.light} left={a.dark} right={a.darker} className="cr-accent-box" />
      {[
        [0.55, 1.55],
        [2.37, 1.55],
      ].map(([lx, ly]) => (
        <Box key={`tl${lx}`} x={lx} y={ly} z={0} w={0.08} d={0.08} h={1.33} {...LEG} />
      ))}
      <Box x={0.55} y={2.38} z={0.3} w={1.9} d={0.06} h={1.03} top={WOOD.top} left={WOOD.left} right={WOOD.right} />
      <Box x={0.5} y={1.5} z={1.33} w={2} d={1} h={0.12} {...WOOD} />
      <Box x={1.3} y={1.62} z={1.45} w={0.4} d={0.3} h={0.03} top="#3A4577" left="#232C58" right="#1B2349" />
      <Box x={1.45} y={1.72} z={1.48} w={0.1} d={0.08} h={0.3} top="#3A4577" left="#232C58" right="#1B2349" />
      <Box x={1.0} y={1.8} z={1.75} w={1.0} d={0.08} h={0.7} top="#2B3566" left="#1A2246" right="#121936" />
      <g transform={planeY(1.885)}>
        <rect x={1.06} y={-2.39} width={0.88} height={0.58} fill="#0B1230" />
        <g className="cr-fade" style={fade(boardOn)}>
          <rect x={1.06} y={-2.39} width={0.88} height={0.58} fill={url('screen')} />
          <rect x={1.14} y={-2.3} width={0.42} height={0.08} fill="#FFFFFF" opacity={0.85} />
          <rect x={1.14} y={-2.16} width={0.7} height={0.05} fill="#FFFFFF" opacity={0.5} />
          <rect x={1.14} y={-2.06} width={0.55} height={0.05} fill="#FFFFFF" opacity={0.5} />
        </g>
      </g>
      <Box x={2.05} y={1.65} z={1.45} w={0.32} d={0.62} h={0.7} top="#3A4577" left="#232C58" right="#1B2349" />
      <circle cx={iso(2.3, 2.27, 2.0)[0]} cy={iso(2.3, 2.27, 2.0)[1]} r={2} fill="#34D399" />
      <Box x={1.05} y={2.02} z={1.45} w={0.85} d={0.28} h={0.035} top="#E3E8F5" left="#B9C2DD" right="#AAB4D2" />

      {/* ---------- Student desks, laptops and chairs ---------- */}
      {DESK_Y.map((dy) =>
        DESK_X.map((dx) => (
          <g key={`desk${dx}-${dy}`}>
            {[
              [dx + 0.06, dy + 0.06],
              [dx + 1.66, dy + 0.06],
              [dx + 0.06, dy + 0.86],
              [dx + 1.66, dy + 0.86],
            ].map(([lx, ly]) => (
              <Box key={`${lx}-${ly}`} x={lx} y={ly} z={0} w={0.08} d={0.08} h={1.28} {...LEG} />
            ))}
            <Box x={dx} y={dy} z={1.28} w={1.8} d={1.0} h={0.12} {...WOOD} />
            {/* laptop */}
            <Box x={dx + 0.5} y={dy + 0.25} z={1.4} w={0.8} d={0.5} h={0.03} top="#D6DCEC" left="#AEB7D0" right="#A0AAC6" />
            <Box x={dx + 0.5} y={dy + 0.2} z={1.43} w={0.8} d={0.05} h={0.52} top="#AEB7D0" left="#2B3566" right="#8E98B8" />
            <g transform={planeY(dy + 0.252)}>
              <rect x={dx + 0.55} y={-1.9} width={0.7} height={0.42} fill="#0B1230" />
              <g className="cr-fade" style={fade(boardOn)}>
                <rect x={dx + 0.55} y={-1.9} width={0.7} height={0.42} fill={url('screen')} />
                <rect x={dx + 0.61} y={-1.83} width={0.3} height={0.06} fill="#FFFFFF" opacity={0.85} />
                <rect x={dx + 0.61} y={-1.72} width={0.5} height={0.04} fill="#FFFFFF" opacity={0.5} />
              </g>
            </g>
            {/* chair */}
            {[
              [dx + 0.5, dy + 1.2],
              [dx + 1.25, dy + 1.2],
              [dx + 0.5, dy + 1.85],
              [dx + 1.25, dy + 1.85],
            ].map(([lx, ly]) => (
              <Box key={`c${lx}-${ly}`} x={lx} y={ly} z={0} w={0.06} d={0.06} h={0.78} {...LEG} />
            ))}
            <Box x={dx + 0.45} y={dy + 1.15} z={0.78} w={0.9} d={0.8} h={0.1} top={a.light} left={a.dark} right={a.darker} className="cr-accent-box" />
            <Box x={dx + 0.45} y={dy + 1.9} z={0.88} w={0.9} d={0.1} h={0.95} top={a.light} left={a.dark} right={a.darker} className="cr-accent-box" />
          </g>
        )),
      )}

      {/* ---------- Ceiling projector ---------- */}
      <Box x={9.85} y={5.95} z={5.15} w={0.1} d={0.1} h={1.45} top="#AEB8D6" left="#9AA5C7" right="#8893B8" />
      <Box x={9.35} y={5.55} z={4.75} w={1.1} d={0.9} h={0.4} top="#F1F4FB" left="#CDD4E9" right="#B6BFDB" />
      <g transform={planeX(10.455)}>
        {[0, 1, 2].map((i) => (
          <line key={i} x1={5.75 + i * 0.12} y1={-5.05} x2={5.75 + i * 0.12} y2={-4.85} stroke="#8E98B8" strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
        ))}
      </g>
      <circle cx={iso(9.6, 6.45, 4.95)[0]} cy={iso(9.6, 6.45, 4.95)[1]} r={2.6} fill={projOn ? '#34D399' : '#7C88AE'} />

      {/* ---------- Darkness ---------- */}
      <rect
        x={VIEW.x}
        y={VIEW.y}
        width={VIEW.w}
        height={VIEW.h}
        fill="#040920"
        className="cr-fade"
        style={{ opacity: overlay }}
      />

      {/* ---------- Things that glow ---------- */}
      <g className="cr-fade" style={fade(boardOn)}>
        <g transform={planeY(0.004)}>
          <ellipse cx={4.5} cy={-3} rx={2.7} ry={1.7} fill={url('ifp-glow')} />
        </g>
        <g transform={planeY(0.21)}>
          <rect x={2.95} y={-3.88} width={3.1} height={1.76} fill={url('ifp')} />
          <rect x={2.95} y={-3.88} width={3.1} height={0.16} fill="#FFFFFF" opacity={0.16} />
          {services.slice(0, 3).map((s, i) => (
            <rect key={s.id} x={3.15 + i * 0.95} y={-3.5} width={0.8} height={0.55} rx={0.06} fill={s.color} opacity={0.95} />
          ))}
          <path d="M3.2 -2.5 q0.3 -0.28 0.6 0 t0.6 0 t0.6 0 t0.6 0" fill="none" stroke="#FFFFFF" strokeWidth={2} vectorEffect="non-scaling-stroke" />
          <circle cx={5.75} cy={-2.45} r={0.12} fill="#FFB52E" />
        </g>
      </g>

      <g className="cr-fade" style={fade(projOn)}>
        <polygon points={pts(...beam)} fill={url('beam')} />
        <g transform={planeY(0.065)}>
          <ellipse cx={9.5} cy={-3.92} rx={2.3} ry={1.7} fill={url('sheet-glow')} />
          <rect x={SHEET.u0} y={SHEET.v0} width={SHEET.u1 - SHEET.u0} height={SHEET.v1 - SHEET.v0} fill="#FFFFFF" />
        </g>
      </g>

      <g className="cr-fade" style={fade(lesson)}>
        <g transform={planeY(0.07)}>
          <rect x={SHEET.u0 + 0.12} y={SHEET.v0 + 0.12} width={SHEET.u1 - SHEET.u0 - 0.24} height={SHEET.v1 - SHEET.v0 - 0.24} fill="#0B1640" />
          <text x={SHEET.u0 + 0.32} y={SHEET.v0 + 0.55} fontSize={0.3} fontFamily="Unbounded, sans-serif" fontWeight={700} fill="#FFFFFF">
            {slideTitle}
          </text>
          <text x={SHEET.u0 + 0.32} y={SHEET.v0 + 0.85} fontSize={0.17} fontFamily="Poppins, sans-serif" fill="#B9C4EE">
            {slideSub}
          </text>
          {[0.45, 0.68, 0.91, 1.14, 1.37].map((rx) => (
            <ellipse key={rx} cx={9.5} cy={-3.45} rx={rx} ry={rx * 0.34} fill="none" stroke="#6F86FF" strokeWidth={1} opacity={0.7} vectorEffect="non-scaling-stroke" />
          ))}
          <circle cx={9.5} cy={-3.45} r={0.2} fill="#FFB52E" />
          {services.map((s, i) => {
            const rx = 0.45 + i * 0.23;
            const t = [0.4, 2.2, 3.6, 5.1, 1.2][i];
            return <circle key={s.id} cx={9.5 + Math.cos(t) * rx} cy={-3.45 + Math.sin(t) * rx * 0.34} r={0.07} fill={s.color} />;
          })}
        </g>
      </g>

      <g className="cr-fade" style={fade(lightsOn)}>
        <g transform={planeY(0.01)}>
          <polygon points="2.9,-5.25 6.1,-5.25 6.7,-3.4 2.3,-3.4" fill={url('wash')} />
        </g>
        <g transform={planeX(0.01)}>
          <polygon points="2.3,-5.3 4.3,-5.3 4.8,-3.5 1.8,-3.5" fill={url('wash')} />
          <polygon points="5.7,-5.3 7.7,-5.3 8.2,-3.5 5.2,-3.5" fill={url('wash')} />
        </g>
        <Box x={2.9} y={0} z={5.25} w={3.2} d={0.16} h={0.18} top="#FFFFFF" left="#FFF6D6" right="#FFE9A8" />
        <Box x={0} y={2.3} z={5.3} w={0.16} d={2.0} h={0.18} top="#FFFFFF" left="#FFE9A8" right="#FFF6D6" />
        <Box x={0} y={5.7} z={5.3} w={0.16} d={2.0} h={0.18} top="#FFFFFF" left="#FFE9A8" right="#FFF6D6" />
      </g>
    </svg>
  );
}
