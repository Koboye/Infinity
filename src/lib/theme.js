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
  brandLight: '#2E7BFF',      // gradient's lighter stop — also used standalone
                              // (e.g. the story-ring accent), so it gets its own name
                              // instead of only ever existing inside a gradient string
  brandSecondary: '#083FB0',  // deeper blue, used only for gradient depth
  // Same value as `brand` in light mode, but a separate name so dark mode can
  // point it somewhere else (see COLORS_DARK) without touching every other
  // `brand` call site. Use this specifically where white text/numerals sit
  // directly on a solid brand-colored fill (avatar initials, unread-count
  // badges) — those need the 4.5:1 AA text ratio, not the looser 3:1 non-text
  // ratio that plain icon glyphs and toggle fills get away with.
  brandTextFill: '#0B5FFF',
  gradient: 'linear-gradient(135deg,#2E7BFF,#0B5FFF)',
  gradientBlue: 'linear-gradient(135deg,#2E7BFF,#0B5FFF)',
  info: '#0B5FFF',
  success: '#22C55E',
  warning: '#F59E0B',
  warningAlt: '#FBBF24',
  danger: '#EF4444',
  // `success`/`warning`/`danger` above are tuned for pills, icon fills, and
  // borders (3:1 non-text minimum) and read as washed-out at small text sizes
  // — 2.28:1 / 2.15:1 / 3.76:1 against white, all below the 4.5:1 AA text
  // minimum. These darker variants are for `color:` (actual text) only; keep
  // using the originals for backgrounds/icons/borders.
  successText: '#15803D',
  warningText: '#B45309',
  dangerText: '#DC2626',
  live: '#E11D2E',            // reserved exclusively for LIVE indicators
  liveSecondary: '#B3121F',   // second stop of the live gradient, pairs with `live`
  currency: '#FFD60A',        // coins / gifts / premium — the one recurring gold semantic

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
  // #4E8CFF (plain `brand`) only hits 3.22:1 against white text in dark mode —
  // fails the 4.5:1 AA text minimum even though it's fine for icons/borders
  // (3:1 non-text minimum). brandSecondary hits 5.4:1, so text/numerals that
  // sit directly on a brand fill use this token instead in dark mode.
  brandTextFill: '#2E63D8',
  gradient: 'linear-gradient(135deg,#4E8CFF,#2E63D8)',
  gradientBlue: 'linear-gradient(135deg,#4E8CFF,#2E63D8)',
  info: '#4E8CFF',
  success: '#4ADE80',
  warning: '#FBBF24',
  warningAlt: '#FCD34D',
  danger: '#F87171',
  // Unlike light mode, these already clear 4.5:1 against dark surfaces
  // (6.6:1–10.9:1), so text just reuses the same values here.
  successText: '#4ADE80',
  warningText: '#FBBF24',
  dangerText: '#F87171',
  live: '#FF4D5E',
  liveSecondary: '#C41F30',
  currency: '#FFDE59',

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
    // BUG FIX: the app's own components (COLORS.xxx read in inline styles) repainted
    // fine on toggle, but <html>/<body> background was a hardcoded hex in globals.css
    // and never got the memo — so the strip behind/around the app (overscroll bounce,
    // safe-area insets, any gap before the app tree mounts) stayed light-mode white
    // even after switching to dark. This looked exactly like "theme change doesn't
    // work" even though every in-app surface actually had switched correctly.
    // Setting a CSS custom property here (read by globals.css via var(--app-bg)) keeps
    // the document-level background in sync with COLORS.bg on every toggle.
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

// 8pt-based spacing scale. Use SPACING.md for default gaps/padding instead of
// reaching for an arbitrary pixel number — keeps rhythm consistent across
// cards, lists, and sheets that currently each pick their own values.
export const SPACING = {
  xs: 4, sm: 8, md: 12, lg: 16, xl: 20, '2xl': 24, '3xl': 32, '4xl': 40, '5xl': 56,
};

/**
 * Legacy shadow/transition scale — this used to be a SECOND, separate copy
 * defined locally inside Infinity.jsx (SHADOW / EASE / TRANSITION / a dead
 * `pressable` helper), completely disconnected from ELEVATION/MOTION below.
 * That's real token drift: two places defining "what a card shadow looks
 * like" that could silently disagree. Moved here as the single source so
 * Infinity.jsx imports instead of redefining. Values are UNCHANGED from the
 * original — this is a source-of-truth fix, not a visual change. Migrating
 * every call site onto the canonical ELEVATION/MOTION scale is a separate,
 * visually-verified phase (see ROADMAP.md Phase A) since it does change
 * rendered pixels and needs a running app to check.
 */
export const SHADOW = {
  xs: '0 1px 2px rgba(20,16,32,0.06)',
  sm: '0 2px 8px rgba(20,16,32,0.07)',
  card: '0 4px 16px rgba(20,16,32,0.08), 0 1px 3px rgba(20,16,32,0.06)',
  raised: '0 8px 28px rgba(20,16,32,0.12), 0 2px 6px rgba(20,16,32,0.07)',
  modal: '0 24px 64px rgba(12,10,20,0.28), 0 4px 16px rgba(12,10,20,0.14)',
  glow: (color) => `0 4px 20px ${color}40`,
};
export const EASE = 'cubic-bezier(0.22, 1, 0.36, 1)';
export const TRANSITION = {
  fast: `all 0.15s ${EASE}`,
  base: `all 0.22s ${EASE}`,
  slow: `all 0.35s ${EASE}`,
};
// NOTE: the old `pressable` export was dead code (zero call sites in
// Infinity.jsx) and has been dropped rather than moved.

/**
 * Elevation / shadow scale. Dark mode shadows use higher opacity black
 * (rather than just "less shadow") because on dark surfaces a soft light-mode
 * shadow all but disappears — this keeps the same *perceived* lift at every
 * level in both themes rather than flattening dark mode.
 */
export const ELEVATION = {
  light: {
    0: 'none',
    1: '0 1px 2px rgba(11,15,25,0.06)',
    2: '0 2px 8px rgba(11,15,25,0.08)',
    3: '0 6px 20px rgba(11,15,25,0.10)',
    4: '0 12px 32px rgba(11,15,25,0.14)',
    5: '0 24px 56px rgba(11,15,25,0.18)',
  },
  dark: {
    0: 'none',
    1: '0 1px 2px rgba(0,0,0,0.4)',
    2: '0 2px 8px rgba(0,0,0,0.45)',
    3: '0 6px 20px rgba(0,0,0,0.5)',
    4: '0 12px 32px rgba(0,0,0,0.55)',
    5: '0 24px 56px rgba(0,0,0,0.6)',
  },
};

/**
 * Motion tokens — durations, easings, and spring presets. Nothing in the app
 * currently references these; components hand-write transition strings
 * per-callsite. This is the foundation Phase 4 (motion language) builds on:
 * swap hand-written durations/easings for these so a page transition and a
 * sheet transition feel like the same product instead of coincidentally
 * similar numbers.
 */
export const MOTION = {
  duration: {
    instant: 100,   // micro feedback: tap states, ripples
    fast: 180,       // small UI: toggles, chips, icon state changes
    base: 240,       // default: cards, buttons, most transitions
    slow: 320,       // sheets, modals, page-level transitions
    slower: 480,     // hero/shared-element transitions, celebrations
  },
  easing: {
    standard: 'cubic-bezier(0.4, 0, 0.2, 1)',   // default in/out
    decelerate: 'cubic-bezier(0, 0, 0.2, 1)',   // entering the screen
    accelerate: 'cubic-bezier(0.4, 0, 1, 1)',   // leaving the screen
    emphasized: 'cubic-bezier(0.2, 0, 0, 1)',   // hero/shared-element moves
  },
  spring: {
    // { stiffness, damping, mass } — tuned for use with Framer Motion or
    // manual spring implementations.
    default: { stiffness: 300, damping: 30, mass: 1 },
    snappy: { stiffness: 420, damping: 32, mass: 0.9 },
    gentle: { stiffness: 200, damping: 26, mass: 1 },
    bouncy: { stiffness: 340, damping: 18, mass: 1 }, // celebrations, gifts, achievements only — not for chrome/navigation
  },
};

// Icon sizing scale — keeps icon weight consistent relative to the type scale.
export const ICON_SIZE = {
  xs: 14, sm: 16, md: 20, lg: 24, xl: 28, '2xl': 36,
};

/**
 * Z-index scale — Phase B stacking audit (round 7).
 *
 * Previously the app had no central stacking order: 73 components each picked
 * their own bare z-index (ranging 1–10500), which produced real inversions —
 * e.g. CreateStoryModal (3500) rendered *below* the StoriesPage (4000) it opens
 * on top of, IncomingCallScreen (3000) could get buried under a comments sheet
 * (5000), and Toast (already tokenized at 500) sat under nearly every modal in
 * the app despite this same file's comment claiming it should be "above
 * everything else."
 *
 * Every full-screen/root-level overlay component now pulls from this scale.
 * Small z-index values used *inside* an already-fixed/absolute parent (e.g.
 * header/footer layering within TelegramStoryViewer, or a dropdown nested in
 * ModerationPage) are intentionally left as local literals — they only
 * compete with siblings in their own stacking context, so centralizing them
 * would add risk with no benefit.
 */
export const Z = {
  base: 0,
  stickyHeader: 10,    // bottom tab bar — above scrolling content, below any overlay
  page: 100,           // full-screen views that replace the current tab (Search,
                       // Discover, Stories, Live, Saved Posts, Notifications,
                       // Sound Library, Analytics, QR, Broadcast, Inbox thread, etc.)
  drawer: 200,         // side/bottom drawers anchored to an edge (profile nav
                       // drawer, save-confirm sheet). Use `Z.drawer + 1` for a
                       // sibling element that must render above a drawer's own
                       // backdrop (see InfinityV1app's profile drawer).
  popover: 300,        // dropdowns, small action menus, floating action buttons
  modal: 400,          // bottom sheets / centered dialogs that block a page
                       // (comments, likes, share, donation, report, post
                       // options, edit profile, create-story, quick-view chat)
  toast: 500,          // toasts, notif popups — always above any page/drawer/modal
  confirmDialog: 600,  // window.confirm() replacement — must sit above a toast
                       // that happens to be showing when it opens
  systemBanner: 700,   // offline banner — always visible regardless of what's open
  call: 800,           // incoming-call screen + active CallModal — by design,
                       // an in-progress or ringing call outranks everything,
                       // including system banners and toasts
};

/**
 * ------------------------------------------------------------------
 * Avatar color palette
 * ------------------------------------------------------------------
 * Fallback ("initials") avatars used to get `hsl(random 0-360, 70%, 60%)`
 * assigned at account/group creation. That meant any hue at all — including
 * oranges, greens, purples — could show up next to each other in a single
 * chat list, clashing with the app's single-brand blue/white design system
 * described above. This is the same palette already offered in the "Profile
 * color" picker (EditProfileModal), so a fallback avatar and a deliberately
 * chosen one are visually indistinguishable.
 *
 * Colors are assigned deterministically (hashed from the user/group id), not
 * randomly, so the same account always renders with the same color instead
 * of flickering between hues on every reload.
 */
export const AVATAR_PALETTE = [
  '#0B5FFF', '#2E7BFF', '#083FB0', '#00A9D6',
  '#5E5CE6', '#2ED573', '#5CA0FF', '#FFB100',
];

const hashSeed = (seed) => {
  const str = String(seed || 'user');
  let h = 0;
  for (let i = 0; i < str.length; i++) { h = (h * 31 + str.charCodeAt(i)) | 0; }
  return Math.abs(h);
};

// Pick a stable, on-brand color for a given id/username. Use this instead of
// `Math.random()` anywhere a new user/group avatar color is generated.
export const pickAvatarColor = (seed) => AVATAR_PALETTE[hashSeed(seed) % AVATAR_PALETTE.length];

// Normalize a stored avatarColor value for display:
// - Legacy `hsl(...)` values (the old random generator) are replaced with a
//   stable on-brand palette color, keyed off `seed` so it doesn't shift on
//   every render.
// - Any other value (a hex the person deliberately picked in Edit Profile,
//   or already-migrated data) is left untouched.
// - Missing/falsy values fall back to a palette color too.
export const resolveAvatarColor = (color, seed) => {
  if (!color || (typeof color === 'string' && color.startsWith('hsl('))) {
    return pickAvatarColor(seed);
  }
  return color;
};
