'use client';
import React from 'react';
import { BOARDS, finishOf } from '@/lib/ludo/engine.js';
import { ringXY, homeXY, baseXY, finishXY, tokenXY, viewBoxOf, TRI } from '@/lib/ludo/layout.js';

export const COLORS = ['#E0452B', '#2E9E4F', '#F2B632', '#2F6FD6'];
export const COLOR_NAMES = ['red', 'green', 'yellow', 'blue'];
const DARK = ['#9c2a17', '#1d6b34', '#b98412', '#1d4a99'];

const star = (x, y, r) => {
  const pts = Array.from({ length: 10 }, (_, i) => { const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * 0.42 : r; return `${(x + rr * Math.cos(a)).toFixed(3)},${(y + rr * Math.sin(a)).toFixed(3)}`; });
  return pts.join(' ');
};

function Defs() {
  return (
    <defs>
      {COLORS.map((c, i) => (
        <radialGradient key={i} id={`lg${i}`} cx="35%" cy="30%" r="75%"><stop offset="0%" stopColor="#fff" stopOpacity=".95" /><stop offset="28%" stopColor={c} /><stop offset="100%" stopColor={DARK[i]} /></radialGradient>
      ))}
    </defs>
  );
}

/** Static board: bases, ring, start cells, stars, home columns, centre. */
function Square({ seats }) {
  const cells = [];
  for (let i = 0; i < 52; i++) {
    const { x, y } = ringXY('square', i), si = BOARDS.square.seatStart.indexOf(i), safe = BOARDS.square.seatStart.some((st) => BOARDS.square.safeOffsets.some((o) => (st + o) % 52 === i));
    cells.push(
      <g key={i}>
        <rect x={x - 0.5} y={y - 0.5} width="1" height="1" fill={si >= 0 ? COLORS[si] : '#fffaf0'} stroke="#2a1d10" strokeWidth="0.04" />
        {safe && si < 0 && <polygon points={star(x, y, 0.34)} fill="#d9a521" stroke="#8a5a0b" strokeWidth="0.03" />}
        {si >= 0 && <polygon points={star(x, y, 0.3)} fill="#fff" opacity=".9" />}
      </g>,
    );
  }
  const home = [];
  [0, 1, 2, 3].forEach((s) => { for (let m = 1; m <= 5; m++) { const { x, y } = homeXY('square', s, m); home.push(<rect key={`${s}${m}`} x={x - 0.5} y={y - 0.5} width="1" height="1" fill={COLORS[s]} stroke="#2a1d10" strokeWidth="0.04" opacity={seats.includes(s) ? 1 : 0.35} />); } });
  const bases = [[0, 0], [9, 0], [9, 9], [0, 9]].map(([x, y], s) => (
    <g key={s} opacity={seats.includes(s) ? 1 : 0.35}>
      <rect x={x} y={y} width="6" height="6" fill={COLORS[s]} stroke="#2a1d10" strokeWidth="0.06" />
      <rect x={x + 0.9} y={y + 0.9} width="4.2" height="4.2" rx="0.6" fill="#fffaf0" />
      {[0, 1, 2, 3].map((k) => { const p = baseXY('square', s, k); return <circle key={k} cx={p.x} cy={p.y} r="0.55" fill="none" stroke={COLORS[s]} strokeWidth="0.12" opacity=".55" />; })}
    </g>
  ));
  return (
    <g>
      <rect x="-0.2" y="-0.2" width="15.4" height="15.4" rx="0.6" fill="#2a1d10" />
      {bases}{cells}{home}
      <polygon points="6,6 9,6 7.5,7.5" fill={COLORS[1]} /><polygon points="9,6 9,9 7.5,7.5" fill={COLORS[2]} />
      <polygon points="9,9 6,9 7.5,7.5" fill={COLORS[3]} /><polygon points="6,9 6,6 7.5,7.5" fill={COLORS[0]} />
      <rect x="6" y="6" width="3" height="3" fill="none" stroke="#2a1d10" strokeWidth="0.06" />
    </g>
  );
}

function Triangle() {
  const B = BOARDS.triangle, cells = [];
  for (let i = 0; i < 54; i++) {
    const { x, y } = ringXY('triangle', i), si = B.seatStart.indexOf(i), safe = B.seatStart.some((st) => B.safeOffsets.some((o) => (st + o) % 54 === i));
    cells.push(
      <g key={i}>
        <circle cx={x} cy={y} r="1.95" fill={si >= 0 ? COLORS[si] : '#fffaf0'} stroke="#2a1d10" strokeWidth="0.3" />
        {safe && <polygon points={star(x, y, si >= 0 ? 1.3 : 1.45)} fill={si >= 0 ? '#fff' : '#d9a521'} stroke={si >= 0 ? 'none' : '#8a5a0b'} strokeWidth="0.15" />}
      </g>,
    );
  }
  const home = [];
  [0, 1, 2].forEach((s) => { for (let m = 1; m <= 5; m++) { const { x, y } = homeXY('triangle', s, m); home.push(<circle key={`${s}${m}`} cx={x} cy={y} r="1.75" fill={COLORS[s]} stroke="#2a1d10" strokeWidth="0.3" />); } });
  const bases = [0, 1, 2].map((s) => {
    const b = baseXY('triangle', s, 0);
    return (
      <g key={s}>
        <circle cx={b.bx} cy={b.by} r="9" fill={COLORS[s]} stroke="#2a1d10" strokeWidth="0.5" />
        <circle cx={b.bx} cy={b.by} r="7.4" fill="#fffaf0" />
        {[0, 1, 2, 3].map((k) => { const p = baseXY('triangle', s, k); return <circle key={k} cx={p.x} cy={p.y} r="2.1" fill="none" stroke={COLORS[s]} strokeWidth="0.5" opacity=".55" />; })}
      </g>
    );
  });
  const wedge = [0, 1, 2].map((s) => { // centre hub: three wedges, one per seat, pointing at that seat's home column
    const f = finishXY('triangle', s, 1.5), a = Math.atan2(f.y - TRI.cy, f.x - TRI.cx), r = 5.2, a0 = a - Math.PI / 3, a1 = a + Math.PI / 3;
    const p = (t) => `${(TRI.cx + r * Math.cos(t)).toFixed(2)},${(TRI.cy + r * Math.sin(t)).toFixed(2)}`;
    return <path key={s} d={`M${TRI.cx},${TRI.cy} L${p(a0)} A${r},${r} 0 0 1 ${p(a1)} Z`} fill={COLORS[s]} stroke="#2a1d10" strokeWidth="0.3" />;
  });
  const [A, Bv, C] = TRI.V;
  return (
    <g>
      <polygon points={`${A.x},${A.y} ${Bv.x},${Bv.y} ${C.x},${C.y}`} fill="#f6ecd2" stroke="#2a1d10" strokeWidth="9" strokeLinejoin="round" />
      {bases}{cells}{home}{wedge}
    </g>
  );
}

/** tokens: [{p, i, seat, pos}] already resolved (animation overrides applied). legal: Set of "p:i" keys the human may tap. */
export default function LudoBoard({ board, seats, tokens, legal, onPick, hintKey }) {
  const isSq = board === 'square', R = isSq ? 0.36 : 1.75;
  // spread tokens that share a point
  const groups = new Map();
  tokens.forEach((tk) => { const xy = tokenXY(board, tk.seat, tk.pos, tk.i); const k = `${xy.x.toFixed(2)},${xy.y.toFixed(2)}`; (groups.get(k) || groups.set(k, []).get(k)).push({ tk, xy }); });
  const items = [];
  groups.forEach((g) => g.forEach(({ tk, xy }, idx) => {
    const n = g.length, ang = (idx / n) * Math.PI * 2, spread = n > 1 ? R * 0.55 : 0;
    items.push({ tk, x: xy.x + Math.cos(ang) * spread, y: xy.y + Math.sin(ang) * spread, sc: n > 1 ? 0.8 : 1 });
  }));
  items.sort((a, b) => a.y - b.y);
  return (
    <svg className={`ludo-svg ${board}`} viewBox={viewBoxOf(board)} role="img" aria-label={isSq ? 'Ludo board' : 'Ludo triangle board'}>
      <Defs />
      {isSq ? <Square seats={seats} /> : <Triangle />}
      {items.map(({ tk, x, y, sc }) => {
        const key = `${tk.p}:${tk.i}`, can = legal.has(key);
        return (
          <g key={key} className={`ludo-tok${can ? ' can' : ''}${hintKey === key ? ' hint' : ''}`} style={{ transform: `translate(${x}px, ${y}px)` }}
            onPointerDown={can ? (e) => { e.preventDefault(); onPick(tk.i); } : undefined} role={can ? 'button' : undefined} aria-label={can ? `Move ${COLOR_NAMES[tk.seat]} token` : undefined}>
            {can && <circle r={R * 1.45} className="ring" fill="none" stroke="#fff" strokeWidth={R * 0.2} />}
            <circle r={R * sc * 1.08} fill="rgba(0,0,0,.35)" transform={`translate(${R * 0.12}, ${R * 0.18})`} />
            <circle r={R * sc} fill={`url(#lg${tk.seat})`} stroke="#241609" strokeWidth={R * 0.12} />
            <circle r={R * sc * 0.45} fill="none" stroke="rgba(255,255,255,.55)" strokeWidth={R * 0.1} />
          </g>
        );
      })}
    </svg>
  );
}

export { finishOf };
