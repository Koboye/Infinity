'use client';
import { useEffect, useState } from 'react';
import { pushState, pushSubscribe, pushUnsubscribe } from '@/lib/studyClient';

const key = (b64) => { const p = '='.repeat((4 - (b64.length % 4)) % 4), raw = atob((b64 + p).replace(/-/g, '+').replace(/_/g, '/')); return Uint8Array.from(raw, (c) => c.charCodeAt(0)); };

/** Settings row: a daily study reminder by web push. Hidden until the server has its push keys. */
export default function ReminderRow({ t, lang, say }) {
  const [st, setSt] = useState(null), [busy, setBusy] = useState(false);
  useEffect(() => { pushState().then(setSt).catch(() => setSt(null)); }, []);
  if (!st || !st.supported) return null;
  const capable = typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
  const toggle = async () => {
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      if (st.enabled) {
        try { (await reg.pushManager.getSubscription())?.unsubscribe(); } catch { /* the server copy is removed below */ }
        setSt(await pushUnsubscribe()); say('ok', t('remOff'));
      } else {
        if ((await Notification.requestPermission()) !== 'granted') { say('err', t('remDenied')); return; }
        const sub = (await reg.pushManager.getSubscription()) || await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key(st.publicKey) });
        setSt(await pushSubscribe(sub.toJSON(), lang)); say('ok', t('remOn'));
      }
    } catch { say('err', t('remFail')); } finally { setBusy(false); }
  };
  return (
    <div className="inf-set-row"><div><b>{t('remTitle')}</b><small>{capable ? t('remSub') : t('remUnsupported')}</small></div>
      <button type="button" className="inf-ghost-btn" disabled={!capable || busy} aria-pressed={st.enabled} onClick={toggle}>{st.enabled ? t('remOnBtn') : t('remOffBtn')}</button></div>
  );
}
