'use client';
import React from 'react';
import { Tile } from './Tile';
import { handPips } from '@/lib/dominoes/engine.js';

/** Shown when a round ends: both hands revealed, points awarded. */
export default function RoundOverlay({ t, names, result, scores, target, onNext, nextLabel, matchOver, seatMe = 0 }) {
  const w = result.winner;
  const won = (s) => (names[s] === t.you ? t.roundWonYou(result.points) : t.roundWon(names[s], result.points));
  const label = (s) => (names[s] === t.you ? t.yourHand : t.handLabel(names[s]));
  let title;
  if (w === 'tie') title = t.tieRound;
  else title = result.reason === 'domino' ? `${t.domino} ${won(w)}` : `${t.blockedRound} · ${won(w)}`;
  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-label={title}>
      <div className={`result ${w === 'tie' ? 'draw' : w === seatMe ? 'win' : 'lose'} dround`}>
        <div className="result-title sm">{title}</div>
        {[0, 1].map((s) => (
          <div key={s} className="dreveal">
            <div className="dreveal-h"><b>{label(s)}</b><span>{t.roundScoreLine(handPips(result.hands[s]))}</span></div>
            <div className="dreveal-t">{result.hands[s].length ? result.hands[s].map((x) => <Tile key={`${x[0]}${x[1]}`} a={x[0]} b={x[1]} vertical className="mini2" />) : <em>—</em>}</div>
          </div>
        ))}
        <div className="result-score">{scores[0]} <span>:</span> {scores[1]}</div>
        <div className="result-sub">{t.playTo(target)}</div>
        <div className="result-actions">{onNext && <button className="btn primary" onClick={onNext}>{nextLabel || t.nextRound}</button>}</div>
      </div>
    </div>
  );
}
