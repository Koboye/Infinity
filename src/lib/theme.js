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

/**
 * ------------------------------------------------------------------
 * Dark Mode
 * ------------------------------------------------------------------
 * `COLORS` above is imported as a plain object and read as `COLORS.xxx` at
 * render time in ~8,000 lines of inline styles — there's no ThemeContext or
 * hook anywhere in the app. Rewriting every one of those call sites to read
 * from context is the "correct" long-term fix but is a multi-day project on
 * its own and too risky to do as a blind bulk edit.
 *
 * Instead: COLORS stays a single mutable object. Toggling theme does
 * Object.assign(COLORS, COLORS_DARK) — same object reference, new values —
 * then notifies subscribers so the app can force one re-render at the root.
 * Because nearly every component reads COLORS.xxx fresh on each render
 * (nothing memoizes style objects with an empty dep array), that single
 * root re-render cascades down and every surface repaints with the new
 * palette. The one exception is EnhancedVideoCard, which is wrapped in
 * React.memo — pass the `theme` value into it as a prop (even unused) so
 * memo's shallow-compare sees a change and re-renders it too.
 *
 * This does NOT persist per-tab isolation (two tabs share the mutated
 * object) and isn't a substitute for a real ThemeContext if you later want
 * scoped theming (e.g. previewing a theme without switching the whole app).
 * For a single-user PWA this tradeoff is reasonable.
 */
export const COLORS_LIGHT = { ...COLORS };

export const COLORS_DARK = {
  bg: '#0F0D17',
  surface: '#1A1725',
  surfaceAlt: '#241F33',
  surface1: '#1A1725',
  surface2: '#241F33',
  surface3: '#2E2740',
  surface4: '#3A3050',

  brand: '#A78BFA',
  brandSecondary: '#F472B6',
  gradient: 'linear-gradient(135deg,#A78BFA,#F472B6)',
  gradientBlue: 'linear-gradient(135deg,#818CF8,#60A5FA)',
  info: '#60A5FA',
  success: '#4ADE80',
  warning: '#FBBF24',
  warningAlt: '#FCD34D',
  danger: '#F87171',

  textPrimary: '#F3F1FA',
  textSecondary: 'rgba(243,241,250,0.68)',
  textTertiary: 'rgba(243,241,250,0.48)',
  textDisabled: 'rgba(243,241,250,0.3)',
  textOnBrand: '#0F0D17',

  border: 'rgba(167,139,250,0.16)',
  borderStrong: 'rgba(167,139,250,0.28)',
  overlaySubtle: 'rgba(167,139,250,0.08)',
};

const THEME_STORAGE_KEY = 'infinity_theme';
let themeListeners = [];

export const subscribeTheme = (fn) => {
  themeListeners.push(fn);
  return () => { themeListeners = themeListeners.filter(l => l !== fn); };
};

export const getStoredTheme = () => {
  if (typeof window === 'undefined') return 'light';
  try { return localStorage.getItem(THEME_STORAGE_KEY) === 'dark' ? 'dark' : 'light'; }
  catch { return 'light'; }
};

// Mutates the shared COLORS object in place and notifies subscribers. Call once on
// mount (with the stored preference) and again on every toggle.
export const applyTheme = (theme) => {
  Object.assign(COLORS, theme === 'dark' ? COLORS_DARK : COLORS_LIGHT);
  if (typeof window !== 'undefined') {
    try { localStorage.setItem(THEME_STORAGE_KEY, theme); } catch {}
  }
  themeListeners.forEach(fn => { try { fn(theme); } catch {} });
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
