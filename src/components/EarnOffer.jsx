'use client';
import React, { useEffect, useRef, useState } from 'react';
import * as W from '@/lib/wallet';
import * as Ads from '@/lib/ads';
import { shouldOffer, noteShown, noteAccepted, noteIgnored, newOfferState, OFFER } from '@/lib/adsOffer.js';
import AdOverlay from './AdOverlay';
import { useWallet } from './Wallet';

const KEY = 'gebeta.ads.offer';
const load = () => { try { return JSON.parse(localStorage.getItem(KEY)) || newOfferState(); } catch { return newOfferState(); } };
const save = (s) => { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* storage blocked: only means one extra offer */ } };

const TXT = {
  en: { title: (n) => (n > 0 ? 'Bonus spins & coins' : 'Free spins ready'), sub: (c, s) => `Watch a short ad → +${s} spins · +${c} 🪙`, subLow: (c, s) => `Low on coins? Watch a short ad → +${c} 🪙 +${s} spins`, watch: 'Watch', later: 'Not now', spinNow: 'Spin now',
    won: (c, s) => `🎉 +${c} coins${s ? ` · +${s} spins` : ''} added!`, none: 'No ad rewards left today. They come back tomorrow.', fail: 'The ad could not be shown. Try again.', net: 'Could not reach the server.' },
  am: { title: (n) => (n > 0 ? 'ተጨማሪ ዙሮች እና ሳንቲም' : 'ነፃ ዙሮች ተዘጋጅተዋል'), sub: (c, s) => `አጭር ማስታወቂያ ይመልከቱ → +${s} ዙሮች · +${c} 🪙`, subLow: (c, s) => `ሳንቲም አንሶዎታል? አጭር ማስታወቂያ ይመልከቱ → +${c} 🪙 +${s} ዙሮች`, watch: 'ተመልከት', later: 'አሁን አይሆንም', spinNow: 'አሽከርክር',
    won: (c, s) => `🎉 +${c} ሳንቲም${s ? ` · +${s} ዙሮች` : ''} ተጨመሩ!`, none: 'ዛሬ ተጨማሪ ሽልማት አልቀረም። ነገ ይመለሳል።', fail: 'ማስታወቂያው ሊታይ አልቻለም። እንደገና ይሞክሩ።', net: 'ከአገልጋዩ ጋር መገናኘት አልተቻለም።' },
};

/**
 * The smart "watch an ad for free spins" invitation, for every game and every screen.
 *  context  'open' (app opened) | 'result' (a game just ended) | 'lowcoins' (cannot afford an online match)
 *  variant  'banner' (floats above the bottom bar) | 'card' (sits inside a screen or a result overlay)
 * It shows itself only when adsOffer.shouldOffer says it is worth it, and never over a running ad. The ad, the timing and the
 * payout belong to the server (W.adStart / W.adDone); a signed-out player sees nothing here (the top-bar button asks to sign in).
 */
export default function EarnOffer({ lang = 'en', context = 'open', tone, variant = 'card', active = true, onSpin }) {
  const L = TXT[lang === 'am' ? 'am' : 'en']; const w = useWallet();
  const [show, setShow] = useState(false), [busy, setBusy] = useState(false), [ad, setAd] = useState(null), [msg, setMsg] = useState(''), [won, setWon] = useState(false);
  const decided = useRef(false), touched = useRef(false), gone = useRef(false);

  useEffect(() => {   // decide once, when the wallet is known and nothing else (a splash ad) is on screen
    if (decided.current || !active || !w.ready) return;
    decided.current = true;
    const now = Date.now();
    if (!shouldOffer({ context, ready: w.ready, adsLeft: w.adsLeft, spins: w.spins, coins: w.coins, bonus: w.bonus, tone }, load(), now)) return;
    if (context !== 'lowcoins') save(noteShown(load(), context, now));
    setShow(true);
  }, [active, w.ready]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {   // an untouched floating banner leaves by itself and counts as ignored
    if (!show || variant !== 'banner' || context === 'lowcoins') return undefined;
    const id = setTimeout(() => { if (!touched.current && !gone.current) { gone.current = true; save(noteIgnored(load())); setShow(false); } }, OFFER.autoHideMs);
    return () => clearTimeout(id);
  }, [show, variant, context]);

  if (!show) return null;
  const coins = w.adCoins || 50, spins = w.adSpins || 2;
  const dismiss = () => { touched.current = true; gone.current = true; if (context !== 'lowcoins') save(noteIgnored(load())); setShow(false); };
  const watch = async () => {
    if (busy) return;
    touched.current = true; setBusy(true); setMsg('');
    const r = await W.adStart(); setBusy(false);
    if (!r.ok) { setMsg(/left today|No bonus|No ad/.test(r.error || '') ? L.none : (r.error || L.net)); return; }
    save(noteAccepted(load())); setAd(r);
  };
  const closed = async (completed, reason) => {
    const cur = ad; setAd(null);
    if (!completed) { if (reason === 'failed') setMsg(L.fail); return; }
    setBusy(true); const r = await W.adDone(cur.session.id); setBusy(false);
    if (r.ok) { setWon(true); setMsg(L.won(r.coins, r.spins)); if (variant === 'banner') setTimeout(() => { if (!gone.current) { gone.current = true; setShow(false); } }, 6000); }
    else setMsg(r.error || L.net);
  };
  return (
    <>
      <aside className={`earn-offer ${variant}${won ? ' won' : ''}`} role="region" aria-label={L.title(w.spins)}>
        <span className="earn-ico" aria-hidden="true">{won ? '🎉' : '🎡'}</span>
        <div className="earn-copy">
          <b>{L.title(w.spins)}</b>
          <small role="status" aria-live="polite">{msg || (w.coins < OFFER.lowCoins ? L.subLow(coins, spins) : L.sub(coins, spins))}</small>
        </div>
        <div className="earn-acts">
          {won
            ? (onSpin && <button type="button" className="btn primary small" onClick={() => { onSpin(); setShow(false); }}>{L.spinNow}</button>)
            : <button type="button" className="btn primary small earn-go" disabled={busy} onClick={watch}>🎬 {L.watch}</button>}
          {!busy && <button type="button" className="earn-x" onClick={dismiss} aria-label={L.later}>✕</button>}
        </div>
      </aside>
      {ad && <AdOverlay ad={ad.ad} lang={lang} placement="rewarded" seconds={ad.session.durationMs / 1000} reward={coins} rewardSpins={spins} onClick={(a) => Ads.clicked(a)} onClose={closed} />}
    </>
  );
}
