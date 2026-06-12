/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Manrope', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      colors: {
        brand: {
          DEFAULT: '#0176D3',
          deep: '#014486',
          soft: '#EAF5FE',
        },
        sidebar: {
          DEFAULT: '#032D60',
          hover: '#0B5CAB',
        },
        ink: {
          DEFAULT: '#181818',
          soft: '#444444',
          faint: '#747474',
        },
        rule: {
          DEFAULT: '#E5E5E5',
          soft: '#F0F0F0',
        },
        bg: '#F3F3F3',
        good: {
          DEFAULT: '#2E844A',
          soft: '#DEF5E5',
        },
        warn: {
          DEFAULT: '#B86C00',
          soft: '#FEF1DC',
        },
        bad: {
          DEFAULT: '#BA0517',
          soft: '#FEDED7',
        },
        purple: {
          DEFAULT: '#7F56D9',
          soft: '#F4EBFF',
        },
      },
      boxShadow: {
        sm: '0 1px 2px rgba(16, 24, 40, 0.04), 0 1px 1px rgba(16, 24, 40, 0.03)',
        md: '0 4px 12px rgba(16, 24, 40, 0.06), 0 2px 4px rgba(16, 24, 40, 0.04)',
      },
      borderRadius: {
        card: '8px',
        hero: '12px',
      },
      keyframes: {
        'rise-in': {
          '0%': { opacity: '0', transform: 'translateY(6px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        'rise-in': 'rise-in 0.5s ease-out both',
      },
      zIndex: {
        9999: '9999',
      },
    },
  },
  plugins: [],
};
