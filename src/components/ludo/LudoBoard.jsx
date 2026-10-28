'use client';
import React, { useState } from 'react';
import { BOARDS, finishOf } from '@/lib/ludo/engine.js';
import { ringXY, homeXY, baseXY, finishXY, tokenXY, viewBoxOf, homeAngle, UNIT } from '@/lib/ludo/layout.js';

// colours are by SCREEN position (top-left, top-right, bottom-right, bottom-left): the bottom-left one is always YOU, in yellow
export const COLORS = ['#E5484D', '#2DB66F', '#3A7BF2', '#F6B73C'];
export const COLOR_NAMES = ['red', 'green', 'blue', 'yellow'];
const DARK = ['#8f1f26', '#13633a', '#1b3f99', '#a86a0a'];
const LIGHT = ['#ffa5a8', '#93f0ba', '#aecbff', '#ffe6a0'];
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
 * The classic cross, redrawn as a ROAD:
 *   • a continuous rounded road runs round the board; it changes colour every 13 cells (red → green → yellow → blue, the way play
 *     travels), so you always see whose quarter you are in;
 *   • light tiles sit on the road, each player's start tile is solid colour with an arrow into the road, safe tiles carry a gold star;
 *   • faint dots flow along the road in the direction of play;
 *   • each home lane is a coloured strip with chevrons pointing at the centre.
 */
function Square({ seats, turnSeat, names, youSlot }) {
  const B = BOARDS.square, N = B.ringLen, seg = N / 4;
  const pts = Array.from({ length: N }, (_, i) => ringXY('square', i));
  const road = [];
  for (let q = 0; q < 4; q++) {
    const part = []; for (let k = 0; k <= seg; k++) part.push(pts[(q * seg + k) % N]);
    road.push(<path key={`rs${q}`} d={pathOf(part)} fill="none" stroke="#1d2056" strokeOpacity=".2" strokeWidth="1.08" strokeLinecap="round" strokeLinejoin="round" transform="translate(0 .07)" />);
  }
  for (let q = 0; q < 4; q++) {
    const part = []; for (let k = 0; k <= seg; k++) part.push(pts[(q * seg + k) % N]);
    road.push(<path key={`r${q}`} d={pathOf(part)} fill="none" stroke={COLORS[q]} strokeOpacity={seats.includes(q) ? 1 : 0.5} strokeWidth="1.08" strokeLinecap="round" strokeLinejoin="round" />);
  }
  const cells = [];
  for (let i = 0; i < N; i++) {
    const { x, y } = pts[i], si = B.seatStart.indexOf(i), safe = si < 0 && B.seatStart.some((st) => B.safeOffsets.some((o) => (st + o) % N === i));
    const nx = pts[(i + 1) % N], ang = Math.atan2(nx.y - y, nx.x - x) * 180 / Math.PI;
    cells.push(
      <g key={i}>
        <rect x={x - 0.47} y={y - 0.47} width="0.94" height="0.94" rx="0.15" fill={si >= 0 ? `url(#lc${si})` : 'url(#ltile)'} opacity={si >= 0 && !seats.includes(si) ? 0.55 : 1} />
        <rect x={x - 0.42} y={y - 0.44} width="0.84" height="0.34" rx="0.11" fill="#fff" opacity={si >= 0 ? 0.28 : 0.7} />
        {safe && <><polygon points={star(x, y, 0.45)} fill="#ffcf4a" opacity=".5" filter="url(#lglowS)" /><polygon points={star(x, y, 0.38)} fill="url(#lgold)" stroke="#7a4d08" strokeWidth="0.03" strokeLinejoin="round" /></>}
        {si >= 0 && <path d="M-0.2,-0.22 L0.12,0 L-0.2,0.22 M-0.02,-0.22 L0.3,0 L-0.02,0.22" transform={`translate(${x} ${y}) rotate(${ang})`} fill="none" stroke="#fff" strokeOpacity=".95" strokeWidth="0.09" strokeLinecap="round" strokeLinejoin="round" />}
      </g>,
    );
  }
  const home = [];
  [0, 1, 2, 3].forEach((s) => {
    const a = homeAngle('square', s), on = seats.includes(s), p1 = homeXY('square', s, 1), p5 = homeXY('square', s, 5);
    home.push(<g key={`h${s}`} opacity={on ? 1 : 0.4}>
      <line x1={p1.x} y1={p1.y + 0.05} x2={p5.x} y2={p5.y + 0.05} stroke="#1d2056" strokeOpacity=".2" strokeWidth="1.04" strokeLinecap="round" />
      <line x1={p1.x} y1={p1.y} x2={p5.x} y2={p5.y} stroke={DARK[s]} strokeWidth="1.02" strokeLinecap="round" />
      <line x1={p1.x} y1={p1.y} x2={p5.x} y2={p5.y} stroke={COLORS[s]} strokeOpacity=".55" strokeWidth=".9" strokeLinecap="round" />
      {[1, 2, 3, 4, 5].map((m) => {
        const { x, y } = homeXY('square', s, m);
        return (
          <g key={m}>
            <rect x={x - 0.47} y={y - 0.47} width="0.94" height="0.94" rx="0.15" fill={`url(#lt${s})`} />
            <rect x={x - 0.42} y={y - 0.44} width="0.84" height="0.32" rx="0.11" fill="#fff" opacity=".55" />
            <Chevron x={x} y={y} a={a} s={m === 5 ? 1.15 : 0.9} o={m === 5 ? 1 : 0.8} c={COLORS[s]} />
          </g>
        );
      })}
    </g>);
  });
  const bases = [[0, 0], [9, 0], [9, 9], [0, 9]].map(([x0, y0], s) => {
    const Y = 4.7, x = x0 + (x0 === 0 ? 0.25 : 6 - 0.25 - Y), y = y0 + (y0 === 0 ? 0.25 : 6 - 0.25 - Y); // a 4.7 yard tucked into the outer corner: the road gets the room
    const c = Y / 2;
    return (
    <g key={s} opacity={seats.includes(s) ? 1 : 0.34}>
      <rect x={x} y={y + 0.08} width={Y} height={Y} rx="0.7" fill="#1d2056" opacity=".22" />
      <rect x={x} y={y} width={Y} height={Y} rx="0.7" fill={`url(#lc${s})`} />
      <rect x={x + 0.1} y={y + 0.1} width={Y - 0.2} height="1.7" rx="0.58" fill="#fff" opacity=".16" />
      <rect x={x + 0.55} y={y + 0.6} width={Y - 1.1} height={Y - 1.1} rx="0.95" fill="#000" opacity=".2" />
      <rect x={x + 0.55} y={y + 0.55} width={Y - 1.1} height={Y - 1.1} rx="0.95" fill="url(#lplate)" stroke={DARK[s]} strokeOpacity=".55" strokeWidth="0.07" />
      <rect x={x + 0.75} y={y + 0.75} width={Y - 1.5} height={Y - 1.5} rx="0.8" fill="none" stroke={COLORS[s]} strokeOpacity=".4" strokeWidth="0.05" strokeDasharray="0.14 0.2" />
      {[0, 1, 2, 3].map((k) => { const p = baseXY('square', s, k); return (
        <g key={k}>
          <circle cx={p.x} cy={p.y + 0.05} r="0.6" fill="#000" opacity=".16" />
          <circle cx={p.x} cy={p.y} r="0.6" fill={`url(#lw${s})`} stroke={DARK[s]} strokeOpacity=".65" strokeWidth="0.05" />
          <circle cx={p.x} cy={p.y} r="0.43" fill="url(#lsock)" />
          <circle cx={p.x} cy={p.y} r="0.43" fill="none" stroke="#fff" strokeOpacity=".5" strokeWidth="0.04" />
        </g>
      ); })}
      {youSlot === s && <rect className="ludo-youglow" x={x + 0.03} y={y + 0.03} width={Y - 0.06} height={Y - 0.06} rx="0.68" fill="none" stroke="#ffe08a" strokeWidth="0.16" />}
      {turnSeat === s && youSlot !== s && <rect className="ludo-baseturn" x={x + 0.03} y={y + 0.03} width={Y - 0.06} height={Y - 0.06} rx="0.68" fill="none" stroke="#fff" strokeWidth="0.12" />}
      {names && names[s] && (() => {
        const nm = String(names[s]), you = youSlot === s, w = Math.min(3.8, Math.max(1.7, nm.length * 0.32 + 0.9));
        return (
          <g className={you ? 'ludo-you' : 'ludo-nameplate'} style={{ pointerEvents: 'none' }}>
            <rect x={x + c - w / 2} y={y + Y - 0.66} width={w} height="0.5" rx="0.25" fill={you ? 'url(#lgold)' : '#1d2056'} fillOpacity={you ? 1 : 0.8} stroke={you ? '#fff4c2' : '#fff'} strokeOpacity={you ? 0.95 : 0.35} strokeWidth="0.04" />
            <text x={x + c} y={y + Y - 0.41} textAnchor="middle" dominantBaseline="central" fontSize="0.34" fontWeight="800" fill={you ? '#3a2205' : '#fff7e0'}>{nm}</text>
          </g>
        );
      })()}
    </g>
    );
  });
  const jewel = COLORS[turnSeat] || '#fff';
  return (
    <g>
      <rect x="-0.45" y="-0.37" width="15.9" height="15.9" rx="1.1" fill="#000" opacity=".25" />
      <rect x="-0.45" y="-0.45" width="15.9" height="15.9" rx="1.1" fill="url(#lframe)" />
      <rect x="-0.3" y="-0.3" width="15.6" height="15.6" rx="0.95" fill="none" stroke="url(#lgold)" strokeWidth="0.07" />
      {[[-0.2, -0.2], [7.5, -0.2], [15.2, -0.2], [-0.2, 7.5], [15.2, 7.5], [-0.2, 15.2], [7.5, 15.2], [15.2, 15.2]].map(([rx, ry], k) => <circle key={k} cx={rx} cy={ry} r="0.085" fill="url(#lgold)" stroke="#1d2056" strokeWidth="0.02" />)}
      <rect x="0" y="0" width="15" height="15" rx="0.5" fill="url(#lpaper)" />
      <rect x="0" y="0" width="15" height="15" rx="0.5" fill="url(#lweave)" />
      {bases}{road}{cells}{home}
      <polygon points="6,6 9,6 7.5,7.5" fill="url(#lc1)" /><polygon points="9,6 9,9 7.5,7.5" fill="url(#lc2)" />
      <polygon points="9,9 6,9 7.5,7.5" fill="url(#lc3)" /><polygon points="6,9 6,6 7.5,7.5" fill="url(#lc0)" />
      <path d="M6,6 L9,9 M9,6 L6,9" stroke="#fff" strokeOpacity=".5" strokeWidth="0.05" />
      <rect x="6" y="6" width="3" height="3" fill="none" stroke={INK} strokeOpacity=".7" strokeWidth="0.06" />
      <path className="ludo-roadflow" d={pathOf([...pts, pts[0]])} fill="none" stroke="#1d2056" strokeOpacity=".28" strokeWidth="0.075" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="0.02 0.43" />
      <circle cx="7.5" cy="7.5" r="0.62" fill={jewel} opacity=".5" filter="url(#lglowS)" className="ludo-jewel-glow" />
      <circle cx="7.5" cy="7.5" r="0.42" fill="url(#lgold)" stroke="#7a4d08" strokeWidth="0.04" />
      <circle cx="7.5" cy="7.5" r="0.26" fill={jewel} stroke="#fff" strokeOpacity=".8" strokeWidth="0.04" className="ludo-jewel" />
    </g>
  );
}

/**
 * The toy pawn, drawn at radius 1: a little peg-doll — round glossy head with two eyes, shoulders, a flared skirt with a gold belt and
 * a chunky base, all with a white rim so it stays readable on every colour. A pawn that has reached home wears a gold crown.
 */
function Pawn({ seat, fin }) {
  const rim = { stroke: '#fff', strokeOpacity: 0.95, strokeWidth: 0.085, strokeLinejoin: 'round' };
  return (
    <g transform={`translate(0 ${fin ? 0.1 : 0.2}) scale(0.9 1.1)`}>
      <ellipse cx="0" cy="0.6" rx="0.92" ry="0.3" fill={DARK[seat]} {...rim} />
      <path d="M-0.5,-0.32 C-0.5,0.12 -0.84,0.3 -0.86,0.5 C-0.5,0.68 0.5,0.68 0.86,0.5 C0.84,0.3 0.5,0.12 0.5,-0.32 Z" fill={`url(#lb${seat})`} {...rim} />
      <path d="M-0.66,0.2 Q0,0.4 0.66,0.2 L0.72,0.34 Q0,0.56 -0.72,0.34 Z" fill="url(#lgold)" stroke="#7a4d08" strokeOpacity=".6" strokeWidth="0.03" />
      <ellipse cx="-0.3" cy="0.05" rx="0.09" ry="0.26" fill="#fff" opacity=".4" transform="rotate(8 -0.3 0.05)" />
      <ellipse cx="0" cy="-0.34" rx="0.66" ry="0.22" fill={`url(#lc${seat})`} {...rim} />
      <circle cx="0" cy="-0.86" r="0.5" fill={`url(#lg${seat})`} {...rim} />
      <ellipse cx="-0.17" cy="-1.08" rx="0.19" ry="0.1" fill="#fff" opacity=".9" transform="rotate(-28 -0.17 -1.08)" />
      <ellipse cx="-0.16" cy="-0.82" rx="0.075" ry="0.1" fill="#1d2056" /><ellipse cx="0.16" cy="-0.82" rx="0.075" ry="0.1" fill="#1d2056" />
      <circle cx="-0.185" cy="-0.855" r="0.025" fill="#fff" /><circle cx="0.135" cy="-0.855" r="0.025" fill="#fff" />
      {fin && <path d="M-0.34,-1.28 L-0.28,-1.62 L-0.12,-1.4 L0,-1.68 L0.12,-1.4 L0.28,-1.62 L0.34,-1.28 Z" fill="url(#lgold)" stroke="#7a4d08" strokeWidth="0.05" strokeLinejoin="round" />}
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
export default function LudoBoard({ board, seats: seatsIn, tokens, legal, onPick, hintKey, turnSeat: turnIn, previews, trail, retTrail = null, fx = [], flying, view = 0, names = null, youSlot = null }) {
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
          <g key={key} className={`ludo-tok${can ? ' can' : ''}${idle ? ' idle' : ''}${hintKey === key ? ' hint' : ''}${fly ? ' fly' : ''}${tk.moving ? ' moving' : ''}${tk.back ? ' back' : ''}`}
            style={{ transform: `translate(${x}px, ${y}px)`, '--hop': U.hop, '--r': R }}
            onPointerDown={pick} onPointerEnter={can ? () => setHover(key) : undefined} onPointerLeave={can ? () => setHover(null) : undefined}
            onKeyDown={can ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onPick(tk.i); } } : undefined}
            role={can ? 'button' : undefined} tabIndex={can ? 0 : undefined} aria-label={can ? `Move ${COLOR_NAMES[dp(tk.seat)]} token` : undefined}>
            {can && <circle r={R * 1.6} fill="transparent" />}
            {tk.back && <circle r={R * 1.3} className="retring" fill="none" stroke="#ff3b2a" strokeWidth={R * 0.2} />}
            {can && <circle r={R * 1.3} className="ring" fill="none" stroke={COLORS[dp(tk.seat)]} strokeWidth={R * 0.2} />}
            {can && <circle r={R * 1.3} className="ring2" fill="none" stroke="#fff" strokeWidth={R * 0.07} />}
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
