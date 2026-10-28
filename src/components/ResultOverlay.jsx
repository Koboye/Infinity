'use client';
import React, { useEffect, useMemo, useState } from 'react';
import { recordResult } from '@/lib/progress';
import { winLine, loseLine, pick, LOSE_EMOJI } from '@/lib/celebrate.js';
import Fireworks from './Fireworks';
import { LoseScene, Candle, Trophy } from './Ambience';
import EarnOffer from './EarnOffer';

const CONFETTI = ['#F2B632', '#4FA36B', '#C23B2A', '#3b8fd6', '#F4E9CF', '#8E3FD1'];

/**
 * End-of-game screen. A win rains confetti and shows a bouncing trophy; a loss is playful (wobbling emoji + a gentle joke);
 * a draw is a handshake. `taunt` (optional list of words) is shown word by word to the loser — used by Gebeta.
 */
export default function ResultOverlay({ palette = null, title, sub, tone = 'win', score, children, taunt = null, tauntNote = null, lang: langProp, jackpot = false, coins }) {
  const lang = langProp || (typeof document !== 'undefined' && document.documentElement.lang === 'am' ? 'am' : 'en');
  useEffect(() => {
    recordResult(tone);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const flair = useMemo(() => {
    const r = Math.random;
    return {
      line: tone === 'win' ? winLine(lang, r) : tone === 'lose' ? loseLine(lang, r) : '',
      face: tone === 'lose' ? pick(LOSE_EMOJI, r) : '',
      bits: tone === 'win' ? Array.from({ length: 64 }, (_, i) => ({
        left: Math.round(r() * 100), delay: +(r() * 1.4).toFixed(2), dur: +(2.4 + r() * 2).toFixed(2), size: Math.round(6 + r() * 7),
        rot: Math.round(r() * 360), color: (palette || CONFETTI)[i % (palette || CONFETTI).length], drift: Math.round(-40 + r() * 80),
      })) : [],
    };
  }, [tone, lang]);
  return (
    <div className={`overlay result-overlay ${tone}`} role="dialog" aria-modal="true" aria-label={title}>
      {tone === 'win' && <Fireworks intensity={jackpot ? 2 : 1} />}
      {tone === 'lose' && <LoseScene />}
      {tone === 'draw' && <div className="draw-glow" aria-hidden="true" />}
      {flair.bits.length > 0 && (
        <div className="confetti" aria-hidden="true">
          {flair.bits.map((b, i) => (
            <i key={i} style={{ left: `${b.left}%`, width: b.size, height: Math.round(b.size * 1.6), background: b.color, animationDelay: `${b.delay}s`, animationDuration: `${b.dur}s`, '--rot': `${b.rot}deg`, '--drift': `${b.drift}px` }} />
          ))}
        </div>
      )}
      <div className={`result ${tone}`}>
        {tone === 'win' && <div className="trophy-stage" aria-hidden="true"><i className="rays" /><Trophy /><span className="spark s1">✦</span><span className="spark s2">✦</span><span className="spark s3">✧</span></div>}
        {tone === 'lose' && <div className="candle-stage" aria-hidden="true"><Candle /><span className="lose-face">{flair.face}</span></div>}
        {tone === 'draw' && <div className={`result-emoji ${tone}`} aria-hidden="true">🤝</div>}
        <div className="result-title">{title}</div>
        {flair.line && <div className={`result-flair ${tone}`}>{flair.line}</div>}
        {taunt && taunt.length > 0 && (
          <div className="taunt" aria-label={taunt.join(' ')}>
            <span className="puff" aria-hidden="true">💨</span>
            <span className="taunt-words" aria-hidden="true">
              {taunt.map((w, i) => <b key={i} style={{ animationDelay: `${0.5 + i * 0.55}s` }}>{w}</b>)}
            </span>
            {tauntNote && <small>{tauntNote}</small>}
          </div>
        )}
        {score && <div className="result-score">{score[0]} <span>:</span> {score[1]}</div>}
        {Number.isFinite(coins) && <div className={`result-coins ${coins > 0 ? 'up' : coins < 0 ? 'down' : ''}`} aria-label={`${coins} coins`}>🪙 {coins > 0 ? '+' : coins < 0 ? '−' : '±'}{Math.abs(coins).toLocaleString('en-US')}</div>}
        {sub && <div className="result-sub">{sub}</div>}
        <div className="result-actions">{children}</div>
        <EarnOffer lang={lang} context="result" tone={tone} variant="card" />
      </div>
    </div>
  );
}
