'use client';
import React, { useEffect, useState } from 'react';
import * as W from '@/lib/wallet';

const TXT = {
  en: { coins: 'Coins', spin: 'Daily lucky spin', spinsLeft: (n) => `${n} of ${W.DAILY_SPINS} spins left today`, doSpin: 'SPIN', won: (n) => `You won ${n} coins!`, none: 'No spins left. Come back tomorrow for 10 more.',
    fee: 'Choose your entry fee', feeSub: (n) => `Winner takes the pot (${n} players, 90% paid out). A draw returns your fee.`, again: 'Play again?', pay: 'Pay & play', cancel: 'Back', low: 'Not enough coins', lowSub: 'Spin the daily wheel to earn more coins.', balance: 'Your coins',
    gift: 'Welcome gift!', giftSub: 'Here are 1,000 coins to start. Every match costs an entry fee, and the winner takes the pot.', claim: 'Claim 1,000 coins', win: (n) => `+${n} coins`, close: 'Close', toPlay: 'Entry fee', pot: 'Pot' },
  am: { coins: 'ሳንቲሞች', spin: 'የዕለት ዕድል ጎማ', spinsLeft: (n) => `ዛሬ ${n} ከ${W.DAILY_SPINS} ዙሮች ቀርተዋል`, doSpin: 'አሽከርክር', won: (n) => `${n} ሳንቲም አሸነፉ!`, none: 'ዙሮች አልቀዋል። ነገ 10 ተጨማሪ ያገኛሉ።',
    fee: 'የመግቢያ ክፍያ ይምረጡ', feeSub: (n) => `አሸናፊው ሽልማቱን ይወስዳል (${n} ተጫዋቾች፣ 90% ይከፈላል)። አቻ ሲሆን ክፍያው ይመለሳል።`, again: 'እንደገና ይጫወቱ?', pay: 'ክፈል እና ተጫወት', cancel: 'ተመለስ', low: 'በቂ ሳንቲም የለም', lowSub: 'ተጨማሪ ሳንቲም ለማግኘት ዕለታዊውን ጎማ ያሽከርክሩ።', balance: 'ሳንቲሞችዎ',
    gift: 'የእንኳን ደህና መጡ ስጦታ!', giftSub: 'ለመጀመር 1,000 ሳንቲም። እያንዳንዱ ጨዋታ የመግቢያ ክፍያ አለው፣ አሸናፊው ሽልማቱን ይወስዳል።', claim: '1,000 ሳንቲም ተቀበል', win: (n) => `+${n} ሳንቲም`, close: 'ዝጋ', toPlay: 'የመግቢያ ክፍያ', pot: 'ሽልማት' },
};
const tx = (lang) => TXT[lang === 'am' ? 'am' : 'en'];
const fmt = (n) => Number(n).toLocaleString('en-US');

export function useWallet() {
  const [s, setS] = useState({ coins: 0, spins: 0 });
  useEffect(() => {
    const read = () => setS({ coins: W.balance(), spins: W.spinsLeft() });
    read(); window.addEventListener('wallet:change', read); window.addEventListener('storage', read);
    return () => { window.removeEventListener('wallet:change', read); window.removeEventListener('storage', read); };
  }, []);
  return s;
}

export function WalletChip({ lang, onOpen }) {
  const w = useWallet(); const L = tx(lang);
  return (
    <button type="button" className="coin-chip" onClick={onOpen} aria-label={`${L.coins}: ${w.coins}. ${L.spin}`}>
      <span className="coin-ico" aria-hidden="true">🪙</span><b>{fmt(w.coins)}</b>{w.spins > 0 && <i className="coin-dot" aria-hidden="true">{w.spins}</i>}
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

/** Entry fee picker. Every match (any game, any mode) goes through this: no coins, no match. */
export function FeeSheet({ lang, seats = 2, initial = 50, rematch = false, onPay, onCancel, onSpin }) {
  const L = tx(lang); const w = useWallet();
  const [fee, setFee] = useState(() => (W.canAfford(initial) ? initial : (W.affordableFees().slice(-1)[0] || initial)));
  const broke = w.coins < W.MIN_FEE;
  const pay = () => { const r = W.startMatch({ fee, seats }); if (r.ok) onPay(fee); };
  return (
    <Sheet label={L.fee} onClose={onCancel}>
      <h2>{rematch ? L.again : L.fee}</h2>
      <p className="wallet-bal">🪙 {L.balance}: <b>{fmt(w.coins)}</b></p>
      {broke ? (
        <><p className="err">{L.low}. {L.lowSub}</p><div className="match-actions"><button className="btn primary" onClick={onSpin}>🎡 {L.spin}</button><button className="btn ghost" onClick={onCancel}>{L.cancel}</button></div></>
      ) : (
        <>
          <p className="muted small">{L.feeSub(Math.max(2, seats))}</p>
          <div className="fee-grid" role="radiogroup" aria-label={L.toPlay}>
            {W.FEES.map((f) => (
              <button key={f} type="button" role="radio" aria-checked={fee === f} disabled={f > w.coins} className={`fee-tile${fee === f ? ' on' : ''}`} onClick={() => setFee(f)}>
                <span aria-hidden="true">🪙</span><b>{fmt(f)}</b><small>{L.pot} {fmt(W.prizeFor(f * Math.max(2, seats)))}</small>
              </button>
            ))}
          </div>
          <div className="match-actions"><button className="btn primary" disabled={fee > w.coins} onClick={pay}>{L.pay} · 🪙 {fmt(fee)}</button><button className="btn ghost" onClick={onCancel}>{L.cancel}</button></div>
        </>
      )}
    </Sheet>
  );
}

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
  const [rot, setRot] = useState(0); const [busy, setBusy] = useState(false); const [won, setWon] = useState(null);
  const reduce = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const go = () => {
    if (busy) return; const r = W.spin(); if (!r.ok) return;
    setBusy(true); setWon(null);
    setRot((cur) => { const base = Math.ceil(cur / 360) * 360; return base + 360 * 5 + (360 - (r.index + 0.5) * SLICE); });
    setTimeout(() => { setWon(r.coins); setBusy(false); }, reduce ? 200 : 4200);
  };
  const grad = `conic-gradient(${W.SPIN_PRIZES.map((_, i) => `${COLS[i % COLS.length]} ${i * SLICE}deg ${(i + 1) * SLICE}deg`).join(',')})`;
  return (
    <Sheet label={L.spin} onClose={busy ? undefined : onClose}>
      <h2>🎡 {L.spin}</h2>
      <p className="wallet-bal">🪙 <b>{fmt(w.coins)}</b> · {L.spinsLeft(w.spins)}</p>
      <div className="wheel-wrap">
        <i className="wheel-pointer" aria-hidden="true" />
        <div className="wheel" style={{ background: grad, transform: `rotate(${rot}deg)`, transition: reduce ? 'none' : 'transform 4s cubic-bezier(.12,.7,.1,1)' }}>
          {W.SPIN_PRIZES.map((p, i) => <span key={i} className="wheel-lbl" style={{ transform: `rotate(${(i + 0.5) * SLICE}deg) translateY(-92px)` }}>{p.coins}</span>)}
        </div>
      </div>
      <p className="wheel-result" role="status" aria-live="polite">{won != null ? L.won(won) : w.spins === 0 && !busy ? L.none : '\u00a0'}</p>
      <div className="match-actions"><button className="btn primary" disabled={busy || w.spins === 0} onClick={go}>{L.doSpin}</button><button className="btn ghost" disabled={busy} onClick={onClose}>{L.close}</button></div>
    </Sheet>
  );
}
