'use client';
import React, { useCallback, useEffect, useRef } from 'react';

/**
 * SwipePicker — a release-grade, touch-first chooser.
 * Cards snap to the centre (CSS scroll-snap), the card in the centre IS the selection, neighbours peek in so the
 * control visibly invites a swipe. Also works with mouse (arrows), keyboard (←/→/Home/End) and plain taps.
 *   items: [{ id, title, sub, glyph, pips, tone }]   tone = CSS colour that tints the card
 */
export default function SwipePicker({ items, value, onChange, label, prevLabel = 'Previous', nextLabel = 'Next' }) {
  const track = useRef(null);
  const settle = useRef(null);
  const index = Math.max(0, items.findIndex((i) => i.id === value));

  const centerOn = useCallback((i, smooth) => {
    const el = track.current?.children[i];
    if (!el || !track.current) return;
    const left = el.offsetLeft - (track.current.clientWidth - el.clientWidth) / 2;
    track.current.scrollTo({ left, behavior: smooth ? 'smooth' : 'auto' });
  }, []);

  // first paint: jump to the current choice; later changes (tap / arrows / keys): glide to it
  const first = useRef(true);
  useEffect(() => { centerOn(index, !first.current); first.current = false; }, [index, centerOn]);

  // after the finger lifts and the carousel stops, whichever card sits in the middle becomes the choice
  const onScroll = () => {
    clearTimeout(settle.current);
    settle.current = setTimeout(() => {
      const t = track.current; if (!t) return;
      const mid = t.scrollLeft + t.clientWidth / 2;
      let best = 0, d = Infinity;
      for (let k = 0; k < t.children.length; k++) {
        const c = t.children[k], dist = Math.abs(c.offsetLeft + c.clientWidth / 2 - mid);
        if (dist < d) { d = dist; best = k; }
      }
      if (items[best] && items[best].id !== value) onChange(items[best].id);
    }, 90);
  };
  useEffect(() => () => clearTimeout(settle.current), []);

  const go = (i) => { const k = Math.min(items.length - 1, Math.max(0, i)); if (items[k]) onChange(items[k].id); centerOn(k, true); };
  const onKey = (e) => {
    if (e.key === 'ArrowRight') { e.preventDefault(); go(index + 1); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); go(index - 1); }
    else if (e.key === 'Home') { e.preventDefault(); go(0); }
    else if (e.key === 'End') { e.preventDefault(); go(items.length - 1); }
  };

  return (
    <section className="swipe" aria-label={label}>
      <div className="swipe-head">
        <span className="swipe-label">{label}</span>
        <span className="swipe-count" aria-hidden="true">{index + 1} / {items.length}</span>
      </div>
      <div className="swipe-stage">
        <button type="button" className="swipe-arrow l" onClick={() => go(index - 1)} disabled={index === 0} aria-label={prevLabel}>‹</button>
        <div className="swipe-track" ref={track} onScroll={onScroll} onKeyDown={onKey} role="radiogroup" aria-label={label}>
          {items.map((it, k) => (
            <button
              key={it.id} type="button" role="radio" aria-checked={it.id === value}
              tabIndex={it.id === value ? 0 : -1}
              className={`swipe-card${it.id === value ? ' on' : ''}`}
              style={{ '--tone': it.tone }}
              onClick={() => go(k)}
            >
              {it.glyph && <span className="sc-glyph" aria-hidden="true">{it.glyph}</span>}
              <b className="sc-title">{it.title}</b>
              {it.pips > 0 && <span className="sc-pips" aria-hidden="true">{[1, 2, 3].map((n) => <i key={n} className={n <= it.pips ? 'f' : ''} />)}</span>}
              {it.sub && <span className="sc-sub">{it.sub}</span>}
            </button>
          ))}
        </div>
        <button type="button" className="swipe-arrow r" onClick={() => go(index + 1)} disabled={index === items.length - 1} aria-label={nextLabel}>›</button>
      </div>
      <div className="swipe-dots" aria-hidden="true">{items.map((it, k) => <i key={it.id} className={k === index ? 'on' : ''} style={{ '--tone': it.tone }} />)}</div>
    </section>
  );
}
