'use client';
import React, { memo, useEffect, useRef, useState } from 'react';
import { isDark } from '@/lib/checkers/engine.js';
import { heroById } from '@/lib/i18n';

// The board is drawn mirrored left↔right, so the long diagonal runs the other way (the dark corner is at the bottom-RIGHT).
// Only the drawing is mirrored: squares, rules and moves keep their numbers. Set to false to get the old orientation back.
const MIRROR = true;
const mir = (d) => (MIRROR ? (d & ~7) | (7 - (d & 7)) : d);
const dispIdx = (sq, vs) => mir(vs === 0 ? sq : 63 - sq);   // square number → position on screen
const sqAt = (d, vs) => { const b = mir(d); return vs === 0 ? b : 63 - b; }; // position on screen → square number

const Piece = memo(function Piece({ p, viewSeat, can, sel, pick, heroId, drag }) {
  const hero = heroById(heroId);
  const d = dispIdx(p.sq, viewSeat);
  return (
    <div
      className={`ck-piece s${p.seat}${p.king ? ' king' : ''}${p.dying ? ` dying${p.kbig ? ' big' : ''}` : ''}${p.strike ? ` strike-${p.strike}` : ''}${can ? ' can' : ''}${sel ? ' sel' : ''}${pick ? ' pick' : ''}`}
      style={{
        left: `${(d & 7) * 12.5}%`, top: `${(d >> 3) * 12.5}%`,
        ...(p.dying ? { '--kx': (p.kx || 0) * (viewSeat === 0 ? 1 : -1) * (MIRROR ? -1 : 1), '--ky': (p.ky || 0) * (viewSeat === 0 ? 1 : -1), '--kd': `${p.kd || 0}ms` } : null),
        ...(p.strike ? { '--kd': `${p.kd || 0}ms` } : null),
        ...(drag ? { transform: `translate(${drag.x}px, ${drag.y}px) scale(1.12)`, transition: 'none', zIndex: 5 } : null),
      }}
    >
      <i className="ck-face" style={p.king ? { '--hero': hero.color } : undefined}>
        {p.king ? (
          <b className="k3d" data-hero={heroId} role="img" aria-label={hero.name.en}>
            <b className="k3d-base" aria-hidden="true" />
            <b className="k3d-fig" aria-hidden="true">
              {/* stacked slices give the figure real thickness while it sways in 3D */}
              {[5, 4, 3, 2, 1, 0].map((z) => <u key={z} style={{ '--z': z }}>{hero.glyph}</u>)}
            </b>
            <b className="ck-crown" aria-hidden="true">♛</b>
          </b>
        ) : null}
      </i>
    </div>
  );
});

/**
 * 8×8 board. `viewSeat` is the side shown at the bottom (seat 1 sees the board rotated 180°).
 * Diagonal draughts: only dark squares are tappable.
 */
export default function CheckersBoard({ pieces, viewSeat = 0, selected = null, picked = [], targets = [], movable = [], last = null, onSquare = () => {}, label = 'Checkers board', heroes = ['lion', 'shield'], onSwipe = null, hideTargets = false, hint = null, pick = [], showMovable = true, fx = [], shake = null }) {
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
      const f = viewSeat === 0 ? 1 : -1; // board coordinates (seat 1 sees the board rotated; the drawing is mirrored left↔right)
      const to = sqAt(row * 8 + col, viewSeat);
      swipeRef.current?.(d.sq, dx * f * (MIRROR ? -1 : 1), dy * f, to & 7, to >> 3);
    };
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', up); window.addEventListener('pointercancel', up);
    return () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); window.removeEventListener('pointercancel', up); };
  }, [!!drag, viewSeat]); // eslint-disable-line react-hooks/exhaustive-deps

  const onDown = (e) => {
    if (!swipeRef.current || (e.pointerType === 'mouse' && e.button !== 0)) return;
    const r = boardRef.current.getBoundingClientRect(); const c = r.width / 8;
    const col = Math.floor((e.clientX - r.left) / c), row = Math.floor((e.clientY - r.top) / c);
    if (col < 0 || col > 7 || row < 0 || row > 7) return;
    const dd = row * 8 + col; const sq = sqAt(dd, viewSeat);
    if (!movableRef.current.includes(sq)) return;
    dragRef.current = { sq, x0: e.clientX, y0: e.clientY, x: 0, y: 0 };
    setDrag({ sq, x: 0, y: 0 });
  };
  const pieceAt = {}; pieces.forEach((p) => { if (!p.dying) pieceAt[p.sq] = p; });
  const cells = [];
  for (let d = 0; d < 64; d++) {
    const sq = sqAt(d, viewSeat);
    if (!isDark(sq)) { cells.push(<div key={d} className="sq light" />); continue; }
    const cls = ['sq', 'dark'];
    if (!hideTargets && targets.includes(sq)) cls.push('target');
    if (selected === sq) cls.push('sel');
    if (hint && (hint.from === sq || hint.to === sq)) cls.push('hint');
    if (picked.includes(sq)) cls.push('visited');
    if (pick.includes(sq)) cls.push('pick');
    if (last && (last.from === sq || last.to === sq)) cls.push('last');
    cells.push(<button key={d} type="button" className={cls.join(' ')} onClick={() => { if (!swiped.current) onSquare(sq); }} aria-label={`${String.fromCharCode(97 + (sq & 7))}${8 - (sq >> 3)}${pieceAt[sq] ? ` · ${pieceAt[sq].seat === 0 ? 'dark' : 'light'}${pieceAt[sq].king ? ' king' : ''}` : ''}`} />);
  }
  return (
    <div ref={boardRef} onPointerDown={onDown} className={`ckboard${shake ? ` hit-${shake.big ? 'big' : 'small'}-${shake.k > 0.5 ? 'a' : 'b'}` : ''}`} style={shake ? { '--kd': `${shake.kd || 0}ms` } : undefined} role="group" aria-label={label}>
      {cells}
      <div className="ck-fx" aria-hidden="true">
        {fx.map((f) => {
          const d = dispIdx(f.sq, viewSeat);
          return (
            <span key={f.id} className={`ck-impact${f.big ? ' big' : ''}`} style={{ left: `${(d & 7) * 12.5}%`, top: `${(d >> 3) * 12.5}%`, '--kd': `${f.kd}ms` }}>
              <i className="ring" />
              {[0, 1, 2, 3, 4, 5, 6, 7].map((n) => <i key={n} className="spark" style={{ '--a': `${n * 45}deg` }} />)}
              <b className="pow">{f.big ? '💥' : '✦'}</b>
            </span>
          );
        })}
      </div>
      <div className="ck-pieces">
        {pieces.map((p) => <Piece key={p.id} p={p} viewSeat={viewSeat} heroId={heroes[p.seat]} drag={drag && drag.sq === p.sq && !p.dying ? drag : null} can={showMovable && movable.includes(p.sq) && !p.dying} pick={pick.includes(p.sq) && !p.dying} sel={selected === p.sq} />)}
      </div>
    </div>
  );
}
