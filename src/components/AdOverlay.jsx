'use client';
import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { SKIP_AFTER_SEC } from '@/lib/adsCore.js';

const TXT = {
  en: { ad: 'Ad', skip: 'Skip', skipNo: 'Skip (no reward)', earn: (n) => `Watch to the end to earn ${n} free spins`, claim: (n) => `Collect +${n} spins`, secs: (s) => `${s} seconds left` },
  am: { ad: 'ማስታወቂያ', skip: 'ዝለል', skipNo: 'ዝለል (ያለ ሽልማት)', earn: (n) => `እስከ መጨረሻ ይመልከቱና ${n} ነፃ ዙሮች ያግኙ`, claim: (n) => `+${n} ዙሮች ተቀበል`, secs: (s) => `${s} ሰከንድ ቀርቷል` },
};
const LOAD_TIMEOUT_MS = 6000;

/**
 * One full-screen ad.
 *  • The clock starts only once the picture is really on screen, so every ad gets its full 2–10 seconds, and it
 *    stops while the app is in the background (a player cannot "watch" with the screen off).
 *  • Splash / pre-game: ends by itself; a Skip button appears after 3 s (ads shorter than that just end).
 *  • Rewarded: no skip until it is over; then "Collect" reports completion. Leaving early (Skip, no reward) reports `false`.
 *  • A picture that fails to load closes the ad at once (`onClose(false, 'failed')`): a broken ad can never trap anybody.
 * onClose(completed, reason) is called exactly once.
 */
export default function AdOverlay({ ad, lang = 'en', placement, seconds, reward = 0, onShown, onClick, onClose }) {
  const L = TXT[lang === 'am' ? 'am' : 'en'];
  const rewarded = placement === 'rewarded';
  const total = Math.max(2, Math.round(seconds || ad.durationSec || 5));
  const [loaded, setLoaded] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [done, setDone] = useState(false);
  const rootRef = useRef(null), imgRef = useRef(null), skipRef = useRef(null), closed = useRef(false);
  const finish = (completed, reason) => { if (closed.current) return; closed.current = true; onClose?.(completed, reason); };

  const pick = (en, am) => (lang === 'am' && am ? am : en);
  const title = pick(ad.title, ad.titleAm), body = pick(ad.body, ad.bodyAm), cta = pick(ad.cta, ad.ctaAm) || ad.cta;

  useEffect(() => {  // the picture may already be cached
    const img = imgRef.current;
    if (img?.complete && img.naturalWidth > 0) setLoaded(true);
  }, []);
  useEffect(() => {  // give up on a picture that never arrives; the timer stops the moment it does
    if (loaded) return undefined;
    const id = setTimeout(() => finish(false, 'failed'), LOAD_TIMEOUT_MS);
    return () => clearTimeout(id);
  }, [loaded]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!loaded) return undefined;
    onShown?.(ad);
    let acc = 0, last = performance.now(), lastSec = -1;
    const id = setInterval(() => {
      const now = performance.now(); const dt = now - last; last = now;
      if (document.hidden) return;                      // background = paused
      acc += Math.min(dt, 300);                         // a frozen main thread cannot fast-forward the ad
      const p = Math.min(1, acc / (total * 1000));
      rootRef.current?.style.setProperty('--p', String(p));
      const sec = Math.floor(acc / 1000); if (sec !== lastSec) { lastSec = sec; setElapsed(sec); }
      if (p >= 1) { clearInterval(id); setDone(true); if (!rewarded) finish(true); }
    }, 100);
    return () => clearInterval(id);
  }, [loaded]); // eslint-disable-line react-hooks/exhaustive-deps

  const canSkip = loaded && !done && elapsed >= SKIP_AFTER_SEC && (rewarded || total > SKIP_AFTER_SEC);
  useEffect(() => { if (canSkip) skipRef.current?.focus(); }, [canSkip]);
  useEffect(() => {
    const key = (e) => { if (e.key === 'Escape' && canSkip) finish(false, 'skipped'); };
    window.addEventListener('keydown', key); return () => window.removeEventListener('keydown', key);
  }, [canSkip]); // eslint-disable-line react-hooks/exhaustive-deps

  const open = () => { if (!ad.clickUrl) return; onClick?.(ad); try { window.open(ad.clickUrl, '_blank', 'noopener,noreferrer'); } catch { /* popup blocked */ } };
  const Media = ad.clickUrl ? 'button' : 'div';

  const node = (
    <div className={`ad-ov ad-${placement}${loaded ? ' on' : ''}`} ref={rootRef} style={{ '--p': 0 }} role="dialog" aria-modal="true" aria-label={`${L.ad}: ${ad.advertiser}`}>
      <div className="ad-bg" style={{ backgroundImage: `url("${ad.image}")` }} aria-hidden="true" />
      <div className="ad-card">
        <div className="ad-top">
          <span className="ad-badge"><b>{L.ad}</b><i aria-hidden="true">·</i><span>{ad.advertiser}</span></span>
          {canSkip
            ? <button ref={skipRef} type="button" className="ad-skip" onClick={() => finish(false, 'skipped')}>{rewarded ? L.skipNo : L.skip} <span aria-hidden="true">✕</span></button>
            : !done && <span className="ad-ring" role="timer" aria-label={L.secs(Math.max(0, total - elapsed))}>
                <svg viewBox="0 0 36 36" aria-hidden="true"><circle className="bg" cx="18" cy="18" r="16" /><circle className="fg" cx="18" cy="18" r="16" pathLength="1" /></svg>
                <em>{loaded ? Math.max(0, total - elapsed) : ''}</em>
              </span>}
        </div>
        <Media className="ad-media" {...(ad.clickUrl ? { type: 'button', onClick: open, 'aria-label': `${title || ad.advertiser} — ${cta}` } : {})}>
          <img ref={imgRef} src={ad.image} alt="" decoding="async" referrerPolicy="no-referrer" onLoad={() => setLoaded(true)} onError={() => finish(false, 'failed')} />
          {!loaded && <i className="ad-wait" aria-hidden="true" />}
        </Media>
        {(title || body) && <div className="ad-copy">{title && <h3>{title}</h3>}{body && <p>{body}</p>}</div>}
        <div className="ad-actions">
          {rewarded && done
            ? <button type="button" className="btn primary wide ad-claim" autoFocus onClick={() => finish(true)}>🎁 {L.claim(reward)}</button>
            : ad.clickUrl && <button type="button" className="btn primary wide ad-cta" onClick={open}>{cta} <span aria-hidden="true">↗</span></button>}
          {rewarded && !done && <p className="ad-note">🎁 {L.earn(reward)}</p>}
        </div>
        <div className="ad-bar" aria-hidden="true"><b /></div>
      </div>
    </div>
  );
  return typeof document === 'undefined' ? null : createPortal(node, document.body);   // always above everything, whatever dialog opened it
}
