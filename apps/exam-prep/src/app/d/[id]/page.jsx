'use client';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState, useCallback } from 'react';
import { deptById } from '@/data/departments.js';
import { api, useUser } from '@/lib/firebase.js';
import Quiz from '@/components/Quiz.jsx';

export default function Department() {
  const { id } = useParams(); const dept = deptById(id); const { user, ready } = useUser();
  const [data, setData] = useState(null); const [err, setErr] = useState(''); const [mode, setMode] = useState(null); const [n, setN] = useState(20);
  const load = useCallback(() => { api(`/api/bank?dept=${encodeURIComponent(id)}`).then(setData).catch((e) => setErr(e.message)); }, [id]);
  useEffect(() => { if (ready) load(); }, [ready, user?.uid, load]);
  if (!dept) return <div className="card"><h2>Department not found</h2><Link href="/">← All departments</Link></div>;
  const qs = data?.questions || [], max = qs.length;
  const examSet = () => qs.slice(0, Math.min(n, max));
  if (mode && data) return <Quiz key={mode} mode={mode} questions={mode === 'exam' ? examSet() : qs} onExit={() => setMode(null)} />;
  return (
    <>
      <p><Link href="/">← All departments</Link></p>
      <section className="card hero"><h1>{dept.name}</h1><p>{data ? `${data.total} question${data.total === 1 ? '' : 's'} with explanations` : 'Loading…'}</p></section>
      {err && <p className="err">{err}</p>}
      {data && data.total === 0 && (
        <div className="card"><h2>No questions here yet</h2><p>This department is waiting for its first questions. Add 15 new ones and you get a month of access to every department, free.</p><Link className="btn gold" href={`/contribute?dept=${id}`}>Contribute questions</Link></div>
      )}
      {data && max > 0 && (
        <>
          {data.locked && (
            <div className="card" style={{ borderColor: 'var(--gold)' }}>
              <b>Free preview: {max} of {data.total} questions.</b>
              <p className="hint">Unlock all {data.total} for 15 birr a month, or contribute 15 new questions to get a month free.</p>
              <div className="row"><Link className="btn gold" href="/account">Unlock for 15 birr</Link><Link className="btn alt" href={`/contribute?dept=${id}`}>Contribute 15 questions</Link></div>
            </div>
          )}
          <div className="card">
            <h2>Practice</h2><p className="hint">See the right answer and a full explanation after every question.</p>
            <button className="btn" onClick={() => setMode('practice')}>Start practice ({max} question{max === 1 ? '' : 's'})</button>
          </div>
          <div className="card">
            <h2>Exit exam simulation</h2><p className="hint">Timed, with answers revealed only at the end — like the real thing.</p>
            <label htmlFor="n">Number of questions</label>
            <select id="n" value={Math.min(n, max)} onChange={(e) => setN(+e.target.value)}>{[...new Set([5, 10, 20, 30, 50, 100, max].filter((x) => x <= max))].sort((a, b) => a - b).map((x) => <option key={x} value={x}>{x}</option>)}</select>
            <button className="btn gold mt" onClick={() => setMode('exam')}>Start timed exam</button>
          </div>
        </>
      )}
      {data && max > 0 && !data.locked && <p className="hint">Subscribed · {data.access.daysLeft} day{data.access.daysLeft === 1 ? '' : 's'} left. <Link href={`/contribute?dept=${id}`}>Add questions for this department</Link> to earn more free months.</p>}
    </>
  );
}
