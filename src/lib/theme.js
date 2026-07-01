/**
 * Infinity — Design Tokens
 * ------------------------------------------------------------------
 * Single source of truth for color + type scale, extracted from the
 * dark UI actually shipping in Infinity.jsx (the light/green palette
 * previously sitting unused in tailwind.config.ts has been retired —
 * it didn't match anything on screen).
 *
 * Usage in components:
 *   import { COLORS, TYPE } from '@/lib/theme';
 *   <span style={{ color: COLORS.textSecondary, fontSize: TYPE.sm }}>...</span>
 *
 * This file doesn't change any existing UI by itself — it's the
 * target that Infinity.jsx's inline styles have been consolidated
 * toward. Prefer these tokens over new raw hex/rgba values going
 * forward so the palette doesn't drift again.
 * ------------------------------------------------------------------ */

export const COLORS = {
  // Surfaces
  bg: '#0B0B0F',
  surface1: '#15151C',
  surface2: '#1C1C24',
  surface3: '#24242E',
  surface4: '#34343E',

  // Brand / semantic — one canonical value per meaning.
  // Previously split across multiple near-duplicate hexes:
  brand: '#FF2156',      // was also #FF453A, #FF3B5C
  brandSecondary: '#9D4EDD',
  info: '#0A84FF',       // was also #2F9BFF, #00A9D6, #5E5CE6
  success: '#2ED573',    // was also #00E6B4
  warning: '#FFB100',
  warningAlt: '#FFD60A',

  // Text (white-on-dark, opacity scale kept to WCAG-AA-safe steps
  // for anything that's actually read, not just decorative)
  textPrimary: '#FFFFFF',
  textSecondary: 'rgba(255,255,255,0.7)',  // ~9.2:1 — body/secondary copy
  textTertiary: 'rgba(255,255,255,0.55)',  // ~5.3:1 — minimum for readable small text
  textDisabled: 'rgba(255,255,255,0.35)',  // decorative/disabled only, not for content

  // Borders / dividers / low-emphasis fills — fine at low opacity,
  // these are not text so WCAG text-contrast rules don't apply.
  border: 'rgba(255,255,255,0.08)',
  borderStrong: 'rgba(255,255,255,0.12)',
  overlaySubtle: 'rgba(255,255,255,0.04)',
};

// Type scale — collapse the ~27 ad-hoc font sizes found in Infinity.jsx
// down to this set. Anything below 11 was a usability floor violation
// on mobile and has been raised to 11.
export const TYPE = {
  xs: 11,   // was 9, 10, 11
  sm: 12,   // was 12
  base: 13, // was 13
  md: 14,   // was 14, 15
  lg: 16,   // was 16, 17
  xl: 18,   // was 18, 19
  '2xl': 20,
  '3xl': 24, // was 22, 24
  '4xl': 28, // was 26, 28
  '5xl': 32, // was 30, 32
  '6xl': 40, // was 36, 38, 40
  '7xl': 48, // was 42, 44, 48
  display: 64,
  displayLg: 80,  // was 80, 90
};

export const RADIUS = {
  sm: 8,
  md: 14,
  lg: 20,
  xl: 24,
  pill: 999,
};
