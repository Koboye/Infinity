'use client';
import { useCallback, useRef } from 'react';

/** Swipe left / right on a main screen to move to the next / previous bottom tab (home, level, friends, trophy, rules, profile). */
export const TAB_ORDER = ['home', 'progress', 'friends', 'leaders', 'rules', 'profile'];
export const tabIndexOf = (name) => (name === 'home' || name === 'modes' ? 0 : TAB_ORDER.indexOf(name));

// Touches that start here keep their own horizontal gesture (typing, chat swipe-to-reply, scrolling rails, sliders, game boards).
const KEEP = 'input,textarea,select,[contenteditable],[data-noswipe],.swipe,.swipe-rail,.rail,.tg-msgs,.board,canvas,iframe';
const scrollsSideways = (el) => {
  for (let n = el; n && n.nodeType === 1 && n !== document.body; n = n.parentElement) {
    if (n.scrollWidth > n.clientWidth + 4) { const o = getComputedStyle(n).overflowX; if (o === 'auto' || o === 'scroll') return true; }
  }
  return false;
};

/** Returns touch handlers for the <main> element. `enabled` is false in games, open chats, dialogs and sheets. */
export default function useTabSwipe({ viewName, enabled, onGo }) {
  const s = useRef(null);
  const onTouchStart = useCallback((e) => {
    s.current = null;
    if (!enabled || e.touches.length !== 1) return;
    const el = e.target instanceof Element ? e.target : null;
    if (!el || el.closest(KEEP) || scrollsSideways(el)) return;
    const t = e.touches[0];
    s.current = { x: t.clientX, y: t.clientY, at: Date.now() };
  }, [enabled]);
  const onTouchEnd = useCallback((e) => {
    const st = s.current; s.current = null;
    if (!st || !enabled) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - st.x, dy = t.clientY - st.y, dt = Date.now() - st.at;
    if (Math.abs(dx) < 70 || Math.abs(dx) < Math.abs(dy) * 1.8 || dt > 700) return;   // a clear, mostly horizontal, quick swipe
    const i = tabIndexOf(viewName); if (i < 0) return;
    const next = i + (dx < 0 ? 1 : -1);
    if (next < 0 || next >= TAB_ORDER.length) return;
    onGo(TAB_ORDER[next], dx < 0 ? 'left' : 'right');
  }, [enabled, viewName, onGo]);
  return { onTouchStart, onTouchEnd };
}
