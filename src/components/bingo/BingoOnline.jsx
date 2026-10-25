'use client';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db, apiCall } from '@/lib/firebase';
import { letterOf, LETTERS, FREE, CALL_SECONDS } from '@/lib/bingo/engine.js';
import { sfx } from '@/lib/sound';
import { speakBall, stopSpeaking, speechSupported } from '@/lib/speech';
import { MatchFrame } from '../MatchView';
import { useMatchLifecycle } from '../online/useMatch';
import { RoomControls, RoomResult } from '../online/RoomParts';

/** Bingo with a friend or a random opponent. Same rules as the offline game; the server calls the balls and judges every claim. */
export default function BingoOnline({ t, lang, room, uid, code, onExit, onSwitchRoom, confirm }) {
  const L = useMatchLifecycle({ t, lang, room, uid, code, busy: false, onExit, onSwitchRoom, confirm });
  const { seat } = L;
  const [mine, setMine] = useState(null);           // { card, marks } — my private document
  const [shake, setShake] = useState(null);
  const [flash, setFlash] = useState(null);
  const [voiceOn, setVoiceOn] = useState(true);
  const flashTimer = useRef(null);
  const lastCalled = room.called[room.called.length - 1];
  const prevCount = useRef(room.called.length);
  const callFor = useRef(-1);

  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'gebetaRooms', code, 'private', uid), (s) => setMine(s.exists() ? s.data() : null), () => {});
    return () => unsub();
  }, [code, uid]);
  useEffect(() => () => { clearTimeout(flashTimer.current); stopSpeaking(); }, []);

  const say = useCallback((text, kind = 'extra') => {
    clearTimeout(flashTimer.current); setFlash({ text, kind, k: Math.random() });
    flashTimer.current = setTimeout(() => setFlash(null), 1500);
  }, []);

  // Seconds until the next ball (server clock). Whoever's phone notices first asks for it; the server ignores duplicates.
  const secs = room.status === 'playing' && room.nextCallAt ? Math.max(0, Math.ceil((room.nextCallAt - L.now) / 1000)) : 0;
  useEffect(() => {
    if (room.status !== 'playing' || !room.nextCallAt || secs > 0 || callFor.current === room.called.length) return undefined;
    callFor.current = room.called.length;
    const id = setTimeout(() => apiCall({ action: 'call', code, n: room.called.length }, { retries: 0 }).catch(() => { callFor.current = -1; }), seat === 0 ? 0 : 350);
    return () => clearTimeout(id);
  }, [secs, room.status, room.nextCallAt, room.called.length, code, seat]);

  // A new ball: sound + voice. Events from the opponent (false BINGO) are announced too.
  useEffect(() => {
    if (room.called.length > prevCount.current) {
      prevCount.current = room.called.length; sfx.ball();
      if (voiceOn && lastCalled) speakBall(lastCalled, document.documentElement.lang === 'am' ? 'am' : 'en');
    }
  }, [room.called.length]); // eslint-disable-line react-hooks/exhaustive-deps
  const lm = room.lastMove, lmSeq = room.moveSeq;
  useEffect(() => {
    if (!lm || room.status !== 'playing') return;
    if (lm.kind === 'false' && lm.by !== seat) say(`${room.names[lm.by]}: ${t.bingoFalse}`, 'relay');
  }, [lmSeq]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (room.status === 'finished' && room.winner === seat) sfx.cheer?.(); }, [room.status]); // eslint-disable-line react-hooks/exhaustive-deps

  const lock = room.lock?.[seat] || 0;
  const playing = room.status === 'playing';
  const tap = async (i) => {
    if (!playing || !mine || i === FREE || mine.marks[i]) return;
    if (!room.called.includes(mine.card[i])) { setShake(i); setTimeout(() => setShake(null), 400); sfx.pass(); try { navigator.vibrate?.(30); } catch {} return; }
    sfx.place(); setMine((m) => (m ? { ...m, marks: m.marks.map((x, k) => (k === i ? true : x)) } : m)); // optimistic
    try { await apiCall({ action: 'mark', code, idx: i }, { retries: 1 }); } catch (e) { L.setErr(e.message); }
  };
  const shout = async () => {
    if (!playing || lock > 0) return;
    sfx.bingoCall();
    try { await apiCall({ action: 'claim', code }); } catch (e) { sfx.pass(); L.setErr(e.message); say(t.bingoFalse, 'relay'); }
  };
  const toggleVoice = () => { const v = !voiceOn; setVoiceOn(v); if (!v) stopSpeaking(); sfx.tap(); };

  const players = [0, 1].map((s) => ({ name: room.names[s], hero: room.avatars[s] }));
  const winLine = room.status === 'finished' && room.winner === seat ? room.winLine : null;
  const oppWinLine = room.status === 'finished' && room.winner === 1 - seat ? room.winLine : null;
  const status = !playing ? '' : L.err || (lock > 0 ? t.bingoLocked(lock) : room.called.length ? t.bingoStatus : t.bingoStart);
  const recent = room.called.slice(-6, -1).reverse();
  const card = mine?.card, marks = mine?.marks;

  const board = (
    <div className="bingo">
      <div className="bingo-caller" aria-live="polite">
        <div className={`bball l${lastCalled ? 'BINGO'.indexOf(letterOf(lastCalled)) : 5}`} key={lastCalled || 0}>
          <small>{lastCalled ? letterOf(lastCalled) : ''}</small><b>{lastCalled || '—'}</b>
        </div>
        <div className="bcall-meta">
          <span className="bnext" aria-label={t.bingoNext(secs)}><i style={{ '--p': `${Math.min(100, (secs / CALL_SECONDS) * 100)}%` }} /><em>{playing ? secs : ''}</em></span>
          <div className="brecent">{recent.map((n) => <span key={n} className={`bchip l${'BINGO'.indexOf(letterOf(n))}`}>{letterOf(n)}{n}</span>)}</div>
          <span className="bcount">{room.called.length}/75 · {t[`bingoR_${room.ruleset}`]}</span>
        </div>
      </div>
      <div className="bcards n1">
        <div className="bcard" role="grid" aria-label={t.bingoName}>
          {LETTERS.map((Lt, col) => <span key={Lt} className={`bhead l${col}`}>{Lt}</span>)}
          {(card || new Array(25).fill(0)).map((n, i) => {
            const m = marks ? marks[i] : i === FREE;
            const cls = `bcell${i === FREE ? ' free' : ''}${m ? ' on' : ''}${shake === i ? ' shake' : ''}${winLine && winLine.includes(i) ? ' win' : ''}`;
            return <button key={i} type="button" role="gridcell" className={cls} aria-pressed={!!m} disabled={!card} onClick={() => tap(i)}>{i === FREE ? '★' : (card ? n : '')}</button>;
          })}
        </div>
      </div>
      <button type="button" className="bingo-btn" disabled={!playing || lock > 0 || !card} onClick={shout}>{t.bingoBtn}{lock > 0 ? ` · ${lock}` : ''}</button>
      <div className="bside">
        <div className="bopp" aria-label={room.names[1 - seat]}>
          <span className="bopp-name">{room.names[1 - seat]}</span>
          <span className="bopp-bar"><i style={{ '--p': `${Math.round(((room.marked?.[1 - seat] || 0) / 24) * 100)}%` }} /></span>
          <span className="bopp-num">{room.marked?.[1 - seat] || 0}/24</span>
        </div>
        <div className="bsheet" aria-label={t.bingoCalled}>
          {LETTERS.map((Lt, c) => (
            <div key={Lt} className="brow">
              <b className={`l${c}`}>{Lt}</b>
              {Array.from({ length: 15 }, (_, k) => c * 15 + k + 1).map((n) => <i key={n} className={room.called.includes(n) ? 'on' : ''}>{n}</i>)}
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  return (
    <MatchFrame
      t={t} players={players} viewSeat={seat} turn={-1} scores={[room.toGo?.[0] ?? 0, room.toGo?.[1] ?? 0]} scoreLabel={t.bingoToGo}
      emotes={L.emotes} flash={flash} status={status} board={board} boardClass="bingo-wrap"
      overlay={<RoomResult t={t} room={room} L={L} score={null} detail={room.detail ? t.bingoWonBy(room.names[room.winner] || '', room.called.length) : ''} />}
    >
      <RoomControls t={t} lang={lang} L={L}>
        {speechSupported() && <button className={`btn${voiceOn ? ' on' : ''}`} aria-pressed={voiceOn} onClick={toggleVoice}>{voiceOn ? '🔊' : '🔇'} {voiceOn ? (t.voiceOn || 'Voice on') : (t.voiceOff || 'Voice off')}</button>}
      </RoomControls>
    </MatchFrame>
  );
}
