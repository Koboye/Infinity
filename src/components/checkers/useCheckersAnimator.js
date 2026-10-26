'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { seatOf, isKing, rowOf, colOf } from '@/lib/checkers/engine.js';
import { mark } from '@/lib/progress';
import { sfx } from '@/lib/sound';

const HOP_MS = 300;      // one hop = one clear beat
const CAPTURE_MS = 430;  // the kicked piece needs this long to fly off the board (see kick.css)
const TURN_END_MS = 140;
const CROWN_MS = 1300;    // the coronation: the piece rises, spins in 3D and the crown lands (see kings3d.css)
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
  const [fx, setFx] = useState([]);       // impact bursts: [{ id, sq, big, kd }]
  const [shake, setShake] = useState(null); // { k, big } — the board jolts on a hit
  const ref = useRef(pieces);
  const queue = useRef([]);
  const running = useRef(false);
  const token = useRef(0);
  const flashTimer = useRef(null);
  const tRef = useRef(t); tRef.current = t;
  const shakeTimer = useRef(null);
  const fxId = useRef(1);
  const strikes = useRef(0);

  const commit = (p) => { ref.current = p; setPieces(p.map((x) => ({ ...x }))); };
  /** Ludo-King style kill: the attacker lunges, the victim is KICKED away in the direction of travel, with an impact burst. */
  const kick = (p, mover, victim, hop, startFrom) => {
    const dx = Math.sign(colOf(hop.to) - colOf(hop.from)), dy = Math.sign(rowOf(hop.to) - rowOf(hop.from));
    const total = Math.max(Math.abs(colOf(hop.to) - colOf(hop.from)), Math.abs(rowOf(hop.to) - rowOf(hop.from))) || 1;
    const toVictim = Math.max(Math.abs(colOf(victim.sq) - colOf(hop.from)), Math.abs(rowOf(victim.sq) - rowOf(hop.from))) || 1;
    const kd = Math.max(60, Math.min(HOP_MS - 40, Math.round((toVictim / total) * (HOP_MS - 60))));
    const big = !!mover.king || (hop.chain || 0) >= 2;
    victim.dying = true; victim.kx = dx; victim.ky = dy; victim.kd = kd; victim.kbig = big;
    mover.strike = (strikes.current += 1) % 2 === 0 ? 'a' : 'b'; mover.kd = kd;
    const id = fxId.current++;
    setFx((l) => [...l, { id, sq: victim.sq, big, kd }]);
    setTimeout(() => setFx((l) => l.filter((x) => x.id !== id)), kd + 900);
    clearTimeout(shakeTimer.current);
    setShake({ k: Math.random(), big, kd });
    shakeTimer.current = setTimeout(() => setShake(null), kd + 500);
    setTimeout(() => sfx.kick(big), kd);
  };
  /** A claimed (huffed) piece is knocked off the same way, away from the middle of the board. */
  const kickAway = (v) => {
    const dy = rowOf(v.sq) < 4 ? -1 : 1, dx = colOf(v.sq) < 4 ? -1 : 1;
    v.dying = true; v.kx = dx; v.ky = dy; v.kd = 0; v.kbig = false;
    const id = fxId.current++;
    setFx((l) => [...l, { id, sq: v.sq, big: false, kd: 0 }]);
    setTimeout(() => setFx((l) => l.filter((x) => x.id !== id)), 900);
    clearTimeout(shakeTimer.current); setShake({ k: Math.random(), big: false, kd: 0 }); shakeTimer.current = setTimeout(() => setShake(null), 500);
    sfx.kick(false);
  };
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
            mover.strike = null;
            if (hop.cap != null) { const v = p.find((x) => x.sq === hop.cap && !x.dying); caps++; if (v) { if (fast) { v.dying = true; sfx.jump(); } else kick(p, mover, v, { ...hop, chain: caps }, job.hops[0].from); } else sfx.jump(); } else sfx.move();
            setLast({ from: job.hops[0].from, to: hop.to });
            commit(p);
            if (!fast) await wait(HOP_MS);
            if (hop.cap != null) { if (!fast) await wait(CAPTURE_MS); p = p.filter((x) => !x.dying); commit(p); }
          }
          if (job.huffed != null) {
            const v = p.find((x) => x.sq === job.huffed && !x.dying);
            if (v) { if (fast) { v.dying = true; sfx.jump(); } else kickAway(v); commit(p); if (!fast) await wait(HOP_MS + CAPTURE_MS); p = p.filter((x) => !x.dying); commit(p); }
          } else if (job.promote) { mover.king = true; mover.crown = !fast; commit(p); sfx.king(); mark('king'); showFlash(tRef.current.kinged, 'extra'); if (!fast) { await wait(CROWN_MS); if (token.current !== my) return; mover.crown = false; commit(p); } }
          else if (caps > 1) { showFlash(tRef.current.jumped(caps), 'capture'); if (!fast) await wait(HOP_MS); }
          if (!fast) await wait(TURN_END_MS);
        }
      }
      else if (job.huffed != null) { // the opponent's pick on its own: just remove that piece
        let p = ref.current.map((x) => ({ ...x }));
        const v = p.find((x) => x.sq === job.huffed && !x.dying);
        if (v) { if (reduced()) { v.dying = true; sfx.jump(); } else kickAway(v); commit(p); if (!reduced()) await wait(HOP_MS + CAPTURE_MS); p = p.filter((x) => !x.dying); commit(p); }
      }
      if (token.current !== my) return;
      if (!matches(ref.current, job.final)) commit(makePieces(job.final)); // always end exactly on the authoritative board
    }
    if (token.current === my) { running.current = false; setBusy(false); }
  }, []);

  const enqueue = useCallback((job) => { queue.current.push(job); drain(); }, [drain]);
  const reset = useCallback((board) => {
    token.current += 1; queue.current = []; running.current = false;
    setBusy(false); setLast(null); setFlash(null); setFx([]); setShake(null); commit(makePieces(board));
  }, []);
  useEffect(() => () => { token.current += 1; clearTimeout(flashTimer.current); clearTimeout(shakeTimer.current); }, []);

  return { pieces, busy, last, flash, fx, shake, enqueue, reset };
}
