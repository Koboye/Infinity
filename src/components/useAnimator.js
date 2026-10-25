'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { applyStep, applyFlag, isStore } from '@/lib/gebeta/engine.js';
import { sfx } from '@/lib/sound';

// ONE standard, slow pace — always. Every seed is its own visible hop, with a breath between moves.
// Nothing is squeezed to fit a time budget and nothing speeds it up: not a tap on the board, not the phone's
// "reduce motion" setting. A long relay chain simply takes as long as it takes.
export const DELAY = {
  pick: 520,    // lift the seeds, let the player see how many are in hand
  lift1: 60,    // Tuz opening: a single stone is picked up (the drop that follows keeps the beat)
  sow: 400,     // one seed, one hole, one beat
  relay: 620,  // pause on the filled hole before lifting it
  family: 700, // celebrate a captured family
  capture: 950, // አሻግሮ መብል: the stone and the opposite hole are taken
  bank: 800,    // አሻግሮ መብል: the stopper keeps his own single stone
  sweep: 260,
  ripe: 0,      // a hole reached four — silently; the player has to notice it
  tuztake: 900, // Tuz: two stones are taken from the opponent's frozen hole
  share: 320,  // a four nobody collected freezes
  split: 800,
  deal: 1100,   // 'New round' — let everyone see the board being re-dealt
  turnEnd: 380, // breathing room before the next turn starts
};
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

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
  const [spin, setSpin] = useState(null);          // { winner } while the 2+2 tie-break wheel is on screen
  const spinDone = useRef(null);
  const endSpin = useCallback(() => { setSpin(null); spinDone.current?.(); spinDone.current = null; }, []);
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

  const commit = (p) => { pitsRef.current = p; setPits(p); };
  const showFlash = (text, kind, ms = 1500) => {
    if (!text) return;
    clearTimeout(flashTimer.current);
    setFlash({ text, kind, k: Math.random() });
    flashTimer.current = setTimeout(() => setFlash(null), ms);
  };
  // Gebeta speed setting (Settings → Gebeta speed): 'slow' is the default; 'normal' is about 30% quicker. A tap never changes it.
  const paceMul = () => (typeof document !== 'undefined' && document.documentElement.dataset.pace === 'normal' ? 0.7 : 1);
  const ms = (k) => (DELAY[k] ?? 400) * paceRef.current * paceMul();

  const drain = useCallback(async () => {
    if (running.current) return;
    running.current = true;
    const my = token.current;
    setBusy(true);
    try {
    while (queue.current.length) {
      const job = queue.current.shift();
      curJob.current = job; shownRef.current = 0;
      if (job.steps) {
        const p = pitsRef.current.slice();
        let inHand = 0;
        let fours = 0; // how many fours this one move created
        const fl = (flagRef.current || new Array(14).fill(0)).slice();
        let k = 0;
        for (;;) {
          while (k < job.steps.length) { // job.steps may be re-scripted while we wait (see patch)
            const s = job.steps[k];
            if (token.current !== my) return;
            k += 1; shownRef.current = k;
            applyStep(p, s);
            applyFlag(fl, s); setFlagBoth(fl.slice());
            commit(p.slice());
            if (s.t === 'pick') {
              inHand = s.n; setHand(inHand); setActive(s.i); sfx.pick();
            } else if (s.t === 'lift1') {
              inHand = 1; setHand(1); setActive(s.i); sfx.pick();
            } else if (s.t === 'sow') {
              inHand = Math.max(0, inHand - 1); setHand(inHand); setActive(s.i); sfx.sow();
            } else if (s.t === 'relay') {
              inHand = s.n; setHand(inHand); setActive(s.i); sfx.pick(); showFlash(tRef.current.relay, 'relay', 1200);
            } else if (s.t === 'family') {
              setHand(inHand); setActive(s.store); sfx.capture();
              showFlash(tRef.current.family ? tRef.current.family(s.last) : tRef.current.captured?.(s.n), 'capture');
            } else if (s.t === 'capture') {
              setHand(0); setActive(s.store); sfx.capture();
              showFlash(tRef.current.eat ? tRef.current.eat(s.n) : tRef.current.captured?.(s.n), 'capture', 1800);
            } else if (s.t === 'bank') {
              setHand(0); setActive(s.store); sfx.store();
              showFlash(tRef.current.bank, 'extra', 1600);
            } else if (s.t === 'deal') {
              setHand(0); setActive(null); sfx.store(); if (s.own) setOwn(s.own.slice()); showFlash(tRef.current.newRound, 'extra', 1800);
              if (s.spin) { setSpin({ winner: s.spin.winner }); await new Promise((res) => { spinDone.current = res; setTimeout(res, 11000); }); setSpin(null); }
            } else if (s.t === 'ripe') {
              setHand(inHand); // no sound, no glow: spotting a four is the player's job
              fours += 1;
              if (fours === 2 && tRef.current.combo) showFlash(tRef.current.combo, 'capture', 1400); // two fours in one sowing chain
            } else if (s.t === 'tuztake') {
              setHand(0); setActive(s.store); sfx.capture(); showFlash(tRef.current.tuzTake, 'extra', 1800);
            } else if (s.t === 'tuz') {
              setHand(0); setActive(s.i); sfx.capture(); showFlash(tRef.current.tuz, 'capture', 2000);
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
          // a collect tapped during that last breath re-scripts the move: play the extra steps too, never skip them
          if (k >= job.steps.length) break;
        }
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
      if (token.current === my) { running.current = false; setBusy(false); setActive(null); setHand(0); }
    }
  }, []);

  const enqueue = useCallback((job) => { queue.current.push(job); drain(); }, [drain]);
  const hurry = useCallback(() => {}, []); // kept so old callers still work; the pace is fixed on purpose
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
    token.current += 1; queue.current = []; running.current = false; curJob.current = null;
    setBusy(false); setActive(null); setHand(0); setFlash(null); commit(p.slice());
  }, []);
  useEffect(() => () => { token.current += 1; clearTimeout(flashTimer.current); }, []);

  return { pits, own, flag, active, hand, flash, busy, enqueue, reset, hurry, shown, patch, spin, endSpin };
}
