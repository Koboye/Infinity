'use client';
import React, { useEffect, useState } from 'react';
import * as P from '@/lib/pass';

const TXT = {
  en: { title: 'Unlock today\'s levels', sub: (n) => `Pay once and play ${n} levels today. Tomorrow you unlock again.`, phone: 'The phone number you pay from (we match your payment with it)', pay: 'Pay & unlock', dial: 'Your phone\'s dialer opens with the code. Press call, finish the payment, then come back.',
    code: 'Payment code', waiting: 'Waiting for your payment to be confirmed…', check: 'I have paid — check now', notYet: 'Not confirmed yet. It can take a minute.', unlocked: (n) => `Unlocked! ${n} levels today.`, play: 'Play now', close: 'Close', retry: 'Could not reach the server. Check your connection.', usedUp: 'You used all your levels today. Pay again to unlock more.' },
  am: { title: 'የዛሬን ደረጃዎች ክፈት', sub: (n) => `አንድ ጊዜ ይክፈሉ፤ ዛሬ ${n} ደረጃዎችን ይጫወቱ። ነገ እንደገና ይከፍታሉ።`, phone: 'የሚከፍሉበት ስልክ ቁጥር (ክፍያዎን በእሱ እናዛምዳለን)', pay: 'ክፈል እና ክፈት', dial: 'የስልክዎ መደወያ በኮዱ ይከፈታል። ደውለው ክፍያውን ጨርሰው ይመለሱ።',
    code: 'የክፍያ ኮድ', waiting: 'ክፍያዎ እስኪረጋገጥ በመጠበቅ ላይ…', check: 'ከፍያለሁ — አሁን አረጋግጥ', notYet: 'ገና አልተረጋገጠም። አንድ ደቂቃ ሊወስድ ይችላል።', unlocked: (n) => `ተከፍቷል! ዛሬ ${n} ደረጃዎች።`, play: 'አሁን ተጫወት', close: 'ዝጋ', retry: 'ሰርቨሩን ማግኘት አልተቻለም። ግንኙነትዎን ይመልከቱ።', usedUp: 'ዛሬ ደረጃዎችዎ አልቀዋል። ለተጨማሪ እንደገና ይክፈሉ።' },
};

/** Pay-to-unlock sheet. `onUnlocked` runs when the server says the pass is open (the game the player wanted then starts). */
export default function PassSheet({ lang, onClose, onUnlocked }) {
  const L = TXT[lang === 'am' ? 'am' : 'en'];
  const [phone, setPhone] = useState('');
  const [claim, setClaim] = useState(null);
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  const check = async (quiet) => {
    const r = await P.refresh();
    if (!r.ok) { if (!quiet) setMsg(L.retry); return; }
    if (r.pass.left > 0) { setDone(true); setMsg(''); } else if (!quiet) setMsg(L.notYet);
  };
  useEffect(() => { check(true); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (!claim || done) return undefined; const id = setInterval(() => check(true), 5000); return () => clearInterval(id); }, [claim, done]); // eslint-disable-line react-hooks/exhaustive-deps

  const pay = async () => {
    setBusy(true); setMsg('');
    const r = await P.pay(phone);
    setBusy(false);
    if (r.ok) setClaim(r.claim); else setMsg(r.error);
  };

  return (
    <div className="overlay wallet-sheet" role="dialog" aria-modal="true" aria-label={L.title} onClick={(e) => { if (e.target === e.currentTarget) onClose?.(); }}>
      <div className="dialog wallet-card">
        <h3>🔓 {L.title}</h3>
        {done ? (
          <>
            <p><b>{L.unlocked(P.PASS_LEVELS)}</b></p>
            <button type="button" className="btn primary wide" onClick={() => onUnlocked?.()}>{L.play}</button>
          </>
        ) : (
          <>
            <p className="muted">{L.sub(P.PASS_LEVELS)}</p>
            {P.passPrice && <p><b>{lang === 'am' ? `ዋጋ: ${P.passPrice} ብር` : `Price: ${P.passPrice} birr`}</b></p>}
            {!claim && <label className="muted small">{L.phone}<input inputMode="tel" autoComplete="tel" maxLength={16} value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="09xxxxxxxx" /></label>}
            {!claim && <button type="button" className="btn primary wide" disabled={busy || !/^(\+?251|0)?[79]\d{8}$/.test(phone.replace(/[\s-]/g, ''))} onClick={pay}>{L.pay}</button>}
            {claim && (
              <>
                <p className="muted small">{L.dial}</p>
                <p className="muted small">{L.code}: <b>{claim}</b> · <code>{P.ussdCode}</code></p>
                <p className="muted small" aria-live="polite">{L.waiting}</p>
                <button type="button" className="btn wide" onClick={() => check(false)}>{L.check}</button>
              </>
            )}
            {msg && <p className="err" role="alert">{msg}</p>}
          </>
        )}
        <button type="button" className="btn small" onClick={onClose}>{L.close}</button>
      </div>
    </div>
  );
}
