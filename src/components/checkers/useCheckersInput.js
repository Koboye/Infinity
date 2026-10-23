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

  const onSquare = useCallback((sq) => {
    if (!enabled) return;
    if (from != null && targets.includes(sq)) {
      const np = [...picked, sq];
      const done = moves.find((m) => m.from === from && m.path.length === np.length && m.path.every((s, i) => s === np[i]));
      const more = moves.some((m) => m.from === from && m.path.length > np.length && np.every((s, i) => m.path[i] === s));
      if (done && !more) { setFrom(null); setPicked([]); onMove(done); } else { sfx.tap(); setPicked(np); }
      return;
    }
    if (movable.includes(sq)) { sfx.tap(); setFrom(sq); setPicked([]); return; }
    setFrom(null); setPicked([]);
  }, [enabled, from, targets, picked, moves, movable, onMove]);

  return { from, picked, movable, targets, onSquare };
}
