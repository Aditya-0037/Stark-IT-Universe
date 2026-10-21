import type { ServiceId } from '../content/services';
import { SERVICE_ICON_SHAPES, type ServiceIconName, type Shape } from './iconShapes';

/** Renders shape data from iconShapes.ts as SVG elements. */
export function IconShapes({ shapes }: { shapes: Shape[] }) {
  return (
    <>
      {shapes.map((sh, i) =>
        sh.t === 'path' ? (
          <path key={i} d={sh.d} />
        ) : sh.t === 'circle' ? (
          <circle key={i} cx={sh.cx} cy={sh.cy} r={sh.r} />
        ) : (
          <rect key={i} x={sh.x} y={sh.y} width={sh.w} height={sh.h} rx={sh.rx} />
        ),
      )}
    </>
  );
}

/**
 * Original line icons (24 x 24, 1.75 stroke). Decorative by default:
 * give the surrounding control an accessible name instead.
 */
const paths = {
  ...Object.fromEntries(
    Object.entries(SERVICE_ICON_SHAPES).map(([name, shapes]) => [name, <IconShapes key={name} shapes={shapes} />]),
  ) as Record<ServiceIconName, JSX.Element>,
  desktop: (
    <>
      <rect x="3" y="4" width="18" height="12" rx="1.6" />
      <path d="M12 16v4M8.5 20h7" />
    </>
  ),
  school: (
    <>
      <path d="M3 20.5h18M5 20.5V10l7-5 7 5v10.5" />
      <path d="M10 20.5V16h4v4.5M9 11.5h.01M15 11.5h.01M12 11.5h.01" />
    </>
  ),
  shield: (
    <>
      <path d="M12 3 5 6v5c0 4.5 3 8 7 10 4-2 7-5.5 7-10V6l-7-3Z" />
      <path d="m9 12 2 2 4-4" />
    </>
  ),
  phone: (
    <path d="M6.6 3.5h2.6l1.5 4-2 1.3a11 11 0 0 0 6.5 6.5l1.3-2 4 1.5v2.6a2 2 0 0 1-2.2 2A17 17 0 0 1 4.6 5.7a2 2 0 0 1 2-2.2Z" />
  ),
  chat: (
    <>
      <path d="M20.5 11.5a8.5 8.5 0 0 1-12.3 7.6L3.5 20.5l1.4-4.4a8.5 8.5 0 1 1 15.6-4.6Z" />
      <path d="M8.5 11.5h.01M12 11.5h.01M15.5 11.5h.01" />
    </>
  ),
  mail: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="m3.5 6.5 8.5 6.5 8.5-6.5" />
    </>
  ),
  pin: (
    <>
      <path d="M12 21s7-6.2 7-11.5a7 7 0 1 0-14 0C5 14.8 12 21 12 21Z" />
      <circle cx="12" cy="9.5" r="2.5" />
    </>
  ),
  arrowRight: <path d="M5 12h14M13 6l6 6-6 6" />,
  arrowDown: <path d="M12 5v14M6 13l6 6 6-6" />,
  flip: (
    <>
      <path d="M3.5 11A8.5 8.5 0 0 1 18 6.3L20.5 9" />
      <path d="M20.5 4v5h-5" />
      <path d="M20.5 13A8.5 8.5 0 0 1 6 17.7L3.5 15" />
      <path d="M3.5 20v-5h5" />
    </>
  ),
  check: <path d="m5 12.5 4.5 4.5L19 7.5" />,
  plus: <path d="M12 5v14M5 12h14" />,
  minus: <path d="M5 12h14" />,
  sun: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4" />
    </>
  ),
  moon: <path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z" />,
  power: (
    <>
      <path d="M12 3v8" />
      <path d="M6.3 6.8a8 8 0 1 0 11.4 0" />
    </>
  ),
  bulb: (
    <>
      <path d="M9 18h6M10 21h4" />
      <path d="M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3Z" />
    </>
  ),
  menu: <path d="M4 7h16M4 12h16M4 17h16" />,
  close: <path d="M6 6l12 12M18 6 6 18" />,
  slide: (
    <>
      <rect x="3" y="4" width="18" height="12" rx="1.5" />
      <path d="M7 8.5h6M7 11.5h10M12 16v4" />
    </>
  ),
} as const;

export type IconName = keyof typeof paths;

export const serviceIcon: Record<ServiceId, IconName> = {
  smartclass: 'cap',
  ifp: 'panel',
  projector: 'projector',
  laptop: 'laptop',
  network: 'router',
};

interface IconProps {
  name: IconName;
  size?: number;
  className?: string;
  strokeWidth?: number;
}

export function Icon({ name, size = 24, className, strokeWidth = 1.75 }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className={className}
    >
      {paths[name]}
    </svg>
  );
}
