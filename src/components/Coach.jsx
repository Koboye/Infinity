'use client';
import React, { useState } from 'react';

const KEY = (g) => `gebeta.coach.${g}`;
export const needsCoach = (g) => { try { return localStorage.getItem(KEY(g)) !== '1'; } catch { return false; } };
export const doneCoach = (g) => { try { localStorage.setItem(KEY(g), '1'); } catch { /* storage unavailable */ } };

/** First-run walkthrough: the first steps of the rules, one card at a time. */
export default function Coach({ t, game, onClose }) {
  const steps = (t[`rules_${game === 'checkers' ? 'checkers' : game}`] || []).slice(0, game === 'checkers' ? 3 : 5);
  const [i, setI] = useState(0);
  if (!steps.length) return null;
  const last = i === steps.length - 1;
  const close = () => { doneCoach(game); onClose(); };
  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-label={t.tutorial}>
      <div className="dialog coach">
        <small className="muted">{t.tutorial} · {i + 1}/{steps.length}</small>
        <h3>{steps[i][0]}</h3>
        <p>{steps[i][1]}</p>
        <div className="result-actions">
          <button className="btn ghost" onClick={close}>{t.skip}</button>
          <button className="btn primary" onClick={() => (last ? close() : setI(i + 1))}>{last ? t.start : t.next}</button>
        </div>
      </div>
    </div>
  );
}
