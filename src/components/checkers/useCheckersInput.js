'use client';
import { useEffect, useMemo, useState, useCallback } from 'react';
import { movablePieces, nextSquares } from '@/lib/checkers/engine.js';
import { sfx } from '@/lib/sound';

/**
 * Tap-to-move for checkers. Tap a piece that can move, then tap a highlighted square;
 * for multi-jumps keep tapping each landing square until the chain is complete.
 */
export function useCheckersInput({ moves, enabled, onMove, resetKey }) {
  const [from, setFrom] = useState(null);
  const [picked, setPicked] = useState([]);
  useEffect(() => { setFrom(null); setPicked([]); }, [resetKey, enabled]);

  const movable = useMemo(() => (enabled ? movablePieces(moves) : []), [moves, enabled]);
  const targets = useMemo(() => (enabled && from != null ? nextSquares(moves, from, picked) : []), [moves, enabled, from, picked]);

  // One touch: tapping a piece that has a single possible move plays it; tapping a square that exactly one
  // move ends on plays that whole move (jump chains included) — no select-then-confirm needed.
  const endsAt = useCallback((sq, only) => moves.filter((m) => (only == null || m.from === only) && m.path[m.path.length - 1] === sq), [moves]);
  const onSquare = useCallback((sq) => {
    if (!enabled) return;
    if (from != null && !picked.length) {
      const direct = endsAt(sq, from);
      if (direct.length === 1) { setFrom(null); setPicked([]); onMove(direct[0]); return; }
    }
    if (from == null && !movable.includes(sq)) {
      const direct = endsAt(sq, null);
      if (direct.length === 1) { setFrom(null); setPicked([]); onMove(direct[0]); return; }
    }
    if (from == null || !targets.includes(sq)) {
      if (movable.includes(sq)) {
        const own = moves.filter((m) => m.from === sq);
        const ends = new Set(own.map((m) => m.path.join('>')));
        if (ends.size === 1) { setFrom(null); setPicked([]); onMove(own[0]); return; }
      }
    }
    if (from != null && targets.includes(sq)) {
      const np = [...picked, sq];
      const done = moves.find((m) => m.from === from && m.path.length === np.length && m.path.every((s, i) => s === np[i]));
      const more = moves.some((m) => m.from === from && m.path.length > np.length && np.every((s, i) => m.path[i] === s));
      if (done && !more) { setFrom(null); setPicked([]); onMove(done); } else { sfx.tap(); setPicked(np); }
      return;
    }
    if (movable.includes(sq)) { sfx.tap(); setFrom(sq); setPicked([]); return; }
    setFrom(null); setPicked([]);
  }, [enabled, from, targets, picked, moves, movable, onMove, endsAt]);

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

  return { from, picked, movable, targets, onSquare, onSwipe };
}
