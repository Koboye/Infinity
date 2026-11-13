'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/firebase.js';

const USSD = process.env.NEXT_PUBLIC_PAY_USSD || '';
const NOTE = process.env.NEXT_PUBLIC_PAY_NOTE || '';
const dial = (code) => `tel:${code.replace(/#/g, '%23')}`;

/** Pay 15 birr: the student dials the owner's code themselves (a tel: link opens the dialer; they press call), then says which number paid.
 *  Access starts when the owner or the payment provider confirms the payment on the server. */
export default function PayCard({ price = 15, openClaim, onChange }) {
  const [phone, setPhone] = useState(''); const [claim, setClaim] = useState(openClaim || null); const [msg, setMsg] = useState(''); const [busy, setBusy] = useState(false);
  useEffect(() => { if (!claim) return undefined; const t = setInterval(() => onChange?.(), 6000); return () => clearInterval(t); }, [claim]); // eslint-disable-line react-hooks/exhaustive-deps
  const start = async () => { setBusy(true); setMsg(''); try { const r = await api('/api/exam', { action: 'claim', phone }); setClaim({ claim: r.claim, phone: r.phone }); } catch (e) { setMsg(e.message); } setBusy(false); };
  return (
    <div className="card">
      <h2>Unlock every department — {price} birr / month</h2>
      {!claim ? (
        <>
          <p className="hint">Pay from your mobile account, then tell us which number you paid from so we can match it.</p>
          <label htmlFor="ph">Mobile number you will pay from</label>
          <input id="ph" inputMode="tel" placeholder="09…" value={phone} onChange={(e) => setPhone(e.target.value)} />
          {msg && <p className="err">{msg}</p>}
          <button className="btn gold mt" disabled={busy || !phone} onClick={start}>Continue to payment</button>
        </>
      ) : (
        <>
          <p>Payment reference: <b>{claim.claim}</b> · from <b>{claim.phone}</b></p>
          {USSD ? <p><a className="btn" href={dial(USSD)}>1. Open the dialer ({USSD})</a><br /><span className="hint">Review the amount ({price} birr) on your phone and press call yourself.</span></p> : <p className="hint">{NOTE || `Pay ${price} birr using the owner's payment instructions.`}</p>}
          <p className="hint">2. Your access starts automatically once the payment is confirmed (usually within minutes). This page checks every few seconds.</p>
          <button className="btn alt" onClick={() => onChange?.()}>Check now</button>
        </>
      )}
    </div>
  );
}
