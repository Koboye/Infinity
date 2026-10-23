'use client';
import React, { useEffect, useRef } from 'react';
import { apiCall } from '@/lib/firebase';
import { playMove, collect, collectable, holesOf, famText } from '@/lib/gebeta/engine.js';
import { sfx } from '@/lib/sound';
import { useAnimator } from '../useAnimator';
import MatchView from '../MatchView';
import { useMatchLifecycle } from './useMatch';
import { RoomControls, RoomResult } from './RoomParts';

export default function GebetaOnline({ t, lang, room, uid, code, onExit, onSwitchRoom, confirm }) {
  const anim = useAnimator(room.pits, t, 1, room.own, room.flag);
  const roomRef = useRef(room); roomRef.current = room;
  const lastQueued = useRef(null);
  const L = useMatchLifecycle({ t, lang, room, uid, code, busy: anim.busy, onExit, onSwitchRoom, confirm });
  const { seat } = L;

  // Live room → animation queue
  useEffect(() => {
    if (lastQueued.current === null) { lastQueued.current = room.moveSeq; anim.reset(room.pits, room.own, room.flag); return; }
    if (room.moveSeq > lastQueued.current) {
      const single = room.moveSeq === lastQueued.current + 1 && room.lastMove;
      lastQueued.current = room.moveSeq;
      anim.enqueue({
        steps: single ? room.lastMove.steps : null, final: room.pits, own: room.own, flag: room.flag,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room]);

  const isLegal = (i) => L.myTurn && !anim.busy && holesOf({ own: anim.own }, seat).includes(i) && room.pits[i] > 0 && !(room.flag && room.flag[i]);
  const canCollect = (i) => L.myTurn && !anim.busy && room.status === 'playing' && collectable({ pits: room.pits, flag: room.flag, turn: room.turn, over: false }, seat).includes(i);

  const doCollect = async (i) => {
    sfx.tap(); L.setErr('');
    const r = roomRef.current;
    const local = collect({ pits: r.pits, own: r.own, flag: r.flag, turn: r.turn, over: false, winner: null }, i);
    if (!local.ok) return;
    lastQueued.current = r.moveSeq + 1;
    anim.enqueue({ steps: local.steps, final: local.state.pits, own: local.state.own, flag: local.state.flag });
    try { await apiCall({ action: 'collect', code, pit: i }); }
    catch (e) {
      L.setErr(`${t.moveFailed}: ${e.message}`);
      lastQueued.current = roomRef.current.moveSeq; anim.reset(roomRef.current.pits, roomRef.current.own, roomRef.current.flag);
    }
  };

  const onPit = async (i) => {
    if (canCollect(i)) { doCollect(i); return; }
    if (!isLegal(i)) return;
    sfx.tap(); L.setErr('');
    const r = roomRef.current;
    const local = playMove({ pits: r.pits, own: r.own, flag: r.flag, turn: r.turn, over: false, winner: null }, i, r.ruleset);
    if (!local.ok) return;
    lastQueued.current = r.moveSeq + 1; // our own move is animated now; ignore its echo
    anim.enqueue({ steps: local.steps, final: local.state.pits, own: local.state.own, flag: local.state.flag });
    try { await apiCall({ action: 'move', code, pit: i }); }
    catch (e) {
      L.setErr(`${t.moveFailed}: ${e.message}`);
      lastQueued.current = roomRef.current.moveSeq; anim.reset(roomRef.current.pits, roomRef.current.own, roomRef.current.flag);
    }
  };

  const players = [0, 1].map((s) => ({ name: room.names[s], hero: room.avatars[s] }));
  const status = room.status === 'playing' ? (L.myTurn && collectable({ pits: room.pits, flag: room.flag, turn: room.turn, over: false }, seat).length ? t.collectHint : L.myTurn ? t.yourTurn : t.theirTurn(players[1 - seat].name)) : '';

  return (
    <MatchView
      t={t} pits={anim.pits} own={anim.own} flag={anim.flag} canCollect={canCollect} turn={room.turn} viewSeat={seat} players={players}
      isLegal={isLegal} onPit={onPit} active={anim.active} flash={anim.flash} status={L.err || status}
      timer={L.playing && L.secondsLeft != null ? { seat: room.turn, left: L.secondsLeft } : null}
      emotes={L.emotes}
      overlay={<RoomResult t={t} room={room} L={L} score={[famText(room.pits[seat === 0 ? 6 : 13]), famText(room.pits[seat === 0 ? 13 : 6])]} detail={t.seedTotals(room.pits[seat === 0 ? 6 : 13], room.pits[seat === 0 ? 13 : 6])} />}
    >
      <RoomControls t={t} lang={lang} L={L} />
    </MatchView>
  );
}
