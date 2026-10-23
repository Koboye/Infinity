'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { applyStep, isStore } from '@/lib/gebeta/engine.js';
import { sfx } from '@/lib/sound';

const DELAY = { pick: 260, relay: 300, sow: 170, cap: 520, sweep: 110 };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const reduced = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/** Replays engine steps one at a time so seeds visibly travel around the board. */
export function useAnimator(initialPits, t) {
  const [pits, setPits] = useState(initialPits);
  const [active, setActive] = useState(null);
  const [flash, setFlash] = useState(null);
  const [busy, setBusy] = useState(false);
  const pitsRef = useRef(initialPits);
  const queue = useRef([]);
  const running = useRef(false);
  const token = useRef(0);
  const tRef = useRef(t);
  tRef.current = t;
  const flashTimer = useRef(null);

  const commit = (p) => { pitsRef.current = p; setPits(p); };
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
      if (job.steps && !reduced()) {
        let p = pitsRef.current.slice();
        // Long relay chains would take ages at full speed — squeeze them into ~3.2s total.
        const total = job.steps.reduce((a, s) => a + (DELAY[s.t] || 150), 0);
        const scale = Math.max(0.12, Math.min(1, 3200 / total));
        for (const s of job.steps) {
          if (token.current !== my) return;
          applyStep(p, s);
          commit(p.slice());
          if (s.t === 'sow') { setActive(s.i); isStore(s.i) ? sfx.store() : sfx.sow(); }
          else if (s.t === 'pick') { setActive(s.i); sfx.pick(); }
          else if (s.t === 'relay') { setActive(s.i); sfx.pick(); showFlash(tRef.current.relay, 'relay'); }
          else if (s.t === 'cap') { setActive(s.store); sfx.capture(); showFlash(tRef.current.captured(s.n), 'capture'); }
          await wait((DELAY[s.t] || 150) * scale);
        }
      }
      if (token.current !== my) return;
      commit(job.final.slice());
      setActive(null);
      if (job.extra) { showFlash(tRef.current.extra, 'extra'); await wait(500); }
    }
    if (token.current === my) { running.current = false; setBusy(false); }
  }, []);

  const enqueue = useCallback((job) => { queue.current.push(job); drain(); }, [drain]);
  const reset = useCallback((p) => {
    token.current += 1; queue.current = []; running.current = false;
    setBusy(false); setActive(null); setFlash(null); commit(p.slice());
  }, []);
  useEffect(() => () => { token.current += 1; clearTimeout(flashTimer.current); }, []);

  return { pits, active, flash, busy, enqueue, reset };
}
