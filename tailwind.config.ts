import type { Config } from 'tailwindcss';
const config: Config = {
  content: [
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
    './src/features/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        accent: { DEFAULT: '#FF2156', 2: '#9D4EDD' },
        success: '#2ED573',
        warning: '#FFB100',
        danger: '#FF453A',
        info: '#0A84FF',
        indigo: '#5E5CE6',
        gold: '#FFD60A',
        teal: { DEFAULT: '#00E6B4', 2: '#00A9D6' },
        bg: {
          base: '#0B0B0F',
          elev1: '#15151C',
          elev2: '#1C1C24',
          elev3: '#24242E',
        },
      },
    },
  },
  plugins: [],
};
export default config;
