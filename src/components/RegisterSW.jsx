'use client';
import { useEffect } from 'react';
export default function RegisterSW() {
  useEffect(() => {
    // the browser fires `beforeinstallprompt` once, early: keep it so the Install buttons work whenever they are shown
    const onPrompt = (e) => { e.preventDefault(); window.__gebetaInstall = e; window.dispatchEvent(new Event('gebeta-install-ready')); };
    const onDone = () => { window.__gebetaInstall = null; };
    window.addEventListener('beforeinstallprompt', onPrompt); window.addEventListener('appinstalled', onDone);
    if (process.env.NODE_ENV === 'production' && 'serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => {});
    return () => { window.removeEventListener('beforeinstallprompt', onPrompt); window.removeEventListener('appinstalled', onDone); };
  }, []);
  return null;
}
