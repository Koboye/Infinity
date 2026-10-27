'use client';
import React, { useMemo, useState } from 'react';
import { GEBETA_TYPES, RULEBOOK, askRules, rulesAsText } from '@/lib/gebetaRules';

const copyText = async (text) => { try { await navigator.clipboard.writeText(text); return true; } catch { return false; } };
const shareText = async (title, text) => {
  try { if (navigator.share) { await navigator.share({ title, text }); return 'shared'; } } catch (e) { if (e?.name === 'AbortError') return 'cancelled'; }
  return (await copyText(text)) ? 'copied' : 'failed';
};

/** The Gebeta rulebook, one game type at a time, one rule at a time, with a box to ask questions. Works offline. */
export default function GebetaRules({ t, lang, type: startType = 'gebeta', onPlay }) {
  const L = lang === 'am' ? 'am' : 'en';
  const [type, setType] = useState(GEBETA_TYPES.includes(startType) ? startType : 'gebeta');
  const [mode, setMode] = useState('one');           // 'one' | 'all'
  const [i, setI] = useState(0);
  const [q, setQ] = useState(''); const [asked, setAsked] = useState(null);
  const [note, setNote] = useState('');
  const book = RULEBOOK[type];
  const steps = book.steps, last = i >= steps.length - 1;
  const step = steps[Math.min(i, steps.length - 1)];
  const popular = useMemo(() => book.faq.slice(0, 4), [book]);

  const pick = (id) => { setType(id); setI(0); setAsked(null); setQ(''); setNote(''); };
  const ask = (text) => { const v = (text ?? q).trim(); if (!v) return; setQ(v); setAsked({ text: v, ...askRules(v, type, L) }); };
  const askFriend = async () => {
    const how = await shareText('Infinity', `${asked.text}\n\n(${book.name[L]} · ${t.rulesTitle})`);
    if (how === 'copied') { setNote(t.copied); setTimeout(() => setNote(''), 1600); }
  };
  const sendRules = async () => {
    const how = await shareText(book.name[L], rulesAsText(type, L));
    if (how === 'copied') { setNote(t.rulesCopied); setTimeout(() => setNote(''), 1800); }
  };

  return (
    <div className="panel rules gr">
      <h2>{t.rulesTitle}</h2>

      <div className="gr-types" role="tablist" aria-label={t.rulesPickType}>
        {GEBETA_TYPES.map((id) => (
          <button key={id} role="tab" aria-selected={type === id} className={`gr-type${type === id ? ' on' : ''}`} onClick={() => pick(id)}>
            <span className="gr-ico" aria-hidden="true">{RULEBOOK[id].icon}</span>
            <b>{RULEBOOK[id].name[L]}</b>
          </button>
        ))}
      </div>
      <p className="muted gr-pitch">{book.pitch[L]}</p>

      <div className="seg gr-mode">
        <button className={mode === 'one' ? 'on' : ''} aria-pressed={mode === 'one'} onClick={() => setMode('one')}>{t.rulesOne}</button>
        <button className={mode === 'all' ? 'on' : ''} aria-pressed={mode === 'all'} onClick={() => setMode('all')}>{t.rulesAll}</button>
      </div>

      {mode === 'one' ? (
        <div className="gr-card" key={`${type}-${i}`}>
          <span className="gr-count">{t.rulesStep(i + 1, steps.length)}</span>
          <h3>{step.h[L]}</h3>
          <p>{step.b[L]}</p>
          <div className="gr-dots" aria-hidden="true">{steps.map((_, k) => <i key={k} className={k === i ? 'on' : k < i ? 'done' : ''} />)}</div>
          {last && <p className="muted gr-done">{t.rulesDone}</p>}
          <div className="gr-nav">
            <button className="btn" disabled={i === 0} onClick={() => setI(i - 1)}>‹ {t.rulesPrev}</button>
            {last
              ? <button className="btn primary" onClick={() => onPlay?.(type)}>{t.rulesPlay}</button>
              : <button className="btn primary" onClick={() => setI(i + 1)}>{t.rulesNext} ›</button>}
          </div>
        </div>
      ) : (
        <ol className="gr-all">
          {steps.map((s) => <li key={s.h.en}><b>{s.h[L]}</b><p>{s.b[L]}</p></li>)}
        </ol>
      )}

      <div className="gr-ask">
        <h3>{t.askTitle}</h3>
        <form className="joinrow" onSubmit={(e) => { e.preventDefault(); ask(); }}>
          <input value={q} onChange={(e) => setQ(e.target.value.slice(0, 160))} placeholder={t.askHint} aria-label={t.askTitle} autoComplete="off" />
          <button className="btn primary" disabled={!q.trim()}>{t.askBtn}</button>
        </form>
        <div className="emote-row gr-pop" aria-label={t.askTry}>
          {popular.map((f) => <button key={f.q.en} className="chip" onClick={() => ask(f.q[L])}>{f.q[L]}</button>)}
        </div>
        {asked && (asked.hits.length > 0
          ? <div className="gr-answers" role="status">
            {asked.hits.map((h, k) => (
              <div key={`${h.type}-${h.q}-${k}`} className="gr-answer">
                <small>{RULEBOOK[h.type].icon} {RULEBOOK[h.type].name[L]}</small>
                <b>{h.q}</b><p>{h.a}</p>
              </div>
            ))}
          </div>
          : <div className="gr-answers" role="status"><p className="muted">{t.askNone}</p><button className="btn" onClick={askFriend}>📨 {t.askFriend}</button></div>)}
      </div>

      <button className="btn ghost wide" onClick={sendRules}>📤 {t.rulesSend}</button>
      {note && <p className="fr-note" role="status">{note}</p>}
    </div>
  );
}
