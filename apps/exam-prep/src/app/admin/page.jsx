'use client';
// Owner screen: approve questions and payments. The secret never leaves this browser tab (sessionStorage) and is sent only as a header to our own API.
import { useCallback, useEffect, useState } from 'react';
import { deptById } from '@/data/departments.js';
import { api } from '@/lib/firebase.js';

export default function Admin() {
  const [secret, setSecret] = useState(''); const [input, setInput] = useState(''); const [pending, setPending] = useState([]); const [claims, setClaims] = useState([]); const [err, setErr] = useState('');
  useEffect(() => { setSecret(sessionStorage.getItem('adm') || ''); }, []);
  const load = useCallback(async () => {
    if (!secret) return; setErr('');
    try { const [a, b] = await Promise.all([api('/api/admin/review', undefined, { admin: secret }), api('/api/pay/confirm', undefined, { admin: secret })]); setPending(a.pending); setClaims(b.claims); }
    catch (e) { setErr(e.message); if (e.status === 401) { sessionStorage.removeItem('adm'); setSecret(''); } }
  }, [secret]);
  useEffect(() => { load(); }, [load]);
  const decide = async (id, decision) => { const reason = decision === 'reject' ? (prompt('Reason (shown to the student):') || 'Not accepted') : ''; try { await api('/api/admin/review', { id, decision, reason }, { admin: secret }); } catch (e) { setErr(e.message); } load(); };
  const pay = async (claim, reject) => { try { await api('/api/pay/confirm', { claim, reject }, { admin: secret }); } catch (e) { setErr(e.message); } load(); };
  if (!secret) return (<div className="card" style={{ maxWidth: 420 }}><h2>Owner access</h2><label htmlFor="s">Admin secret</label><input id="s" type="password" value={input} onChange={(e) => setInput(e.target.value)} />{err && <p className="err">{err}</p>}<button className="btn mt" onClick={() => { sessionStorage.setItem('adm', input); setSecret(input); }}>Open</button></div>);
  return (
    <>
      <div className="row" style={{ justifyContent: 'space-between' }}><h1>Owner</h1><button className="btn alt sm" onClick={() => { sessionStorage.removeItem('adm'); setSecret(''); }}>Lock</button></div>
      {err && <p className="err">{err}</p>}
      <div className="card"><h2>Payments waiting ({claims.length})</h2>
        {claims.length === 0 && <p className="hint">Nothing waiting.</p>}
        {claims.map((c) => <div key={c.claim} className="row" style={{ marginBottom: 8 }}><b>{c.claim}</b><span>{c.phone}</span><span className="hint">{c.amount} birr · {new Date(c.createdAt).toLocaleString()}</span><button className="btn sm" onClick={() => pay(c.claim)}>I received it ✓</button><button className="btn sm alt" onClick={() => pay(c.claim, true)}>Reject</button></div>)}
      </div>
      <div className="card"><h2>Questions to review ({pending.length})</h2>
        {pending.length === 0 && <p className="hint">Queue is empty.</p>}
        {pending.map((p) => (
          <div key={p.id} className="card" style={{ background: 'var(--soft)' }}>
            <span className="pill">{deptById(p.dept)?.name || p.dept}</span>
            <h3 className="mt">{p.q.text}</h3>
            {p.q.options.map((o, i) => <p key={i} style={{ margin: '2px 0' }}>{i === p.q.answer ? '✅' : '▫️'} {'ABCD'[i]}. {o}</p>)}
            <div className="expl">{p.q.explanation}</div>
            <div className="row mt"><button className="btn sm" onClick={() => decide(p.id, 'approve')}>Approve</button><button className="btn sm alt" onClick={() => decide(p.id, 'reject')}>Reject</button></div>
          </div>
        ))}
      </div>
    </>
  );
}
