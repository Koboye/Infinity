'use client';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db, apiCall } from '@/lib/firebase';
import { sfx } from '@/lib/sound';
import { MatchFrame } from '../MatchView';
import { useMatchLifecycle } from '../online/useMatch';
import { RoomControls, RoomResult } from '../online/RoomParts';
import DominoTable from './Table';
import RoundOverlay from './RoundOverlay';

const dec = (s) => [Number(String(s)[0]), Number(String(s)[1])];

export default function DominoesOnline({ t, lang, room, uid, code, onExit, onSwitchRoom, confirm }) {
  const [hand, setHand] = useState([]);
  const [pending, setPending] = useState(false);
  const [flash, setFlash] = useState(null);
  const [count, setCount] = useState(8);
  const lastSeq = useRef(room.moveSeq);
  const flashTimer = useRef(null);
  const L = useMatchLifecycle({ t, lang, room, uid, code, busy: false, onExit, onSwitchRoom, confirm });
  const { seat } = L;

  // My private hand (only I can read this document)
  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'gebetaRooms', code, 'private', uid), (s) => setHand(s.exists() ? (s.data().hand || []).map(dec) : []), () => {});
    return () => unsub();
  }, [code, uid]);

  const say = useCallback((text, kind = 'extra') => {
    clearTimeout(flashTimer.current);
    setFlash({ text, kind, k: Math.random() });
    flashTimer.current = setTimeout(() => setFlash(null), 1300);
  }, []);
  useEffect(() => () => clearTimeout(flashTimer.current), []);

  // Sounds + notices for what just happened
  useEffect(() => {
    setPending(false);
    if (room.moveSeq === lastSeq.current) return;
    lastSeq.current = room.moveSeq;
    const m = room.lastMove;
    if (!m) return;
    if (m.kind === 'play' && m.by !== seat) sfx.place();
    if (m.kind === 'draw' && m.by !== seat) { sfx.draw(); say(t.drewMsg(room.names[m.by]), 'relay'); }
    (m.autoPasses || []).forEach((s) => { sfx.pass(); say(t.passedMsg(room.names[s]), 'relay'); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room.moveSeq]);

  const chain = room.chain.map(dec);
  const ready = hand.length === room.handCounts[seat];
  const roundOver = room.phase === 'roundOver' && room.status === 'playing';
  const drawing = room.ruleset === 'draw';
  const myTurn = L.myTurn && ready && !pending;
  const mustLead = room.mustLead ? dec(room.mustLead) : null;

  const mustDraw = myTurn && drawing && room.boneyardCount > 0 && hand.length > 0
    && !hand.some((tl) => (!chain.length ? (!mustLead || (tl[0] === mustLead[0] && tl[1] === mustLead[1]) || (tl[0] === mustLead[1] && tl[1] === mustLead[0]))
      : [chain[0][0], chain[chain.length - 1][1]].some((v) => tl[0] === v || tl[1] === v)));

  const onPlay = async (tile, end) => {
    setPending(true); sfx.place(); L.setErr('');
    try { await apiCall({ action: 'move', code, tile: `${tile[0]}${tile[1]}`, end }); }
    catch (e) { L.setErr(`${t.moveFailed}: ${e.message}`); setPending(false); }
  };
  const onDraw = async () => {
    setPending(true); sfx.draw(); L.setErr('');
    try { await apiCall({ action: 'drawTile', code }); }
    catch (e) { L.setErr(`${t.moveFailed}: ${e.message}`); setPending(false); }
  };

  // Next round: tap, or it starts by itself after a few seconds (the server ignores duplicates)
  const nextRound = useCallback(() => apiCall({ action: 'nextRound', code, round: room.round }).catch(() => {}), [code, room.round]);
  useEffect(() => {
    if (!roundOver) return undefined;
    setCount(8);
    const id = setInterval(() => setCount((c) => c - 1), 1000);
    return () => clearInterval(id);
  }, [roundOver, room.round]);
  useEffect(() => { if (roundOver && count <= 0) nextRound(); }, [roundOver, count, nextRound]);

  const players = [0, 1].map((s) => ({ name: room.names[s], hero: room.avatars[s] }));
  let status = '';
  if (room.status === 'playing' && !roundOver) {
    if (!L.myTurn) status = t.theirTurn(players[1 - seat].name);
    else if (mustDraw) status = t.mustDrawMsg;
    else if (mustLead && !chain.length) status = `${t.yourTurn} · ${t.leadHint}`;
    else status = t.yourTurn;
  }
  const rr = room.roundResult;
  const names = players.map((p) => p.name);

  return (
    <MatchFrame
      t={t} players={players} viewSeat={seat} turn={roundOver ? -1 : room.turn} scores={room.scores} scoreLabel={t.points}
      flash={flash} status={L.err || status}
      timer={L.playing && L.secondsLeft != null && !roundOver ? { seat: room.turn, left: L.secondsLeft } : null}
      emotes={L.emotes}
      badges={[0, 1].map((s) => <span key={s} className="side-dot-txt">{t.tilesLeft(room.handCounts[s])}</span>)}
      board={(
        <DominoTable
          t={t} chain={chain} hand={hand} oppCount={room.handCounts[1 - seat]} boneyardCount={room.boneyardCount}
          drawing={drawing} myTurn={myTurn} mustDraw={mustDraw} mustLead={mustLead}
          onPlay={onPlay} onDraw={onDraw} lastCode={room.lastMove?.kind === 'play' ? room.lastMove.tile : null}
        />
      )}
      overlay={(
        <>
          {roundOver && rr && (
            <RoundOverlay
              t={t} names={names} seatMe={seat} target={room.target} scores={room.scores}
              result={{ ...rr, hands: [rr.h0.map(dec), rr.h1.map(dec)] }}
              onNext={nextRound} nextLabel={t.nextRoundIn(Math.max(0, count))}
            />
          )}
          <RoomResult t={t} room={room} L={L} score={[room.scores[seat], room.scores[1 - seat]]} />
        </>
      )}
    >
      <RoomControls t={t} lang={lang} L={L} />
    </MatchFrame>
  );
}
