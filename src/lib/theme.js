/**
 * Infinity — Design Tokens (White / Blue brand redesign)
 * ------------------------------------------------------------------
 * Single canonical brand palette: white surfaces, blue brand accent,
 * black/near-black text and icon strokes. No purple, no pink — those
 * were leftover from an earlier direction and made buttons/icons look
 * like a mismatched, "attached" bolt-on instead of one consistent app.
 * Red is reserved for one meaning only: LIVE. Green/amber are kept as
 * universal, non-brand functional signals (success / warning), the
 * same way most mono-brand apps (Twitter, Facebook, LinkedIn) still
 * use them for status rather than identity.
 *
 * Usage in components:
 *   import { COLORS, TYPE, RADIUS } from '@/lib/theme';
 *   <div style={{ background: COLORS.surface, color: COLORS.textPrimary }}>...</div>
 * ------------------------------------------------------------------ */

export const COLORS = {
  // Surfaces
  bg: '#F5F8FF',          // app background — soft blue-white
  surface: '#FFFFFF',     // cards, composer, headers
  surfaceAlt: '#EEF3FE',  // media placeholders, inputs, pressed states
  surface1: '#FFFFFF',
  surface2: '#F3F6FD',
  surface3: '#EAF0FC',
  surface4: '#DCE7FB',

  // Brand / semantic — one canonical value per meaning
  brand: '#0B5FFF',           // primary blue — the one brand colour
  brandSecondary: '#083FB0',  // deeper blue, used only for gradient depth
  gradient: 'linear-gradient(135deg,#2E7BFF,#0B5FFF)',
  gradientBlue: 'linear-gradient(135deg,#2E7BFF,#0B5FFF)',
  info: '#0B5FFF',
  success: '#22C55E',
  warning: '#F59E0B',
  warningAlt: '#FBBF24',
  danger: '#EF4444',
  live: '#E11D2E',            // reserved exclusively for LIVE indicators

  // Text (dark-on-light now)
  textPrimary: '#0B0F19',
  textSecondary: 'rgba(11,15,25,0.65)',
  textTertiary: 'rgba(11,15,25,0.45)',
  textDisabled: 'rgba(11,15,25,0.3)',
  textOnBrand: '#FFFFFF',   // text placed on gradient/brand-colored surfaces stays white

  // Borders / dividers / low-emphasis fills
  border: 'rgba(11,95,255,0.12)',
  borderStrong: 'rgba(11,95,255,0.22)',
  overlaySubtle: 'rgba(11,95,255,0.05)',
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
  bg: '#070B14',
  surface: '#10151F',
  surfaceAlt: '#182031',
  surface1: '#10151F',
  surface2: '#182031',
  surface3: '#1F2A3F',
  surface4: '#28364F',

  brand: '#4E8CFF',
  brandSecondary: '#2E63D8',
  gradient: 'linear-gradient(135deg,#4E8CFF,#2E63D8)',
  gradientBlue: 'linear-gradient(135deg,#4E8CFF,#2E63D8)',
  info: '#4E8CFF',
  success: '#4ADE80',
  warning: '#FBBF24',
  warningAlt: '#FCD34D',
  danger: '#F87171',
  live: '#FF4D5E',

  textPrimary: '#F5F7FB',
  textSecondary: 'rgba(245,247,251,0.68)',
  textTertiary: 'rgba(245,247,251,0.48)',
  textDisabled: 'rgba(245,247,251,0.3)',
  textOnBrand: '#FFFFFF',

  border: 'rgba(78,140,255,0.18)',
  borderStrong: 'rgba(78,140,255,0.3)',
  overlaySubtle: 'rgba(78,140,255,0.08)',
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
