'use client';
import React, { useCallback, useState } from 'react';

type Claim = { claim: string; uid: string; phone: string; createdAt: number; name?: string };

/** Owner screen: see who says they paid, match it to the payment SMS on your phone, then Approve or Reject. */
export default function PayAdmin() {
  const [key, setKey] = useState('');
  const [claims, setClaims] = useState<Claim[] | null>(null);
  const [msg, setMsg] = useState('');
  const call = useCallback(async (init?: { claim: string; reject?: boolean }) => {
    setMsg('');
    const res = await fetch('/api/pay/confirm', {
      method: init ? 'POST' : 'GET',
      headers: { 'x-pay-secret': key, ...(init ? { 'content-type': 'application/json' } : {}) },
      body: init ? JSON.stringify(init) : undefined,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) { setMsg(data.error || `Error ${res.status}`); return false; }
    if (!init) setClaims(data.claims);
    return true;
  }, [key]);
  const act = async (claim: string, reject = false) => { if (await call({ claim, reject })) await call(); };
  const ago = (t: number) => { const m = Math.max(0, Math.round((Date.now() - t) / 60000)); return m < 60 ? `${m} min ago` : `${Math.round(m / 60)} h ago`; };
  return (
    <main style={{ maxWidth: 720, margin: '0 auto', padding: 16, fontFamily: 'system-ui, sans-serif' }}>
      <h1>Payments</h1>
      <p>Match each claim to the payment SMS on your phone (payer number, amount, time), then approve it. The player&apos;s pass opens at once.</p>
      <input type="password" placeholder="PAY_WEBHOOK_SECRET" value={key} onChange={(e) => setKey(e.target.value)} style={{ width: '100%', padding: 8 }} />
      <button type="button" onClick={() => call()} style={{ margin: '8px 0', padding: 8 }}>Load open claims</button>
      {msg && <p role="alert" style={{ color: '#b00' }}>{msg}</p>}
      {claims && !claims.length && <p>No open claims.</p>}
      {claims?.map((c) => (
        <div key={c.claim} style={{ border: '1px solid #8886', borderRadius: 8, padding: 12, margin: '8px 0' }}>
          <div><b>{c.name || c.uid.slice(0, 8)}</b> · pays from <b>{c.phone || 'no number given'}</b> · {ago(c.createdAt)}</div>
          <div style={{ fontSize: 13, opacity: 0.7 }}>code {c.claim}</div>
          <button type="button" onClick={() => act(c.claim)} style={{ marginRight: 8, padding: 8 }}>Approve</button>
          <button type="button" onClick={() => act(c.claim, true)} style={{ padding: 8 }}>Reject</button>
        </div>
      ))}
    </main>
  );
}
