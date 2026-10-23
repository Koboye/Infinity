'use client';
import React, { memo, useEffect, useRef, useState } from 'react';
import { isDark } from '@/lib/checkers/engine.js';
import { heroById } from '@/lib/i18n';

const Piece = memo(function Piece({ p, viewSeat, can, sel, heroId, drag }) {
  const hero = heroById(heroId);
  const d = viewSeat === 0 ? p.sq : 63 - p.sq;
  return (
    <div
      className={`ck-piece s${p.seat}${p.king ? ' king' : ''}${p.dying ? ' dying' : ''}${can ? ' can' : ''}${sel ? ' sel' : ''}`}
      style={{ left: `${(d & 7) * 12.5}%`, top: `${(d >> 3) * 12.5}%`, ...(drag ? { transform: `translate(${drag.x}px, ${drag.y}px) scale(1.12)`, transition: 'none', zIndex: 5 } : null) }}
    >
      <i className="ck-face" style={p.king ? { '--hero': hero.color } : undefined}>
        {p.king ? (<>
          <b className="ck-crown" aria-hidden="true">♛</b>
          <b className="ck-avatar" role="img" aria-label={hero.name.en}>{hero.glyph}</b>
        </>) : null}
      </i>
    </div>
  );
});

/**
 * 8×8 board. `viewSeat` is the side shown at the bottom (seat 1 sees the board rotated 180°).
 * Diagonal draughts: only dark squares are tappable. Dama (`dama`): every square is in play.
 */
export default function CheckersBoard({ pieces, viewSeat = 0, selected = null, picked = [], targets = [], movable = [], last = null, onSquare = () => {}, label = 'Checkers board', dama = false, heroes = ['lion', 'shield'], onSwipe = null, hideTargets = false, hint = null }) {
  const boardRef = useRef(null);
  const [drag, setDrag] = useState(null); // { sq, x, y } pixel offset of the dragged piece
  const dragRef = useRef(null);
  const swiped = useRef(false);
  const movableRef = useRef(movable); movableRef.current = movable;
  const swipeRef = useRef(onSwipe); swipeRef.current = onSwipe;

  useEffect(() => {
    if (!drag) return undefined;
    const el = boardRef.current;
    const cell = () => el.getBoundingClientRect().width / 8;
    const move = (e) => {
      const d = dragRef.current; if (!d) return;
      d.x = e.clientX - d.x0; d.y = e.clientY - d.y0;
      setDrag({ sq: d.sq, x: d.x, y: d.y });
    };
    const up = (e) => {
      const d = dragRef.current; dragRef.current = null; setDrag(null);
      if (!d) return;
      const c = cell(); const dx = (e.clientX - d.x0), dy = (e.clientY - d.y0);
      if (Math.hypot(dx, dy) < c * 0.35) return; // a tap — the square's own click handles it
      swiped.current = true; setTimeout(() => { swiped.current = false; }, 60);
      const r = el.getBoundingClientRect();
      let col = Math.floor((e.clientX - r.left) / c), row = Math.floor((e.clientY - r.top) / c);
      col = Math.max(0, Math.min(7, col)); row = Math.max(0, Math.min(7, row));
      const f = viewSeat === 0 ? 1 : -1; // board coordinates (seat 1 sees the board rotated)
      swipeRef.current?.(d.sq, dx * f, dy * f, viewSeat === 0 ? col : 7 - col, viewSeat === 0 ? row : 7 - row);
    };
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', up); window.addEventListener('pointercancel', up);
    return () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); window.removeEventListener('pointercancel', up); };
  }, [!!drag, viewSeat]); // eslint-disable-line react-hooks/exhaustive-deps

  const onDown = (e) => {
    if (!swipeRef.current || (e.pointerType === 'mouse' && e.button !== 0)) return;
    const r = boardRef.current.getBoundingClientRect(); const c = r.width / 8;
    const col = Math.floor((e.clientX - r.left) / c), row = Math.floor((e.clientY - r.top) / c);
    if (col < 0 || col > 7 || row < 0 || row > 7) return;
    const dd = row * 8 + col; const sq = viewSeat === 0 ? dd : 63 - dd;
    if (!movableRef.current.includes(sq)) return;
    dragRef.current = { sq, x0: e.clientX, y0: e.clientY, x: 0, y: 0 };
    setDrag({ sq, x: 0, y: 0 });
  };
  const pieceAt = {}; pieces.forEach((p) => { if (!p.dying) pieceAt[p.sq] = p; });
  const cells = [];
  for (let d = 0; d < 64; d++) {
    const sq = viewSeat === 0 ? d : 63 - d;
    if (!dama && !isDark(sq)) { cells.push(<div key={d} className="sq light" />); continue; }
    const cls = dama ? ['sq', 'dama', isDark(sq) ? 'dk' : 'lt'] : ['sq', 'dark'];
    if (!hideTargets && targets.includes(sq)) cls.push('target');
    if (selected === sq) cls.push('sel');
    if (hint && (hint.from === sq || hint.to === sq)) cls.push('hint');
    if (picked.includes(sq)) cls.push('visited');
    if (last && (last.from === sq || last.to === sq)) cls.push('last');
    cells.push(<button key={d} type="button" className={cls.join(' ')} onClick={() => { if (!swiped.current) onSquare(sq); }} aria-label={`${String.fromCharCode(97 + (sq & 7))}${8 - (sq >> 3)}${pieceAt[sq] ? ` · ${pieceAt[sq].seat === 0 ? 'dark' : 'light'}${pieceAt[sq].king ? ' king' : ''}` : ''}`} />);
  }
  return (
    <div ref={boardRef} onPointerDown={onDown} className={`ckboard${dama ? ' dama' : ''}`} role="group" aria-label={label}>
      {cells}
      <div className="ck-pieces">
        {pieces.map((p) => <Piece key={p.id} p={p} viewSeat={viewSeat} heroId={heroes[p.seat]} drag={drag && drag.sq === p.sq && !p.dying ? drag : null} can={movable.includes(p.sq) && !p.dying} sel={selected === p.sq} />)}
      </div>
    </div>
  );
}
