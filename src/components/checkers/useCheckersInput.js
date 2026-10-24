'use client';
import { useEffect, useMemo, useState, useCallback } from 'react';
import { movablePieces, nextSquares } from '@/lib/checkers/engine.js';
import { sfx } from '@/lib/sound';

/**
 * Tap-to-move for checkers. Tap a piece that can move, then tap a highlighted square;
 * for multi-jumps keep tapping each landing square until the chain is complete.
 */
export function useCheckersInput({ moves, enabled, onMove, resetKey, strict = false }) {
  const [from, setFrom] = useState(null);
  const [picked, setPicked] = useState([]);
  useEffect(() => { setFrom(null); setPicked([]); }, [resetKey, enabled]);

  const movable = useMemo(() => (enabled ? movablePieces(moves) : []), [moves, enabled]);
  const targets = useMemo(() => (enabled && from != null ? nextSquares(moves, from, picked) : []), [moves, enabled, from, picked]);

  // Moves that cannot be extended. A move that COULD be extended (`more`) is only played when the player confirms
  // it by tapping its last square again — stopping a chain early costs the piece, so it is never done by accident.
  const complete = useMemo(() => moves.filter((m) => !m.more), [moves]);
  const endsAt = useCallback((sq, only) => complete.filter((m) => (only == null || m.from === only) && m.path[m.path.length - 1] === sq), [complete]);
  const matchPath = (m, f, np) => m.from === f && m.path.length === np.length && m.path.every((s, i) => s === np[i]);
  const reset = () => { setFrom(null); setPicked([]); };
  const onSquare = useCallback((sq) => {
    if (!enabled) return;
    // Tapping the last landing square of a half-finished chain again = stop here.
    if (from != null && picked.length && sq === picked[picked.length - 1]) {
      const stop = moves.find((m) => matchPath(m, from, picked));
      if (stop) { reset(); onMove(stop); return; }
    }
    if (!strict) {
      if (from != null && !picked.length) {
        const direct = endsAt(sq, from);
        if (direct.length === 1) { reset(); onMove(direct[0]); return; }
      }
      if (from == null && !movable.includes(sq)) {
        const direct = endsAt(sq, null);
        if (direct.length === 1) { reset(); onMove(direct[0]); return; }
      }
      if (from == null || !targets.includes(sq)) {
        if (movable.includes(sq)) {
          const own = moves.filter((m) => m.from === sq);
          const ends = new Set(own.map((m) => m.path.join('>')));
          if (ends.size === 1) { reset(); onMove(own[0]); return; }
        }
      }
    }
    if (strict && from != null && !picked.length && !targets.includes(sq)) {
      const direct = endsAt(sq, from).filter((m) => m.caps.length);
      if (direct.length === 1) { reset(); onMove(direct[0]); return; } // tap the end of a whole jump chain
    }
    if (from != null && targets.includes(sq)) {
      const np = [...picked, sq];
      const done = moves.find((m) => matchPath(m, from, np));
      const more = moves.some((m) => m.from === from && m.path.length > np.length && np.every((s, i) => m.path[i] === s));
      if (done && !more) { reset(); onMove(done); return; }
      if (strict && !more && !done) { sfx.tap(); setPicked(np); return; }
      // a long jump straight to the end of a chain (flying kings, tap the final square)
      const full = endsAt(sq, from).filter((m) => m.path.length >= np.length && m.path.slice(0, picked.length).every((x, i) => x === picked[i]));
      if (full.length === 1 && strict) { reset(); onMove(full[0]); return; }
      sfx.tap(); setPicked(np);
      return;
    }
    if (movable.includes(sq)) { sfx.tap(); setFrom(sq); setPicked([]); return; }
    reset();
  }, [enabled, from, targets, picked, moves, movable, onMove, endsAt, strict]); // eslint-disable-line react-hooks/exhaustive-deps

  /**
   * Swipe/drag a piece: (sq) start square, (dx, dy) drag in board cells, (cx, cy) the cell it was released over.
   * Picks the legal next square that lies in the swiped direction and is closest to where the finger ended,
   * so the swipe does not need to land exactly. Multi-jump chains are swiped one jump at a time.
   */
  const onSwipe = useCallback((sq, dx, dy, cx, cy) => {
    if (!enabled) return;
    let base = from, pk = picked;
    if (from == null || sq !== from) {
      if (!movable.includes(sq)) return;
      base = sq; pk = [];
    }
    const opts = nextSquares(moves, base, pk);
    if (!opts.length) return;
    const o = pk.length ? pk[pk.length - 1] : base;
    let best = null, bestCost = Infinity;
    for (const s of opts) {
      const ox = (s & 7) - (o & 7), oy = (s >> 3) - (o >> 3);
      if (ox * dx + oy * dy <= 0) continue;
      const cost = ((s & 7) - cx) ** 2 + ((s >> 3) - cy) ** 2;
      if (cost < bestCost) { best = s; bestCost = cost; }
    }
    if (best == null) { setFrom(base); setPicked(pk); return; }
    const np = [...pk, best];
    const done = moves.find((m) => m.from === base && m.path.length === np.length && m.path.every((x, i) => x === np[i]));
    const more = moves.some((m) => m.from === base && m.path.length > np.length && np.every((x, i) => m.path[i] === x));
    if (done && !more) { setFrom(null); setPicked([]); onMove(done); } else { sfx.tap(); setFrom(base); setPicked(np); }
  }, [enabled, from, picked, moves, movable, onMove]);

  // A half-finished chain can be stopped with a button as well as by tapping the last square again.
  const stopMove = useMemo(() => (enabled && from != null && picked.length ? moves.find((m) => matchPath(m, from, picked)) || null : null), [enabled, from, picked, moves]);
  const stopChain = useCallback(() => { if (stopMove) { reset(); onMove(stopMove); } }, [stopMove, onMove]); // eslint-disable-line react-hooks/exhaustive-deps

  return { from, picked, movable, targets, onSquare, onSwipe, canStop: !!stopMove, stopChain };
}
