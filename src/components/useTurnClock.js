'use client';
import { useEffect, useRef, useState } from 'react';
import { TURN_SECONDS } from '@/lib/games.js';

/**
 * One standard turn clock for every game. Counts down while `running`, restarts whenever `resetKey` changes
 * (a new turn), and calls `onExpire` once when it reaches zero. Returns { seat, left } for MatchFrame's `timer` prop.
 */
export function useTurnClock({ running, seat, resetKey, onExpire, seconds = TURN_SECONDS }) {
  const [left, setLeft] = useState(seconds);
  const cb = useRef(onExpire); cb.current = onExpire;
  useEffect(() => {
    setLeft(seconds);
    if (!running) return undefined;
    const end = Date.now() + seconds * 1000;
    let fired = false;
    const id = setInterval(() => {
      const s = Math.max(0, Math.ceil((end - Date.now()) / 1000));
      setLeft(s);
      if (s <= 0 && !fired) { fired = true; clearInterval(id); cb.current?.(); }
    }, 250);
    return () => clearInterval(id);
  }, [running, resetKey, seconds]);
  return running ? { seat, left, max: seconds } : null;
}
