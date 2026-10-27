'use client';
import React, { useState } from 'react';
import { BOARDS, finishOf } from '@/lib/ludo/engine.js';
import { ringXY, homeXY, baseXY, finishXY, tokenXY, viewBoxOf, homeAngle, UNIT } from '@/lib/ludo/layout.js';

// colours are by SCREEN position (top-left, top-right, bottom-right, bottom-left): the bottom-left one is always YOU, in yellow
export const COLORS = ['#E0452B', '#2E9E4F', '#2F6FD6', '#F2B632'];
export const COLOR_NAMES = ['red', 'green', 'blue', 'yellow'];
const DARK = ['#8e2412', '#17592b', '#163f86', '#a8740d'];
const LIGHT = ['#ff8e74', '#77d98f', '#8db8ff', '#ffe08a'];
const INK = '#2a1d10';

const star = (x, y, r) => {
  const pts = Array.from({ length: 10 }, (_, i) => { const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * 0.42 : r; return `${(x + rr * Math.cos(a)).toFixed(3)},${(y + rr * Math.sin(a)).toFixed(3)}`; });
  return pts.join(' ');
};

function Defs() {
  return (
    <defs>
      <linearGradient id="lframe" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#8a5a2b" /><stop offset=".5" stopColor="#4a2e15" /><stop offset="1" stopColor="#2a1a0b" /></linearGradient>
      <linearGradient id="lpaper" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#fff9e8" /><stop offset="1" stopColor="#efe2bf" /></linearGradient>
      <radialGradient id="lplate" cx="50%" cy="40%" r="70%"><stop offset="0" stopColor="#fffdf4" /><stop offset="1" stopColor="#ecdfbd" /></radialGradient>
      <linearGradient id="lgold" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#ffe9a3" /><stop offset=".55" stopColor="#e2a921" /><stop offset="1" stopColor="#a8700b" /></linearGradient>
      <radialGradient id="lsock" cx="50%" cy="40%" r="65%"><stop offset="0" stopColor="#000" stopOpacity=".28" /><stop offset="1" stopColor="#000" stopOpacity=".06" /></radialGradient>
      <filter id="lglowS" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation=".16" /></filter>
      <filter id="lglowT" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="1.1" /></filter>
      {COLORS.map((c, i) => (
        <React.Fragment key={i}>
          <radialGradient id={`lg${i}`} cx="36%" cy="30%" r="78%"><stop offset="0" stopColor="#fff" stopOpacity=".95" /><stop offset=".26" stopColor={LIGHT[i]} /><stop offset=".62" stopColor={c} /><stop offset="1" stopColor={DARK[i]} /></radialGradient>
          <linearGradient id={`lb${i}`} x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor={DARK[i]} /><stop offset=".3" stopColor={LIGHT[i]} /><stop offset=".62" stopColor={c} /><stop offset="1" stopColor={DARK[i]} /></linearGradient>
          <linearGradient id={`lc${i}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={LIGHT[i]} /><stop offset=".45" stopColor={c} /><stop offset="1" stopColor={DARK[i]} /></linearGradient>
          <radialGradient id={`lw${i}`} cx="50%" cy="50%" r="75%"><stop offset="0" stopColor={LIGHT[i]} /><stop offset=".6" stopColor={c} /><stop offset="1" stopColor={DARK[i]} /></radialGradient>
        </React.Fragment>
      ))}
    </defs>
  );
}

const Chevron = ({ x, y, a, s = 1, o = 0.6 }) => (
  <path d="M-0.17,-0.2 L0.11,0 L-0.17,0.2" transform={`translate(${x} ${y}) rotate(${a}) scale(${s})`} fill="none" stroke="#fff" strokeOpacity={o} strokeWidth={0.1 * 1} strokeLinecap="round" strokeLinejoin="round" />
);

/** The classic cross: bases, ring, start cells, stars, home columns and the centre. */
function Square({ seats, turnSeat }) {
  const cells = [], B = BOARDS.square;
  for (let i = 0; i < 52; i++) {
    const { x, y } = ringXY('square', i), si = B.seatStart.indexOf(i), safe = B.seatStart.some((st) => B.safeOffsets.some((o) => (st + o) % 52 === i));
    cells.push(
      <g key={i}>
        <rect x={x - 0.46} y={y - 0.37} width="0.92" height="0.92" rx="0.16" fill="#2a1d10" opacity=".2" />
        <rect x={x - 0.46} y={y - 0.46} width="0.92" height="0.92" rx="0.14" fill={si >= 0 ? `url(#lc${si})` : 'url(#lpaper)'} stroke={INK} strokeOpacity=".55" strokeWidth="0.035" opacity={si >= 0 && !seats.includes(si) ? 0.5 : 1} />
        <rect x={x - 0.4} y={y - 0.4} width="0.8" height="0.4" rx="0.1" fill="#fff" opacity={si >= 0 ? 0.2 : 0.55} />
        {safe && si < 0 && <><polygon points={star(x, y, 0.4)} fill="#ffcf4a" opacity=".55" filter="url(#lglowS)" /><polygon points={star(x, y, 0.33)} fill="url(#lgold)" stroke="#7a4d08" strokeWidth="0.03" strokeLinejoin="round" /></>}
        {si >= 0 && <polygon points={star(x, y, 0.3)} fill="#fff" opacity=".92" />}
      </g>,
    );
  }
  const home = [];
  [0, 1, 2, 3].forEach((s) => {
    const a = homeAngle('square', s), on = seats.includes(s);
    for (let m = 1; m <= 5; m++) {
      const { x, y } = homeXY('square', s, m);
      home.push(
        <g key={`${s}${m}`} opacity={on ? 1 : 0.35}>
          <rect x={x - 0.46} y={y - 0.46} width="0.92" height="0.92" rx="0.14" fill={`url(#lc${s})`} stroke={INK} strokeOpacity=".6" strokeWidth="0.035" />
          <rect x={x - 0.4} y={y - 0.4} width="0.8" height="0.35" rx="0.1" fill="#fff" opacity=".22" />
          <Chevron x={x} y={y} a={a} s={m === 5 ? 1.1 : 0.9} o={m === 5 ? 0.95 : 0.55} />
        </g>,
      );
    }
  });
  const bases = [[0, 0], [9, 0], [9, 9], [0, 9]].map(([x, y], s) => (
    <g key={s} opacity={seats.includes(s) ? 1 : 0.32}>
      <rect x={x} y={y} width="6" height="6" rx="0.5" fill={`url(#lc${s})`} stroke={INK} strokeWidth="0.06" />
      <rect x={x + 0.12} y={y + 0.12} width="5.76" height="2.4" rx="0.4" fill="#fff" opacity=".13" />
      <rect x={x + 0.85} y={y + 0.95} width="4.3" height="4.3" rx="0.95" fill="#000" opacity=".22" />
      <rect x={x + 0.85} y={y + 0.85} width="4.3" height="4.3" rx="0.95" fill="url(#lplate)" stroke={DARK[s]} strokeOpacity=".6" strokeWidth="0.08" />
      <rect x={x + 1.05} y={y + 1.05} width="3.9" height="3.9" rx="0.78" fill="none" stroke={COLORS[s]} strokeOpacity=".45" strokeWidth="0.05" strokeDasharray="0.16 0.2" />
      {[0, 1, 2, 3].map((k) => { const p = baseXY('square', s, k); return (
        <g key={k}>
          <circle cx={p.x} cy={p.y + 0.06} r="0.78" fill="#000" opacity=".2" />
          <circle cx={p.x} cy={p.y} r="0.78" fill={`url(#lw${s})`} stroke={DARK[s]} strokeOpacity=".7" strokeWidth="0.05" />
          <circle cx={p.x} cy={p.y} r="0.56" fill="url(#lsock)" />
          <circle cx={p.x} cy={p.y} r="0.56" fill="none" stroke="#fff" strokeOpacity=".55" strokeWidth="0.04" />
          <ellipse cx={p.x - 0.18} cy={p.y - 0.4} rx="0.32" ry="0.12" fill="#fff" opacity=".45" />
        </g>
      ); })}
    </g>
  ));
  const jewel = COLORS[turnSeat] || '#fff';
  return (
    <g>
      <rect x="-0.4" y="-0.4" width="15.8" height="15.8" rx="1" fill="url(#lframe)" />
      <rect x="-0.28" y="-0.28" width="15.56" height="15.56" rx="0.85" fill="none" stroke="#e8c27d" strokeOpacity=".5" strokeWidth="0.05" />
      <rect x="0" y="0" width="15" height="15" rx="0.45" fill="url(#lpaper)" />
      {bases}{cells}{home}
      <polygon points="6,6 9,6 7.5,7.5" fill="url(#lc1)" /><polygon points="9,6 9,9 7.5,7.5" fill="url(#lc2)" />
      <polygon points="9,9 6,9 7.5,7.5" fill="url(#lc3)" /><polygon points="6,9 6,6 7.5,7.5" fill="url(#lc0)" />
      <path d="M6,6 L9,9 M9,6 L6,9" stroke="#fff" strokeOpacity=".55" strokeWidth="0.05" />
      <rect x="6" y="6" width="3" height="3" fill="none" stroke={INK} strokeWidth="0.06" />
      <circle cx="7.5" cy="7.5" r="0.62" fill={jewel} opacity=".5" filter="url(#lglowS)" className="ludo-jewel-glow" />
      <circle cx="7.5" cy="7.5" r="0.42" fill="url(#lgold)" stroke="#7a4d08" strokeWidth="0.04" />
      <circle cx="7.5" cy="7.5" r="0.26" fill={jewel} stroke="#fff" strokeOpacity=".8" strokeWidth="0.04" className="ludo-jewel" />
    </g>
  );
}

/** A toy pawn drawn at radius 1: white-rimmed glossy sphere head, collar, tapered body and a chunky rounded base. */
function Pawn({ seat, fin }) {
  const rim = { stroke: '#fff', strokeOpacity: 0.92, strokeWidth: 0.1, strokeLinejoin: 'round' };
  return (
    <g transform={`translate(0 ${fin ? 0.05 : 0.2})`}>
      <ellipse cx="0" cy="0.58" rx="0.98" ry="0.36" fill={DARK[seat]} {...rim} />
      <ellipse cx="0" cy="0.46" rx="0.98" ry="0.36" fill={`url(#lc${seat})`} stroke="rgba(0,0,0,.45)" strokeWidth="0.05" />
      <ellipse cx="-0.25" cy="0.38" rx="0.4" ry="0.1" fill="#fff" opacity=".5" />
      <path d="M-0.62,0.42 C-0.62,0.06 -0.28,0.04 -0.2,-0.34 L0.2,-0.34 C0.28,0.04 0.62,0.06 0.62,0.42 C0.4,0.58 -0.4,0.58 -0.62,0.42 Z" fill={`url(#lb${seat})`} {...rim} />
      <ellipse cx="0" cy="-0.36" rx="0.5" ry="0.15" fill={`url(#lc${seat})`} {...rim} />
      <circle cx="0" cy="-0.82" r="0.52" fill={`url(#lg${seat})`} {...rim} />
      <ellipse cx="-0.18" cy="-1.02" rx="0.2" ry="0.11" fill="#fff" opacity=".9" transform="rotate(-28 -0.18 -1.02)" />
      <circle cx="0.2" cy="-0.6" r="0.09" fill="#fff" opacity=".35" />
    </g>
  );
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
export default function LudoBoard({ board, seats: seatsIn, tokens, legal, onPick, hintKey, turnSeat: turnIn, previews, trail, retTrail = null, fx = [], flying, view = 0 }) {
  const U = UNIT[board], R = U.r, F = finishOf(board);
  const dp = (s) => (s + view) % 4;                       // seat → where it sits on THIS screen
  const seats = seatsIn.map(dp), turnSeat = dp(turnIn);
  const [hover, setHover] = useState(null);
  // spread tokens that share a point
  const groups = new Map();
  tokens.forEach((tk) => { const xy = tokenXY(board, tk.seat, tk.pos, tk.i, view); const k = `${xy.x.toFixed(2)},${xy.y.toFixed(2)}`; (groups.get(k) || groups.set(k, []).get(k)).push({ tk, xy }); });
  const items = [];
  groups.forEach((g) => g.forEach(({ tk, xy }, idx) => {
    const n = g.length, ang = (idx / n) * Math.PI * 2 - Math.PI / 2, spread = n > 1 ? R * (n > 2 ? 0.8 : 0.62) : 0;
    items.push({ tk, x: xy.x + Math.cos(ang) * spread, y: xy.y + Math.sin(ang) * spread, sc: (n > 1 ? 0.78 : 1) * (tk.pos === F ? 0.85 : 1), fin: tk.pos === F });
  }));
  items.sort((a, b) => (a.tk.moving ? 1 : 0) - (b.tk.moving ? 1 : 0) || a.y - b.y);
  const ghosts = [];
  legal.forEach((key) => {
    const pv = previews && previews.get(key); if (!pv) return;
    const [p, i] = key.split(':').map(Number), tk = tokens.find((t) => t.p === p && t.i === i); if (!tk) return;
    const xy = tokenXY(board, tk.seat, pv.to, i, view), on = hover === key || hintKey === key, hit = pv.captured.length > 0;
    ghosts.push(
      <g key={key} className={`ludo-ghost${on ? ' on' : ''}${hit ? ' hit' : ''}`} style={{ transform: `translate(${xy.x}px, ${xy.y}px)` }}>
        <circle r={R * 0.95} fill={COLORS[dp(tk.seat)]} fillOpacity={on ? 0.34 : 0.16} stroke={hit ? '#ff4d3a' : COLORS[dp(tk.seat)]} strokeWidth={R * 0.16} strokeDasharray={`${R * 0.45} ${R * 0.33}`} />
        {hit && <g stroke="#ff3b2a" strokeWidth={R * 0.2} strokeLinecap="round"><path d={`M${-R * 0.42},${-R * 0.42} L${R * 0.42},${R * 0.42} M${R * 0.42},${-R * 0.42} L${-R * 0.42},${R * 0.42}`} /></g>}
        {pv.finishes && <polygon points={star(0, 0, R * 0.7)} fill="url(#lgold)" stroke="#7a4d08" strokeWidth={R * 0.08} />}
      </g>,
    );
  });
  return (
    <svg className={`ludo-svg ${board}`} viewBox={viewBoxOf(board)} role="img" aria-label="Ludo board">
      <Defs />
      <Square seats={seats} turnSeat={turnSeat} />
      {trail && trail.pts.length > 0 && (
        <g className="ludo-trail" key={trail.k}>
          {trail.pts.map((pt, k) => <circle key={k} cx={pt.x} cy={pt.y} r={R * 0.3} fill={COLORS[dp(trail.seat)]} stroke="#fff" strokeWidth={R * 0.08} style={{ animationDelay: `${k * 0.05}s` }} />)}
        </g>
      )}
      {retTrail && retTrail.map((rt, n) => (
        <g className="ludo-ret" key={`r${n}`}>
          {rt.pts.map((pt, k) => <circle key={k} cx={pt.x} cy={pt.y} r={R * 0.26} fill="#ff3b2a" stroke="#fff" strokeWidth={R * 0.07} style={{ animationDelay: `${k * 0.03}s` }} />)}
        </g>
      ))}
      {ghosts}
      {items.map(({ tk, x, y, sc, fin }) => {
        const key = `${tk.p}:${tk.i}`, can = legal.has(key), fly = flying && flying.has(key);
        const pick = can ? (e) => { e.preventDefault(); onPick(tk.i); } : undefined;
        return (
          <g key={key} className={`ludo-tok${can ? ' can' : ''}${hintKey === key ? ' hint' : ''}${fly ? ' fly' : ''}${tk.moving ? ' moving' : ''}${tk.back ? ' back' : ''}`}
            style={{ transform: `translate(${x}px, ${y}px)`, '--hop': U.hop }}
            onPointerDown={pick} onPointerEnter={can ? () => setHover(key) : undefined} onPointerLeave={can ? () => setHover(null) : undefined}
            onKeyDown={can ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onPick(tk.i); } } : undefined}
            role={can ? 'button' : undefined} tabIndex={can ? 0 : undefined} aria-label={can ? `Move ${COLOR_NAMES[dp(tk.seat)]} token` : undefined}>
            {can && <circle r={R * 1.6} fill="transparent" />}
            {tk.back && <circle r={R * 1.3} className="retring" fill="none" stroke="#ff3b2a" strokeWidth={R * 0.2} />}
            {can && <circle r={R * 1.35} className="ring" fill="none" stroke="#fff" strokeWidth={R * 0.18} />}
            <ellipse className="shadow" cx={R * 0.1} cy={R * 0.78 * sc} rx={R * 0.95 * sc} ry={R * 0.34 * sc} fill="rgba(0,0,0,.42)" />
            <g key={tk.moving ? `m${tk.pos}` : 'still'} className="body"><g transform={`scale(${R * sc})`}><Pawn seat={dp(tk.seat)} fin={fin} /></g></g>
          </g>
        );
      })}
      {fx.map((f) => <Burst key={f.id} fx={f} board={board} />)}
    </svg>
  );
}

export { finishOf };
