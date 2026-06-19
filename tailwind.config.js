/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // "Manifest" palette — travel-document vernacular.
        paper: {
          DEFAULT: '#f8f7f2', // document ground
          raised: '#fffefb', // tags, cards, raised surfaces
          sunk: '#f0eee6', // wells, grouped headers
        },
        ink: {
          DEFAULT: '#16202e', // passport-ink navy; primary text + dark surfaces
          soft: '#56616f', // secondary text
          faint: '#8b94a0', // tertiary / placeholder
        },
        line: '#e3dfd4', // warm hairline on paper
        vermilion: {
          DEFAULT: '#d83a2b', // airmail red — the one accent
          deep: '#b62c1e',
          soft: '#f7e3df',
        },
        airblue: {
          DEFAULT: '#1f5673', // stamp blue — secondary accent
          soft: '#dde9ef',
        },
        stamp: {
          DEFAULT: '#3a6b4f', // stamp green
          soft: '#dde9e1',
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
