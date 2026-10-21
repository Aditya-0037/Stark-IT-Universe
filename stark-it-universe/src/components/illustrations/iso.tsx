/**
 * Isometric drawing helpers for the 2D classroom (LITE mode).
 * World units: x runs along the front wall (down-right on screen),
 * y along the window wall (down-left), z is up. 1 unit is ~34 px.
 */
export type Pt = [number, number];

export const U = 34;
const CX = Math.cos(Math.PI / 6);
export const ORIGIN = { x: 410, y: 232 };

/** The illustration's viewBox, shared with the HTML hotspot overlay. */
export const VIEW = { x: 90, y: 8, w: 700, h: 630 };

export function iso(x: number, y: number, z = 0): Pt {
  return [ORIGIN.x + (x - y) * CX * U, ORIGIN.y + (x + y) * 0.5 * U - z * U];
}

export const pts = (...ps: Pt[]) => ps.map(([a, b]) => `${a.toFixed(1)},${b.toFixed(1)}`).join(' ');

/** Draw on the wall plane y = y0 using local (u = x, v = -z) coordinates. */
export const planeY = (y0: number) =>
  `matrix(${CX * U} ${0.5 * U} 0 ${U} ${ORIGIN.x - y0 * CX * U} ${ORIGIN.y + y0 * 0.5 * U})`;

/** Draw on the wall plane x = x0 using local (u = y, v = -z). Mirrored. */
export const planeX = (x0: number) =>
  `matrix(${-CX * U} ${0.5 * U} 0 ${U} ${ORIGIN.x + x0 * CX * U} ${ORIGIN.y + x0 * 0.5 * U})`;

/** Draw on the floor plane z = z0 using local (u = x, v = y). */
export const planeZ = (z0: number) =>
  `matrix(${CX * U} ${0.5 * U} ${-CX * U} ${0.5 * U} ${ORIGIN.x} ${ORIGIN.y - z0 * U})`;

/** Mix two hex colours. t = 0 gives a, t = 1 gives b. */
export function mix(a: string, b: string, t: number) {
  const pa = parseInt(a.slice(1), 16);
  const pb = parseInt(b.slice(1), 16);
  const ch = (p: number, s: number) => (p >> s) & 255;
  const c = (s: number) => Math.round(ch(pa, s) + (ch(pb, s) - ch(pa, s)) * t);
  return `#${((1 << 24) | (c(16) << 16) | (c(8) << 8) | c(0)).toString(16).slice(1)}`;
}

/** Convex hull (monotone chain), used for the projector beam. */
export function hull(points: Pt[]): Pt[] {
  const p = [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (o: Pt, a: Pt, b: Pt) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lower: Pt[] = [];
  for (const q of p) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], q) <= 0) lower.pop();
    lower.push(q);
  }
  const upper: Pt[] = [];
  for (let i = p.length - 1; i >= 0; i--) {
    const q = p[i];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], q) <= 0) upper.pop();
    upper.push(q);
  }
  upper.pop();
  lower.pop();
  return lower.concat(upper);
}

interface BoxProps {
  x: number;
  y: number;
  z: number;
  w: number;
  d: number;
  h: number;
  /** Fill for the top face. */
  top: string;
  /** Fill for the +y face (screen left). */
  left: string;
  /** Fill for the +x face (screen right). */
  right: string;
  className?: string;
}

/** An axis-aligned box: draws the three faces facing the viewer. */
export function Box({ x, y, z, w, d, h, top, left, right, className }: BoxProps) {
  const X = x + w;
  const Y = y + d;
  const Z = z + h;
  return (
    <g className={className}>
      <polygon points={pts(iso(x, Y, Z), iso(X, Y, Z), iso(X, Y, z), iso(x, Y, z))} fill={left} />
      <polygon points={pts(iso(X, y, Z), iso(X, Y, Z), iso(X, Y, z), iso(X, y, z))} fill={right} />
      <polygon points={pts(iso(x, y, Z), iso(X, y, Z), iso(X, Y, Z), iso(x, Y, Z))} fill={top} />
    </g>
  );
}

/** A polyline through 3D points. */
export function Line3({
  points,
  stroke,
  width = 2.5,
  opacity = 1,
}: {
  points: [number, number, number][];
  stroke: string;
  width?: number;
  opacity?: number;
}) {
  return (
    <polyline
      points={pts(...points.map(([x, y, z]) => iso(x, y, z)))}
      fill="none"
      stroke={stroke}
      strokeWidth={width}
      strokeLinecap="round"
      strokeLinejoin="round"
      opacity={opacity}
    />
  );
}
