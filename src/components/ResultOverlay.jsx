'use client';
import React from 'react';

export default function ResultOverlay({ title, sub, tone = 'win', score, children }) {
  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-label={title}>
      <div className={`result ${tone}`}>
        <div className="result-title">{title}</div>
        {score && <div className="result-score">{score[0]} <span>:</span> {score[1]}</div>}
        {sub && <div className="result-sub">{sub}</div>}
        <div className="result-actions">{children}</div>
      </div>
    </div>
  );
}
