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
        accent: { DEFAULT: '#3D6B4F', soft: '#EBF3EE', 2: '#5A9A6F', light: '#E8F2EB' },
        success: '#3D6B4F',
        warning: '#F59E0B',
        danger: '#EF4444',
        info: '#3D6B4F',
        bg: {
          base: '#F8F7F4',
          elev1: '#FFFFFF',
          elev2: '#F0EDE8',
          elev3: '#E8E4DD',
        },
        text: {
          primary: '#1A1A1A',
          secondary: '#5C5C5C',
          muted: '#9CA3AF',
        },
        border: {
          DEFAULT: 'rgba(0,0,0,0.07)',
          strong: 'rgba(0,0,0,0.12)',
        },
      },
    },
  },
  plugins: [],
};
export default config;
