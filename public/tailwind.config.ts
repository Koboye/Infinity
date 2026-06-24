/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
    './src/features/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Single source of truth for the Dagu brand palette.
        // Migrated from the original inline CSS variables.
        accent: { DEFAULT: '#FF2156', 2: '#9D4EDD' },
        success: '#2ED573',
        warning: '#FFB100',
        danger: '#FF453A',
        info: '#0A84FF',
        indigo: '#5E5CE6',
        gold: '#FFD60A',
        teal: { DEFAULT: '#00E6B4', 2: '#00A9D6' },
        verified: '#2F9BFF',
        bg: {
          base: '#0B0B0F',
          elev1: '#15151C',
          elev2: '#1C1C24',
          elev3: '#24242E',
        },
        border: { strong: '#34343E' },
        muted: '#5A5A66',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
      animation: {
        'slide-up': 'slideUp 0.3s ease',
        'slide-down': 'slideDown 0.3s ease',
        'pop-in': 'popIn 0.2s ease',
        'heart-burst': 'heartBurst 0.9s ease forwards',
        'float-up': 'floatUp 1.5s ease forwards',
        'shimmer': 'shimmer 1.5s infinite',
        'pulse': 'pulse 2s infinite',
      },
      keyframes: {
        slideUp: { from: { transform: 'translateY(100%)', opacity: '0' }, to: { transform: 'translateY(0)', opacity: '1' } },
        slideDown: { from: { transform: 'translateY(-20px)', opacity: '0' }, to: { transform: 'translateY(0)', opacity: '1' } },
        popIn: { '0%': { transform: 'scale(0.8)', opacity: '0' }, '70%': { transform: 'scale(1.05)' }, '100%': { transform: 'scale(1)', opacity: '1' } },
        heartBurst: { '0%': { transform: 'scale(0.4) translateY(0)', opacity: '1' }, '100%': { transform: 'scale(1.8) translateY(-80px)', opacity: '0' } },
        floatUp: { '0%': { transform: 'translateY(0) scale(1)', opacity: '1' }, '100%': { transform: 'translateY(-120px) scale(1.5)', opacity: '0' } },
        shimmer: { '0%': { backgroundPosition: '-200% 0' }, '100%': { backgroundPosition: '200% 0' } },
        pulse: { '0%,100%': { opacity: '1' }, '50%': { opacity: '0.4' } },
      },
    },
  },
  plugins: [],
};
