'use client';
import React, { memo } from 'react';

// Slots 0-6 belong to seat 0 (slot 6 is its family pile), 7-13 to seat 1.
const ownerOf = (i) => (i <= 6 ? 0 : 1);
const GOLDEN = 2.399963229728653;

// Even, countable layout: seeds sit on a sunflower spiral so every stone is visible and none hides another.
// x / y are unit-disc coordinates; the CSS maps them onto the real (round or oval) hole, and the stones
// shrink as the hole fills so the person can always count them.
const sizeFor = (n, store) => {
  if (store) return n <= 8 ? 0.2 : n <= 16 ? 0.16 : n <= 30 ? 0.13 : 0.105;
  return n <= 4 ? 0.3 : n <= 6 ? 0.27 : n <= 9 ? 0.235 : n <= 13 ? 0.2 : n <= 19 ? 0.17 : n <= 28 ? 0.145 : 0.12;
};

const Seeds = memo(function Seeds({ slot, n, store, owner }) {
  const out = [];
  const s = sizeFor(n, store);
  for (let k = 0; k < n; k++) {
    const r = n === 1 ? 0 : Math.sqrt((k + 0.5) / n);
    const a = k * GOLDEN + (slot % 5) * 0.7;
    const x = Math.cos(a) * r, y = Math.sin(a) * r;
    out.push(
      <i key={k} className={`seed ${owner === 0 ? 'a' : 'b'} v${(slot + k) % 3}`}
        style={{ '--x': x.toFixed(3), '--y': y.toFixed(3), '--s': s, rotate: `${(slot * 53 + k * 97) % 360}deg` }} />,
    );
  }
  return <>{out}</>;
});

function Pit({ slot, owner, n, store, legal, collectable, active, flagState, onClick, label, hint }) {
  const cls = `pit o${owner}${store ? ' store' : ''}${legal ? ' legal' : ''}${collectable ? ' collect' : ''}${active ? ' hot' : ''}${hint ? ' hint' : ''}${flagState === 3 ? ' locked' : ''}${flagState === 1 || flagState === 2 ? ' ripe' : ''}`;
  return (
    <button type="button" className={cls} disabled={!(legal || collectable)} onClick={onClick} aria-label={`${label}`}>
      <Seeds slot={slot} n={n} store={store} owner={owner} />
      {flagState === 3 && <span className="lockmark" aria-hidden="true">🔒</span>}
    </button>
  );
}

/**
 * Renders the 12 holes and the two family piles. No numbers are printed: the stones themselves are the count.
 * `viewSeat` is the seat shown at the bottom. Display slot d maps to real slot (d + 7*viewSeat) % 14.
 * `flag` marks holes that reached four (1/2 = waiting for seat 0/1 to tap them) or are shared/locked (3).
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
