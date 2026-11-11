'use client';
import { useEffect } from 'react';
import { fitScale } from '@/lib/fit.js';

/**
 * Keeps the app sized to the REAL visible screen in every orientation (portrait, landscape left/right, tablets, split-screen,
 * foldables, phones whose browser bar slides in and out). It writes --app-h / --app-w and data-orient on <html>, re-measured on
 * resize, rotation and visual-viewport changes (keyboard, zoom). It never locks the orientation.
 *
 * Screen-size fit (v3.4 phase 1): menus, friends, profile etc. are designed for a ~390px-wide phone. Instead of showing that design
 * at one fixed size, the whole page shell is scaled by --k (small phone .8 … tablet/desktop 1.6) with CSS `zoom` (see fit.css),
 * so every device sees the same proportions. --app-w-z / --app-h-z are the visible size in the scaled coordinate space
 * (real size / k): use them instead of vw / dvh for anything inside the scaled shell.
 */
export default function ViewportFit() {
  useEffect(() => {
    const el = document.documentElement;
    let raf = 0;
    const measure = () => {
      raf = 0;
      const vv = window.visualViewport;
      const h = Math.round(vv ? vv.height : window.innerHeight), w = Math.round(vv ? vv.width : window.innerWidth);
      el.style.setProperty('--app-h', `${h}px`);
      el.style.setProperty('--app-w', `${w}px`);
      const zoomOk = typeof CSS !== 'undefined' && CSS.supports?.('zoom', '1');
      const k = zoomOk ? fitScale(w, h) : 1;
      el.style.setProperty('--k', String(k));
      el.style.setProperty('--app-w-z', `${Math.round(w / k)}px`);
      el.style.setProperty('--app-h-z', `${Math.round(h / k)}px`);
      el.dataset.fit = zoomOk ? 'zoom' : 'off';
      el.dataset.orient = w > h ? 'landscape' : 'portrait';
      el.dataset.size = w < 360 ? 'xs' : w < 480 ? 'sm' : w < 900 ? 'md' : 'lg';
    };
    const schedule = () => { if (!raf) raf = requestAnimationFrame(measure); };
    measure();
    window.addEventListener('resize', schedule);
    window.addEventListener('orientationchange', () => { schedule(); setTimeout(schedule, 250); setTimeout(schedule, 700); }); // some phones report the new size late
    window.visualViewport?.addEventListener('resize', schedule);
    return () => {
      window.removeEventListener('resize', schedule);
      window.visualViewport?.removeEventListener('resize', schedule);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);
  return null;
}
