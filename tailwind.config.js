/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: {
          950: '#0B1120',
          900: '#111827',
          800: '#1B2333',
          700: '#293142',
        },
        paper: {
          50: '#FBFAF7',
          100: '#F4F2EC',
          200: '#E8E4D9',
        },
        signal: {
          amber: '#C77D2E',
          teal: '#1F6F6B',
          rust: '#B3452E',
        },
      },
      fontFamily: {
        display: ['"Fraunces"', 'ui-serif', 'Georgia', 'serif'],
        sans: ['"Inter"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      boxShadow: {
        card: '0 1px 2px rgba(11,17,32,0.06), 0 8px 24px -12px rgba(11,17,32,0.18)',
      },
    },
  },
  plugins: [],
}
