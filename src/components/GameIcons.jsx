import React from 'react';

// Small hand-drawn SVG icons for the game picker (no image files needed).
export function GameIcon({ game, size = 44 }) {
  if (game === 'checkers') {
    return (
      <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true">
        <rect x="3" y="3" width="42" height="42" rx="8" fill="#E7C79A" />
        {[0, 1, 2, 3].flatMap((r) => [0, 1, 2, 3].map((c) => ((r + c) % 2 ? <rect key={`${r}${c}`} x={3 + c * 10.5} y={3 + r * 10.5} width="10.5" height="10.5" fill="#7A2E24" /> : null)))}
        <circle cx="16" cy="31" r="8" fill="#3B2314" /><circle cx="16" cy="29.5" r="5" fill="none" stroke="#6b4426" strokeWidth="1.5" />
        <circle cx="31" cy="19" r="8" fill="#F3DEB8" /><circle cx="31" cy="17.5" r="5" fill="none" stroke="#d9bd8b" strokeWidth="1.5" />
        <path d="M27 20l1.4-4 2.6 2.2 2.6-2.2 1.4 4z" fill="#C98B1A" />
      </svg>
    );
  }
  if (game === 'dominoes') {
    const pip = (x, y) => <circle key={`${x}-${y}`} cx={x} cy={y} r="2.1" fill="#1b1209" />;
    return (
      <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true">
        <g transform="rotate(-14 24 24)">
          <rect x="12" y="4" width="24" height="40" rx="5" fill="#F4EBD3" stroke="#B9A57A" strokeWidth="1.5" />
          <line x1="15" y1="24" x2="33" y2="24" stroke="#3a2a12" strokeWidth="1.6" />
          <circle cx="24" cy="24" r="2" fill="#C98B1A" />
          {[[18, 10], [30, 10], [24, 14.5], [18, 19], [30, 19]].map(([x, y]) => pip(x, y))}
          {[[18, 30], [30, 30], [18, 38], [30, 38]].map(([x, y]) => pip(x, y))}
        </g>
      </svg>
    );
  }
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true">
      <rect x="2" y="9" width="44" height="30" rx="9" fill="#C98B4A" stroke="#7A4A22" strokeWidth="2" />
      {[0, 1, 2].flatMap((i) => [0, 1].map((j) => <circle key={`${i}${j}`} cx={12 + i * 12} cy={18 + j * 13} r="4.6" fill="#3A210F" />))}
      {[[12, 18, '#F2B632'], [24, 31, '#C23B2A'], [36, 18, '#4FA36B'], [24, 17, '#F4E9CF'], [13, 30, '#F2B632']].map(([x, y, c], i) => <circle key={i} cx={x + (i % 2 ? 1 : -1)} cy={y} r="1.9" fill={c} />)}
    </svg>
  );
}
