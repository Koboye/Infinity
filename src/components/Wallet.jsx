'use client';
import React, { useEffect, useState } from 'react';
import * as W from '@/lib/wallet';
import AdOverlay from './AdOverlay';
import * as Ads from '@/lib/ads';

const TXT = {
  en: { coins: 'Coins', spin: 'Daily lucky spin', spinsLeft: (n) => `${n} of ${W.DAILY_SPINS} spins left today`, doSpin: 'SPIN', won: (n) => `You won ${n} coins!`, none: 'No spins left today. New spins arrive every day.',
    fee: 'Entry fee', feeSub: 'Both players pay it when the match starts. The winner takes 90% of the pot; a draw returns both fees.', low: 'Not enough coins', lowSub: 'Spin the daily wheel to earn more coins.', balance: 'Your coins',
    gift: 'Welcome gift!', giftSub: 'Your account wallet starts with 1,000 coins. Online matches have an entry fee; the winner takes the pot.', claim: 'Claim 1,000 coins', close: 'Close', pot: 'Win', signIn: 'Sign in',
    stake: (f) => `Entry fee 🪙 ${W.FEES.includes(f) ? f.toLocaleString('en-US') : f} each · winner gets 🪙 ${W.prizeFor(f * 2).toLocaleString('en-US')}`,
    practice: 'Online matches use coins. Computer and Pass & Play are free practice.', offlineErr: 'Could not reach the server. Check your connection.',
    refill: (n) => `Daily refill: top up to ${n} coins`, refilled: (n) => `Refilled +${n} coins`, refillSub: 'Only when you have fewer than 200 coins, once a day.',
    bonusLeft: (n, b) => `${n} spins left${b ? ` (${b} bonus)` : ' today'}`, watch: (n) => `🎬 Watch a short ad → +${n} spins`, watchLeft: (k) => `${k} bonus ${k === 1 ? 'ad' : 'ads'} left today`, watchSub: 'Optional. Spins are added when the ad ends.',
    adWon: (n, c) => `+${c || 0} coins and +${n} bonus spins added!`, adNone: 'No ad is available right now. Try again a little later.', adFail: 'The ad could not be shown. No spins were used.', adOver: 'No bonus ads left today. They come back tomorrow.' },
  am: { coins: 'ሳንቲሞች', spin: 'የዕለት ዕድል ጎማ', spinsLeft: (n) => `ዛሬ ${n} ከ${W.DAILY_SPINS} ዙሮች ቀርተዋል`, doSpin: 'አሽከርክር', won: (n) => `${n} ሳንቲም አሸነፉ!`, none: 'ዛሬ ዙሮች አልቀዋል። አዳዲስ ዙሮች በየቀኑ ይመጣሉ።',
    fee: 'የመግቢያ ክፍያ', feeSub: 'ጨዋታው ሲጀምር ሁለቱም ተጫዋቾች ይከፍላሉ። አሸናፊው 90% ይወስዳል፤ አቻ ሲሆን ሁለቱም ክፍያ ይመለሳል።', low: 'በቂ ሳንቲም የለም', lowSub: 'ተጨማሪ ሳንቲም ለማግኘት ዕለታዊውን ጎማ ያሽከርክሩ።', balance: 'ሳንቲሞችዎ',
    gift: 'የእንኳን ደህና መጡ ስጦታ!', giftSub: 'የመለያዎ ቦርሳ በ1,000 ሳንቲም ይጀምራል። የኢንተርኔት ጨዋታዎች የመግቢያ ክፍያ አላቸው፤ አሸናፊው ሽልማቱን ይወስዳል።', claim: '1,000 ሳንቲም ተቀበል', close: 'ዝጋ', pot: 'ሽልማት', signIn: 'ግባ',
    stake: (f) => `የመግቢያ ክፍያ 🪙 ${f.toLocaleString('en-US')} ለእያንዳንዱ · አሸናፊው 🪙 ${W.prizeFor(f * 2).toLocaleString('en-US')} ያገኛል`,
    practice: 'የኢንተርኔት ጨዋታዎች ሳንቲም ይጠቀማሉ። ከኮምፒውተር እና Pass & Play ነፃ ልምምድ ናቸው።', offlineErr: 'ሰርቨሩን ማግኘት አልተቻለም። ግንኙነትዎን ይመልከቱ።',
    refill: (n) => `ዕለታዊ መሙያ፦ እስከ ${n} ሳንቲም`, refilled: (n) => `+${n} ሳንቲም ተሞላ`, refillSub: 'ከ200 ሳንቲም በታች ሲኖርዎት ብቻ፣ በቀን አንድ ጊዜ።',
    bonusLeft: (n, b) => `${n} ዙሮች ቀርተዋል${b ? ` (${b} ተጨማሪ)` : ' ዛሬ'}`, watch: (n) => `🎬 አጭር ማስታወቂያ ይመልከቱ → +${n} ዙሮች`, watchLeft: (k) => `ዛሬ ${k} ተጨማሪ ማስታወቂያ ቀርቷል`, watchSub: 'አማራጭ ነው። ዙሮቹ ማስታወቂያው ሲያልቅ ይጨመራሉ።',
    adWon: (n, c) => `+${c || 0} ሳንቲም እና +${n} ተጨማሪ ዙሮች ተጨመሩ!`, adNone: 'አሁን ምንም ማስታወቂያ የለም። ትንሽ ቆይተው ይሞክሩ።', adFail: 'ማስታወቂያው ሊታይ አልቻለም። ምንም ዙር አልተጠቀመም።', adOver: 'ዛሬ ተጨማሪ ማስታወቂያ አልቀረም። ነገ ይመለሳሉ።' },
};
export const walletText = (lang) => TXT[lang === 'am' ? 'am' : 'en'];
const tx = walletText;
const fmt = (n) => Number(n).toLocaleString('en-US');

export function useWallet() {
  const [s, setS] = useState(W.snapshot());
  useEffect(() => {
    const read = () => setS(W.snapshot());
    read(); window.addEventListener('wallet:change', read);
    return () => window.removeEventListener('wallet:change', read);
  }, []);
  return s;
}

/** Balance chip in the top bar. Signed out it invites the player to sign in (the wallet belongs to the account). */
export function WalletChip({ lang, signedIn, onOpen }) {
  const w = useWallet(); const L = tx(lang);
  if (!signedIn) return <button type="button" className="coin-chip out" onClick={onOpen}><span className="coin-ico" aria-hidden="true">🪙</span><b>{L.signIn}</b></button>;
  return (
    <button type="button" className="coin-chip" onClick={onOpen} aria-label={`${L.coins}: ${w.coins}. ${L.spin}`}>
      <span className="coin-ico" aria-hidden="true">🪙</span><b>{w.ready ? fmt(w.coins) : '…'}</b>{w.spins > 0 && <i className="coin-dot" aria-hidden="true">{w.spins}</i>}
    </button>
  );
}

function Sheet({ children, label, onClose }) {
  return (
    <div className="overlay wallet-sheet" role="dialog" aria-modal="true" aria-label={label} onClick={(e) => { if (e.target === e.currentTarget) onClose?.(); }}>
      <div className="dialog wallet-card">{children}</div>
    </div>
  );
}

/** Entry-fee picker for an online match. The server charges the fee when the match starts; this only chooses the tier. */
export function FeePicker({ lang, value, onChange, onSpin }) {
  const L = tx(lang); const w = useWallet();
  const broke = w.ready && w.coins < W.MIN_FEE;
  useEffect(() => { if (w.ready && value > w.coins) { const best = W.FEES.filter((f) => f <= w.coins).slice(-1)[0]; if (best) onChange(best); } }, [w.coins, w.ready]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <section className="fee-picker" aria-label={L.fee}>
      <header><h3>{L.fee}</h3><span className="wallet-bal">🪙 <b>{w.ready ? fmt(w.coins) : '…'}</b></span></header>
      <div className="fee-grid" role="radiogroup" aria-label={L.fee}>
        {W.FEES.map((f) => (
          <button key={f} type="button" role="radio" aria-checked={value === f} disabled={w.ready && f > w.coins} className={`fee-tile${value === f ? ' on' : ''}`} onClick={() => onChange(f)}>
            <span aria-hidden="true">🪙</span><b>{fmt(f)}</b><small>{L.pot} {fmt(W.prizeFor(f * 2))}</small>
          </button>
        ))}
      </div>
      {broke ? <p className="err">{L.low}. {L.lowSub} <button type="button" className="btn small" onClick={onSpin}>🎡 {L.spin}</button></p> : <p className="muted small">{L.feeSub}</p>}
    </section>
  );
}

/** One line shown while waiting for an opponent: what this match costs and pays. */
export function StakeLine({ lang, fee }) { return fee > 0 ? <p className="stake-line">{tx(lang).stake(fee)}</p> : null; }
export function PracticeNote({ lang }) { return <p className="modes-note">{tx(lang).practice}</p>; }

export function WelcomeGift({ lang, onClose }) {
  const L = tx(lang);
  return (
    <Sheet label={L.gift} onClose={onClose}>
      <div className="gift-ico" aria-hidden="true">🎁</div><h2>{L.gift}</h2><p>{L.giftSub}</p>
      <div className="gift-amt">🪙 {fmt(W.WELCOME_GIFT)}</div>
      <div className="match-actions"><button className="btn primary" onClick={onClose}>{L.claim}</button></div>
    </Sheet>
  );
}

const SLICE = 360 / W.SPIN_PRIZES.length;
const COLS = ['#F2B632', '#C23B2A', '#4FA36B', '#3b8fd6', '#8E3FD1', '#FF8A3D', '#35E0C2', '#FF5C8A'];
export function SpinSheet({ lang, onClose }) {
  const L = tx(lang); const w = useWallet();
  const [rot, setRot] = useState(0); const [busy, setBusy] = useState(false); const [won, setWon] = useState(null); const [err, setErr] = useState(''); const [refilled, setRefilled] = useState(null); const [ad, setAd] = useState(null); const [adMsg, setAdMsg] = useState('');
  const reduce = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  useEffect(() => { W.refresh(); }, []);
  const go = async () => {
    if (busy) return; setBusy(true); setWon(null); setErr('');
    const r = await W.spin();                         // the server draws the prize and pays it; the wheel only shows it
    if (!r.ok) { setBusy(false); setErr(r.error || L.offlineErr); return; }
    setRot((cur) => { const base = Math.ceil(cur / 360) * 360; return base + 360 * 5 + (360 - (r.index + 0.5) * SLICE); });
    setTimeout(() => { setWon(r.coins); setBusy(false); }, reduce ? 200 : 4200);
  };
  const refill = async () => {
    if (busy) return; setBusy(true); setErr('');
    const r = await W.topUp();                         // the server checks the balance and the day, then pays
    setBusy(false); if (r.ok) setRefilled(r.coins); else setErr(r.error || L.offlineErr);
  };
  // Rewarded ad, by the player's choice. The server picks and times the ad; spins are added only when it confirms the ad ran to the end.
  const watch = async () => {
    if (busy) return; setBusy(true); setErr(''); setAdMsg(''); setWon(null);
    const r = await W.adStart();
    setBusy(false);
    if (!r.ok) { setErr(/No ad is available/.test(r.error || '') ? L.adNone : (r.error || L.offlineErr)); return; }
    setAd(r);
  };
  const adClosed = async (completed, reason) => {
    const cur = ad; setAd(null);
    if (!completed) { if (reason === 'failed') setErr(L.adFail); return; }
    setBusy(true); const r = await W.adDone(cur.session.id); setBusy(false);
    if (r.ok) setAdMsg(L.adWon(r.spins, r.coins)); else setErr(r.error || L.offlineErr);
  };
  const grad = `conic-gradient(${W.SPIN_PRIZES.map((_, i) => `${COLS[i % COLS.length]} ${i * SLICE}deg ${(i + 1) * SLICE}deg`).join(',')})`;
  return (
    <Sheet label={L.spin} onClose={busy ? undefined : onClose}>
      <h2>🎡 {L.spin}</h2>
      <p className="wallet-bal">🪙 <b>{w.ready ? fmt(w.coins) : '…'}</b> · {w.bonus > 0 ? L.bonusLeft(w.spins, w.bonus) : L.spinsLeft(w.spins)}</p>
      <div className="wheel-wrap">
        <i className="wheel-pointer" aria-hidden="true" />
        <div className="wheel" style={{ background: grad, transform: `rotate(${rot}deg)`, transition: reduce ? 'none' : 'transform 4s cubic-bezier(.12,.7,.1,1)' }}>
          {W.SPIN_PRIZES.map((p, i) => <span key={i} className="wheel-lbl" style={{ transform: `rotate(${(i + 0.5) * SLICE}deg) translateY(-92px)` }}>{p.coins}</span>)}
        </div>
      </div>
      <p className="wheel-result" role="status" aria-live="polite">{err || adMsg || (won != null ? L.won(won) : w.ready && w.spins === 0 && !busy ? (w.adsLeft > 0 ? '\u00a0' : L.none) : '\u00a0')}</p>
      {w.ready && w.adsLeft > 0 && <div className={`ad-earn${w.spins === 0 ? ' urgent' : ''}`}>
        <button type="button" className={`btn${w.spins === 0 ? ' primary' : ''}`} disabled={busy} onClick={watch}>{L.watch(w.adSpins)}</button>
        <small>{L.watchLeft(w.adsLeft)} · {L.watchSub}</small>
      </div>}
      {w.ready && w.topUp && <div className="refill"><button type="button" className="btn small" disabled={busy} onClick={refill}>🪙 {L.refill(W.TOPUP_FLOOR)}</button><small>{L.refillSub}</small></div>}
      {refilled != null && <p className="wheel-result" role="status">{L.refilled(refilled)}</p>}
      <div className="match-actions"><button className="btn primary" disabled={busy || !w.ready || w.spins === 0} onClick={go}>{L.doSpin}</button><button className="btn ghost" disabled={busy} onClick={onClose}>{L.close}</button></div>
      {ad && <AdOverlay ad={ad.ad} lang={lang} placement="rewarded" seconds={ad.session.durationMs / 1000} reward={w.adSpins} onClick={(a) => Ads.clicked(a)} onClose={adClosed} />}
    </Sheet>
  );
}
