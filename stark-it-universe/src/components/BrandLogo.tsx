import { useId } from 'react';
import { brand } from '../lib/brand';
import { services } from '../content/services';

/**
 * The header logo. `on` is the background the logo sits on:
 *   'light' -> siu-header-logo.svg
 *   'dark'  -> siu-header-logo-dark.svg
 * If the file is missing, a placeholder mark + wordmark is drawn.
 */
export function BrandLogo({ on, className = '' }: { on: 'light' | 'dark'; className?: string }) {
  const src = on === 'dark' ? brand.headerLogoDark : brand.headerLogo;
  if (src) {
    return <img src={src} alt="Stark IT Universe" height={36} className={`brand-logo-img ${className}`} />;
  }
  // The wordmark text is the accessible name; the drawn mark is decorative.
  return (
    <span className={`brand-logo ${className}`} data-on={on}>
      <LogoMark size={36} />
      <span className="brand-logo__word">
        Stark IT <b>Universe</b>
      </span>
    </span>
  );
}

/** Placeholder mark: a gold "SIU" star with five small planets. */
export function LogoMark({ size = 36 }: { size?: number }) {
  const id = useId().replace(/:/g, '');
  const angles = [200, 290, 20, 110, 155];
  return (
    <svg viewBox="-20 -20 40 40" width={size} height={size} aria-hidden="true" focusable="false">
      <defs>
        <radialGradient id={`${id}-sun`} cx="40%" cy="35%" r="70%">
          <stop offset="0" stopColor="#FFE7A8" />
          <stop offset="0.55" stopColor="#FFB52E" />
          <stop offset="1" stopColor="#F08A00" />
        </radialGradient>
      </defs>
      <ellipse rx="17" ry="7" fill="none" stroke="#6F86FF" strokeWidth="0.8" opacity="0.8" transform="rotate(-18)" />
      <circle r="10.5" fill={`url(#${id}-sun)`} />
      <text
        y="0.4"
        textAnchor="middle"
        dominantBaseline="middle"
        fontFamily="Unbounded, sans-serif"
        fontWeight={800}
        fontSize="6.6"
        fill="#0B1640"
      >
        SIU
      </text>
      {services.map((s, i) => {
        const a = (angles[i] * Math.PI) / 180;
        return <circle key={s.id} cx={Math.cos(a) * 16} cy={Math.sin(a) * 16} r={2.3} fill={s.color} />;
      })}
    </svg>
  );
}
