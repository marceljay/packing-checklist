/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // "Manifest" palette — travel-document vernacular. Driven by CSS
        // variables (channels in `index.css`) so a `.dark` theme can repaint
        // every surface without touching component classes.
        paper: {
          DEFAULT: 'rgb(var(--paper) / <alpha-value>)', // document ground
          raised: 'rgb(var(--paper-raised) / <alpha-value>)', // tags, cards
          sunk: 'rgb(var(--paper-sunk) / <alpha-value>)', // wells, headers
        },
        ink: {
          DEFAULT: 'rgb(var(--ink) / <alpha-value>)', // primary text
          soft: 'rgb(var(--ink-soft) / <alpha-value>)', // secondary text
          faint: 'rgb(var(--ink-faint) / <alpha-value>)', // tertiary / placeholder
        },
        line: 'rgb(var(--line) / <alpha-value>)', // hairline
        vermilion: {
          DEFAULT: 'rgb(var(--vermilion) / <alpha-value>)', // the one accent
          deep: 'rgb(var(--vermilion-deep) / <alpha-value>)',
          soft: 'rgb(var(--vermilion-soft) / <alpha-value>)',
        },
        airblue: {
          DEFAULT: 'rgb(var(--airblue) / <alpha-value>)', // secondary accent
          soft: 'rgb(var(--airblue-soft) / <alpha-value>)',
        },
        stamp: {
          DEFAULT: 'rgb(var(--stamp) / <alpha-value>)',
          soft: 'rgb(var(--stamp-soft) / <alpha-value>)',
        },
        // Boarding-pass "ticket" stock + its print colour. Swappable per design
        // (see `.ticket--*` in index.css); both themes resolve via CSS vars.
        ticket: {
          DEFAULT: 'rgb(var(--ticket) / <alpha-value>)',
          ink: 'rgb(var(--ticket-ink) / <alpha-value>)',
        },
      },
      fontFamily: {
        display: ['"Space Grotesk"', 'system-ui', 'sans-serif'],
        sans: ['"Space Grotesk"', 'system-ui', 'sans-serif'],
        mono: ['"Space Mono"', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      boxShadow: {
        tag: '0 1px 2px rgba(22,32,46,0.06), 0 8px 24px -12px rgba(22,32,46,0.18)',
        pass: '0 2px 0 rgba(22,32,46,0.04), 0 16px 40px -20px rgba(22,32,46,0.28)',
      },
      letterSpacing: {
        code: '0.18em',
      },
      keyframes: {
        stampIn: {
          '0%': { transform: 'scale(0.4) rotate(-8deg)', opacity: '0' },
          '60%': { transform: 'scale(1.08) rotate(-8deg)', opacity: '1' },
          '100%': { transform: 'scale(1) rotate(-8deg)', opacity: '1' },
        },
      },
      animation: {
        stampIn: 'stampIn 0.22s ease-out',
      },
    },
  },
  plugins: [],
};
