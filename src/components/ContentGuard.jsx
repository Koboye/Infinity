'use client';
import {useEffect} from 'react';

/* Best-effort protection for the web app: no copy, cut, drag, save, print or text selection outside form fields,
   and the screen is covered while the app is in the background (app-switcher preview).
   A browser cannot detect or block OS screenshots and screen recording: the Android app build does that (FLAG_SECURE). */
const editable = (el) => !!el && el.closest && !!el.closest('input,textarea,[contenteditable=true]');

export default function ContentGuard() {
  useEffect(() => {
    const root = document.documentElement;
    root.classList.add('inf-protected');
    const stop = (e) => { if (!editable(e.target)) e.preventDefault(); };
    const copy = (e) => { if (editable(e.target)) return; e.preventDefault(); try { e.clipboardData && e.clipboardData.setData('text/plain', ''); } catch {} };
    const cover = (on) => root.classList.toggle('inf-away', on);
    const vis = () => cover(document.hidden);
    const key = (e) => {
      const k = String(e.key || '').toLowerCase(), mod = e.ctrlKey || e.metaKey;
      if (k === 'printscreen') { try { navigator.clipboard && navigator.clipboard.writeText(''); } catch {} cover(true); setTimeout(() => cover(document.hidden), 1500); return; }
      if (editable(e.target)) return;
      if (e.key === 'F12' || (mod && ['s', 'p', 'u', 'a', 'c', 'x'].includes(k)) || (mod && e.shiftKey && ['i', 'j', 'c'].includes(k))) e.preventDefault();
    };
    const ev = [['copy', copy], ['cut', copy], ['contextmenu', stop], ['dragstart', stop], ['selectstart', stop], ['keydown', key], ['keyup', key], ['visibilitychange', vis], ['beforeprint', () => cover(true)], ['afterprint', () => cover(document.hidden)]];
    ev.forEach(([n, f]) => document.addEventListener(n, f));
    window.addEventListener('pagehide', () => cover(true));
    window.addEventListener('pageshow', () => cover(document.hidden));
    return () => { root.classList.remove('inf-protected', 'inf-away'); ev.forEach(([n, f]) => document.removeEventListener(n, f)); };
  }, []);
  return null;
}
