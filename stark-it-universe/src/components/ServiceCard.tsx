import { useRef, useState, type CSSProperties, type MouseEvent, type PointerEvent } from 'react';
import { en } from '../content/en';
import type { Service } from '../content/services';
import { useReducedMotion } from '../hooks/useReducedMotion';
import { goToQuote } from '../lib/quoteStore';
import { Button } from './Button';
import { Icon, serviceIcon } from './Icons';
import { Rich } from './Placeholder';

const MAX_TILT = 8;

/**
 * Collectible-style service card in its planet colour.
 * - Hover tilts it in 3D (max 8°), mouse only, off under Reduce Motion.
 * - Click anywhere, or the flip button (Enter/Space), flips it.
 * - Front: number, name, one line. Back: what's included, price, quote.
 * The back is `inert` until flipped, so keyboard focus never lands on
 * something hidden. Under Reduce Motion the flip becomes a crossfade.
 */
export function ServiceCard({ service: s }: { service: Service }) {
  const [flipped, setFlipped] = useState(false);
  const reduced = useReducedMotion();
  const tiltRef = useRef<HTMLDivElement>(null);
  const p = en.planets;
  const backId = `service-${s.id}-back`;

  const onPointerMove = (e: PointerEvent<HTMLElement>) => {
    if (reduced || e.pointerType !== 'mouse' || !tiltRef.current) return;
    const r = e.currentTarget.getBoundingClientRect();
    const nx = (e.clientX - r.left) / r.width - 0.5;
    const ny = (e.clientY - r.top) / r.height - 0.5;
    const el = tiltRef.current;
    el.style.setProperty('--ry', `${(nx * 2 * MAX_TILT).toFixed(2)}deg`);
    el.style.setProperty('--rx', `${(-ny * 2 * MAX_TILT).toFixed(2)}deg`);
    el.style.setProperty('--mx', `${((nx + 0.5) * 100).toFixed(1)}%`);
    el.style.setProperty('--my', `${((ny + 0.5) * 100).toFixed(1)}%`);
    el.dataset.hover = 'true';
  };
  const onPointerLeave = () => {
    const el = tiltRef.current;
    if (!el) return;
    el.style.setProperty('--rx', '0deg');
    el.style.setProperty('--ry', '0deg');
    delete el.dataset.hover;
  };
  const onCardClick = (e: MouseEvent<HTMLElement>) => {
    if ((e.target as HTMLElement).closest('a, button')) return;
    setFlipped((f) => !f);
  };

  return (
    <article
      id={`service-${s.id}`}
      className="svc-card"
      data-flipped={flipped || undefined}
      style={{ '--planet': `var(${s.colorVar})` } as CSSProperties}
      aria-labelledby={`service-${s.id}-name`}
      onPointerMove={onPointerMove}
      onPointerLeave={onPointerLeave}
      onClick={onCardClick}
    >
      <div ref={tiltRef} className="svc-card__tilt">
        <div className="svc-card__face svc-card__front">
          <div className="svc-card__art" aria-hidden="true">
            <span className="svc-card__number">{s.number}</span>
            <span className="svc-card__orbit" />
            <span className={`planet-ball ${s.id === 'network' ? 'planet-ball--ringed' : ''}`}>
              <Icon name={serviceIcon[s.id]} size={44} strokeWidth={1.6} />
            </span>
          </div>
          <div className="svc-card__body">
            <h3 id={`service-${s.id}-name`} className="svc-card__name">
              {s.name}
            </h3>
            <p className="svc-card__line">{s.line}</p>
            <p className="svc-card__hint" aria-hidden="true">
              {p.flipToBack}
              <Icon name="flip" size={16} />
            </p>
          </div>
        </div>

        <button
          type="button"
          className="svc-card__flip"
          aria-expanded={flipped}
          aria-controls={backId}
          onClick={() => setFlipped((f) => !f)}
        >
          <Icon name="flip" size={20} />
          <span className="sr-only">
            {p.included}: {s.shortName}
          </span>
        </button>

        <div id={backId} className="svc-card__face svc-card__back" inert={flipped ? undefined : ''}>
          <p className="svc-card__back-kicker">
            <span className="mono">{s.number}</span> {s.shortName}
          </p>
          <p className="svc-card__back-title">{p.included}</p>
          <ul className="svc-card__list">
            {s.included.map((item) => (
              <li key={item}>
                <Rich text={item} />
              </li>
            ))}
          </ul>
          <p className="svc-card__price">
            <Rich text={s.price} />
          </p>
          <Button variant="primary" className="svc-card__cta" onClick={() => goToQuote({ service: s.name })}>
            {p.quoteThis}
          </Button>
        </div>
      </div>
    </article>
  );
}
