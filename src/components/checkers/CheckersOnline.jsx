'use client';
import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { apiCall } from '@/lib/firebase';
import { playMove, resolveHuff, legalMoves, counts, hopsOf, getRules } from '@/lib/checkers/engine.js';
import { useCheckersAnimator } from './useCheckersAnimator';
import { useCheckersInput } from './useCheckersInput';
import CheckersBoard from './CheckersBoard';
import { SideDot, ckReason } from './CheckersLocal';
import { MatchFrame } from '../MatchView';
import { useMatchLifecycle } from '../online/useMatch';
import { RoomControls, RoomResult } from '../online/RoomParts';

const stateOf = (room) => ({
  board: room.board, turn: room.turn, over: false, winner: null, reason: null, noProgress: room.noProgress || 0, seen: room.seen || {}, pendingHuff: room.pendingHuff || null,
});

export default function CheckersOnline({ t, lang, room, uid, code, onExit, onSwitchRoom, confirm }) {
  const anim = useCheckersAnimator(room.board, t);
  const roomRef = useRef(room); roomRef.current = room;
  const lastQueued = useRef(null);
  const L = useMatchLifecycle({ t, lang, room, uid, code, busy: anim.busy, onExit, onSwitchRoom, confirm });
  const { seat } = L;
  const claimed = useRef(-1); // moveSeq at which we claimed a piece: no move until the server has echoed it

  useEffect(() => {
    if (lastQueued.current === null) { lastQueued.current = room.moveSeq; anim.reset(room.board); return; }
    if (room.moveSeq > lastQueued.current) {
      const single = room.moveSeq === lastQueued.current + 1 && room.lastMove;
      lastQueued.current = room.moveSeq;
      if (single) anim.enqueue({ hops: hopsOf(room.lastMove), final: room.board, promote: !!room.lastMove.promote, huffed: room.lastMove.huffed ?? null });
      else anim.reset(room.board);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room]);

  const playing = room.status === 'playing';
  const moves = useMemo(() => (playing ? legalMoves(stateOf(room), room.ruleset) : []), [room.moveSeq, room.status, room.ruleset]); // eslint-disable-line
  const enabled = L.myTurn && !anim.busy && claimed.current !== room.moveSeq;

  const onMove = useCallback(async (move) => {
    const r = roomRef.current;
    const local = playMove(stateOf(r), move.from, move.path, r.ruleset);
    if (!local.ok) return;
    lastQueued.current = r.moveSeq + 1; // animate our own move now; ignore its echo
    anim.enqueue({ hops: local.hops, final: local.state.board, promote: local.promoted, huffed: local.huffed });
    try { await apiCall({ action: 'move', code, from: move.from, path: move.path }); }
    catch (e) { L.setErr(`${t.moveFailed}: ${e.message}`); lastQueued.current = roomRef.current.moveSeq; anim.reset(roomRef.current.board); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [anim, code, t]);

  // Huff forfeit: the player to move MAY touch a piece that missed a capture and remove it (free action). Nothing is shown.
  const pending = playing ? room.pendingHuff || null : null;
  const onPick = useCallback(async (square) => {
    const r = roomRef.current;
    const local = resolveHuff(stateOf(r), square, r.ruleset);
    if (!local.ok) return;
    lastQueued.current = r.moveSeq + 1; claimed.current = r.moveSeq;
    anim.enqueue({ hops: [], final: local.state.board, promote: false, huffed: local.huffed });
    try { await apiCall({ action: 'huff', code, square }); }
    catch (e) { claimed.current = -1; L.setErr(`${t.moveFailed}: ${e.message}`); lastQueued.current = roomRef.current.moveSeq; anim.reset(roomRef.current.board); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [anim, code, t]);

  const input = useCheckersInput({ moves, enabled, onMove, resetKey: `${room.moveSeq}:${room.status}`, strict: !!getRules(room.ruleset).huff });

  const players = [0, 1].map((s) => ({ name: room.names[s], hero: room.avatars[s] }));
  const c = counts(room.board);
  let status = '';
  if (playing) {
    status = L.myTurn ? t.yourTurn : t.theirTurn(players[1 - seat].name);
  }
  const offeredByOpp = room.drawOffer === 1 - seat;
  const offeredByMe = room.drawOffer === seat;
  const act = (action) => apiCall({ action, code }).catch((e) => L.setErr(e.message));

  return (
    <MatchFrame
      t={t} players={players} viewSeat={seat} turn={room.turn} scores={c} scoreLabel={t.piecesLabel}
      badges={[<SideDot key="a" seat={0} t={t} />, <SideDot key="b" seat={1} t={t} />]}
      flash={anim.flash} status={L.err || status}
      timer={L.playing && L.secondsLeft != null ? { seat: room.turn, left: Math.min(L.secondsLeft, L.turnMax), max: L.turnMax } : null}
      emotes={L.emotes}
      board={(
        <CheckersBoard
          pieces={anim.pieces} viewSeat={seat} selected={input.from} picked={input.picked} targets={input.targets}
          movable={input.movable} last={anim.last} onSquare={(sq) => { if (pending && enabled && pending.options.includes(sq)) onPick(sq); else input.onSquare(sq); }} pick={[]} showMovable={!getRules(room.ruleset).huff} label={t.checkersName} onSwipe={input.onSwipe} heroes={players.map((p) => p.hero)} fx={anim.fx} shake={anim.shake}
        />
      )}
      overlay={<RoomResult t={t} room={room} L={L} score={[c[seat], c[1 - seat]]} detail={ckReason(t, room.detail, room.board)} />}
    >
      {playing && offeredByOpp && (
        <div className="draw-offer" role="alert">
          <span>{t.oppOffersDraw}</span>
          <button className="btn primary" onClick={() => act('offerDraw')}>{t.accept}</button>
          <button className="btn" onClick={() => act('declineDraw')}>{t.decline}</button>
        </div>
      )}
      {input.canStop && <div className="match-actions"><button className="btn primary" onClick={input.stopChain}>⏹ {t.stopChain}</button></div>}
      <RoomControls t={t} lang={lang} L={L}>
        {!offeredByOpp && <button className="btn ghost" disabled={offeredByMe} onClick={() => act('offerDraw')}>{offeredByMe ? t.drawOffered : t.offerDraw}</button>}
      </RoomControls>
    </MatchFrame>
  );
}
