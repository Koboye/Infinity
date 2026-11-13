'use client';
import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { COLLEGES } from '@/data/departments.js';
import { api, useUser } from '@/lib/firebase.js';
import AuthBox from '@/components/AuthBox.jsx';

const blank = { text: '', options: ['', '', '', ''], answer: -1, explanation: '', topic: '' };

function Form() {
  const { user, ready } = useUser(); const params = useSearchParams();
  const [dept, setDept] = useState(params.get('dept') || ''); const [cur, setCur] = useState(blank); const [list, setList] = useState([]); const [err, setErr] = useState(''); const [out, setOut] = useState(null); const [busy, setBusy] = useState(false);
  useEffect(() => { setErr(''); }, [cur]);
  if (!ready) return <p className="hint">Loading…</p>;
  if (!user) return <AuthBox why="Sign in to contribute questions" />;
  const setOpt = (i, v) => setCur((c) => ({ ...c, options: c.options.map((o, k) => (k === i ? v : o)) }));
  const addable = cur.text.trim().length >= 15 && cur.options.every((o) => o.trim()) && cur.answer >= 0 && cur.explanation.trim().length >= 20;
  const add = () => { if (list.length >= 15) return; setList([...list, cur]); setCur(blank); setOut(null); };
  const send = async () => {
    setBusy(true); setErr('');
    try {
      const r = await api('/api/exam', { action: 'contribute', dept, items: list });
      setOut(r); const bad = list.filter((_, i) => !r.results[i].ok); setList(bad);
    } catch (e) { setErr(e.message); }
    setBusy(false);
  };
  return (
    <>
      <section className="card hero"><h1>Contribute questions</h1><p>Add <b>15 new questions</b> your department’s bank does not have yet. When the owner approves them, you get <b>one month of access to every department, free</b>.</p></section>
      <div className="card">
        <label htmlFor="dp">Department</label>
        <select id="dp" value={dept} onChange={(e) => setDept(e.target.value)}><option value="">Choose…</option>{COLLEGES.map((c) => <optgroup key={c.id} label={c.name}>{c.depts.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</optgroup>)}</select>
        <p className="hint">Rules: write your own questions (no copying from books or other apps), make sure the marked answer is correct, and explain why. Copies of questions already in the bank are rejected automatically.</p>
      </div>
      <div className="card">
        <h2>Question {list.length + 1} of 15</h2>
        <label htmlFor="qt">Question</label><textarea id="qt" value={cur.text} onChange={(e) => setCur({ ...cur, text: e.target.value })} />
        {cur.options.map((o, i) => (
          <div key={i} className="row" style={{ flexWrap: 'nowrap', marginTop: 8 }}>
            <input type="radio" name="right" aria-label={`Option ${'ABCD'[i]} is correct`} style={{ width: 22 }} checked={cur.answer === i} onChange={() => setCur({ ...cur, answer: i })} />
            <input aria-label={`Option ${'ABCD'[i]}`} placeholder={`Option ${'ABCD'[i]}`} value={o} onChange={(e) => setOpt(i, e.target.value)} />
          </div>
        ))}
        <p className="hint">Select the circle beside the correct option.</p>
        <label htmlFor="ex">Explanation (why the answer is correct)</label><textarea id="ex" value={cur.explanation} onChange={(e) => setCur({ ...cur, explanation: e.target.value })} />
        <label htmlFor="tp">Topic (optional)</label><input id="tp" value={cur.topic} onChange={(e) => setCur({ ...cur, topic: e.target.value })} />
        <button className="btn mt" disabled={!addable || list.length >= 15} onClick={add}>Add to my batch</button>
      </div>
      {list.length > 0 && (
        <div className="card">
          <h2>My batch: {list.length}/15</h2>
          <div className="bar"><i style={{ width: `${(list.length / 15) * 100}%` }} /></div>
          {list.map((x, i) => <p key={i}>{i + 1}. {x.text} {out && !out.results?.[i]?.ok && out.results?.[i] && <span className="err">— {out.results[i].error}</span>} <button className="btn sm alt" onClick={() => setList(list.filter((_, k) => k !== i))}>Remove</button></p>)}
          {err && <p className="err">{err}</p>}
          <button className="btn gold" disabled={busy || !dept} onClick={send}>{list.length < 15 ? `Submit ${list.length} now (15 needed for a free month)` : 'Submit all 15'}</button>
          {!dept && <p className="err">Choose a department first.</p>}
        </div>
      )}
      {out && <div className="card"><p className="ok">{out.accepted} question{out.accepted === 1 ? '' : 's'} sent for review.</p>{out.results.some((r) => !r.ok) && <p className="err">Some were not accepted — fix or replace them in your batch above.</p>}</div>}
    </>
  );
}
export default function Contribute() { return <Suspense fallback={<p className="hint">Loading…</p>}><Form /></Suspense>; }
