import { useId } from 'react';

/** Original SIU satellite: a rounded gold body with two small solar panels. */
export function Satellite2D({ width = 72, className = '' }: { width?: number; className?: string }) {
  const id = useId().replace(/:/g, '');
  return (
    <svg
      viewBox="-44 -28 88 56"
      width={width}
      height={(width * 56) / 88}
      aria-hidden="true"
      focusable="false"
      className={className}
    >
      <defs>
        <linearGradient id={`${id}-b`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#FFD57A" />
          <stop offset="0.55" stopColor="#FFB52E" />
          <stop offset="1" stopColor="#F08A00" />
        </linearGradient>
      </defs>
      {[-1, 1].map((side) => (
        <g key={side} transform={side === 1 ? 'scale(-1 1)' : undefined}>
          <rect x="-19" y="-1.6" width="7" height="3.2" rx="1" fill="#B9C4EE" />
          <rect x="-42" y="-10" width="23" height="20" rx="3" fill="#3152F5" stroke="#93ACFF" strokeWidth="1.4" />
          <path d="M-34.3 -10v20M-26.6 -10v20M-42 0h23" stroke="#93ACFF" strokeWidth="1.1" />
        </g>
      ))}
      <path d="M0 -15v-6" stroke="#FFB52E" strokeWidth="2.2" strokeLinecap="round" />
      <circle cx="0" cy="-22.5" r="2.6" fill="#FFE7A8" />
      <rect x="-13" y="-15" width="26" height="30" rx="10" fill={`url(#${id}-b)`} />
      <rect x="-13" y="2" width="26" height="4" fill="#F08A00" opacity="0.55" />
      <circle cx="0" cy="-5" r="4.6" fill="#0B1640" />
      <circle cx="-1.5" cy="-6.5" r="1.4" fill="#93ACFF" />
    </svg>
  );
}
