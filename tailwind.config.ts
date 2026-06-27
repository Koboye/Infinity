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
        accent: { DEFAULT: '#6B4EFF', soft: '#EEE9FF', 2: '#9D7BFF' },
        success: '#10B981',
        warning: '#F59E0B',
        danger: '#EF4444',
        info: '#3B82F6',
        bg: {
          base: '#F5F5F7',
          elev1: '#FFFFFF',
          elev2: '#F0EFF4',
          elev3: '#E8E7EE',
        },
        text: {
          primary: '#0D0D12',
          secondary: '#6B7280',
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
