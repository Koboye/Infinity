'use client';
import React, { useCallback, useEffect, useRef, useState } from 'react';

/**
 * SwipeRail — one horizontal, snap-scrolling rail used for every choice in the app (games, levels, game types, actions, dock).
 *  - touch: native momentum scrolling + CSS scroll-snap; mouse: click-and-drag; keyboard: ← → (and Home / End)
 *  - `value` (index) is controlled: a tap selects, and so does swiping an item to the centre (`selectOnSwipe`)
 *  - `onSelect(i)` fires on a tap; `onSettle(i)` fires when a swipe comes to rest on item i
 *  - dots show where you are; `aria-live` text is the caller's job (items carry their own labels)
 */
export default function SwipeRail({ items, value = 0, onSelect, onSettle, selectOnSwipe = false, renderItem, label, className = '', dots = true, itemClass = '' }) {
  const ref = useRef(null);
  const [cur, setCur] = useState(value);
  const drag = useRef({ on: false, x: 0, left: 0, moved: 0 });
  const settleT = useRef(null);
  const programmatic = useRef(false);

  const centred = useCallback(() => {
    const el = ref.current; if (!el) return 0;
    const mid = el.scrollLeft + el.clientWidth / 2; let best = 0, bd = Infinity;
    Array.from(el.children).forEach((c, i) => { const d = Math.abs(c.offsetLeft + c.offsetWidth / 2 - mid); if (d < bd) { bd = d; best = i; } });
    return best;
  }, []);

  const scrollTo = useCallback((i, smooth = true) => {
    const el = ref.current, c = el?.children[i]; if (!c) return;
    programmatic.current = true;
    el.scrollTo({ left: c.offsetLeft - (el.clientWidth - c.offsetWidth) / 2, behavior: smooth && !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 'smooth' : 'auto' });
    setTimeout(() => { programmatic.current = false; }, 450);
  }, []);

  // follow the controlled value (first paint without animation)
  const first = useRef(true);
  useEffect(() => { setCur(value); scrollTo(value, !first.current); first.current = false; }, [value, items.length, scrollTo]);

  const onScroll = () => {
    const i = centred(); if (i !== cur) setCur(i);
    clearTimeout(settleT.current);
    settleT.current = setTimeout(() => {
      if (drag.current.on || programmatic.current) return;
      const k = centred(); onSettle?.(k); if (selectOnSwipe && k !== value) onSelect?.(k);
    }, 110);
  };

  // mouse drag (touch uses native scrolling)
  const down = (e) => {
    if (e.pointerType !== 'mouse' || e.button !== 0) return;
    const el = ref.current; drag.current = { on: true, x: e.clientX, left: el.scrollLeft, moved: 0 }; el.classList.add('dragging');
  };
  const move = (e) => { const d = drag.current; if (!d.on) return; const dx = e.clientX - d.x; d.moved = Math.max(d.moved, Math.abs(dx)); ref.current.scrollLeft = d.left - dx; };
  const up = () => {
    const d = drag.current; if (!d.on) return; d.on = false; const el = ref.current; el.classList.remove('dragging');
    const k = centred(); scrollTo(k); onSettle?.(k); if (selectOnSwipe && k !== value) onSelect?.(k);
  };
  const clickGuard = (e) => { if (drag.current.moved > 6) { e.preventDefault(); e.stopPropagation(); drag.current.moved = 0; } };

  const key = (e) => {
    const n = items.length; let k = cur;
    if (e.key === 'ArrowRight') k = Math.min(n - 1, cur + 1); else if (e.key === 'ArrowLeft') k = Math.max(0, cur - 1);
    else if (e.key === 'Home') k = 0; else if (e.key === 'End') k = n - 1; else return;
    e.preventDefault(); scrollTo(k); setCur(k); if (selectOnSwipe) onSelect?.(k);
  };

  return (
    <div className={`rail-wrap ${className}`}>
      <div ref={ref} className="rail" role="listbox" aria-label={label} aria-orientation="horizontal" tabIndex={0}
        onScroll={onScroll} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} onPointerLeave={up} onClickCapture={clickGuard} onKeyDown={key}>
        {items.map((it, i) => (
          <div key={it.id ?? i} className={`rail-item${i === value ? ' sel' : ''}${i === cur ? ' mid' : ''} ${itemClass}`} role="option" aria-selected={i === value}>
            {renderItem(it, i, i === value)}
          </div>
        ))}
      </div>
      {dots && items.length > 1 && (
        <div className="rail-dots" aria-hidden="true">
          {items.map((it, i) => <i key={it.id ?? i} className={i === cur ? 'on' : ''} />)}
        </div>
      )}
    </div>
  );
}
