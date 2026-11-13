'use client';
import { useMemo, useState, useEffect, useRef, useCallback } from 'react';
import Explain from './Explain.jsx';
import { recordAnswer, saveBest, loadProgress, DAILY_GOAL } from '@/lib/progress.js';

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
const PRAISE = ['Nice!', 'Great!', 'On fire!', 'Unstoppable!', 'Genius!'];

/** mode 'practice': feedback + smart explanation after each answer, XP and combos.  mode 'exam': timed, answers shown only at the end. */
export default function Quiz({ questions, mode, onExit, dept = '', label = '' }) {
  const [run, setRun] = useState(0);
  const set = useMemo(() => shuffle(questions).map(withShuffledOptions), [questions, run]); // eslint-disable-line react-hooks/exhaustive-deps
  const [i, setI] = useState(0);
  const [picked, setPicked] = useState({});
  const [done, setDone] = useState(false);
  const [combo, setCombo] = useState(0), [best, setBest] = useState(0), [xp, setXp] = useState(0), [flash, setFlash] = useState(null), [today, setToday] = useState(0);
  const total = set.length, minutes = Math.max(1, Math.ceil(total * 1.2));
  const [left, setLeft] = useState(minutes * 60);
  const saved = useRef(false);
  useEffect(() => { setToday(loadProgress().today); }, []);
  useEffect(() => { if (mode !== 'exam' || done) return undefined; const t = setInterval(() => setLeft((s) => { if (s <= 1) { setDone(true); return 0; } return s - 1; }), 1000); return () => clearInterval(t); }, [mode, done]);
  const restart = () => { setRun((r) => r + 1); setI(0); setPicked({}); setDone(false); setLeft(minutes * 60); setCombo(0); setBest(0); setXp(0); setFlash(null); saved.current = false; };
  const score = set.filter((q) => picked[q.id] === q.answer).length;
  const finished = done || (mode === 'practice' && i >= total);

  // exam mode: record everything once, when it ends
  useEffect(() => {
    if (!finished || saved.current) return;
    saved.current = true;
    if (mode === 'exam') { let gain = 0; set.forEach((q) => { if (picked[q.id] != null) gain += recordAnswer(dept, q, picked[q.id] === q.answer, 0).gain; }); setXp(gain); }
    if (total) saveBest(`${dept}:${mode}`, Math.round((score / total) * 100));
  }, [finished]); // eslint-disable-line react-hooks/exhaustive-deps

  const q = set[i], chosen = q ? picked[q.id] : undefined, reveal = mode === 'practice' && chosen != null;
  const choose = useCallback((k) => {
    if (!q || (mode === 'practice' && picked[q.id] != null)) return;
    setPicked((p) => ({ ...p, [q.id]: k }));
    if (mode === 'practice') {
      const ok = k === q.answer, c = ok ? combo + 1 : 0;
      const r = recordAnswer(dept, q, ok, combo);
      setCombo(c); setBest((b) => Math.max(b, c)); setXp((x) => x + r.gain); setToday(r.state.today);
      setFlash({ ok, gain: r.gain, text: ok ? (c >= 3 ? `${PRAISE[Math.min(c - 3, 4)]} ${c} in a row` : PRAISE[0]) : 'Learn from it', n: Date.now() });
    }
  }, [q, mode, picked, combo, dept]);
  const next = useCallback(() => { if (i + 1 < total) setI(i + 1); else if (mode === 'exam') setDone(true); else setI(total); }, [i, total, mode]);

  useEffect(() => {
    if (finished || !q) return undefined;
    const onKey = (e) => {
      if (e.target && /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
      const k = 'abcd'.indexOf(e.key.toLowerCase()), n = ['1', '2', '3', '4'].indexOf(e.key);
      if (k >= 0 && k < q.options.length) choose(k); else if (n >= 0 && n < q.options.length) choose(n);
      else if ((e.key === 'Enter' || e.key === 'ArrowRight') && (mode === 'exam' || reveal)) next();
    };
    window.addEventListener('keydown', onKey); return () => window.removeEventListener('keydown', onKey);
  }, [finished, q, choose, next, mode, reveal]);

  if (finished) {
    const pct = total ? Math.round((score / total) * 100) : 0;
    const msg = pct >= 80 ? '🏆 Outstanding!' : pct >= 50 ? '👏 Well done — keep going!' : '💪 Every mistake is saved to your review list.';
    return (
      <div className="card">
        <div className="center"><div className="big pop">{pct}%</div><p><b>{score} of {total}</b> correct · {msg}</p>
          <div className="row" style={{ justifyContent: 'center' }}>{xp > 0 && <span className="pill good">+{xp} XP</span>}{best > 1 && <span className="pill warn">🔥 best combo {best}</span>}</div></div>
        <div className="row mt" style={{ justifyContent: 'center' }}><button className="btn" onClick={restart}>Try again</button><button className="btn alt" onClick={onExit}>Back</button></div>
        <h3 className="mt">Review {set.length - score > 0 ? `· ${set.length - score} to learn` : ''}</h3>
        {set.map((x, n) => (
          <details key={x.id} open={picked[x.id] !== x.answer && n < 40}>
            <summary>{n + 1}. {picked[x.id] === x.answer ? '✅' : picked[x.id] == null ? '⏭️' : '❌'} {x.text}</summary>
            <Explain q={x} chosen={picked[x.id]} />
          </details>
        ))}
      </div>
    );
  }
  const mm = String(Math.floor(left / 60)).padStart(2, '0'), ss = String(left % 60).padStart(2, '0');
  return (
    <div className="card quiz">
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <span className="pill">{mode === 'exam' ? 'Exit exam simulation' : label || 'Practice'} · {i + 1}/{total}</span>
        <span className="row" style={{ gap: 6 }}>
          {mode === 'practice' && combo >= 2 && <span className="pill warn pop" key={combo}>🔥 {combo}</span>}
          {mode === 'practice' && <span className="pill good">⭐ {xp}</span>}
          {mode === 'exam' && <span className={`pill ${left < 60 ? 'bad' : ''}`}>⏱ {mm}:{ss}</span>}
        </span>
      </div>
      <div className="bar mt"><i style={{ width: `${(i / total) * 100}%` }} /></div>
      {mode === 'practice' && <p className="hint goal">Daily goal: {Math.min(today, DAILY_GOAL)}/{DAILY_GOAL}{today >= DAILY_GOAL ? ' 🎯 reached!' : ''}</p>}
      {q.topic && <p className="hint">{q.topic}</p>}
      <h3 className="qtext">{q.text}</h3>
      {q.options.map((o, k) => (
        <button key={k} disabled={reveal} className={`opt ${reveal ? (k === q.answer ? 'right' : k === chosen ? 'wrong shake' : '') : chosen === k ? 'sel' : ''}`} onClick={() => choose(k)}>
          <b className="ltr">{LETTERS[k]}</b><span>{o}</span>
        </button>
      ))}
      {reveal && flash && <div className={`flash ${flash.ok ? 'ok' : 'err'}`} key={flash.n}>{flash.text} · +{flash.gain} XP</div>}
      {reveal && <Explain q={q} chosen={chosen} />}
      <div className="row mt" style={{ justifyContent: 'space-between' }}>
        <button className="btn alt" onClick={onExit}>Quit</button>
        <div className="row">
          {mode === 'exam' && i > 0 && <button className="btn alt" onClick={() => setI(i - 1)}>Back</button>}
          <button className={`btn ${i + 1 >= total ? 'gold' : ''}`} disabled={mode === 'practice' && chosen == null} onClick={next}>{i + 1 < total ? 'Next →' : 'Finish'}</button>
        </div>
      </div>
      <p className="hint kb">Tip: press A–D to answer, Enter for next.</p>
    </div>
  );
}
