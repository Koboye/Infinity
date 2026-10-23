'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { applyStep, isStore } from '@/lib/gebeta/engine.js';
import { sfx } from '@/lib/sound';

// Ludo-King pacing: every seed is its own visible hop, with a breath between moves.
// Nothing is squeezed to fit a time budget — a long relay chain simply takes as long as it takes.
export const DELAY = {
  pick: 750,    // lift the seeds, let the player see how many are in hand
  sow: 500,     // one seed, one hole, one beat
  relay: 850,  // pause on the filled hole before lifting it
  family: 1300, // celebrate a captured family
  sweep: 380,
  deal: 2000,   // 'New round' — let everyone see the board being re-dealt
  turnEnd: 550, // breathing room before the next turn starts
};
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const reduced = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/** Replays engine steps one at a time so seeds visibly travel around the board. */
export function useAnimator(initialPits, t, pace = 1) {
  const [pits, setPits] = useState(initialPits);
  const [active, setActive] = useState(null);
  const [hand, setHand] = useState(0);
  const [flash, setFlash] = useState(null);
  const [busy, setBusy] = useState(false);
  const pitsRef = useRef(initialPits);
  const queue = useRef([]);
  const running = useRef(false);
  const token = useRef(0);
  const tRef = useRef(t);
  tRef.current = t;
  const paceRef = useRef(pace);
  paceRef.current = pace;
  const flashTimer = useRef(null);

  const commit = (p) => { pitsRef.current = p; setPits(p); };
  const showFlash = (text, kind, ms = 1500) => {
    if (!text) return;
    clearTimeout(flashTimer.current);
    setFlash({ text, kind, k: Math.random() });
    flashTimer.current = setTimeout(() => setFlash(null), ms);
  };
  const ms = (k) => (DELAY[k] || 400) * paceRef.current;

  const drain = useCallback(async () => {
    if (running.current) return;
    running.current = true;
    const my = token.current;
    setBusy(true);
    while (queue.current.length) {
      const job = queue.current.shift();
      if (job.steps && !reduced()) {
        const p = pitsRef.current.slice();
        let inHand = 0;
        for (const s of job.steps) {
          if (token.current !== my) return;
          applyStep(p, s);
          commit(p.slice());
          if (s.t === 'pick') {
            inHand = s.n; setHand(inHand); setActive(s.i); sfx.pick();
          } else if (s.t === 'sow') {
            inHand = Math.max(0, inHand - 1); setHand(inHand); setActive(s.i); sfx.sow();
          } else if (s.t === 'relay') {
            inHand = s.n; setHand(inHand); setActive(s.i); sfx.pick(); showFlash(tRef.current.relay, 'relay', 1200);
          } else if (s.t === 'family') {
            setHand(inHand); setActive(s.store); sfx.capture();
            showFlash(tRef.current.family ? tRef.current.family(s.last) : tRef.current.captured?.(s.n), 'capture');
          } else if (s.t === 'deal') {
            setHand(0); setActive(null); sfx.store(); showFlash(tRef.current.newRound, 'extra', 1800);
          } else if (s.t === 'sweep') {
            setHand(0); setActive(s.store); isStore(s.store) && sfx.store();
          }
          await wait(ms(s.t));
        }
        setHand(0);
        await wait(ms('turnEnd'));
      }
      if (token.current !== my) return;
      commit(job.final.slice());
      setActive(null);
      setHand(0);
      if (job.extra) { showFlash(tRef.current.extra, 'extra'); await wait(500); }
    }
    if (token.current === my) { running.current = false; setBusy(false); }
  }, []);

  const enqueue = useCallback((job) => { queue.current.push(job); drain(); }, [drain]);
  const reset = useCallback((p) => {
    token.current += 1; queue.current = []; running.current = false;
    setBusy(false); setActive(null); setHand(0); setFlash(null); commit(p.slice());
  }, []);
  useEffect(() => () => { token.current += 1; clearTimeout(flashTimer.current); }, []);

  return { pits, active, hand, flash, busy, enqueue, reset };
}
