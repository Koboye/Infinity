'use client';
import React, { memo } from 'react';

const SEED_COLORS = ['#F2B632', '#C23B2A', '#4FA36B', '#F4E9CF', '#E98A2A'];

// Deterministic scatter so seeds don't jump around on every render.
function seedPos(slot, k, store) {
  const h = Math.sin((slot + 1) * 91.7 + (k + 1) * 12.9898) * 43758.5453;
  const h2 = Math.sin((slot + 3) * 31.3 + (k + 1) * 78.233) * 12345.678;
  const a = (h - Math.floor(h)) * Math.PI * 2;
  const r = Math.sqrt(h2 - Math.floor(h2));
  if (store) return { left: 50 + Math.cos(a) * r * 30, top: 50 + Math.sin(a) * r * 40 };
  return { left: 50 + Math.cos(a) * r * 30, top: 50 + Math.sin(a) * r * 30 };
}

const Seeds = memo(function Seeds({ slot, n, store }) {
  const shown = Math.min(n, store ? 36 : 16);
  const out = [];
  for (let k = 0; k < shown; k++) {
    const { left, top } = seedPos(slot, k, store);
    out.push(<i key={k} className="seed" style={{ left: `${left}%`, top: `${top}%`, background: SEED_COLORS[(slot + k) % SEED_COLORS.length] }} />);
  }
  return <>{out}</>;
});

function Pit({ slot, n, store, legal, active, onClick, label }) {
  return (
    <button
      type="button"
      className={`pit${store ? ' store' : ''}${legal ? ' legal' : ''}${active ? ' hot' : ''}`}
      disabled={!legal}
      onClick={onClick}
      aria-label={`${label}: ${n}`}
    >
      <Seeds slot={slot} n={n} store={store} />
      <span className="count">{n}</span>
    </button>
  );
}

/**
 * Renders the 14 slots. `viewSeat` is the seat shown at the bottom (so each online player
 * always sees their own pits nearest them). Display slot d maps to real slot (d + 7*viewSeat) % 14.
 */
export default function Board({ pits, viewSeat = 0, isLegal, onPit, active, storeLabel = 'Store' }) {
  const real = (d) => (d + 7 * viewSeat) % 14;
  const cell = (d, gridStyle) => {
    const i = real(d);
    const store = d === 6 || d === 13;
    const legal = !store && isLegal(i);
    return (
      <div className="cell" style={gridStyle} key={d}>
        <Pit slot={i} n={pits[i]} store={store} legal={legal} active={active === i} onClick={() => onPit(i)} label={store ? storeLabel : `Pit ${d + 1}`} />
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
