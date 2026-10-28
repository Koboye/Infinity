'use client';
import React, { useState } from 'react';
import { BOARDS, finishOf } from '@/lib/ludo/engine.js';
import { ringXY, homeXY, baseXY, finishXY, tokenXY, viewBoxOf, homeAngle, UNIT } from '@/lib/ludo/layout.js';

// colours are by SCREEN position (top-left, top-right, bottom-right, bottom-left): the bottom-left one is always YOU, in yellow
export const COLORS = ['#E9202B', '#00A651', '#FFDD12', '#2AA9FF'];
export const COLOR_NAMES = ['red', 'green', 'yellow', 'blue'];
const DARK = ['#8f0f16', '#00642f', '#a88a00', '#0a62a8'];
const LIGHT = ['#ff9a9e', '#8be8ae', '#fff58f', '#a5dcff'];
const INK = '#1d2056';

const star = (x, y, r) => {
  const pts = Array.from({ length: 10 }, (_, i) => { const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * 0.42 : r; return `${(x + rr * Math.cos(a)).toFixed(3)},${(y + rr * Math.sin(a)).toFixed(3)}`; });
  return pts.join(' ');
};

function Defs() {
  return (
    <defs>
      <linearGradient id="lframe" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#4a4fa8" /><stop offset=".5" stopColor="#222768" /><stop offset="1" stopColor="#0f1236" /></linearGradient>
      <linearGradient id="lpaper" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#fffbf1" /><stop offset="1" stopColor="#f2e8d0" /></linearGradient>
      <pattern id="lweave" width=".5" height=".5" patternUnits="userSpaceOnUse"><circle cx=".25" cy=".25" r=".022" fill="#b9a574" opacity=".35" /></pattern>
      <linearGradient id="ltile" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#ffffff" /><stop offset="1" stopColor="#efe5cc" /></linearGradient>
      <radialGradient id="lplate" cx="50%" cy="40%" r="70%"><stop offset="0" stopColor="#fffdf6" /><stop offset="1" stopColor="#eadfc0" /></radialGradient>
      <linearGradient id="lgold" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#fff0b8" /><stop offset=".55" stopColor="#e8b02a" /><stop offset="1" stopColor="#a8700b" /></linearGradient>
      <radialGradient id="lsock" cx="50%" cy="38%" r="70%"><stop offset="0" stopColor="#000" stopOpacity=".34" /><stop offset="1" stopColor="#000" stopOpacity=".05" /></radialGradient>
      <filter id="lglowS" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation=".16" /></filter>
      <filter id="lglowT" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="1.1" /></filter>
      {COLORS.map((c, i) => (
        <React.Fragment key={i}>
          <radialGradient id={`lg${i}`} cx="36%" cy="30%" r="78%"><stop offset="0" stopColor="#fff" stopOpacity=".95" /><stop offset=".26" stopColor={LIGHT[i]} /><stop offset=".62" stopColor={c} /><stop offset="1" stopColor={DARK[i]} /></radialGradient>
          <linearGradient id={`lb${i}`} x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor={DARK[i]} /><stop offset=".28" stopColor={LIGHT[i]} /><stop offset=".6" stopColor={c} /><stop offset="1" stopColor={DARK[i]} /></linearGradient>
          <linearGradient id={`lc${i}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={LIGHT[i]} /><stop offset=".45" stopColor={c} /><stop offset="1" stopColor={DARK[i]} /></linearGradient>
          <linearGradient id={`lt${i}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#fff" /><stop offset="1" stopColor={LIGHT[i]} /></linearGradient>
          <radialGradient id={`lw${i}`} cx="50%" cy="50%" r="75%"><stop offset="0" stopColor={LIGHT[i]} /><stop offset=".6" stopColor={c} /><stop offset="1" stopColor={DARK[i]} /></radialGradient>
        </React.Fragment>
      ))}
    </defs>
  );
}

const Chevron = ({ x, y, a, s = 1, o = 0.6, c = '#fff' }) => (
  <path d="M-0.17,-0.2 L0.11,0 L-0.17,0.2" transform={`translate(${x} ${y}) rotate(${a}) scale(${s})`} fill="none" stroke={c} strokeOpacity={o} strokeWidth="0.11" strokeLinecap="round" strokeLinejoin="round" />
);

/** Smooth path through a list of points (straight segments — the road turns at right angles). */
const pathOf = (pts) => 'M' + pts.map((p) => `${+p.x.toFixed(3)} ${+p.y.toFixed(3)}`).join(' L');

/**
 * The classic Ludo board, drawn flat and crisp: four solid yards each with a white inner square, white grid cells, home lanes and
 * start tiles filled with the player's colour, hollow stars on the safe cells, an arrow where each lane enters, and the four
 * colour triangles in the middle.
 */
function Square({ seats, turnSeat, names, youSlot }) {
  const B = BOARDS.square, N = B.ringLen;
  const grid = { stroke: '#8f8f8f', strokeWidth: 0.035 };
  const cells = [];
  for (let i = 0; i < N; i++) {
    const { x, y } = ringXY('square', i), si = B.seatStart.indexOf(i), safe = si < 0 && B.seatStart.some((st) => B.safeOffsets.some((o) => (st + o) % N === i));
    cells.push(
      <g key={i}>
        <rect x={x - 0.5} y={y - 0.5} width="1" height="1" fill={si >= 0 ? COLORS[si] : '#fff'} opacity={si >= 0 && !seats.includes(si) ? 0.5 : 1} {...grid} />
        {safe && <polygon points={star(x, y, 0.36)} fill="#fff" stroke="#7a7a7a" strokeWidth="0.045" strokeLinejoin="round" />}
      </g>,
    );
  }
  const home = [];
  [0, 1, 2, 3].forEach((q) => {
    for (let m = 1; m <= 5; m++) { const { x, y } = homeXY('square', q, m); home.push(<rect key={`h${q}${m}`} x={x - 0.5} y={y - 0.5} width="1" height="1" fill={COLORS[q]} opacity={seats.includes(q) ? 1 : 0.5} {...grid} />); }
  });
  // the arrow where each colour's lane begins (on the edge cell, pointing at the centre)
  const arrows = [[0.5, 7.5, 0], [7.5, 0.5, 90], [14.5, 7.5, 180], [7.5, 14.5, 270]].map(([x, y, a], q) => (
    <path key={`ar${q}`} d="M-0.34,0 L0.34,0 M0.08,-0.24 L0.34,0 L0.08,0.24" transform={`translate(${x} ${y}) rotate(${a})`} fill="none" stroke={COLORS[q]} strokeWidth="0.075" strokeLinecap="round" strokeLinejoin="round" />
  ));
  const bases = [[0, 0], [9, 0], [9, 9], [0, 9]].map(([x, y], q) => {
    const top = y === 0, nm = names && names[q] ? String(names[q]) : null, you = youSlot === q;
    return (
      <g key={q} opacity={seats.includes(q) ? 1 : 0.4}>
        <rect x={x} y={y} width="6" height="6" fill={COLORS[q]} />
        <rect x={x + 1} y={y + 1} width="4" height="4" fill="#fff" />
        {[0, 1, 2, 3].map((k) => { const p = baseXY('square', q, k); return (
          <g key={k}>
            <circle cx={p.x} cy={p.y + 0.4} r="0.56" fill={COLORS[q]} />
            <circle cx={p.x} cy={p.y + 0.4} r="0.4" fill="none" stroke={DARK[q]} strokeWidth="0.09" />
          </g>
        ); })}
        {(youSlot === q || turnSeat === q) && <rect className={youSlot === q ? 'ludo-youglow' : 'ludo-baseturn'} x={x + 0.06} y={y + 0.06} width="5.88" height="5.88" fill="none" stroke={youSlot === q ? '#fff4a8' : '#fff'} strokeWidth="0.12" />}
        {nm && <text x={x + 3} y={top ? y + 0.52 : y + 5.5} textAnchor="middle" dominantBaseline="central" fontSize="0.62" fontWeight="800" fill={you ? '#fff1a0' : '#fff'} stroke="#222" strokeWidth="0.1" paintOrder="stroke" strokeLinejoin="round" style={{ pointerEvents: 'none' }}>{nm}</text>}
      </g>
    );
  });
  return (
    <g>
      <rect x="-0.06" y="-0.06" width="15.12" height="15.12" fill="#2b2b2b" />
      <rect x="0" y="0" width="15" height="15" fill="#fff" />
      {bases}{cells}{home}{arrows}
      <polygon points="6,6 9,6 7.5,7.5" fill={COLORS[1]} /><polygon points="9,6 9,9 7.5,7.5" fill={COLORS[2]} />
      <polygon points="9,9 6,9 7.5,7.5" fill={COLORS[3]} /><polygon points="6,9 6,6 7.5,7.5" fill={COLORS[0]} />
    </g>
  );
}

/**
 * The pawn, drawn at radius 1: a map-pin — a white pin with a glossy colour ball for a head and its tip on the ground
 * (tip at y = 0.62), the way every Ludo player knows it. A pawn that has reached home wears a small gold crown.
 */
function Pawn({ seat, fin }) {
  return (
    <g>
      <path d="M0,0.62 C-0.2,0.3 -0.64,-0.25 -0.64,-0.72 A0.64,0.64 0 1 1 0.64,-0.72 C0.64,-0.25 0.2,0.3 0,0.62 Z" fill="#f4f4f4" stroke="#8c8c8c" strokeWidth="0.07" strokeLinejoin="round" />
      <path d="M-0.5,-0.78 C-0.5,-1.12 -0.28,-1.34 0,-1.34 C-0.3,-1.2 -0.42,-0.9 -0.4,-0.5 C-0.5,-0.55 -0.5,-0.66 -0.5,-0.78 Z" fill="#fff" opacity=".9" />
      <circle cx="0" cy="-0.72" r="0.4" fill={`url(#lg${seat})`} stroke={DARK[seat]} strokeWidth="0.05" />
      <ellipse cx="-0.13" cy="-0.88" rx="0.13" ry="0.08" fill="#fff" opacity=".85" transform="rotate(-30 -0.13 -0.88)" />
      {fin && <path d="M-0.3,-1.42 L-0.24,-1.74 L-0.1,-1.56 L0,-1.8 L0.1,-1.56 L0.24,-1.74 L0.3,-1.42 Z" fill="url(#lgold)" stroke="#7a4d08" strokeWidth="0.05" strokeLinejoin="round" />}
    </g>
  );
}

/** Where the idx-th of n pawns on one point stands, and how big it is (1 = full size): one pawn is full size, two stand side by side,
 *  three in a triangle, four in a square, more in a ring — each step smaller, so nothing is ever hidden behind its neighbour. */
const STACK = [null, [[0, 0]], [[-0.27, 0.05], [0.27, 0.05]], [[-0.3, 0.16], [0.3, 0.16], [0, -0.2]], [[-0.3, 0.2], [0.3, 0.2], [-0.3, -0.2], [0.3, -0.2]]];
const STACK_SIZE = [1, 1, 0.62, 0.54, 0.5];
function stackSlot(n, idx) {
  if (n <= 4) { const [x, y] = STACK[n][idx]; return [x, y, STACK_SIZE[n]]; }
  const a = (idx / n) * Math.PI * 2 - Math.PI / 2; return [Math.cos(a) * 0.36, Math.sin(a) * 0.34, 0.44];
}

/** Particles for a capture / home / leave-base burst, drawn at a board position. */
function Burst({ fx, board }) {
  const U = UNIT[board], n = fx.kind === 'out' || fx.kind === 'land' ? 0 : 12;
  return (
    <g className={`ludo-fx ${fx.kind}`} style={{ transform: `translate(${fx.x}px, ${fx.y}px)`, '--u': U.r }}>
      <circle className="fx-ring" r={U.r * 1.1} fill="none" stroke={fx.kind === 'home' ? '#ffd24a' : fx.color} strokeWidth={U.r * 0.22} />
      {fx.kind === 'hit' && <circle className="fx-flash" r={U.r * 1.4} fill="#fff" />}
      {Array.from({ length: n }, (_, k) => {
        const a = (k / n) * Math.PI * 2 + fx.k * 0.7, d = U.r * (2.4 + (k % 3) * 0.7);
        return <circle key={k} className="fx-p" r={U.r * (0.12 + (k % 3) * 0.05)} fill={fx.kind === 'home' ? (k % 2 ? '#ffd24a' : '#fff7c2') : (k % 2 ? fx.color : '#fff')} style={{ '--dx': Math.cos(a) * d, '--dy': Math.sin(a) * d, animationDelay: `${(k % 4) * 0.02}s` }} />;
      })}
    </g>
  );
}

/**
 * tokens   : [{p, i, seat, pos, moving}] already resolved (animation overrides applied).
 * legal    : Set of "p:i" keys the human may tap.     previews: Map "p:i" → { to, captured, finishes } for those tokens.
 * trail    : { seat, pts:[{x,y}], k } the cells the last move crossed.   fx: [{id,x,y,color,kind,k}] bursts.   flying: Set of keys sliding home after a capture.
 */
export default function LudoBoard({ board, seats: seatsIn, tokens, legal, onPick, hintKey, turnSeat: turnIn, previews, trail, retTrail = null, fx = [], flying, view = 0, names = null, youSlot = null }) {
  const U = UNIT[board], R = U.r, F = finishOf(board);
  const dp = (s) => (s + view) % 4;                       // seat → where it sits on THIS screen
  const seats = seatsIn.map(dp), turnSeat = dp(turnIn);
  const [hover, setHover] = useState(null);
  // pawns that share a stopping point (the start tile, a safe star, the yard door …) shrink and line up neatly so every one stays visible
  const groups = new Map();
  tokens.forEach((tk) => { const xy = tokenXY(board, tk.seat, tk.pos, tk.i, view); const k = `${xy.x.toFixed(2)},${xy.y.toFixed(2)}`; (groups.get(k) || groups.set(k, []).get(k)).push({ tk, xy }); });
  const items = [];
  groups.forEach((g) => g.forEach(({ tk, xy }, idx) => {
    const n = g.length, fin = tk.pos === F, [ox, oy, sz] = stackSlot(n, idx);
    items.push({ tk, x: xy.x + ox, y: xy.y + oy, sc: fin ? 0.5 : sz, fin });
  }));
  items.sort((a, b) => (a.tk.moving ? 1 : 0) - (b.tk.moving ? 1 : 0) || a.y - b.y);
  const ghosts = [];
  legal.forEach((key) => {
    const pv = previews && previews.get(key); if (!pv) return;
    const [p, i] = key.split(':').map(Number), tk = tokens.find((t) => t.p === p && t.i === i); if (!tk) return;
    const xy = tokenXY(board, tk.seat, pv.to, i, view), on = hover === key || hintKey === key, hit = pv.captured.length > 0;
    const col = COLORS[dp(tk.seat)];
    ghosts.push(
      <g key={key} className={`ludo-ghost${on ? ' on' : ''}${hit ? ' hit' : ''}`} style={{ transform: `translate(${xy.x}px, ${xy.y}px)` }}>
        <rect x={-0.52} y={-0.52} width="1.04" height="1.04" rx="0.18" fill={hit ? '#ff4d3a' : col} fillOpacity={on ? 0.36 : 0.2} stroke={hit ? '#ff4d3a' : col} strokeWidth="0.09" />
        {hit && <g stroke="#fff" strokeWidth={R * 0.2} strokeLinecap="round"><path d={`M${-R * 0.42},${-R * 0.42} L${R * 0.42},${R * 0.42} M${R * 0.42},${-R * 0.42} L${-R * 0.42},${R * 0.42}`} /></g>}
        {!hit && !pv.finishes && <circle r={R * 0.2} fill="#fff" />}
        {pv.finishes && <polygon points={star(0, 0, R * 0.78)} fill="url(#lgold)" stroke="#7a4d08" strokeWidth={R * 0.08} />}
      </g>,
    );
  });
  return (
    <svg className={`ludo-svg ${board}`} viewBox={viewBoxOf(board)} role="img" aria-label="Ludo board">
      <Defs />
      <Square seats={seats} turnSeat={turnSeat} names={names} youSlot={youSlot} />
      {trail && trail.pts.length > 0 && (
        <g className="ludo-trail" key={trail.k}>
          {trail.pts.length > 1 && <path className="t-glow" d={pathOf(trail.pts)} pathLength="1" fill="none" stroke={COLORS[dp(trail.seat)]} strokeWidth={R * 1.05} strokeLinecap="round" strokeLinejoin="round" />}
          {trail.pts.length > 1 && <path className="t-flow" d={pathOf(trail.pts)} fill="none" stroke="#fff" strokeWidth={R * 0.17} strokeLinecap="round" strokeLinejoin="round" strokeDasharray="0.14 0.23" />}
          <circle className="t-end" cx={trail.pts[trail.pts.length - 1].x} cy={trail.pts[trail.pts.length - 1].y} r={R * 0.95} fill="none" stroke="#fff" strokeWidth={R * 0.14} />
        </g>
      )}
      {retTrail && retTrail.map((rt, n) => (rt.pts.length > 1 ? (
        <g className="ludo-ret" key={`r${n}`}>
          <path className="t-glow" d={pathOf(rt.pts)} pathLength="1" fill="none" stroke="#ff3b2a" strokeWidth={R * 0.8} strokeLinecap="round" strokeLinejoin="round" />
          <path className="t-flow" d={pathOf(rt.pts)} fill="none" stroke="#fff" strokeWidth={R * 0.14} strokeLinecap="round" strokeLinejoin="round" strokeDasharray="0.14 0.23" />
        </g>
      ) : null))}
      {ghosts}
      {items.map(({ tk, x, y, sc, fin }) => {
        const key = `${tk.p}:${tk.i}`, can = legal.has(key), fly = flying && flying.has(key), idle = legal.size > 0 && !can && !tk.moving;
        const pick = can ? (e) => { e.preventDefault(); onPick(tk.i); } : undefined;
        return (
          <g key={key} className={`ludo-tok${can ? ' can' : ''}${idle ? ' idle' : ''}${hintKey === key ? ' hint' : ''}${fly ? ' fly' : ''}${tk.moving ? ' moving' : ''}${tk.back ? ' back' : ''}${fin ? ' fin' : ''}${items.length && sc < 1 && !fin ? ' stacked' : ''}`}
            style={{ transform: `translate(${x}px, ${y}px)`, '--hop': U.hop, '--r': R }}
            onPointerDown={pick} onPointerEnter={can ? () => setHover(key) : undefined} onPointerLeave={can ? () => setHover(null) : undefined}
            onKeyDown={can ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onPick(tk.i); } } : undefined}
            role={can ? 'button' : undefined} tabIndex={can ? 0 : undefined} aria-label={can ? `Move ${COLOR_NAMES[dp(tk.seat)]} token` : undefined}>
            {can && <circle r={R * 1.6} fill="transparent" />}
            {tk.back && <circle r={R * 1.3} className="retring" fill="none" stroke="#ff3b2a" strokeWidth={R * 0.2} />}
            {can && <circle r={R * 1.3} className="ring" fill="none" stroke={COLORS[dp(tk.seat)]} strokeWidth={R * 0.2} />}
            {can && <circle r={R * 1.3} className="ring2" fill="none" stroke="#fff" strokeWidth={R * 0.07} />}
            <ellipse className="shadow" cx={R * 0.1} cy={R * 0.66 * sc} rx={R * 0.5 * sc} ry={R * 0.16 * sc} fill="rgba(0,0,0,.28)" />
            <g key={tk.moving ? `m${tk.pos}` : 'still'} className="body"><g className="sz" style={{ transform: `scale(${R * sc})` }}><Pawn seat={dp(tk.seat)} fin={fin} /></g></g>
          </g>
        );
      })}
      {fx.map((f) => <Burst key={f.id} fx={f} board={board} />)}
    </svg>
  );
}

export { finishOf };
