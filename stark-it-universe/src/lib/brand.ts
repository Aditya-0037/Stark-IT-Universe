import { brandFiles } from 'virtual:siu-assets';

/**
 * Brand files from /public/brand. When a file is missing the UI draws a
 * placeholder instead (see components/BrandLogo.tsx and
 * components/illustrations/EmblemPlaceholder.tsx).
 */
const file = (name: string) => (brandFiles.includes(name) ? `/brand/${name}` : null);

export const brand = {
  /** For light backgrounds. */
  headerLogo: file('siu-header-logo.svg'),
  /** For dark backgrounds. */
  headerLogoDark: file('siu-header-logo-dark.svg'),
  emblemAnimated: file('siu-emblem-animated.svg'),
  appIcon: file('siu-app-icon.svg'),
};
