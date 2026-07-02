/**
 * Infinity — Design Tokens (Light / Couples redesign)
 * ------------------------------------------------------------------
 * Replaces the old dark TikTok-style palette with the light,
 * purple → pink → blue card-based look from the approved mockup.
 *
 * Usage in components:
 *   import { COLORS, TYPE, RADIUS } from '@/lib/theme';
 *   <div style={{ background: COLORS.surface, color: COLORS.textPrimary }}>...</div>
 * ------------------------------------------------------------------ */

export const COLORS = {
  // Surfaces
  bg: '#F7F5FC',          // app background — soft lavender-white
  surface: '#FFFFFF',     // cards, composer, headers
  surfaceAlt: '#F1ECFB',  // media placeholders, inputs, pressed states
  surface1: '#FFFFFF',
  surface2: '#F5F1FB',
  surface3: '#EFE8FA',
  surface4: '#E4DAF5',

  // Brand / semantic — one canonical value per meaning
  brand: '#8B5CF6',           // primary violet (was #FF2156)
  brandSecondary: '#EC4899',  // pink (was #9D4EDD)
  gradient: 'linear-gradient(135deg,#8B5CF6,#EC4899)',
  gradientBlue: 'linear-gradient(135deg,#6366F1,#3B82F6)',
  info: '#3B82F6',
  success: '#22C55E',
  warning: '#F59E0B',
  warningAlt: '#FBBF24',
  danger: '#EF4444',

  // Text (dark-on-light now)
  textPrimary: '#1E1B2E',
  textSecondary: 'rgba(30,27,46,0.65)',
  textTertiary: 'rgba(30,27,46,0.45)',
  textDisabled: 'rgba(30,27,46,0.3)',
  textOnBrand: '#FFFFFF',   // text placed on gradient/brand-colored surfaces stays white

  // Borders / dividers / low-emphasis fills
  border: 'rgba(139,92,246,0.12)',
  borderStrong: 'rgba(139,92,246,0.22)',
  overlaySubtle: 'rgba(139,92,246,0.05)',
};

// Type scale
export const TYPE = {
  xs: 11, sm: 12, base: 13, md: 14, lg: 16, xl: 18,
  '2xl': 20, '3xl': 24, '4xl': 28, '5xl': 32, '6xl': 40, '7xl': 48,
  display: 64, displayLg: 80,
};

export const RADIUS = {
  sm: 8, md: 14, lg: 20, xl: 24, pill: 999,
};
