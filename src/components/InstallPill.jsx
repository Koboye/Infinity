'use client';
import { useEffect, useState } from 'react';

/** A small "Install app" button on the home screen, shown only where the browser can really install the app (not once installed, not after ✕). */
export default function InstallPill({ t }) {
  const [evt, setEvt] = useState(null);
  useEffect(() => {
    const standalone = window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone;
    let dismissed = false; try { dismissed = window.localStorage.getItem('gebeta.install.no') === '1'; } catch { /* private mode */ }
    if (standalone || dismissed) return undefined;
    const take = () => setEvt(window.__gebetaInstall || null);
    take();
    window.addEventListener('gebeta-install-ready', take); window.addEventListener('appinstalled', take);
    return () => { window.removeEventListener('gebeta-install-ready', take); window.removeEventListener('appinstalled', take); };
  }, []);
  if (!evt) return null;
  const install = async () => { try { evt.prompt(); await evt.userChoice; } catch { /* closed */ } window.__gebetaInstall = null; setEvt(null); };
  const close = () => { try { window.localStorage.setItem('gebeta.install.no', '1'); } catch { /* private mode */ } setEvt(null); };
  return (
    <div className="install-pill" role="region" aria-label={t.installApp}>
      <button type="button" className="btn primary" onClick={install}>📲 {t.installApp}</button>
      <button type="button" className="ip-x" onClick={close} aria-label="✕">✕</button>
    </div>
  );
}
