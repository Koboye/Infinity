'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { applyStep, applyFlag, isStore } from '@/lib/gebeta/engine.js';
import { sfx } from '@/lib/sound';

// Ludo-King pacing: every seed is its own visible hop, with a breath between moves.
// Nothing is squeezed to fit a time budget — a long relay chain simply takes as long as it takes.
export const DELAY = {
  pick: 380,    // lift the seeds, let the player see how many are in hand
  sow: 290,     // one seed, one hole, one beat
  relay: 450,  // pause on the filled hole before lifting it
  family: 520, // celebrate a captured family
  sweep: 200,
  ripe: 0,      // a hole reached four — silently; the player has to notice it
  share: 320,  // a four nobody collected freezes
  split: 800,
  deal: 1100,   // 'New round' — let everyone see the board being re-dealt
  turnEnd: 220, // breathing room before the next turn starts
};
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const reduced = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/** Replays engine steps one at a time so seeds visibly travel around the board. */
export function useAnimator(initialPits, t, pace = 1, initialOwn = null, initialFlag = null) {
  const [pits, setPits] = useState(initialPits);
  const [flag, setFlag] = useState(initialFlag);
  const flagRef = useRef(initialFlag);
  const setFlagBoth = (f) => { flagRef.current = f; setFlag(f); };
  const [own, setOwn] = useState(initialOwn);
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
  const curJob = useRef(null);    // the move being animated right now, and how many of its steps are on screen
  const shownRef = useRef(0);
  const hurryRef = useRef(false); // set by a tap during an animation: finish the move quickly

  const commit = (p) => { pitsRef.current = p; setPits(p); };
  const showFlash = (text, kind, ms = 1500) => {
    if (!text) return;
    clearTimeout(flashTimer.current);
    setFlash({ text, kind, k: Math.random() });
    flashTimer.current = setTimeout(() => setFlash(null), ms);
  };
  const ms = (k) => (DELAY[k] || 400) * paceRef.current * (hurryRef.current ? 0.12 : 1);

  const drain = useCallback(async () => {
    if (running.current) return;
    running.current = true;
    const my = token.current;
    setBusy(true);
    try {
    while (queue.current.length) {
      const job = queue.current.shift();
      curJob.current = job; shownRef.current = 0;
      if (job.steps && !reduced()) {
        const p = pitsRef.current.slice();
        let inHand = 0;
        let fours = 0; // how many fours this one move created
        const fl = (flagRef.current || new Array(14).fill(0)).slice();
        for (let k = 0; k < job.steps.length; k++) { // job.steps may be re-scripted while we wait (see patch)
          const s = job.steps[k];
          if (token.current !== my) return;
          shownRef.current = k + 1;
          applyStep(p, s);
          applyFlag(fl, s); setFlagBoth(fl.slice());
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
            setHand(0); setActive(null); sfx.store(); if (s.own) setOwn(s.own.slice()); showFlash(tRef.current.newRound, 'extra', 1800);
          } else if (s.t === 'ripe') {
            setHand(inHand); // no sound, no glow: spotting a four is the player's job
            fours += 1;
            if (fours === 2 && tRef.current.combo) showFlash(tRef.current.combo, 'capture', 1400); // two fours in one sowing chain
          } else if (s.t === 'share') {
            setActive(s.i); sfx.tap(); // the hole freezes
          } else if (s.t === 'split') {
            setHand(0); setActive(null); sfx.store();
          } else if (s.t === 'sweep') {
            setHand(0); setActive(s.store); isStore(s.store) && sfx.store();
          }
          await wait(ms(s.t));
        }
        setHand(0);
        await wait(ms('turnEnd'));
      }
      if (token.current !== my) return;
      curJob.current = null;
      commit(job.final.slice());
      if (job.own) setOwn(job.own.slice());
      if (job.flag) setFlagBoth(job.flag.slice());
      setActive(null);
      setHand(0);
      if (job.extra) { showFlash(tRef.current.extra, 'extra'); await wait(500); }
    }
    } catch (err) {
      // never leave the board stuck: show the final position of everything still queued
      const last = queue.current.length ? queue.current[queue.current.length - 1] : null;
      queue.current = [];
      if (last && token.current === my) { commit(last.final.slice()); if (last.own) setOwn(last.own.slice()); if (last.flag) setFlagBoth(last.flag.slice()); }
    } finally {
      if (token.current === my) { running.current = false; hurryRef.current = false; setBusy(false); setActive(null); setHand(0); }
    }
  }, []);

  const enqueue = useCallback((job) => { queue.current.push(job); drain(); }, [drain]);
  const hurry = useCallback(() => { hurryRef.current = true; }, []);
  /** How many steps of the running job are on screen, or -1 when nothing is animating. */
  const shown = useCallback(() => (curJob.current ? shownRef.current : -1), []);
  /**
   * Swap in a re-scripted version of the running move (a player tapped a four mid-sowing, so the rest of the move
   * plays out differently). The part already on screen must be identical; returns false when it is not.
   */
  const patch = useCallback((next, offset = 0) => {
    const j = curJob.current; if (!j || !j.steps) return false;
    const n = shownRef.current;
    for (let k = 0; k < n; k++) {
      const a = j.steps[k], b = next.steps[k];
      if (!a || !b || a.t !== b.t || a.i !== b.i) return false;
    }
    j.steps = next.steps; j.final = next.final; j.own = next.own; j.flag = next.flag;
    return true;
  }, []);
  const reset = useCallback((p, o, f) => {
    if (o) setOwn(o.slice());
    setFlagBoth(f ? f.slice() : null);
    token.current += 1; queue.current = []; running.current = false; hurryRef.current = false; curJob.current = null;
    setBusy(false); setActive(null); setHand(0); setFlash(null); commit(p.slice());
  }, []);
  useEffect(() => () => { token.current += 1; clearTimeout(flashTimer.current); }, []);

  return { pits, own, flag, active, hand, flash, busy, enqueue, reset, hurry, shown, patch };
}
