'use client';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { sfx } from '@/lib/sound';
import { SLICE_DEG, POINTER_DEG, ownerOfAngle, pickLanding, finalRotation, angleUnderPointer, easeOut, wheelGradient } from '@/lib/spin.js';
import { randomInt } from '@/lib/fairRandom.js';

const SPIN_MS = 5800;       // length of the spin: long enough to follow the wheel and read who is under the pointer
const SPIN_MS_REDUCED = 1600;
const HOLD_MS = 3400;       // after it stops the result stays up (winner banner + countdown bar) so everybody can read it
const HOLD_MS_REDUCED = 2400;
const COLORS = ['#3b8fd6', '#d65a3b'];

/**
 * "Who starts?" wheel. The winner (0 or 1) is already decided by the caller (a fair cryptographic coin offline, the
 * server online); the wheel only shows it — see lib/spin.js for the geometry.
 *
 * • The wheel has 12 slices that alternate between the two players, so each owns exactly half of it, evenly spread.
 * • It is turned forward only (5–6 full spins, never backwards or with a jump) so that the pointer ends inside a slice
 *   owned by the winner, in the safe middle of that slice. Slice and position are uniformly random, so the picture is
 *   as unbiased as the draw itself, and it can never disagree with it.
 * • The motion is driven by the clock, not by timers: a slow device or a background tab cannot desynchronise the
 *   spin, the tick sounds (one per slice that passes the pointer) or the result.
 */
export default function SpinOverlay({ t, names, winner, onDone, title = null, wonTitle = null }) {
  const [landed, setLanded] = useState(false);
  const [live, setLive] = useState(null);   // seat currently under the pointer while the wheel turns
  const [hold, setHold] = useState(HOLD_MS);
  const wheelRef = useRef(null);
  const pointerRef = useRef(null);
  const done = useRef(false);
  const finish = () => { if (done.current) return; done.current = true; onDone?.(); };
  const w = winner === 1 ? 1 : 0;

  // Decided once per spin: where the pointer will land and how far the wheel turns to get there.
  const plan = useMemo(() => {
    let landing = pickLanding(w);
    if (ownerOfAngle(landing) !== w) landing = (w + 0.5) * SLICE_DEG; // can never happen; the centre of the winner's first slice is always safe
    const turns = 5 + randomInt(2);
    return { rotation: finalRotation(landing, turns), landing };
  }, [w]);

  useEffect(() => {
    const reduced = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const ms = reduced ? SPIN_MS_REDUCED : SPIN_MS;
    const holdMs = reduced ? HOLD_MS_REDUCED : HOLD_MS;
    setHold(holdMs);
    const wheel = wheelRef.current, pointer = pointerRef.current;
    const start = performance.now();
    let raf = 0, lastSlice = null, lastTick = 0, lastOwner = null, ended = false;
    const draw = (rot) => { if (wheel) wheel.style.transform = `rotate(${rot}deg)`; };
    const end = () => {
      if (ended) return; ended = true;
      draw(plan.rotation);
      if (pointer) pointer.style.transform = '';
      setLive(w); setLanded(true); sfx.win();
    };
    const frame = (now) => {
      const x = (now - start) / ms;
      if (x >= 1) { end(); return; }
      const rot = plan.rotation * easeOut(x);
      draw(rot);
      const slice = Math.floor(angleUnderPointer(rot) / SLICE_DEG);   // the slice currently under the pointer
      if (lastSlice !== null && slice !== lastSlice) {
        if (now - lastTick > 55) { sfx.tap(); lastTick = now; }       // one tick per slice, thinned out at top speed
        if (pointer) { pointer.style.transform = 'translateY(-50%) rotate(-14deg)'; setTimeout(() => { if (pointer && !ended) pointer.style.transform = ''; }, 60); }
      }
      lastSlice = slice;
      const ow = slice % 2; if (ow !== lastOwner) { lastOwner = ow; setLive(ow); }   // names flicker by as the wheel slows down
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    const idEnd = setTimeout(end, ms + 250);                 // safety net if animation frames are throttled
    const idDone = setTimeout(finish, ms + holdMs);
    return () => { cancelAnimationFrame(raf); clearTimeout(idEnd); clearTimeout(idDone); };
  }, [plan]); // eslint-disable-line react-hooks/exhaustive-deps

  const background = useMemo(() => wheelGradient(COLORS[0], COLORS[1]), []);
  return (
    <div className="overlay spin-ov" role="dialog" aria-modal="true" aria-label={t.spinWho} onClick={() => landed && finish()}>
      <div className="spin-card">
        <div className="spin-title" aria-live="polite">{landed ? (wonTitle ? wonTitle(names[w]) : t.lotteryStart(names[w])) : (title || t.spinWho)}</div>
        <div className={`spin-live${landed ? ' final' : ' flick'}`} key={`${landed}-${live}`} aria-hidden="true">
          {live != null && <span>{landed ? '🏆 ' : '👉 '}<i className={live === 0 ? 'a' : 'b'} /> {names[live]}</span>}
        </div>
        <div className="spin-stage">
          <div ref={wheelRef} className={`spin-wheel${landed ? ' landed' : ''}`} style={{ background }} />
          <i ref={pointerRef} className="spin-pointer" data-win={landed ? w : undefined} aria-hidden="true" />
          <b className="spin-hub" aria-hidden="true" />
        </div>
        {landed ? <div className="spin-bar" style={{ '--hold': `${hold}ms` }} aria-hidden="true"><b /></div>
          : <button type="button" className="btn ghost" onClick={(e) => { e.stopPropagation(); finish(); }}>{t.skip}</button>}
        <div className="spin-legend">
          <span className={landed && w === 0 ? 'won' : ''}><i className="a" />{names[0]}</span>
          <span className={landed && w === 1 ? 'won' : ''}><i className="b" />{names[1]}</span>
        </div>
      </div>
    </div>
  );
}
