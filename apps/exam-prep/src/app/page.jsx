'use client';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { COLLEGES, DEPARTMENTS } from '@/data/departments.js';
import { api } from '@/lib/firebase.js';
import { loadProgress, levelOf, DAILY_GOAL } from '@/lib/progress.js';

const GROUPS = [['all', 'All'], ['grade12', 'Grade 12'], ['uni', 'University & Exit'], ['freshman', 'Freshman']];
const inGroup = (c, g) => g === 'all' || (g === 'grade12' ? c.id === 'grade12' : g === 'freshman' ? c.id === 'freshman' : c.id !== 'grade12' && c.id !== 'freshman');

export default function Home() {
  const [q, setQ] = useState('');
  const [counts, setCounts] = useState({});
  const [group, setGroup] = useState('all');
  const [p, setP] = useState(null);
  useEffect(() => {
    api('/api/bank').then((r) => setCounts(r.counts || {})).catch(() => {});
    setP(loadProgress());
  }, []);
  const colleges = useMemo(() => {
    const k = q.trim().toLowerCase();
    return COLLEGES.filter((c) => inGroup(c, group))
      .map((c) => ({ ...c, depts: k ? c.depts.filter((d) => d.name.toLowerCase().includes(k) || c.name.toLowerCase().includes(k)) : c.depts }))
      .filter((c) => c.depts.length)
      .sort((a, b) => (a.id === 'grade12' ? -1 : b.id === 'grade12' ? 1 : 0));
  }, [q, group]);
  const lv = levelOf(p?.xp || 0);
  const goalPct = Math.min(100, Math.round(((p?.today || 0) / DAILY_GOAL) * 100));
  const acc = p?.answered ? Math.round((p.correct / p.answered) * 100) : null;
  const mistakes = p ? Object.values(p.mistakes || {}).reduce((n, m) => n + Object.keys(m || {}).length, 0) : 0;
  const recentId = p && Object.keys(p.best || {}).map((key) => DEPARTMENTS.find((d) => key === d.id || key.startsWith(d.id + ':'))?.id).find(Boolean);
  const featured = DEPARTMENTS.find((d) => d.id === recentId) || DEPARTMENTS.find((d) => d.id === 'g12-mathematics');
  return (
    <div className="ep-home">
      <section className="ep-welcome" aria-label="Welcome">
        <div className="ep-eyebrow">YOUR LEARNING SPACE</div>
        <h1>Make today count<span className="ep-spark"> ✦</span></h1>
        <p>One focused session brings you closer to exam day.</p>
        <div className="ep-mini-stats" aria-label="Learning progress">
          <span>🔥 <strong>{p?.streak || 0}</strong> day streak</span>
          <span>✦ <strong>{p?.xp || 0}</strong> XP</span>
          <span>Level <strong>{lv.level}</strong></span>
        </div>
      </section>

      <section className="ep-focus" aria-labelledby="ep-focus-title">
        <div className="ep-focus-top"><span className="ep-eyebrow">YOUR NEXT STEP</span><span className="ep-focus-icon" aria-hidden="true">↗</span></div>
        <h2 id="ep-focus-title">{recentId ? 'Pick up where you left off' : 'Ready for your first session?'}</h2>
        <p>{featured?.name || 'Mathematics'} · Learn with questions and explanations.</p>
        <Link className="ep-primary" href={`/d/${featured?.id || 'g12-mathematics'}`}>{recentId ? 'Continue learning' : 'Start learning'} <span aria-hidden="true">→</span></Link>
      </section>

      <section className="ep-goal" aria-label="Daily learning goal">
        <div className="ep-goal-head"><div><strong>Today's goal</strong><p>{Math.min(p?.today || 0, DAILY_GOAL)} of {DAILY_GOAL} questions completed</p></div><b>{goalPct}%</b></div>
        <div className="ep-goal-track" role="progressbar" aria-label="Daily goal" aria-valuenow={goalPct} aria-valuemin={0} aria-valuemax={100}><span style={{ width: `${goalPct}%` }} /></div>
      </section>

      <section className="ep-explore" aria-labelledby="ep-explore-title">
        <div className="ep-section-heading"><div><span className="ep-eyebrow">EXPLORE</span><h2 id="ep-explore-title">Find your subject</h2></div>{mistakes > 0 && <span className="ep-review-count">📝 {mistakes} to review</span>}</div>
        <label className="ep-search-label" htmlFor="ep-search">Search subjects or departments</label>
        <input id="ep-search" className="ep-search" placeholder="⌕  Search subjects or departments" value={q} onChange={(e) => setQ(e.target.value)} />
        <div className="ep-filter" role="group" aria-label="Education level">
          {GROUPS.map(([id, name]) => <button key={id} type="button" aria-pressed={group === id} className={group === id ? 'active' : ''} onClick={() => setGroup(id)}>{name}</button>)}
        </div>
        <div className="ep-college-list">
          {colleges.map((c) => <details key={c.id} className="ep-college">
            <summary><span className="ep-college-name">{c.name}</span><span className="ep-college-meta">{c.depts.length} subjects <span aria-hidden="true">⌄</span></span></summary>
            <div className="ep-departments">
              {c.depts.map((d) => <Link key={d.id} href={`/d/${d.id}`} className="ep-department"><span>{d.name}</span><small>{counts[d.id] ? `${counts[d.id]} questions` : 'Explore subject'}</small><span aria-hidden="true">→</span></Link>)}
            </div>
          </details>)}
        </div>
        {!colleges.length && <p className="hint">No subjects match “{q}”. Try another search.</p>}
      </section>
      <p className="ep-footer-note">{acc === null ? 'Your learning journey starts here.' : `Your overall answer accuracy: ${acc}%.`} <Link href="/account">Your account</Link></p>
    </div>
  );
}
