'use client';
import { useEffect, useState } from 'react';

/** Install + Share buttons (Settings). Install uses the browser prompt; iOS gets the Add-to-Home-Screen hint. */
export default function AppActions() {
  const [evt, setEvt] = useState(null);
  const [installed, setInstalled] = useState(false);
  const [msg, setMsg] = useState('');
  const ios = typeof navigator !== 'undefined' && /iphone|ipad|ipod/i.test(navigator.userAgent);
  useEffect(() => {
    const standalone = window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone;
    if (standalone) setInstalled(true);
    const onPrompt = (e) => { e.preventDefault(); setEvt(e); };
    const onDone = () => { setInstalled(true); setEvt(null); };
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onDone);
    return () => { window.removeEventListener('beforeinstallprompt', onPrompt); window.removeEventListener('appinstalled', onDone); };
  }, []);
  const note = (m) => { setMsg(m); setTimeout(() => setMsg(''), 3500); };
  const install = async () => {
    if (evt) { evt.prompt(); await evt.userChoice.catch(() => {}); setEvt(null); }
    else if (ios) note('Tap Share, then “Add to Home Screen”.');
    else note('Open your browser menu and choose “Install app”.');
  };
  const share = async () => {
    const data = { title: 'ገበጣ · ዳማ · ሉዶ', text: 'Play Gebeta, Dama, Ludo, Dominoes and Bingo with me!', url: window.location.origin };
    try {
      if (navigator.share) await navigator.share(data);
      else { await navigator.clipboard.writeText(data.url); note('Link copied'); }
    } catch { /* cancelled */ }
  };
  return (
    <div className="app-actions">
      {!installed && <button className="btn primary" onClick={install}>📲 Install app</button>}
      {installed && <span className="app-actions-ok">✓ Installed</span>}
      <button className="btn ghost" onClick={share}>🔗 Share with friends</button>
      {msg && <p role="status" className="app-actions-msg">{msg}</p>}
    </div>
  );
}
