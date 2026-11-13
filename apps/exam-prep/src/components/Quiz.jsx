'use client';
import { useMemo, useState, useEffect } from 'react';

const shuffle = (a) => { const b = [...a]; for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; };
const LETTERS = ['A', 'B', 'C', 'D'];
// Options are re-ordered for every attempt so the right answer is not always in the same slot. A question whose options refer to
// each other ("all of the above", "none of them", "both A and B") keeps its order, because shuffling would change its meaning.
const POSITIONAL = /\b(all|none|neither|both)\b.*\b(above|them|these|a and b)\b|\bnone of\b|\ball of\b/i;
const withShuffledOptions = (q) => {
  if (q.options.some((o) => POSITIONAL.test(o))) return q;
  const order = shuffle(q.options.map((_, k) => k));
  return { ...q, options: order.map((k) => q.options[k]), answer: order.indexOf(q.answer) };
};

/** mode 'practice': feedback and the explanation right after each answer.  mode 'exam': timed, answers shown only at the end (like the real exit exam). */
export default function Quiz({ questions, mode, onExit }) {
  const [run, setRun] = useState(0);
  const set = useMemo(() => shuffle(questions).map(withShuffledOptions), [questions, run]); // eslint-disable-line react-hooks/exhaustive-deps
  const [i, setI] = useState(0);
  const [picked, setPicked] = useState({});     // question id -> chosen option index
  const [done, setDone] = useState(false);
  const total = set.length, minutes = Math.max(1, Math.ceil(total * 1.2));
  const [left, setLeft] = useState(minutes * 60);
  useEffect(() => { if (mode !== 'exam' || done) return undefined; const t = setInterval(() => setLeft((s) => { if (s <= 1) { setDone(true); return 0; } return s - 1; }), 1000); return () => clearInterval(t); }, [mode, done]);
  const restart = () => { setRun((r) => r + 1); setI(0); setPicked({}); setDone(false); setLeft(minutes * 60); };
  const score = set.filter((q) => picked[q.id] === q.answer).length;

  if (done || (mode === 'practice' && i >= total)) {
    const pct = Math.round((score / total) * 100);
    return (
      <div className="card">
        <div className="center"><div className="big">{pct}%</div><p>{score} of {total} correct {pct >= 50 ? '— well done!' : '— keep practising.'}</p></div>
        <div className="row" style={{ justifyContent: 'center' }}><button className="btn" onClick={restart}>Try again</button><button className="btn alt" onClick={onExit}>Back</button></div>
        <h3 className="mt">Review</h3>
        {set.map((q, n) => (
          <details key={q.id} open={picked[q.id] !== q.answer}>
            <summary>{n + 1}. {picked[q.id] === q.answer ? '✅' : picked[q.id] == null ? '⏭️' : '❌'} {q.text}</summary>
            <p className="hint">Correct answer: <b>{LETTERS[q.answer]}. {q.options[q.answer]}</b>{picked[q.id] != null && picked[q.id] !== q.answer && <> · You chose {LETTERS[picked[q.id]]}. {q.options[picked[q.id]]}</>}</p>
            <div className="expl">{q.explanation}</div>
          </details>
        ))}
      </div>
    );
  }
  const q = set[i], chosen = picked[q.id], reveal = mode === 'practice' && chosen != null;
  const mm = String(Math.floor(left / 60)).padStart(2, '0'), ss = String(left % 60).padStart(2, '0');
  return (
    <div className="card">
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <span className="pill">{mode === 'exam' ? 'Exit exam simulation' : 'Practice'} · {i + 1}/{total}</span>
        {mode === 'exam' && <span className={`pill ${left < 60 ? 'bad' : ''}`}>⏱ {mm}:{ss}</span>}
      </div>
      <div className="bar mt"><i style={{ width: `${(i / total) * 100}%` }} /></div>
      {q.topic && <p className="hint mt">{q.topic}</p>}
      <h3>{q.text}</h3>
      {q.options.map((o, k) => (
        <button key={k} disabled={reveal} className={`opt ${reveal ? (k === q.answer ? 'right' : k === chosen ? 'wrong' : '') : chosen === k ? 'sel' : ''}`} onClick={() => setPicked((p) => ({ ...p, [q.id]: k }))}>
          <b>{LETTERS[k]}.</b> {o}
        </button>
      ))}
      {reveal && <div className="expl"><b>{chosen === q.answer ? '✅ Correct. ' : '❌ Not quite. '}</b>{q.explanation}</div>}
      <div className="row mt" style={{ justifyContent: 'space-between' }}>
        <button className="btn alt" onClick={onExit}>Quit</button>
        <div className="row">
          {mode === 'exam' && i > 0 && <button className="btn alt" onClick={() => setI(i - 1)}>Back</button>}
          {i + 1 < total
            ? <button className="btn" disabled={mode === 'practice' && chosen == null} onClick={() => setI(i + 1)}>Next</button>
            : <button className="btn gold" disabled={mode === 'practice' && chosen == null} onClick={() => (mode === 'exam' ? setDone(true) : setI(total))}>Finish</button>}
        </div>
      </div>
    </div>
  );
}
