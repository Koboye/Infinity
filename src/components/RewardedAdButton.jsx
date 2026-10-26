'use client';
import React, { useState } from 'react';
import * as W from '@/lib/wallet';
import * as Ads from '@/lib/ads';
import AdOverlay from './AdOverlay';
import { useWallet } from './Wallet';

const TXT = {
  en: { watch: (c) => `+${c}`, label: (c) => `Watch an ad for ${c} free coins`, won: (c, s) => `🪙 +${c} coins${s ? ` · +${s} spins` : ''}!`, none: 'No ad rewards left today. They come back tomorrow.', fail: 'The ad could not be shown. Try again.', net: 'Could not reach the server.' },
  am: { watch: (c) => `+${c}`, label: (c) => `${c} ነፃ ሳንቲም ለማግኘት ማስታወቂያ ይመልከቱ`, won: (c, s) => `🪙 +${c} ሳንቲም${s ? ` · +${s} ዙሮች` : ''}!`, none: 'ዛሬ ተጨማሪ ሽልማት አልቀረም። ነገ ይመለሳል።', fail: 'ማስታወቂያው ሊታይ አልቻለም። እንደገና ይሞክሩ።', net: 'ከአገልጋዩ ጋር መገናኘት አልተቻለም።' },
};

/**
 * "Watch an ad → coins", always in the top bar: on the home screen, in menus and during a game.
 * The server picks and times the ad (the built-in ad when no paid ad is live) and pays the coins only after the full length was watched.
 * Signed out: asks the app to open the sign-in screen (the wallet belongs to the account).
 */
export default function RewardedAdButton({ lang, signedIn, onNeedSignIn }) {
  const L = TXT[lang === 'am' ? 'am' : 'en']; const w = useWallet();
  const [busy, setBusy] = useState(false), [ad, setAd] = useState(null), [msg, setMsg] = useState('');
  const say = (m) => { setMsg(m); setTimeout(() => setMsg(''), 3500); };
  if (signedIn && w.ready && w.adsLeft <= 0) return null;   // daily limit reached: hide until tomorrow
  const start = async () => {
    if (busy) return;
    if (!signedIn) { onNeedSignIn?.(); return; }
    setBusy(true); const r = await W.adStart(); setBusy(false);
    if (!r.ok) { say(/left today|No bonus/.test(r.error || '') ? L.none : (r.error || L.net)); return; }
    setAd(r);
  };
  const closed = async (completed, reason) => {
    const cur = ad; setAd(null);
    if (!completed) { if (reason === 'failed') say(L.fail); return; }
    setBusy(true); const r = await W.adDone(cur.session.id); setBusy(false);
    say(r.ok ? L.won(r.coins, r.spins) : (r.error || L.net));
  };
  return (
    <>
      <button type="button" className="reward-btn" disabled={busy} onClick={start} aria-label={L.label(w.adCoins || 50)}>
        <span aria-hidden="true">🎬</span><b>{L.watch(w.adCoins || 50)}</b>
      </button>
      {msg && <div className="toast" role="status">{msg}</div>}
      {ad && <AdOverlay ad={ad.ad} lang={lang} placement="rewarded" seconds={ad.session.durationMs / 1000} reward={w.adCoins || 50} onClick={(a) => Ads.clicked(a)} onClose={closed} />}
    </>
  );
}
