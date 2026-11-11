'use client';
import { useEffect } from 'react';

/**
 * Keeps the app sized to the REAL visible screen in every orientation (portrait, landscape left/right, tablets, split-screen,
 * foldables, desktop windows, phones whose browser bar slides in and out). It never locks the orientation.
 *
 * It writes on <html>:
 *   --app-h / --app-w   the visible viewport in px (keyboard, zoom and browser bars included)
 *   --fit-col           the width of the app column: the full width on phones, a phone-shaped column on tablets / desktop
 *   --fit-fs            the root font size. Every rem in the app scales with it, so the whole UI looks the same on a
 *                       320px phone, a 430px phone, a tablet and a desktop window. On the home screen it is also shrunk a
 *                       little when needed so the games and the bottom bar always fit one screen.
 *   data-orient / data-size
 */
const COL_PER_PX = 24.5;      // a 393px-wide column gets a 16px root font (the size the UI was designed at)
const MAX_COL = 640;          // widest column on tablets / desktop
const MIN_FS = 12.5, MAX_FS = 20, HOME_MIN_FS = 11.5;

export default function ViewportFit() {
  useEffect(() => {
    const el = document.documentElement;
    let raf = 0, busy = false;

    const setFs = (fs) => el.style.setProperty('--fit-fs', `${Math.round(fs * 100) / 100}px`);

    const measure = () => {
      raf = 0;
      if (busy) return;
      busy = true;
      try {
        const vv = window.visualViewport;
        const h = Math.round(vv ? vv.height : window.innerHeight), w = Math.round(vv ? vv.width : window.innerWidth);
        const landscape = w > h;
        el.style.setProperty('--app-h', `${h}px`);
        el.style.setProperty('--app-w', `${w}px`);
        el.dataset.orient = landscape ? 'landscape' : 'portrait';
        el.dataset.size = w < 360 ? 'xs' : w < 480 ? 'sm' : w < 900 ? 'md' : 'lg';

        // column: phones use the whole width; bigger screens get a phone-shaped column that follows the height
        let col;
        if (w < 700) col = w;
        else if (h < 520) col = Math.min(w, MAX_COL + 80);          // landscape phone: a bit wider, grid becomes 3 columns
        else col = Math.max(420, Math.min(w, Math.round(h * 0.66), MAX_COL));
        let fs = Math.min(MAX_FS, Math.max(MIN_FS, col / COL_PER_PX));
        if (landscape && h < 520) fs = Math.min(fs, Math.max(12.5, h / 28));
        el.style.setProperty('--fit-col', `${col}px`);
        setFs(fs);

        // home screen: shrink a little (never below HOME_MIN_FS) until the last game card ends above the bottom bar
        const home = document.querySelector('.home');
        const nav = document.querySelector('.bottom-nav');
        if (home && nav && !landscape) {
          for (let i = 0; i < 4; i++) {
            const bottom = home.getBoundingClientRect().bottom + window.scrollY;
            const limit = nav.getBoundingClientRect().top + window.scrollY - 8;
            const over = bottom - limit;
            if (over <= 1 || fs <= HOME_MIN_FS) break;
            const need = bottom - home.getBoundingClientRect().top - window.scrollY;
            fs = Math.max(HOME_MIN_FS, fs * Math.max(0.8, (need - over) / need));
            setFs(fs);
          }
        }
      } finally { busy = false; }
    };

    const schedule = () => { if (!raf) raf = requestAnimationFrame(measure); };
    const late = () => { schedule(); setTimeout(schedule, 250); setTimeout(schedule, 700); }; // some phones report the new size late
    measure();
    window.addEventListener('resize', schedule);
    window.addEventListener('orientationchange', late);
    window.visualViewport?.addEventListener('resize', schedule);
    // screens change without a resize (home <-> game <-> friends): re-fit whenever the screen's structure changes
    const mo = new MutationObserver(schedule);
    mo.observe(document.body, { childList: true, subtree: true });
    if (document.fonts?.ready) document.fonts.ready.then(schedule).catch(() => {});
    return () => {
      window.removeEventListener('resize', schedule);
      window.removeEventListener('orientationchange', late);
      window.visualViewport?.removeEventListener('resize', schedule);
      mo.disconnect();
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);
  return null;
}
