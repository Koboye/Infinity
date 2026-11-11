'use client';
import { useEffect } from 'react';

/**
 * Keeps the app sized to the REAL visible screen in every orientation (portrait, landscape left/right, tablets, split-screen,
 * foldables, phones whose browser bar slides in and out). It writes --app-h / --app-w and data-orient on <html>, re-measured on
 * resize, rotation and visual-viewport changes (keyboard, zoom). It never locks the orientation.
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
