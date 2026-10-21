import { useDeviceTier } from './useDeviceTier';
import { useMediaQuery } from './useMediaQuery';

/**
 * True when the FULL (3D) layouts apply: FULL tier and at least 768 px wide.
 * Matches the CSS: html[data-tier='full'] + @media (min-width: 768px).
 * If someone forces FULL on a phone, the 2D layouts stay (with 3D behind).
 */
export function useFullLayout(): boolean {
  const { tier } = useDeviceTier();
  const wide = useMediaQuery('(min-width: 768px)');
  return tier === 'full' && wide;
}
