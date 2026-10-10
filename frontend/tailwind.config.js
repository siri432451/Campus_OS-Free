/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        navy: '#1A3C5E',
        purple: {
          DEFAULT: '#7B5EA7',
          light: '#9B6FD4',
          pale: '#EDE9F6',
        },
        campusblue: '#2E86DE',
        success: '#27AE60',
        warning: '#E67E22',
        danger: '#E74C3C',
        bg: '#F5F7FA',
        // Institutional redesign tokens (additive — existing colors above are untouched)
        ink: '#14261B',
        field: '#1B4332',
        deep: '#122400',
        moss: '#E2ECE3',
        mossline: '#C7D6C9',
        golddark: '#B8863B',
        goldlight: '#C99A44',
        goldbg: '#F6EDDD',
        text2: '#4C5C50',
        greenok: '#1E5C34',
        greenokbg: '#DCEEE1',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        // Institutional redesign tokens — opt-in, existing 'sans' untouched
        display: ['Fraunces', 'serif'],
        plexmono: ['"IBM Plex Mono"', 'monospace'],
      }
    },
  },
  plugins: [],
}
