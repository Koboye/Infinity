'use client';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { COLLEGES } from '@/data/departments.js';
import { api } from '@/lib/firebase.js';

export default function Home() {
  const [q, setQ] = useState(''); const [counts, setCounts] = useState({});
  useEffect(() => { api('/api/bank').then((r) => setCounts(r.counts || {})).catch(() => {}); }, []);
  const colleges = useMemo(() => {
    const k = q.trim().toLowerCase();
    return COLLEGES.map((c) => ({ ...c, depts: k ? c.depts.filter((d) => d.name.toLowerCase().includes(k) || c.name.toLowerCase().includes(k)) : c.depts })).filter((c) => c.depts.length);
  }, [q]);
  return (
    <>
      <section className="card hero">
        <h1>Pass your university exams and your exit exam</h1>
        <p>Questions with full explanations for every department. <b>15 birr a month</b> — or add 15 new questions for your department and get a month free.</p>
        <div className="row mt"><Link className="btn gold" href="/account">Get access</Link><Link className="btn alt" style={{ color: '#fff', borderColor: '#fff' }} href="/contribute">Contribute questions</Link></div>
      </section>
      <input aria-label="Search your department" placeholder="Search your department…" value={q} onChange={(e) => setQ(e.target.value)} style={{ marginBottom: 14 }} />
      {colleges.map((c) => (
        <section key={c.id} className="card">
          <h2>{c.name}</h2>
          <div className="grid">
            {c.depts.map((d) => (
              <Link key={d.id} href={`/d/${d.id}`} className="dept"><b>{d.name}</b><small>{counts[d.id] ? `${counts[d.id]} questions` : 'Be the first to contribute'}</small></Link>
            ))}
          </div>
        </section>
      ))}
      {!colleges.length && <p className="hint">No department matches “{q}”.</p>}
    </>
  );
}
