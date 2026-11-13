'use client';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { COLLEGES } from '@/data/departments.js';
import { api } from '@/lib/firebase.js';
import { loadProgress, levelOf, DAILY_GOAL } from '@/lib/progress.js';

const GROUPS = [['all', 'All'], ['grade12', '🎓 Grade 12 Entrance'], ['uni', '🏛 University & Exit'], ['freshman', '📘 Freshman']];
const inGroup = (c, g) => g === 'all' || (g === 'grade12' ? c.id === 'grade12' : g === 'freshman' ? c.id === 'freshman' : c.id !== 'grade12' && c.id !== 'freshman');

export default function Home() {
  const [q, setQ] = useState(''), [counts, setCounts] = useState({}), [group, setGroup] = useState('all'), [p, setP] = useState(null);
  useEffect(() => { api('/api/bank').then((r) => setCounts(r.counts || {})).catch(() => {}); setP(loadProgress()); }, []);
  const colleges = useMemo(() => {
    const k = q.trim().toLowerCase();
    return COLLEGES.filter((c) => inGroup(c, group)).map((c) => ({ ...c, depts: k ? c.depts.filter((d) => d.name.toLowerCase().includes(k) || c.name.toLowerCase().includes(k)) : c.depts })).filter((c) => c.depts.length)
      .sort((a, b) => (a.id === 'grade12' ? -1 : b.id === 'grade12' ? 1 : 0));
  }, [q, group]);
  const lv = levelOf(p?.xp || 0), goalPct = Math.min(100, Math.round(((p?.today || 0) / DAILY_GOAL) * 100));
  const acc = p?.answered ? Math.round((p.correct / p.answered) * 100) : 0;
  const mistakes = p ? Object.values(p.mistakes).reduce((n, m) => n + Object.keys(m).length, 0) : 0;
  return (
    <>
      <section className="card hero">
        <h1>Pass your entrance, university and exit exams</h1>
        <p>Real past-paper questions with a smart explanation after every answer. <b>15 birr a month</b> — or add 15 new questions and get a month free.</p>
        <div className="row mt"><Link className="btn gold" href="/account">Get access</Link><Link className="btn alt" style={{ color: '#fff', borderColor: '#fff' }} href="/contribute">Contribute questions</Link></div>
      </section>
      <div className="stats" aria-label="Your progress">
        <div className="stat"><b>🔥 {p?.streak || 0}</b><small>day streak</small></div>
        <div className="stat"><b>⭐ {p?.xp || 0}</b><small>XP · Level {lv.level}</small></div>
        <div className="stat"><b>🎯 {acc}%</b><small>accuracy</small></div>
        <div className="stat"><b>📝 {mistakes}</b><small>to review</small></div>
      </div>
      <div className="card"><b>Daily goal: {Math.min(p?.today || 0, DAILY_GOAL)}/{DAILY_GOAL} questions {goalPct >= 100 ? '🎉' : ''}</b><div className="ring"><i style={{ width: `${goalPct}%` }} /></div></div>
      <input aria-label="Search your department or subject" placeholder="Search your department or subject…" value={q} onChange={(e) => setQ(e.target.value)} style={{ marginBottom: 10 }} />
      <div className="chips" role="tablist">{GROUPS.map(([id, name]) => <button key={id} role="tab" aria-selected={group === id} className={group === id ? 'on' : ''} onClick={() => setGroup(id)}>{name}</button>)}</div>
      {colleges.map((c) => {
        const total = c.depts.reduce((n, d) => n + (counts[d.id] || 0), 0);
        return (
          <details key={c.id} className={`card coll ${c.id === 'grade12' ? 'feature' : ''}`} open={c.id === 'grade12' || !!q || group !== 'all'}>
            <summary><b>{c.name}</b> <span className="pill">{total ? `${total} questions` : `${c.depts.length} departments`}</span></summary>
            <div className="grid mt">
              {c.depts.map((d) => (
                <Link key={d.id} href={`/d/${d.id}`} className="dept"><b>{d.name}</b><small>{counts[d.id] ? `${counts[d.id]} questions` : 'Be the first to contribute'}</small></Link>
              ))}
            </div>
          </details>
        );
      })}
      {!colleges.length && <p className="hint">No department matches “{q}”.</p>}
    </>
  );
}
