'use client';
import {useEffect, useRef, useState} from 'react';
import ExamCalculator, {CALC_ICON} from './ExamCalculator';
import {ACCENTS, Svg, iconFor} from './HomeScreen';
import {makeT} from '@/lib/infText';

const T0 = makeT('en');
const clock = (s) => Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
const letter = (i) => String.fromCharCode(65 + i);
const examSeconds = (n) => Math.max(60, Math.ceil(n * 1.2) * 60);
const PICT = /\p{Extended_Pictographic}(?:\uFE0F|\u200D\p{Extended_Pictographic})*/gu;
// A counting question shows its pictures in their own stage: q.visual if the data has one, otherwise two or more emoji found in the text.
const splitVisual = (q) => {
  if (q.visual) return {title: q.text, items: Array.from(String(q.visual).matchAll(PICT), (m) => m[0])};
  const items = Array.from(String(q.text).matchAll(PICT), (m) => m[0]);
  const title = String(q.text).replace(PICT, '').replace(/\s{2,}/g, ' ').trim();
  return items.length >= 2 && title ? {title, items} : {title: q.text, items: []};
};
const G = {
  check: <path d="m5 12.5 4.5 4.5L19 7.5" />, cross: <path d="M6 6l12 12M18 6L6 18" />, flag: <path d="M5 21V4M5 5h12l-2 4 2 4H5" />,
  list: <><rect x="4" y="4" width="7" height="7" rx="2" /><rect x="13" y="4" width="7" height="7" rx="2" /><rect x="4" y="13" width="7" height="7" rx="2" /><rect x="13" y="13" width="7" height="7" rx="2" /></>,
  left: <path d="M19 12H5M11 6l-6 6 6 6" />, right: <path d="M5 12h14M13 6l6 6-6 6" />, out: <><path d="M9 4H6a2 2 0 00-2 2v12a2 2 0 002 2h3" /><path d="M16 8l4 4-4 4M20 12H9" /></>,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>, game: <><rect x="3" y="8" width="18" height="10" rx="5" /><path d="M8 11v4M6 13h4M16 12h.01M18 14h.01" /></>,
};

/* ---------- running a practice or an exam ---------- */
export function ExamRunner({exam, answers, seconds, flags, onPick, onGo, onFlag, onFinish, onExit, onBreak, breakOpen, onResume, games, t = T0}) {
  const [list, setList] = useState(false), [calc, setCalc] = useState(false);
  const calcBtn = useRef(null);
  const N = exam.questions.length, q = exam.questions[exam.index], exm = exam.mode === 'exam';
  const picked = answers[q.id], done = Object.keys(answers).length, locked = !exm && picked != null;
  const low = exm && seconds <= 60;

  useEffect(() => {
    const h = (e) => {
      if (e.metaKey || e.ctrlKey || e.altKey || list || breakOpen) return;
      if (e.target?.closest?.('.inf-x-calc')) return; // typing in the calculator must not pick answers
      const tag = e.target?.tagName; if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      const k = e.key.toLowerCase(), n = 'abcd'.indexOf(k) >= 0 ? 'abcd'.indexOf(k) : '1234'.indexOf(k);
      if (n >= 0 && n < q.options.length) return onPick(q.id, n);
      if (e.key === 'ArrowRight' && exam.index < N - 1) onGo(exam.index + 1);
      if (e.key === 'ArrowLeft' && exam.index > 0) onGo(exam.index - 1);
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  });

  const closeCalc = () => { setCalc(false); calcBtn.current?.focus(); };

  const finish = () => {
    const left = N - done;
    if (left > 0 && !window.confirm(t('finishConfirm', {n: left}))) return;
    onFinish();
  };
  const ico = iconFor(exam.subject);
  const state = (i) => {
    if (!locked) return picked === i ? 'is-on' : '';
    return i === q.correct ? 'is-right' : picked === i ? 'is-wrong' : 'is-dim';
  };

  const marks = exam.questions.reduce((a, x) => a + (Number(x.marks) || 1), 0);
  const vis = splitVisual(q);

  return (
    <section className={'inf-x inf-x-run' + (calc ? ' has-calc' : '')} aria-label={exam.subject}>
      <div className="inf-x-body">
      <header className="inf-x-top">
        <span className="inf-x-badge" aria-hidden="true">{ico ? <Svg size={28}>{ico}</Svg> : exam.subject.trim().charAt(0).toUpperCase()}</span>
        <div><h1>{exam.subject}</h1><p>{exm ? t('modeExam') : t('modePractice')}</p></div>
        <button type="button" className="inf-x-exit" onClick={onExit}><Svg size={20}>{G.out}</Svg><span>{t('exit')}</span></button>
      </header>

      <div className="inf-x-bar" role="group">
        <div><button type="button" className="inf-x-stat" onClick={() => setList(true)} aria-label={t('questionList')}>
          <Svg size={26}>{G.list}</Svg><span><small>{t('qLabel')}</small><b>{t('qOfN', {a: exam.index + 1, b: N})}</b></span></button></div>
        {exm
          ? <div className={low ? 'is-low' : ''}><span className="inf-x-stat"><Svg size={26}>{G.clock}</Svg><span><small>{t('timeLeft')}</small><b aria-live="off">{clock(seconds)}</b></span></span></div>
          : <div><span className="inf-x-stat"><Svg size={26}>{G.check}</Svg><span><small>{t('correctLabel')}</small><b>{exam.questions.filter((x) => answers[x.id] === x.correct).length}</b></span></span></div>}
        <div><span className="inf-x-stat"><Svg size={26}>{G.flag}</Svg><span><small>{t('totalMarks')}</small><b>{marks}</b></span></span></div>
        <button type="button" ref={calcBtn} className="inf-x-calcbtn" aria-pressed={calc} aria-label={t('calculator')} onClick={() => (calc ? closeCalc() : setCalc(true))}><Svg size={24}>{CALC_ICON.calc}</Svg><span>{t('calculator')}</span></button>
      </div>
      <div className="inf-x-prog" role="progressbar" aria-valuemin={1} aria-valuemax={N} aria-valuenow={exam.index + 1}><i style={{width: ((exam.index + 1) / N) * 100 + '%'}} /></div>

      <div className="inf-x-main">
        {breakOpen ? (
          <div className="inf-x-card inf-x-break"><h2>{t('pausedPick')}</h2>{games}<button type="button" className="inf-x-next" onClick={onResume}>{t('resumeBtn')}</button></div>
        ) : list ? (
          <div className="inf-x-card">
            <h2 className="inf-x-q">{t('questionList')}</h2>
            <div className="inf-x-grid">
              {exam.questions.map((x, i) => (
                <button type="button" key={x.id} className={(answers[x.id] != null ? 'is-done ' : '') + (flags[x.id] ? 'is-flag ' : '') + (i === exam.index ? 'is-now' : '')}
                  aria-label={t('qLabel') + ' ' + (i + 1)} onClick={() => { onGo(i); setList(false); }}>{i + 1}</button>
              ))}
            </div>
            <p className="inf-x-legend"><span className="d1" />{t('legendDone')}<span className="d2" />{t('legendFlag')}<span className="d3" />{t('legendNow')}</p>
            <button type="button" className="inf-x-next" onClick={finish}>{t('finishExam')}</button>
          </div>
        ) : (
          <div className="inf-x-card" key={exam.index}>
            <button type="button" className={'inf-x-flag' + (flags[q.id] ? ' is-on' : '')} aria-pressed={!!flags[q.id]} aria-label={flags[q.id] ? t('flagged') : t('flag')} onClick={() => onFlag(q.id)}><Svg size={18}>{G.flag}</Svg><span>{flags[q.id] ? t('flagged') : t('flag')}</span></button>
            <h2 className="inf-x-q">{vis.title}</h2>
            {vis.items.length > 0 && (
              <div className="inf-x-stage" role="img" aria-label={vis.items.length + ' ' + vis.items[0]}>
                <div style={{'--per': vis.items.length > 6 ? 5 : 3}}>{vis.items.map((e, i) => <span key={i} aria-hidden="true">{e}</span>)}</div>
              </div>
            )}
            <div className="inf-x-opts" role="radiogroup" aria-label={t('qLabel') + ' ' + (exam.index + 1)}>
              {q.options.map((o, i) => (
                <button type="button" role="radio" aria-checked={picked === i} key={i} className={'inf-x-opt ' + state(i)} onClick={() => onPick(q.id, i)}>
                  <span className="inf-x-let">{letter(i)}</span><span className="inf-x-txt">{o}</span>
                  {locked && i === q.correct && <span className="inf-x-mk" aria-hidden="true"><Svg size={18}>{G.check}</Svg></span>}
                  {locked && picked === i && i !== q.correct && <span className="inf-x-mk" aria-hidden="true"><Svg size={18}>{G.cross}</Svg></span>}
                  {!locked && picked === i && <span className="inf-x-mk" aria-hidden="true"><Svg size={18}>{G.check}</Svg></span>}
                </button>
              ))}
            </div>
            {locked && q.explanation && <div className="inf-x-why" role="status"><b>{picked === q.correct ? t('correctLabel') : t('wrongLabel')}</b><p>{q.explanation}</p></div>}
          </div>
        )}

        {!breakOpen && !list && (
          <div className="inf-x-nav">
            <button type="button" className="inf-x-prev" disabled={exam.index === 0} onClick={() => onGo(exam.index - 1)}><Svg size={22}>{G.left}</Svg>{t('previous')}</button>
            {exam.index === N - 1
              ? <button type="button" className="inf-x-next" onClick={finish}>{t('finish')}</button>
              : <button type="button" className="inf-x-next" onClick={() => onGo(exam.index + 1)}>{t('next')}<Svg size={22}>{G.right}</Svg></button>}
          </div>
        )}
        {!breakOpen && <button type="button" className="inf-x-break-btn" onClick={onBreak}><Svg size={18}>{G.game}</Svg>{t('gameBreak')}</button>}
      </div>
      </div>

      {calc && <div className="inf-x-dock"><ExamCalculator t={t} onClose={closeCalc} /></div>}
    </section>
  );
}

/* ---------- results ---------- */
export function ExamResults({exam, answers, seconds, onRetry, onBack, t = T0}) {
  const [show, setShow] = useState('all');
  const N = exam.questions.length;
  const right = exam.questions.filter((q) => answers[q.id] === q.correct).length;
  const skipped = exam.questions.filter((q) => answers[q.id] == null).length, wrong = N - right - skipped;
  const pct = N ? Math.round((right / N) * 100) : 0;
  const used = exam.mode === 'exam' ? Math.max(0, examSeconds(N) - seconds) : null;
  const msg = pct >= 90 ? 'msg4' : pct >= 70 ? 'msg3' : pct >= 40 ? 'msg2' : 'msg1';
  const r = 52, c = 2 * Math.PI * r;
  const miss = exam.questions.filter((q) => answers[q.id] !== q.correct);
  const rows = exam.questions.map((q, i) => ({q, i})).filter(({q}) => show === 'all' || (show === 'wrong' ? answers[q.id] != null && answers[q.id] !== q.correct : answers[q.id] == null));
  return (
    <section className="inf-x" aria-label={t('results')}>
      <header className="inf-x-top"><div><h1>{t('results')}</h1><p>{exam.subject}</p></div></header>
      <div className="inf-x-score">
        <svg viewBox="0 0 128 128" className="inf-x-ring" role="img" aria-label={pct + '%'}>
          <defs><linearGradient id="inf-x-g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#FFE08A" /><stop offset="1" stopColor="#FFB800" /></linearGradient></defs>
          <circle cx="64" cy="64" r={r} fill="none" stroke="rgba(255,255,255,.16)" strokeWidth="11" />
          <circle cx="64" cy="64" r={r} fill="none" stroke="url(#inf-x-g)" strokeWidth="11" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - pct / 100)} transform="rotate(-90 64 64)" />
          <text x="64" y="72" textAnchor="middle" className="inf-x-pct">{pct}%</text>
        </svg>
        <div><h2>{t(msg)}</h2><p>{t('scoreOf', {a: right, b: N})}</p></div>
      </div>
      <dl className="inf-x-tally">
        <div className="ok"><dd>{right}</dd><dt>{t('correctLabel')}</dt></div>
        <div className="no"><dd>{wrong}</dd><dt>{t('wrongLabel')}</dt></div>
        <div><dd>{skipped}</dd><dt>{t('skippedLabel')}</dt></div>
        <div><dd>+{right * 10}</dd><dt>{t('xpEarned')}</dt></div>
        {used != null && <div><dd>{clock(used)}</dd><dt>{t('timeUsed')}</dt></div>}
      </dl>
      <div className="inf-x-actions">
        {miss.length > 0 && <button type="button" className="inf-x-next" onClick={() => onRetry(true)}>{t('practiceMissed', {n: miss.length})}</button>}
        <button type="button" className="inf-x-prev" onClick={() => onRetry(false)}>{t('tryAgain')}</button>
        <button type="button" className="inf-x-ql" onClick={onBack}>{t('allSubjects')}</button>
      </div>
      <h2 className="inf-x-h">{t('review')}</h2>
      <div className="inf-p-seg inf-x-tabs" role="group" aria-label={t('review')}>
        {[['all', t('all')], ['wrong', t('wrongLabel')], ['skip', t('skippedLabel')]].map(([k, l]) => <button key={k} type="button" aria-pressed={show === k} onClick={() => setShow(k)}>{l}</button>)}
      </div>
      <ol className="inf-x-review">
        {rows.map(({q, i}) => {
          const a = answers[q.id], ok = a === q.correct;
          return (
            <li key={q.id} className={a == null ? 'is-skip' : ok ? 'is-ok' : 'is-bad'}>
              <span className="inf-x-n">{i + 1}</span>
              <div>
                <b>{q.text}</b>
                <p>{a == null ? t('noAnswer') : t('yourAnswer', {a: letter(a) + '. ' + q.options[a]})}</p>
                {!ok && <p className="inf-x-good">{t('correctAnswer', {a: letter(q.correct) + '. ' + q.options[q.correct]})}</p>}
                {q.explanation && <small>{q.explanation}</small>}
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

/* ---------- subjects ---------- */
export function SubjectsScreen({subjects, stats, search, onSearch, gradeName, onStart, t = T0}) {
  const list = subjects.filter((d) => d.name.toLowerCase().includes(search.trim().toLowerCase()));
  return (
    <div className="inf-h inf-s">
      <header className="inf-h-hello"><h1>{t('subjectsTitle')}</h1><p>{gradeName}</p></header>
      <input type="search" className="inf-s-search" aria-label={t('searchSubjects')} placeholder={t('searchSubjects')} value={search} onChange={(e) => onSearch(e.target.value)} />
      {list.length ? (
        <div className="inf-s-grid">
          {list.map((d, i) => {
            const ico = iconFor(d.name), res = stats?.subjects?.[d.name], pct = res?.a ? Math.round((res.c / res.a) * 100) : null;
            return (
              <article key={d.id} className="inf-s-card" style={{'--accent': ACCENTS[i % ACCENTS.length]}}>
                <div className="inf-s-head">
                  <span className="inf-h-card-ico" aria-hidden="true">{ico ? <Svg size={26}>{ico}</Svg> : d.name.trim().charAt(0).toUpperCase()}</span>
                  <div><h2>{d.name}</h2><p>{t('nQuestions', {n: d.q.length})} · {t('minutes', {n: Math.round(examSeconds(d.q.length) / 60)})}</p></div>
                </div>
                <div className="inf-s-prog">
                  <div className="inf-p-bar"><i style={{width: (pct ?? 0) + '%'}} /></div>
                  <span>{pct == null ? t('notStarted') : t('accuracyP', {p: pct})}</span>
                </div>
                <div className="inf-s-act">
                  <button type="button" className="inf-x-prev" onClick={() => onStart(d, 'practice')}>{t('practice')}</button>
                  <button type="button" className="inf-x-next" onClick={() => onStart(d, 'exam')}>{t('startExam')}</button>
                </div>
              </article>
            );
          })}
        </div>
      ) : <p className="inf-hint">{subjects.length ? t('noMatch') : t('noSubjects')}</p>}
    </div>
  );
}
