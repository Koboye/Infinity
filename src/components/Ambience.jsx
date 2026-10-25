'use client';
import React, { useMemo } from 'react';

/** A quiet scene for a loss: soft rain, a few drifting petals and a candle that keeps burning. */
export function LoseScene() {
  const drops = useMemo(() => Array.from({ length: 34 }, () => ({ left: Math.round(Math.random() * 100), delay: +(Math.random() * 2).toFixed(2), dur: +(0.9 + Math.random() * 0.9).toFixed(2), h: Math.round(14 + Math.random() * 20), o: +(0.25 + Math.random() * 0.4).toFixed(2) })), []);
  const petals = useMemo(() => Array.from({ length: 9 }, () => ({ left: Math.round(Math.random() * 100), delay: +(Math.random() * 5).toFixed(2), dur: +(7 + Math.random() * 5).toFixed(2), s: Math.round(8 + Math.random() * 8), r: Math.round(Math.random() * 360) })), []);
  return (
    <div className="lose-scene" aria-hidden="true">
      <div className="lose-vignette" />
      {drops.map((d, i) => <i key={i} className="rain" style={{ left: `${d.left}%`, height: d.h, opacity: d.o, animationDelay: `${d.delay}s`, animationDuration: `${d.dur}s` }} />)}
      {petals.map((p, i) => <i key={`p${i}`} className="petal" style={{ left: `${p.left}%`, width: p.s, height: p.s * 1.3, animationDelay: `${p.delay}s`, animationDuration: `${p.dur}s`, '--r': `${p.r}deg` }} />)}
    </div>
  );
}

/** Candle for the loser — a steady little flame: "the game ends, the light stays". */
export function Candle() {
  return (
    <svg className="candle" viewBox="0 0 64 96" width="64" height="96" aria-hidden="true">
      <defs>
        <linearGradient id="wax" x1="0" x2="1"><stop offset="0" stopColor="#d9c9a3" /><stop offset=".5" stopColor="#fff4d6" /><stop offset="1" stopColor="#c8b68c" /></linearGradient>
        <radialGradient id="flame" cx=".5" cy=".7" r=".6"><stop offset="0" stopColor="#fff7c2" /><stop offset=".5" stopColor="#ffb938" /><stop offset="1" stopColor="#ff6a1a" stopOpacity="0" /></radialGradient>
      </defs>
      <ellipse cx="32" cy="30" rx="26" ry="26" fill="url(#flame)" opacity=".35" className="candle-halo" />
      <rect x="20" y="46" width="24" height="44" rx="4" fill="url(#wax)" stroke="#8a7648" strokeWidth="1" />
      <path d="M20 54c5 3 6 8 12 6s7-6 12-4v-6H20z" fill="#fff9e6" opacity=".9" />
      <rect x="31" y="38" width="2" height="9" rx="1" fill="#3a2a14" />
      <path className="candle-flame" d="M32 12c7 9 9 15 4 22-2 3-6 3-8 0-5-7-1-13 4-22z" fill="url(#flame)" />
    </svg>
  );
}

/** Trophy with a laurel for the winner. */
export function Trophy() {
  return (
    <svg className="trophy" viewBox="0 0 120 130" width="120" height="130" aria-hidden="true">
      <defs>
        <linearGradient id="tg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#FFF4C2" /><stop offset=".45" stopColor="#F2B632" /><stop offset="1" stopColor="#A9741A" /></linearGradient>
        <linearGradient id="tb" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#6d4a0c" /><stop offset="1" stopColor="#3a2508" /></linearGradient>
      </defs>
      <path d="M26 20H8c0 24 10 36 28 40M94 20h18c0 24-10 36-28 40" fill="none" stroke="url(#tg)" strokeWidth="7" strokeLinecap="round" />
      <path d="M26 12h68v26c0 24-14 42-34 42S26 62 26 38z" fill="url(#tg)" stroke="#7a520f" strokeWidth="2" strokeLinejoin="round" />
      <path d="M40 20c-3 20 0 34 12 46" stroke="#fff8d8" strokeWidth="4" strokeLinecap="round" fill="none" opacity=".7" />
      <path d="M54 78h12v16H54z" fill="url(#tg)" stroke="#7a520f" strokeWidth="2" />
      <rect x="34" y="94" width="52" height="12" rx="3" fill="url(#tg)" stroke="#7a520f" strokeWidth="2" />
      <rect x="28" y="106" width="64" height="14" rx="4" fill="url(#tb)" stroke="#2b1a05" strokeWidth="2" />
      <path d="M60 28l5 11 12 1-9 8 3 12-11-6-11 6 3-12-9-8 12-1z" fill="#fff7d0" stroke="#A9741A" strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  );
}
