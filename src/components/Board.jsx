'use client';
import React, { memo } from 'react';

// Slots 0-6 belong to seat 0 (slot 6 is its family pile), 7-13 to seat 1.
const ownerOf = (i) => (i <= 6 ? 0 : 1);
const GOLDEN = 2.399963229728653;

// Tidy, countable storage: stones sit in concentric rings (like coins in a tray), evenly spaced and never overlapping.
// x / y are unit-disc coordinates; the CSS maps them onto the real (round or oval) hole. The stone size is derived
// from the packing so a full hole still shows every single stone.
const LAYOUTS = new Map();
function ringLayout(n) {
  if (LAYOUTS.has(n)) return LAYOUTS.get(n);
  const pts = [];
  let K = 1;
  while (1 + 3 * K * (K + 1) < n) K += 1;
  let s;
  if (n === 1) { pts.push([0, 0]); s = 0.34; }
  else if (n <= 6) {
    for (let j = 0; j < n; j++) { const a = -Math.PI / 2 + (j * 2 * Math.PI) / n + (n === 4 ? Math.PI / 4 : 0); pts.push([Math.cos(a), Math.sin(a)]); }
    s = n === 2 ? 0.32 : n <= 4 ? 0.3 : 0.27;
  } else {
    const centre = n >= 10 ? 1 : 0;
    const m = n - centre, tot = (K * (K + 1)) / 2;
    const cnt = []; let used = 0;
    for (let k = 1; k <= K; k++) { const c = Math.floor((m * k) / tot); cnt.push(c); used += c; }
    for (let k = K - 1; used < m; k = (k - 1 + K) % K) { cnt[k] += 1; used += 1; }
    if (centre) pts.push([0, 0]);
    cnt.forEach((c, i) => {
      const k = i + 1, rho = k / K, off = k % 2 ? 0 : Math.PI / c;
      for (let j = 0; j < c; j++) { const a = -Math.PI / 2 + off + (j * 2 * Math.PI) / c; pts.push([Math.cos(a) * rho, Math.sin(a) * rho]); }
    });
    s = 0.34;
    const fits = (sz) => {
      const R = 0.45 - sz / 2;                       // usable radius as a share of the hole's width
      if (R <= 0) return false;
      if (K > 0 && (R / K) < sz * 0.97) return false; // ring-to-ring spacing
      return cnt.every((c, i) => c < 2 || 2 * R * ((i + 1) / K) * Math.sin(Math.PI / c) >= sz * 0.97);
    };
    while (s > 0.06 && !fits(s)) s -= 0.004;
  }
  const out = { pts, s };
  LAYOUTS.set(n, out);
  return out;
}

const sizeFor = (n) => (n <= 8 ? 0.2 : n <= 16 ? 0.16 : n <= 30 ? 0.13 : 0.105); // family piles

const Seeds = memo(function Seeds({ slot, n, store, owner }) {
  const out = [];
  if (store) {
    const s = sizeFor(n);
    for (let k = 0; k < n; k++) {
      const r = n === 1 ? 0 : Math.sqrt((k + 0.5) / n);
      const a = k * GOLDEN;
      out.push(<i key={k} className={`seed ${owner === 0 ? 'a' : 'b'} v${(slot + k) % 3}`} style={{ '--x': (Math.cos(a) * r).toFixed(3), '--y': (Math.sin(a) * r).toFixed(3), '--s': s }} />);
    }
    return <>{out}</>;
  }
  const { pts, s } = ringLayout(n);
  pts.forEach(([x, y], k) => {
    out.push(<i key={k} className={`seed ${owner === 0 ? 'a' : 'b'} v${(slot + k) % 3}`} style={{ '--x': x.toFixed(3), '--y': y.toFixed(3), '--s': s }} />);
  });
  return <>{out}</>;
});

function Pit({ slot, owner, n, store, legal, collectable, active, flagState, onClick, label, hint }) {
  // A hole that reached four looks exactly like any other hole: the player has to notice it. Only a frozen hole shows.
  const cls = `pit o${owner}${store ? ' store' : ''}${legal || collectable ? ' legal' : ''}${active ? ' hot' : ''}${hint ? ' hint' : ''}${flagState === 3 ? ' frozen' : ''}`;
  return (
    <button type="button" className={cls} disabled={!(legal || collectable)} onClick={onClick} aria-label={`${label}`}>
      <Seeds slot={slot} n={n} store={store} owner={owner} />
      {flagState === 3 && <span className="frostmark" aria-hidden="true">❄</span>}
    </button>
  );
}

/**
 * Renders the 12 holes and the two family piles. No numbers are printed: the stones themselves are the count.
 * `viewSeat` is the seat shown at the bottom. Display slot d maps to real slot (d + 7*viewSeat) % 14.
 * `flag` 3 = frozen (a four nobody collected). Holes waiting to be collected (1/2) are deliberately drawn like any other hole.
 */
export default function Board({ pits, own = null, flag = null, viewSeat = 0, isLegal, canCollect = () => false, onPit, active, storeLabel = 'Families', hintPit = null }) {
  const real = (d) => (d + 7 * viewSeat) % 14;
  const cell = (d) => {
    const i = real(d);
    const store = d === 6 || d === 13;
    const legal = !store && isLegal(i);
    const col = !store && canCollect(i);
    return (
      <div className={`cell d${d}`} key={d}>
        <Pit slot={i} owner={own ? own[i] : ownerOf(i)} n={pits[i]} store={store} legal={legal} collectable={col}
          flagState={store || !flag ? 0 : flag[i]} active={active === i} hint={hintPit === i} onClick={() => onPit(i)}
          label={store ? storeLabel : `Pit ${d + 1}`} />
      </div>
    );
  };
  const order = [13, 12, 11, 10, 9, 8, 7, 0, 1, 2, 3, 4, 5, 6];
  return <div className="board" role="group" aria-label="Gebeta board">{order.map((d) => cell(d))}</div>;
}
