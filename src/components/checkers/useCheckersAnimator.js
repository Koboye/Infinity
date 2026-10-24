'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { seatOf, isKing } from '@/lib/checkers/engine.js';
import { mark } from '@/lib/progress';
import { sfx } from '@/lib/sound';

const HOP_MS = 300;      // one hop = one clear beat
const CAPTURE_MS = 190;  // extra pause after a piece is taken, so the capture registers
const TURN_END_MS = 140;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const reduced = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

let nextId = 1;
const makePieces = (board) => board.flatMap((p, sq) => (p ? [{ id: nextId++, sq, seat: seatOf(p), king: isKing(p) }] : []));
const code = (pc) => (pc.seat === 0 ? (pc.king ? 2 : 1) : (pc.king ? 4 : 3));
const matches = (pieces, board) => {
  const live = pieces.filter((p) => !p.dying);
  let n = 0; for (const p of board) if (p) n++;
  return live.length === n && live.every((p) => board[p.sq] === code(p));
};

/** Slides checkers pieces hop by hop so jumps and captures are easy to follow. */
export function useCheckersAnimator(initialBoard, t) {
  const [pieces, setPieces] = useState(() => makePieces(initialBoard));
  const [busy, setBusy] = useState(false);
  const [last, setLast] = useState(null);
  const [flash, setFlash] = useState(null);
  const ref = useRef(pieces);
  const queue = useRef([]);
  const running = useRef(false);
  const token = useRef(0);
  const flashTimer = useRef(null);
  const tRef = useRef(t); tRef.current = t;

  const commit = (p) => { ref.current = p; setPieces(p.map((x) => ({ ...x }))); };
  const showFlash = (text, kind) => {
    clearTimeout(flashTimer.current);
    setFlash({ text, kind, k: Math.random() });
    flashTimer.current = setTimeout(() => setFlash(null), 1300);
  };

  const drain = useCallback(async () => {
    if (running.current) return;
    running.current = true;
    const my = token.current;
    setBusy(true);
    while (queue.current.length) {
      const job = queue.current.shift();
      if (job.hops?.length) {
        let p = ref.current.map((x) => ({ ...x }));
        const mover = p.find((x) => x.sq === job.hops[0].from && !x.dying);
        if (mover) {
          const fast = reduced();
          let caps = 0;
          for (const hop of job.hops) {
            if (token.current !== my) return;
            mover.sq = hop.to;
            if (hop.cap != null) { const v = p.find((x) => x.sq === hop.cap && !x.dying); if (v) v.dying = true; caps++; sfx.jump(); } else sfx.move();
            setLast({ from: job.hops[0].from, to: hop.to });
            commit(p);
            if (!fast) await wait(HOP_MS);
            if (hop.cap != null) { if (!fast) await wait(CAPTURE_MS); p = p.filter((x) => !x.dying); commit(p); }
          }
          if (job.huffed != null) {
            const v = p.find((x) => x.sq === job.huffed && !x.dying);
            if (v) { v.dying = true; commit(p); sfx.jump(); if (!fast) await wait(HOP_MS + CAPTURE_MS); p = p.filter((x) => !x.dying); commit(p); }
          } else if (job.promote) { mover.king = true; commit(p); sfx.king(); mark('king'); showFlash(tRef.current.kinged, 'extra'); if (!fast) await wait(HOP_MS); }
          else if (caps > 1) { showFlash(tRef.current.jumped(caps), 'capture'); if (!fast) await wait(HOP_MS); }
          if (!fast) await wait(TURN_END_MS);
        }
      }
      else if (job.huffed != null) { // the opponent's pick on its own: just remove that piece
        let p = ref.current.map((x) => ({ ...x }));
        const v = p.find((x) => x.sq === job.huffed && !x.dying);
        if (v) { v.dying = true; commit(p); sfx.jump(); if (!reduced()) await wait(HOP_MS + CAPTURE_MS); p = p.filter((x) => !x.dying); commit(p); }
      }
      if (token.current !== my) return;
      if (!matches(ref.current, job.final)) commit(makePieces(job.final)); // always end exactly on the authoritative board
    }
    if (token.current === my) { running.current = false; setBusy(false); }
  }, []);

  const enqueue = useCallback((job) => { queue.current.push(job); drain(); }, [drain]);
  const reset = useCallback((board) => {
    token.current += 1; queue.current = []; running.current = false;
    setBusy(false); setLast(null); setFlash(null); commit(makePieces(board));
  }, []);
  useEffect(() => () => { token.current += 1; clearTimeout(flashTimer.current); }, []);

  return { pieces, busy, last, flash, enqueue, reset };
}
