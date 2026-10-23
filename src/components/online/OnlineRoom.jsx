'use client';
import React, { useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db, apiCall } from '@/lib/firebase';
import { setSaved } from './useMatch';
import GebetaOnline from './GebetaOnline';
import CheckersOnline from '../checkers/CheckersOnline';
import DominoesOnline from '../dominoes/DominoesOnline';

const BODIES = { gebeta: GebetaOnline, checkers: CheckersOnline, dominoes: DominoesOnline };

/** Loads a room, shows the waiting screen, then hands over to the game-specific online view. */
export default function OnlineRoom({ t, lang, uid, code, onExit, onSwitchRoom, confirm }) {
  const [room, setRoom] = useState(null);
  const [missing, setMissing] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setSaved(code);
    const unsub = onSnapshot(doc(db, 'gebetaRooms', code), (snap) => {
      if (!snap.exists()) { setMissing(true); return; }
      setRoom(snap.data());
    }, () => setMissing(true));
    return () => unsub();
  }, [code]);

  const copy = async () => { try { await navigator.clipboard.writeText(code); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch {} };
  const cancelWaiting = async () => { try { await apiCall({ action: 'cancel', code }); } catch {} setSaved(null); onExit(); };

  if (missing) return <div className="panel center"><p>{t.moveFailed}</p><button className="btn primary" onClick={() => { setSaved(null); onExit(); }}>{t.backHome}</button></div>;
  if (!room) return <div className="boot"><div className="boot-seed" /></div>;

  if (room.status === 'waiting') {
    const game = room.game || 'gebeta';
    return (
      <div className="panel center wait">
        <div className="wait-seeds"><i /><i /><i /></div>
        <p className="lead">{t.waiting}</p>
        <p className="muted">{t[`${game}Name`]} · {t.rs[game][room.ruleset]?.[0]}{game === 'dominoes' ? ` · ${t.playTo(room.options?.target ?? room.target)}` : ''}</p>
        {!room.public && <>
          <p className="muted">{t.shareCode}</p>
          <div className="code" aria-label="Room code">{code}</div>
          <button className="btn" onClick={copy}>{copied ? t.copied : t.copy}</button>
        </>}
        <button className="btn ghost" onClick={cancelWaiting}>{t.cancelSearch}</button>
      </div>
    );
  }

  const Body = BODIES[room.game || 'gebeta'] || GebetaOnline;
  return <Body t={t} lang={lang} room={room} uid={uid} code={code} onExit={onExit} onSwitchRoom={onSwitchRoom} confirm={confirm} />;
}
