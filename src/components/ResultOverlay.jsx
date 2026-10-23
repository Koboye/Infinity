'use client';
import React, { useEffect } from 'react';
import { recordResult } from '@/lib/progress';

export default function ResultOverlay({ title, sub, tone = 'win', score, children }) {
  useEffect(() => { recordResult(tone); }, []); // eslint-disable-line react-hooks/exhaustive-deps
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
