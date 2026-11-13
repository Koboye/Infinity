'use client';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { deptById } from '@/data/departments.js';
import { api, useUser } from '@/lib/firebase.js';
import AuthBox from '@/components/AuthBox.jsx';
import PayCard from '@/components/PayCard.jsx';

const STATUS = { pending: ['In review', 'warn'], approved: ['Approved ✓', 'good'], rejected: ['Rejected', 'bad'] };

export default function Account() {
  const { user, ready } = useUser(); const [me, setMe] = useState(null); const [err, setErr] = useState('');
  const load = useCallback(() => api('/api/exam', { action: 'me' }).then(setMe).catch((e) => setErr(e.message)), []);
  useEffect(() => { if (user) load(); }, [user, load]);
  if (!ready) return <p className="hint">Loading…</p>;
  if (!user) return <AuthBox why="Sign in to unlock your exams" />;
  if (!me) return <p className={err ? 'err' : 'hint'}>{err || 'Loading your account…'}</p>;
  const { sub } = me;
  return (
    <>
      <section className="card hero"><h1>My account</h1><p>{user.email || user.displayName}</p></section>
      <div className="card">
        <h2>Access</h2>
        {sub.subscribed ? <p><span className="pill good">Active</span> {sub.daysLeft} day{sub.daysLeft === 1 ? '' : 's'} left (until {new Date(sub.until).toLocaleDateString()}). All departments are unlocked.</p> : <p><span className="pill warn">Not active</span> You can try {5} questions per department for free.</p>}
        <p className="hint">Paying again adds a month after your current time runs out.</p>
      </div>
      <PayCard price={me.price} openClaim={me.openClaim} onChange={load} />
      <div className="card">
        <h2>Or earn a free month</h2>
        <p>Contribute {me.batch} new, correct questions with explanations for a department. Once they are reviewed and approved, you get 30 days of access to every department.</p>
        <Link className="btn alt" href="/contribute">Contribute questions</Link>
        {me.credits.length > 0 && <div className="mt">{me.credits.map((c) => <p key={c.dept} className="hint"><b>{deptById(c.dept)?.name || c.dept}</b>: {c.approved} approved · {c.toNext} more for your next free month</p>)}</div>}
      </div>
      {me.contribs.length > 0 && (
        <div className="card"><h2>My submissions</h2>
          {me.contribs.slice(0, 30).map((c) => (<p key={c.id}><span className={`pill ${STATUS[c.status][1]}`}>{STATUS[c.status][0]}</span> <span className="hint">{deptById(c.dept)?.name}</span><br />{c.text}{c.reason && <><br /><span className="err">{c.reason}</span></>}</p>))}
        </div>
      )}
    </>
  );
}
