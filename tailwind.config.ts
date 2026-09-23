import type { Config } from 'tailwindcss';
const config: Config = {
  content: [
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        accent: { DEFAULT: '#0E7A55', soft: '#D9F0E4' },
        warning: '#E8B531',
        danger: '#B3382C',
        bg: { base: '#F4F7F5', elev1: '#FFFFFF', elev2: '#EEF3F0' },
        text: { primary: '#16201A', secondary: '#566459' },
        border: { DEFAULT: '#DBE2D9' },
      },
    },
  },
  plugins: [],
};
export default config;
