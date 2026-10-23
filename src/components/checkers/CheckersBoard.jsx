'use client';
import React, { memo } from 'react';
import { isDark } from '@/lib/checkers/engine.js';

const Piece = memo(function Piece({ p, viewSeat, can, sel }) {
  const d = viewSeat === 0 ? p.sq : 63 - p.sq;
  return (
    <div
      className={`ck-piece s${p.seat}${p.king ? ' king' : ''}${p.dying ? ' dying' : ''}${can ? ' can' : ''}${sel ? ' sel' : ''}`}
      style={{ left: `${(d & 7) * 12.5}%`, top: `${(d >> 3) * 12.5}%` }}
    >
      <i className="ck-face">{p.king ? <b className="ck-crown">♛</b> : null}</i>
    </div>
  );
});

/**
 * 8×8 board. `viewSeat` is the side shown at the bottom (seat 1 sees the board rotated 180°).
 * Only dark squares are tappable.
 */
export default function CheckersBoard({ pieces, viewSeat = 0, selected = null, picked = [], targets = [], movable = [], last = null, onSquare = () => {}, label = 'Checkers board' }) {
  const cells = [];
  for (let d = 0; d < 64; d++) {
    const sq = viewSeat === 0 ? d : 63 - d;
    if (!isDark(sq)) { cells.push(<div key={d} className="sq light" />); continue; }
    const cls = ['sq', 'dark'];
    if (targets.includes(sq)) cls.push('target');
    if (selected === sq) cls.push('sel');
    if (picked.includes(sq)) cls.push('visited');
    if (last && (last.from === sq || last.to === sq)) cls.push('last');
    cells.push(<button key={d} type="button" className={cls.join(' ')} onClick={() => onSquare(sq)} aria-label={`Square ${String.fromCharCode(97 + (sq & 7))}${8 - (sq >> 3)}`} />);
  }
  return (
    <div className="ckboard" role="group" aria-label={label}>
      {cells}
      <div className="ck-pieces">
        {pieces.map((p) => <Piece key={p.id} p={p} viewSeat={viewSeat} can={movable.includes(p.sq) && !p.dying} sel={selected === p.sq} />)}
      </div>
    </div>
  );
}
