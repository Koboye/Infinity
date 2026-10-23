'use client';
import React, { memo } from 'react';

// Slots 0-6 belong to seat 0 (slot 6 is its family pile), 7-13 to seat 1.
const ownerOf = (i) => (i <= 6 ? 0 : 1);

// Deterministic scatter so seeds don't jump around on every render.
function seedPos(slot, k, store) {
  const h = Math.sin((slot + 1) * 91.7 + (k + 1) * 12.9898) * 43758.5453;
  const h2 = Math.sin((slot + 3) * 31.3 + (k + 1) * 78.233) * 12345.678;
  const a = (h - Math.floor(h)) * Math.PI * 2;
  const r = Math.sqrt(h2 - Math.floor(h2));
  if (store) return { left: 50 + Math.cos(a) * r * 18, top: 50 + Math.sin(a) * r * 34 };
  return { left: 50 + Math.cos(a) * r * 23, top: 50 + Math.sin(a) * r * 23 };
}

const Seeds = memo(function Seeds({ slot, n, store }) {
  const shown = Math.min(n, store ? 36 : 16);
  const out = [];
  for (let k = 0; k < shown; k++) {
    const { left, top } = seedPos(slot, k, store);
    const rot = Math.round(((slot * 53 + k * 97) % 360));
    out.push(<i key={k} className={`seed ${ownerOf(slot) === 0 ? 'a' : 'b'} v${(slot + k) % 3}`} style={{ left: `${left}%`, top: `${top}%`, rotate: `${rot}deg` }} />);
  }
  return <>{out}</>;
});

function Pit({ slot, n, store, legal, active, hand, onClick, label, hint }) {
  // Piles show whole families (4 seeds = 1); leftover seeds swept at game end show as a small remainder.
  const fam = store ? Math.floor(n / 4) : null;
  const rem = store ? n % 4 : 0;
  return (
    <button
      type="button"
      className={`pit${store ? ' store' : ''}${legal ? ' legal' : ''}${active ? ' hot' : ''}${hint ? ' hint' : ''}`}
      disabled={!legal}
      onClick={onClick}
      aria-label={store ? `${label}: ${fam}` : `${label}: ${n}`}
    >
      <Seeds slot={slot} n={n} store={store} />
      <span className="count">{store ? (rem ? `${fam}+${rem}` : fam) : n}</span>
      {active && !store && hand > 0 && <span className="hand" key={`${slot}-${hand}`}>{hand}</span>}
    </button>
  );
}

/**
 * Renders the 12 holes and the two family piles. `viewSeat` is the seat shown at the bottom (so each
 * online player always sees their own holes nearest them). Display slot d maps to real slot (d + 7*viewSeat) % 14.
 * `hand` is how many seeds the player is currently carrying; it is shown above the hole being sown.
 */
export default function Board({ pits, viewSeat = 0, isLegal, onPit, active, hand = 0, storeLabel = 'Families', hintPit = null }) {
  const real = (d) => (d + 7 * viewSeat) % 14;
  const cell = (d, gridStyle) => {
    const i = real(d);
    const store = d === 6 || d === 13;
    const legal = !store && isLegal(i);
    return (
      <div className="cell" style={gridStyle} key={d}>
        <Pit slot={i} n={pits[i]} store={store} legal={legal} active={active === i} hint={hintPit === i} hand={hand} onClick={() => onPit(i)} label={store ? storeLabel : `Pit ${d + 1}`} />
      </div>
    );
  };
  const cells = [];
  cells.push(cell(13, { gridColumn: 1, gridRow: '1 / span 2' }));
  [12, 11, 10, 9, 8, 7].forEach((d, k) => cells.push(cell(d, { gridColumn: k + 2, gridRow: 1 })));
  [0, 1, 2, 3, 4, 5].forEach((d, k) => cells.push(cell(d, { gridColumn: k + 2, gridRow: 2 })));
  cells.push(cell(6, { gridColumn: 8, gridRow: '1 / span 2' }));
  return <div className="board" role="group" aria-label="Gebeta board">{cells}</div>;
}
