import { useId, useRef, type KeyboardEvent, type PointerEvent } from 'react';

const W = 320;
const H = 214;
const CX = 160;
const CY = 168;
const R = 128;
const STEP = 25;

const clamp = (v: number) => Math.min(100, Math.max(0, v));
const pointAt = (v: number, r = R): [number, number] => {
  const a = Math.PI * (1 - v / 100);
  return [CX + Math.cos(a) * r, CY - Math.sin(a) * r];
};

interface Props {
  value: number;
  onChange: (v: number) => void;
  /** Called when a drag ends (value snapped to the nearest step). */
  onCommit?: (v: number) => void;
  onDragStart?: () => void;
  /** Visible label, also the slider's accessible name. */
  label: string;
  valueText: string;
  ticks: string[];
  hint: string;
}

/**
 * "Drag to switch on" arc slider. A real role="slider" with
 * aria-valuenow/valuetext; arrow keys, Page Up/Down, Home and End move
 * between steps. Pointer dragging starts on the thumb or near the arc.
 */
export function ArcSlider({ value, onChange, onCommit, onDragStart, label, valueText, ticks, hint }: Props) {
  const dialRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const labelId = useId();
  const hintId = useId();

  const valueFromPointer = (e: PointerEvent) => {
    const rect = dialRef.current!.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * W;
    const py = ((e.clientY - rect.top) / rect.height) * H;
    let a = Math.atan2(CY - py, px - CX);
    if (a < 0) a = px < CX ? Math.PI : 0;
    return clamp((1 - a / Math.PI) * 100);
  };

  const nearArc = (e: PointerEvent) => {
    const rect = dialRef.current!.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * W;
    const py = ((e.clientY - rect.top) / rect.height) * H;
    const d = Math.hypot(px - CX, py - CY);
    return Math.abs(d - R) < 42 && py < CY + 24;
  };

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    const onThumb = (e.target as HTMLElement).closest('[role="slider"]');
    if (!onThumb && !nearArc(e)) return;
    dragging.current = true;
    e.currentTarget.setPointerCapture(e.pointerId);
    onDragStart?.();
    onChange(valueFromPointer(e));
    if (onThumb) (onThumb as HTMLElement).focus({ preventScroll: true });
  };
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (dragging.current) onChange(valueFromPointer(e));
  };
  const end = (e: PointerEvent<HTMLDivElement>) => {
    if (!dragging.current) return;
    dragging.current = false;
    const snapped = Math.round(valueFromPointer(e) / STEP) * STEP;
    onChange(snapped);
    onCommit?.(snapped);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    let next: number | null = null;
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp' || e.key === 'PageUp') next = Math.floor(value / STEP) * STEP + STEP;
    if (e.key === 'ArrowLeft' || e.key === 'ArrowDown' || e.key === 'PageDown') next = Math.ceil(value / STEP) * STEP - STEP;
    if (e.key === 'Home') next = 0;
    if (e.key === 'End') next = 100;
    if (next === null) return;
    e.preventDefault();
    onDragStart?.();
    const v = clamp(next);
    onChange(v);
    onCommit?.(v);
  };

  const [tx, ty] = pointAt(value);
  const track = `M ${CX - R} ${CY} A ${R} ${R} 0 0 1 ${CX + R} ${CY}`;

  return (
    <div className="arc">
      <p id={labelId} className="arc__label">
        {label}
      </p>
      <div
        ref={dialRef}
        className="arc__dial"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={end}
        onPointerCancel={end}
      >
        <svg viewBox={`0 0 ${W} ${H}`} aria-hidden="true" focusable="false">
          <path d={track} className="arc__track" />
          <path d={track} className="arc__fill" pathLength={100} strokeDasharray={`${value} 100`} />
          {ticks.map((t, i) => {
            const v = (i + 1) * STEP;
            const [x, y] = pointAt(v);
            // The last label sits under the arc's end; the others outside it.
            const [lx, ly] = v === 100 ? [CX + R, CY + 34] : pointAt(v, R + 26);
            const anchor = v === 100 || v === 50 ? 'middle' : v < 50 ? 'end' : 'start';
            const lit = value >= v;
            return (
              <g key={t} className={`arc__tick ${lit ? 'is-lit' : ''}`}>
                <circle cx={x} cy={y} r={5} />
                <text x={lx} y={ly + 4} textAnchor={anchor}>
                  {t}
                </text>
              </g>
            );
          })}
          <circle cx={CX} cy={CY} r={6} className="arc__hub" />
        </svg>
        <div
          role="slider"
          tabIndex={0}
          aria-labelledby={labelId}
          aria-describedby={hintId}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(value)}
          aria-valuetext={valueText}
          className="arc__thumb"
          style={{ left: `${(tx / W) * 100}%`, top: `${(ty / H) * 100}%` }}
          onKeyDown={onKeyDown}
          data-cursor="grow"
        >
          <span aria-hidden="true" />
        </div>
      </div>
      <p id={hintId} className="sr-only">
        {hint}
      </p>
    </div>
  );
}
