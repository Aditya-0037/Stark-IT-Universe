import type { Config } from 'tailwindcss';

// Colours point at the CSS variables in src/styles/tokens.css, so the brand
// palette is defined in exactly one place.
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    screens: {
      sm: '640px',
      md: '768px',
      lg: '1024px',
      // Full header nav (fits EN and HI labels from here up).
      nav: '1280px',
      xl: '1280px',
      '2xl': '1440px',
    },
    extend: {
      colors: {
        night: 'var(--night-sky)',
        deep: 'var(--deep-space)',
        gold: 'var(--siu-gold)',
        ublue: 'var(--universe-blue)',
        orbit: 'var(--orbit)',
        paper: 'var(--paper)',
        fg: 'var(--fg)',
        muted: 'var(--fg-muted)',
        planet: {
          smartclass: 'var(--planet-smartclass)',
          ifp: 'var(--planet-ifp)',
          projector: 'var(--planet-projector)',
          laptop: 'var(--planet-laptop)',
          network: 'var(--planet-network)',
        },
      },
      fontFamily: {
        display: ['Unbounded', '"Unbounded Fallback"', '"Unbounded Fallback R"', 'system-ui', 'sans-serif'],
        body: ['Poppins', '"Poppins Fallback"', '"Poppins Fallback R"', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', '"JetBrains Mono Fallback"', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      maxWidth: {
        content: 'var(--content-max)',
      },
    },
  },
  plugins: [],
} satisfies Config;
