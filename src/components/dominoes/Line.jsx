'use client';
import React, { useEffect, useRef, useState } from 'react';
import { Tile } from './Tile';

/**
 * The line of played tiles, wrapped into a snake (rows alternate direction) so it always fits the screen.
 * Doubles stand across the line. The two open ends are marked.
 */
export default function Line({ chain, lastCode, emptyText }) {
  const ref = useRef(null);
  const [w, setW] = useState(320);
  useEffect(() => {
    const el = ref.current; if (!el) return undefined;
    setW(el.clientWidth || 320);
    if (typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(() => setW(el.clientWidth || 320));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const u = Math.max(16, Math.min(30, Math.floor(w / 13)));
  const gap = Math.max(3, Math.round(u / 7));
  const itemW = (t) => (t[0] === t[1] ? u : 2 * u) + 4 + gap;

  const rows = [];
  let cur = { items: [], w: 0 };
  chain.forEach((t, i) => {
    const iw = itemW(t);
    if (cur.items.length && cur.w + iw > w - 12) { rows.push(cur); cur = { items: [], w: 0 }; }
    cur.items.push({ t, i }); cur.w += iw;
  });
  if (cur.items.length) rows.push(cur);

  return (
    <div className="dline" ref={ref} style={{ '--u': `${u}px`, '--gap': `${gap}px` }}>
      {!chain.length && <p className="dline-empty">{emptyText}</p>}
      {rows.map((row, ri) => {
        const rtl = ri % 2 === 1;
        const items = rtl ? row.items.slice().reverse() : row.items;
        return (
          <div className="dline-row" key={ri}>
            {items.map(({ t, i }) => {
              const dbl = t[0] === t[1];
              const [a, b] = rtl && !dbl ? [t[1], t[0]] : t;
              const isEnd = i === 0 || i === chain.length - 1;
              const code = `${t[0]}${t[1]}`;
              return <Tile key={code} a={a} b={b} vertical={dbl} className={`placed${isEnd ? ' end' : ''}${code === lastCode ? ' fresh' : ''}`} />;
            })}
          </div>
        );
      })}
    </div>
  );
}
