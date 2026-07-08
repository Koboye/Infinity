/**
 * ------------------------------------------------------------------
 * Motion language — framer-motion variants built on MOTION tokens
 * ------------------------------------------------------------------
 * framer-motion has been a dependency (package.json) with ZERO import sites
 * anywhere in the app. Every current transition is a hand-written CSS
 * `transition:` string or a `@keyframes` block in GlobalStyles, tuned
 * per-component. That's why a sheet, a modal, and a toast each move with a
 * slightly different feel even though they're conceptually the same kind of
 * "enter from below" motion.
 *
 * This file is the single place that turns MOTION.duration / MOTION.easing /
 * MOTION.spring (theme.js) into ready-to-use framer-motion variants, so a
 * sheet transition and a page transition share the same physics because
 * they share the same token, not because someone matched numbers by eye.
 *
 * Usage:
 *   import { motion, AnimatePresence } from 'framer-motion';
 *   import { sheetVariants, fadeVariants } from '@/lib/motion';
 *   <AnimatePresence>
 *     {open && (
 *       <motion.div variants={sheetVariants} initial="hidden" animate="visible" exit="hidden">
 *         ...
 *       </motion.div>
 *     )}
 *   </AnimatePresence>
 *
 * Migrating every existing CSS-animation call site onto these variants is
 * intentionally NOT done in this pass — see ROADMAP.md Phase A. That's a
 * per-component visual change that needs a running app to verify; this file
 * only establishes the shared vocabulary so each future migration pulls
 * from one place instead of hand-tuning again.
 */
import { MOTION } from './theme';

// Spring transition presets, ready to drop into a `transition` prop.
export const springs = {
  default: { type: 'spring', ...MOTION.spring.default },
  snappy: { type: 'spring', ...MOTION.spring.snappy },
  gentle: { type: 'spring', ...MOTION.spring.gentle },
  bouncy: { type: 'spring', ...MOTION.spring.bouncy }, // celebrations/gifts/achievements only
};

// Duration-based transition presets (for opacity/color moves that don't
// want spring bounce — e.g. a backdrop fade).
export const durations = {
  instant: { duration: MOTION.duration.instant / 1000, ease: [0.4, 0, 0.2, 1] },
  fast: { duration: MOTION.duration.fast / 1000, ease: [0.4, 0, 0.2, 1] },
  base: { duration: MOTION.duration.base / 1000, ease: [0.4, 0, 0.2, 1] },
  slow: { duration: MOTION.duration.slow / 1000, ease: [0, 0, 0.2, 1] },
  slower: { duration: MOTION.duration.slower / 1000, ease: [0.2, 0, 0, 1] },
};

// Backdrop / scrim fade — behind any sheet, modal, or full-screen overlay.
export const backdropVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: durations.base },
};

// Bottom sheet — the app's most common overlay pattern (Chat Info, Share,
// Confirm, Post Options, composer pickers). Slides up with a gentle spring,
// dismisses with a plain fade+drop so it doesn't bounce on the way out.
export const sheetVariants = {
  hidden: { y: '100%', opacity: 1 },
  visible: { y: 0, opacity: 1, transition: springs.gentle },
  exit: { y: '100%', transition: durations.base },
};

// Centered modal / dialog (confirm, verification, upgrade prompts) — scale
// + fade rather than slide, since it's not anchored to a screen edge.
export const modalVariants = {
  hidden: { opacity: 0, scale: 0.94 },
  visible: { opacity: 1, scale: 1, transition: springs.default },
  exit: { opacity: 0, scale: 0.96, transition: durations.fast },
};

// Toast / snackbar — enters from below, holds, exits down. Distinct from
// sheetVariants (smaller travel distance, snappier spring) since a toast is
// a passive notification, not something the person is dismissing by hand.
export const toastVariants = {
  hidden: { y: 24, opacity: 0, x: '-50%' },
  visible: { y: 0, opacity: 1, x: '-50%', transition: springs.snappy },
  exit: { y: 12, opacity: 0, x: '-50%', transition: durations.fast },
};

// Left-edge drawer (profile nav drawer) — slides in from the left edge rather
// than up from the bottom, since it's anchored to a side, not the bottom sheet.
export const drawerVariants = {
  hidden: { x: '-100%' },
  visible: { x: 0, transition: springs.gentle },
  exit: { x: '-100%', transition: durations.base },
};

// Simple fade — dropdowns, tooltips, popovers, context menus.
export const fadeVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: durations.fast },
  exit: { opacity: 0, transition: durations.instant },
};

// Card / list-item entrance, used with staggerChildren on the parent for
// feed and list mounts so items settle in sequence instead of popping in
// simultaneously.
export const listItemVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: springs.default },
};

export const listContainerVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.045 } },
};

// Full-screen page overlay (Likes list, Comments, profile view) — these occupy
// the whole viewport rather than anchoring to an edge or center, so they get
// their own variant: a soft slide-up + fade rather than sheetVariants' full
// 100%-off-screen travel (which would look like a drawer, not a page).
export const pageVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: durations.slow },
  exit: { opacity: 0, y: 16, transition: durations.base },
};


// as `whileTap` directly: <motion.div whileTap={tapScale}>.
export const tapScale = { scale: 0.96, transition: springs.snappy };

// Celebration burst (achievements, gifts landing, milestones) — the only
// place `springs.bouncy` should be used per the token's own guidance.
export const celebrationVariants = {
  hidden: { opacity: 0, scale: 0.3 },
  visible: { opacity: 1, scale: 1, transition: springs.bouncy },
  exit: { opacity: 0, scale: 0.8, transition: durations.fast },
};
