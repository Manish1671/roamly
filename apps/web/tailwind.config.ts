import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        roamly: {
          canvas: '#F7F4EF',
          navy: '#0F1B2D',
          teal: '#0D9488',
          'teal-muted': '#5EEAD4',
          stone: '#E8E2D9',
        },
      },
      fontFamily: {
        sans: ['var(--font-geist-sans)', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        soft: '0 18px 40px -28px rgba(15, 27, 45, 0.35)',
      },
    },
  },
  plugins: [],
};

export default config;
