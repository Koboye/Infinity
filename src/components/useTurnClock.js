'use client';
import { useEffect, useRef, useState } from 'react';
import { TURN_SECONDS } from '@/lib/games.js';

/**
 * One standard turn clock for every game. Counts down while `running`, restarts whenever `resetKey` changes
 * (a new turn), and calls `onExpire` once when it reaches zero. Returns { seat, left } for MatchFrame's `timer` prop.
 * The deadline is an absolute timestamp, so a throttled background tab or a slow frame never makes the clock drift;
 * it re-syncs the moment the tab becomes visible again.
 */
export function useTurnClock({ running, seat, resetKey, onExpire, seconds = TURN_SECONDS }) {
  const [left, setLeft] = useState(seconds);
  const cb = useRef(onExpire); cb.current = onExpire;
  useEffect(() => {
    setLeft(seconds);
    if (!running) return undefined;
    const end = Date.now() + seconds * 1000;
    let fired = false;
    let id = null;
    const tick = () => {
      const s = Math.max(0, Math.ceil((end - Date.now()) / 1000));
      setLeft((prev) => (prev === s ? prev : s)); // the last-five-seconds tick is played by MatchFrame, for offline and online alike
      if (s <= 0 && !fired) { fired = true; clearInterval(id); cb.current?.(); }
    };
    id = setInterval(tick, 200);
    const vis = () => { if (typeof document !== 'undefined' && !document.hidden) tick(); };
    document.addEventListener('visibilitychange', vis);
    return () => { clearInterval(id); document.removeEventListener('visibilitychange', vis); };
  }, [running, resetKey, seconds]);
  return running ? { seat, left, max: seconds } : null;
}
