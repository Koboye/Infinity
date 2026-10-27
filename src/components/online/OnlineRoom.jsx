'use client';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db, apiCall, serverNow } from '@/lib/firebase';
import { setSaved } from './useMatch';
import GebetaOnline from './GebetaOnline';
import CheckersOnline from '../checkers/CheckersOnline';
import DominoesOnline from '../dominoes/DominoesOnline';
import BingoOnline from '../bingo/BingoOnline';
import SpinOverlay from '../SpinOverlay';
import { InviteFriendsRow } from '../Friends';

const BODIES = { gebeta: GebetaOnline, checkers: CheckersOnline, dominoes: DominoesOnline, bingo: BingoOnline };
const WAIT_LIMIT_S = 120;   // same as the server's WAIT_MS: after this nobody can join any more
const HINT_AFTER_S = 20;    // after this the waiting screen offers to play the computer meanwhile

export const inviteUrl = (code) => { try { const u = new URL(window.location.href); u.search = ''; u.hash = ''; u.searchParams.set('room', code); return u.toString(); } catch { return code; } };

/** Online connection state: browser online/offline events. */
function useOnline() {
  const [on, setOn] = useState(true);
  useEffect(() => {
    const up = () => setOn(true), down = () => setOn(false);
    setOn(navigator.onLine !== false);
    window.addEventListener('online', up); window.addEventListener('offline', down);
    return () => { window.removeEventListener('online', up); window.removeEventListener('offline', down); };
  }, []);
  return on;
}

/** Loads a room, shows the waiting screen, then hands over to the game-specific online view. */
import { StakeLine } from '../Wallet';
export default function OnlineRoom({ t, lang, uid, friends, code, onExit, onSwitchRoom, confirm }) {
  const [room, setRoom] = useState(null);
  const [missing, setMissing] = useState(false);
  const [copied, setCopied] = useState('');
  const [spun, setSpun] = useState(false);
  const [waited, setWaited] = useState(0);
  const [tick, setTick] = useState(serverNow());
  const online = useOnline();
  const retry = useRef(0);

  // Live room. A dropped connection must never throw the player out: retry with back-off; only a deleted room is "missing".
  useEffect(() => {
    setSaved(code); retry.current = 0;
    let unsub = () => {}, timer = null, dead = false;
    const listen = () => {
      unsub = onSnapshot(doc(db, 'gebetaRooms', code), (snap) => {
        retry.current = 0;
        if (!snap.exists()) { setMissing(true); return; }
        setMissing(false); setRoom(snap.data());
      }, () => {
        unsub();
        if (dead) return;
        if (++retry.current > 6) { setMissing(true); return; }
        timer = setTimeout(listen, Math.min(8000, 700 * 2 ** retry.current));
      });
    };
    listen();
    return () => { dead = true; clearTimeout(timer); unsub(); };
  }, [code]);

  useEffect(() => { const id = setInterval(() => setTick(serverNow()), 1000); return () => clearInterval(id); }, []);

  // Waiting room: heartbeat (so quick match never pairs somebody with a ghost) + a visible wait counter.
  const waiting = room?.status === 'waiting';
  useEffect(() => {
    if (!waiting) return undefined;
    setWaited(0);
    const ping = () => apiCall({ action: 'ping', code }, { retries: 0 }).catch(() => {});
    ping(); const idP = setInterval(ping, 15000);
    const idW = setInterval(() => setWaited((w) => w + 1), 1000);
    return () => { clearInterval(idP); clearInterval(idW); };
  }, [waiting, code]);

  const cancelWaiting = useCallback(async () => { try { await apiCall({ action: 'cancel', code }, { retries: 0 }); } catch { /* the room expires by itself */ } setSaved(null); onExit(); }, [code, onExit]);
  useEffect(() => { if (waiting && room?.public && waited >= WAIT_LIMIT_S) cancelWaiting(); }, [waiting, waited, room?.public, cancelWaiting]);

  const copy = async (text, what) => { try { await navigator.clipboard.writeText(text); setCopied(what); setTimeout(() => setCopied(''), 1600); } catch { /* clipboard blocked */ } };
  const share = async () => {
    const game = room?.game || 'gebeta', url = inviteUrl(code), text = t.inviteText(t[`${game}Name`] || game, code);
    try { if (navigator.share) { await navigator.share({ title: 'Infinity', text, url }); return; } } catch (e) { if (e?.name === 'AbortError') return; }
    copy(`${text} ${url}`, 'link');
  };

  if (missing) return <div className="panel center"><p>{t.roomGone}</p><button className="btn primary" onClick={() => { setSaved(null); onExit(); }}>{t.backHome}</button></div>;
  if (!room) return <div className="boot"><div className="boot-seed" />{!online && <p className="muted">{t.reconnecting}</p>}</div>;

  const banner = !online ? t.reconnecting : null;
  const seat = room.players.indexOf(uid);
  const oppSeen = room.seen?.[1 - seat];
  const oppAway = room.status === 'playing' && !!oppSeen && tick - oppSeen > 50000;
  const Banner = (banner || oppAway) ? <div className={`net-banner${banner ? ' bad' : ''}`} role="status">{banner || t.oppAway}</div> : null;

  if (room.status === 'waiting') {
    const game = room.game || 'gebeta';
    const left = Math.max(0, WAIT_LIMIT_S - waited);
    return (
      <div className="panel center wait">
        {Banner}
        <div className="wait-seeds"><i /><i /><i /></div>
        <p className="lead">{waited >= HINT_AFTER_S ? t.waitingLong : t.waiting}</p>
        <StakeLine lang={lang} fee={Number(room.fee) || 0} />
        <p className="muted">{t[`${game}Name`]} · {t.rs[game][room.ruleset]?.[0]}{game === 'dominoes' ? ` · ${t.playTo(room.options?.target ?? room.target)}` : ''}</p>
        {room.public && <p className="muted wait-count">{`${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`}</p>}
        {!room.public && <>
          <p className="muted">{t.shareCode}</p>
          <div className="code" aria-label="Room code">{code}</div>
          <div className="wait-actions">
            <button className="btn primary" onClick={share}>{copied === 'link' ? t.linkCopied : `📨 ${t.shareInvite}`}</button>
            <button className="btn" onClick={() => copy(code, 'code')}>{copied === 'code' ? t.copied : t.copy}</button>
          </div>
          <InviteFriendsRow t={t} code={code} friends={friends} />
        </>}
        {waited >= HINT_AFTER_S && <button className="btn" onClick={cancelWaiting}>🤖 {t.playComputerMeanwhile}</button>}
        <button className="btn ghost" onClick={cancelWaiting}>{t.cancelSearch}</button>
      </div>
    );
  }

  const Body = BODIES[room.game || 'gebeta'] || GebetaOnline;
  // First game of a pairing (not a rematch): both players watch the spin that the server's lottery already decided.
  const wantsSpin = room.game !== 'bingo' && !spun && room.status === 'playing' && (room.moveSeq || 0) === 0 && !(room.options && room.options.avoid) && room.names && room.names.length === 2;
  return (
    <>
      {Banner}
      <Body t={t} lang={lang} room={room} uid={uid} code={code} onExit={onExit} onSwitchRoom={onSwitchRoom} confirm={confirm} />
      {wantsSpin && <SpinOverlay t={t} names={room.names} winner={room.turn === 1 ? 1 : 0} onDone={() => setSpun(true)} />}
    </>
  );
}
