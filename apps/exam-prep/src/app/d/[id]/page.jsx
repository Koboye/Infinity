'use client';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState, useCallback, useMemo } from 'react';
import { deptById } from '@/data/departments.js';
import { api, useUser } from '@/lib/firebase.js';
import Quiz from '@/components/Quiz.jsx';
import { mistakesFor, loadProgress } from '@/lib/progress.js';

export default function Department() {
  const { id } = useParams(); const dept = deptById(id); const { user, ready } = useUser();
  const [data, setData] = useState(null); const [err, setErr] = useState(''); const [mode, setMode] = useState(null); const [n, setN] = useState(20); const [topic, setTopic] = useState(''); const [mist, setMist] = useState([]); const [best, setBest] = useState({});
  const load = useCallback(() => { api(`/api/bank?dept=${encodeURIComponent(id)}`).then(setData).catch((e) => setErr(e.message)); }, [id]);
  useEffect(() => { if (ready) load(); }, [ready, user?.uid, load]);
  useEffect(() => { setMist(mistakesFor(id)); setBest(loadProgress().best); }, [id, mode]);
  const all = data?.questions || [];
  const topics = useMemo(() => [...new Set(all.map((x) => x.topic).filter(Boolean))].sort(), [all]);
  const qs = useMemo(() => (topic ? all.filter((x) => x.topic === topic) : all), [all, topic]);
  const examQs = useMemo(() => qs.slice(0, Math.min(n, qs.length)), [qs, n]);
  if (!dept) return <div className="card"><h2>Department not found</h2><Link href="/">← All departments</Link></div>;
  const max = qs.length;
  if (mode && data) return <Quiz key={mode + topic} dept={id} mode={mode === 'exam' ? 'exam' : 'practice'} label={mode === 'mistakes' ? 'Fix my mistakes' : topic || 'Practice'} questions={mode === 'exam' ? examQs : mode === 'mistakes' ? mist : qs} onExit={() => setMode(null)} />;
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
          {mist.length > 0 && (
            <div className="card" style={{ borderColor: 'var(--bad)' }}>
              <h2>📝 Fix my mistakes</h2><p className="hint">{mist.length} question{mist.length === 1 ? '' : 's'} you got wrong. Answer one correctly and it leaves the list.</p>
              <button className="btn" onClick={() => setMode('mistakes')}>Practise my mistakes ({mist.length})</button>
            </div>
          )}
          {topics.length > 1 && (
            <div className="chips" role="tablist" aria-label="Filter by paper year or topic">
              <button className={!topic ? 'on' : ''} onClick={() => setTopic('')}>All</button>
              {topics.map((t) => <button key={t} className={topic === t ? 'on' : ''} onClick={() => setTopic(t)}>{t}</button>)}
            </div>
          )}
          <div className="card">
            <h2>Practice {best[`${id}:practice`] ? <span className="pill good">best {best[`${id}:practice`]}%</span> : null}</h2><p className="hint">See the right answer and a full explanation after every question.</p>
            <button className="btn" onClick={() => setMode('practice')}>Start practice ({max} question{max === 1 ? '' : 's'})</button>
          </div>
          <div className="card">
            <h2>{dept.college === 'grade12' ? 'Mock entrance exam' : 'Exit exam simulation'} {best[`${id}:exam`] ? <span className="pill good">best {best[`${id}:exam`]}%</span> : null}</h2><p className="hint">Timed, with answers revealed only at the end — like the real thing.</p>
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
