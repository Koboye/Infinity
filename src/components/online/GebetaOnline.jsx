'use client';
import React, { useEffect, useRef } from 'react';
import { apiCall } from '@/lib/firebase';
import { playMove, collect, collectable, holesOf, famText } from '@/lib/gebeta/engine.js';
import { sfx } from '@/lib/sound';
import { gebetaTaunt, resolveGender } from '@/lib/celebrate.js';
import { loadSettings } from '@/lib/settings';
import { useAnimator } from '../useAnimator';
import MatchView from '../MatchView';
import SpinOverlay from '../SpinOverlay';
import { useMatchLifecycle } from './useMatch';
import { RoomControls, RoomResult } from './RoomParts';

export default function GebetaOnline({ t, lang, room, uid, code, onExit, onSwitchRoom, confirm }) {
  const fast = room.ruleset === 'ashagro'; // no fours, no freezing: full speed
  const anim = useAnimator(room.pits, t, fast ? 0.7 : 1, room.own, room.flag);
  const roomRef = useRef(room); roomRef.current = room;
  const lastQueued = useRef(null);
  const moveCtx = useRef(null); // the move being animated (board before it, pit, timed collects so far)
  const L = useMatchLifecycle({ t, lang, room, uid, code, busy: anim.busy, onExit, onSwitchRoom, confirm });
  const { seat } = L;

  // Live room → animation queue
  useEffect(() => {
    if (lastQueued.current === null) { lastQueued.current = room.moveSeq; anim.reset(room.pits, room.own, room.flag); return; }
    if (room.moveSeq > lastQueued.current) {
      const single = room.moveSeq === lastQueued.current + 1 && room.lastMove;
      lastQueued.current = room.moveSeq;
      const lm = room.lastMove;
      moveCtx.current = single && lm && lm.prev && !lm.collect ? { prev: lm.prev, pit: lm.pit, schedule: lm.schedule || [] } : null;
      // the other player tapped a four mid-sowing: the move we are animating is re-scripted in place
      if (single && lm?.rescript && anim.shown() >= 0
        && anim.patch({ steps: lm.steps, final: room.pits, own: room.own, flag: room.flag })) return;
      anim.enqueue({
        steps: single && !lm.rescript ? room.lastMove.steps : null, final: room.pits, own: room.own, flag: room.flag,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room]);

  // The board as it is right now INCLUDING our own moves the server has not echoed yet (optimistic state).
  const optSeq = useRef(0), optState = useRef(null), chain = useRef(Promise.resolve());
  const logic = () => {
    const r = roomRef.current;
    if (optState.current && optSeq.current > r.moveSeq) return optState.current;
    return { pits: r.pits, own: r.own, flag: r.flag, turn: r.turn, starter: r.starter, opening: !!r.opening, over: false, winner: null };
  };
  const nextSeq = () => { optSeq.current = Math.max(optSeq.current, roomRef.current.moveSeq) + 1; return optSeq.current; };
  // requests are sent strictly in order, so a quick tap on a four can never overtake the move that made it
  const send = (body) => { const p = chain.current.then(() => apiCall(body)); chain.current = p.catch(() => {}); return p; };
  const resync = () => { optState.current = null; optSeq.current = 0; lastQueued.current = roomRef.current.moveSeq; anim.reset(roomRef.current.pits, roomRef.current.own, roomRef.current.flag); };

  const isLegal = (i) => L.myTurn && !anim.busy && holesOf({ own: anim.own }, seat).includes(i) && room.pits[i] > 0 && !(room.flag && room.flag[i]);
  // One touch, any time: as soon as the four is visible on the board its owner may tap it — mid-animation, and on the
  // opponent's turn too (your own last stone made it).
  const canCollect = (i) => {
    if (room.status !== 'playing' || seat == null || seat < 0) return false;
    const want = seat === 0 ? 1 : 2;
    if (!anim.flag || anim.flag[i] !== want) return false;
    return collectable(logic(), seat).includes(i);
  };

  const doCollect = async (i) => {
    sfx.tap(); L.setErr('');
    const local = collect(logic(), i, seat);
    if (!local.ok) return;
    moveCtx.current = null; // this job is a collect, not a sowing move: nothing to re-script
    const seq = nextSeq(); lastQueued.current = seq; optState.current = local.state;
    anim.enqueue({ steps: local.steps, final: local.state.pits, own: local.state.own, flag: local.state.flag });
    try { await send({ action: 'collect', code, pit: i }); }
    catch (e) { L.setErr(`${t.moveFailed}: ${e.message}`); resync(); }
  };

  // A four is on screen while stones are still travelling (anyone's move): collect it now; the rest of the move re-plays from there.
  const collectMidMove = (i) => {
    const ctx = moveCtx.current;
    if (!ctx || anim.shown() < 0 || seat == null || seat < 0 || room.status !== 'playing') return false;
    const want = seat === 0 ? 1 : 2;
    if (!anim.flag || anim.flag[i] !== want || anim.pits[i] !== 4) return false;
    const at = anim.shown();
    const schedule = [...ctx.schedule, { at, hole: i, seat }];
    const r = playMove({ ...ctx.prev, over: false, winner: null }, ctx.pit, roomRef.current.ruleset, schedule);
    const fam = r.ok && r.steps[at];
    if (!fam || fam.t !== 'family' || fam.i !== i) return false;
    if (!anim.patch({ steps: r.steps, final: r.state.pits, own: r.state.own, flag: r.state.flag })) return false;
    sfx.tap(); L.setErr('');
    ctx.schedule = schedule;
    const seq = nextSeq(); lastQueued.current = seq; optState.current = r.state;
    send({ action: 'collect', code, pit: i, at }).catch((e) => { L.setErr(`${t.moveFailed}: ${e.message}`); resync(); });
    return true;
  };

  const onPit = async (i) => {
    if (collectMidMove(i)) return;
    if (canCollect(i)) { doCollect(i); return; }
    if (anim.busy) return; // the pace is fixed: a tap never speeds the board up
    if (!isLegal(i)) return;
    sfx.tap(); L.setErr('');
    const before = logic();
    const local = playMove(before, i, roomRef.current.ruleset);
    if (!local.ok) return;
    moveCtx.current = { prev: { pits: before.pits, own: before.own, flag: before.flag, turn: before.turn, starter: before.starter }, pit: i, schedule: [] };
    const seq = nextSeq(); lastQueued.current = seq; optState.current = local.state; // our own move is animated now; ignore its echo
    anim.enqueue({ steps: local.steps, final: local.state.pits, own: local.state.own, flag: local.state.flag });
    try { await send({ action: 'move', code, pit: i }); }
    catch (e) { L.setErr(`${t.moveFailed}: ${e.message}`); resync(); }
  };

  const players = [0, 1].map((s) => ({ name: room.names[s], hero: room.avatars[s] }));
  const status = room.status === 'playing' ? (L.myTurn ? t.yourTurn : t.theirTurn(players[1 - seat].name)) : '';

  return (
    <MatchView
      t={t} raw={fast || room.ruleset === 'tuz'} pits={anim.pits} own={anim.own} flag={anim.flag} canCollect={(i) => !anim.busy && canCollect(i)} turn={room.turn} viewSeat={seat} players={players}
      isLegal={isLegal} onPit={onPit} ruleset={room.ruleset} active={anim.active} flash={anim.flash} status={L.err || status}
      timer={L.playing && L.secondsLeft != null ? { seat: room.turn, left: Math.min(L.secondsLeft, L.turnMax), max: L.turnMax } : null}
      emotes={L.emotes}
      overlay={anim.spin ? <SpinOverlay key="tie" t={t} names={players.map((p) => p.name)} winner={anim.spin.winner} title={t.spinTie} wonTitle={t.spinTieWon} onDone={anim.endSpin} /> : <RoomResult t={t} room={room} L={L} taunt={room.winner === 0 || room.winner === 1 ? gebetaTaunt(resolveGender(1 - room.winner === seat ? loadSettings().gender : 'auto', players[1 - room.winner].hero)) : null} score={fast ? [String(room.pits[seat === 0 ? 6 : 13]), String(room.pits[seat === 0 ? 13 : 6])] : [famText(room.pits[seat === 0 ? 6 : 13]), famText(room.pits[seat === 0 ? 13 : 6])]} detail={t.seedTotals(room.pits[seat === 0 ? 6 : 13], room.pits[seat === 0 ? 13 : 6])} />}
    >
      <RoomControls t={t} lang={lang} L={L} />
    </MatchView>
  );
}
