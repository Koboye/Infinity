'use client';
import React from 'react';

const PIPS = { 0: [], 1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8] };

function Half({ n }) {
  const on = PIPS[n] || [];
  return <span className="dhalf" aria-hidden="true">{Array.from({ length: 9 }, (_, i) => <i key={i} className={on.includes(i) ? 'pip' : ''} />)}</span>;
}

/** A domino. `vertical` stacks the halves (top = a). Size comes from the CSS variable --u on a parent or the style prop. */
export function Tile({ a, b, vertical = false, back = false, className = '', style, onClick, disabled, label, ...rest }) {
  const cls = `dtile ${vertical ? 'v' : 'h'}${back ? ' back' : ''} ${className}`;
  const inner = back ? null : <><Half n={a} /><span className="dpin" /><Half n={b} /></>;
  if (onClick) {
    return <button type="button" className={cls} style={style} onClick={onClick} disabled={disabled} aria-label={label || `${a}-${b}`} {...rest}>{inner}</button>;
  }
  return <div className={cls} style={style} role={back ? undefined : 'img'} aria-label={back ? undefined : `${a}-${b}`} {...rest}>{inner}</div>;
}
