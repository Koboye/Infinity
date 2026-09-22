/**
 * Gebeya Link — Design Tokens (Green / Gold / Red)
 * ------------------------------------------------------------------
 * Same token shape as Infinity (COLORS, TYPE, RADIUS, SHADOW, Z ...) so the
 * code reads the same, but the palette follows the Gebeya Link design:
 *   Green = main action, money in, stock fine
 *   Gold  = warning, low stock, due soon
 *   Red   = overdue, out of stock, money you owe
 * Colour never carries meaning alone — every status also has a word or number.
 *
 * Usage:
 *   import { COLORS, TYPE, RADIUS } from '@/lib/theme';
 *   <div style={{ background: COLORS.surface, color: COLORS.textPrimary }}>...</div>
 * ------------------------------------------------------------------ */

export const COLORS = {
  // Surfaces
  bg: '#F4F7F2',
  surface: '#FFFFFF',
  surfaceAlt: '#EDF2EB',   // fields, cards, pressed states

  // Brand (green)
  brand: '#1E6B45',
  brandSoft: '#D9EEE2',
  brandTextFill: '#1E6B45', // solid fill that carries white text
  textOnBrand: '#FFFFFF',

  // Warning (gold)
  warning: '#E8B531',
  warningSoft: '#FAEFC8',
  warningText: '#7A5B00',
  textOnWarning: '#2A2000',

  // Danger (red)
  danger: '#B3382C',
  dangerSoft: '#F7DCD8',
  dangerText: '#B3382C',

  success: '#1E6B45',
  successText: '#1E6B45',

  // Text
  textPrimary: '#16201A',
  textSecondary: '#566459',
  textTertiary: '#7C8A7F',

  // Lines / overlays
  border: '#DBE2D9',
  borderStrong: '#C4CEC2',
  overlay: 'rgba(22,32,26,0.5)',
};

export const COLORS_LIGHT = { ...COLORS };

export const COLORS_DARK = {
  bg: '#0F1511',
  surface: '#172019',
  surfaceAlt: '#1F2B21',

  brand: '#2E8A5C',
  brandSoft: '#1C3A29',
  brandTextFill: '#25784F',
  textOnBrand: '#FFFFFF',

  warning: '#E8B531',
  warningSoft: '#3A3212',
  warningText: '#E8B531',
  textOnWarning: '#2A2000',

  danger: '#E5786C',
  dangerSoft: '#402019',
  dangerText: '#E5786C',

  success: '#4FBF83',
  successText: '#4FBF83',

  textPrimary: '#EBF1EB',
  textSecondary: '#9AA99D',
  textTertiary: '#748578',

  border: '#2B382D',
  borderStrong: '#3A4A3D',
  overlay: 'rgba(0,0,0,0.6)',
};

/**
 * Dark mode — same approach as Infinity: COLORS stays one mutable object,
 * applyTheme() Object.assign()s the new palette into it and notifies
 * subscribers so the root re-renders once and every surface repaints.
 */
const THEME_STORAGE_KEY = 'gebeya_theme';
let themeListeners = [];

export const subscribeTheme = (fn) => {
  themeListeners.push(fn);
  return () => { themeListeners = themeListeners.filter((l) => l !== fn); };
};

export const getStoredTheme = () => {
  if (typeof window === 'undefined') return 'light';
  try {
    const saved = localStorage.getItem(THEME_STORAGE_KEY);
    if (saved) return saved === 'dark' ? 'dark' : 'light';
    return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  } catch { return 'light'; }
};

export const applyTheme = (theme) => {
  Object.assign(COLORS, theme === 'dark' ? COLORS_DARK : COLORS_LIGHT);
  if (typeof window !== 'undefined') {
    try { localStorage.setItem(THEME_STORAGE_KEY, theme); } catch {}
    try {
      document.documentElement.style.setProperty('--app-bg', COLORS.bg);
      let meta = document.querySelector('meta[name="theme-color"]');
      if (!meta) {
        meta = document.createElement('meta');
        meta.setAttribute('name', 'theme-color');
        document.head.appendChild(meta);
      }
      meta.setAttribute('content', COLORS.bg);
    } catch {}
  }
  themeListeners.forEach((fn) => { try { fn(theme); } catch {} });
};

// Type scale — 14px+ for real screens, per the design rules.
export const TYPE = {
  xs: 12, sm: 13, base: 14, md: 15, lg: 17, xl: 20,
  '2xl': 22, '3xl': 26, '4xl': 32, '5xl': 40,
};

export const RADIUS = { sm: 8, md: 12, lg: 16, xl: 24, pill: 999 };

export const SPACING = {
  xs: 4, sm: 8, md: 12, lg: 16, xl: 20, '2xl': 24, '3xl': 32,
};

export const SHADOW = {
  xs: '0 1px 2px rgba(22,32,26,0.06)',
  sm: '0 2px 8px rgba(22,32,26,0.08)',
  card: '0 4px 16px rgba(22,32,26,0.08)',
  modal: '0 24px 64px rgba(12,20,14,0.3)',
};

export const EASE = 'cubic-bezier(0.22, 1, 0.36, 1)';
export const TRANSITION = {
  fast: `all 0.15s ${EASE}`,
  base: `all 0.22s ${EASE}`,
};

export const MOTION = {
  duration: { instant: 100, fast: 180, base: 240, slow: 320, slower: 480 },
  easing: {
    standard: 'cubic-bezier(0.4, 0, 0.2, 1)',
    decelerate: 'cubic-bezier(0, 0, 0.2, 1)',
    accelerate: 'cubic-bezier(0.4, 0, 1, 1)',
    emphasized: 'cubic-bezier(0.2, 0, 0, 1)',
  },
  spring: {
    default: { stiffness: 300, damping: 30, mass: 1 },
    snappy: { stiffness: 420, damping: 32, mass: 0.9 },
    gentle: { stiffness: 200, damping: 26, mass: 1 },
    bouncy: { stiffness: 340, damping: 18, mass: 1 },
  },
};

// Z-index scale — one stacking order for the whole app.
export const Z = {
  base: 0,
  tabBar: 10,
  page: 100,
  sheet: 300,
  toast: 500,
  confirmDialog: 600,
  banner: 700,
  lock: 800,
};
