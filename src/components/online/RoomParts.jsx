'use client';
import React from 'react';
import { EMOTES } from '@/lib/i18n';
import ResultOverlay from '../ResultOverlay';

/** Emote chips + resign (+ game specific controls passed as children). */
export function RoomControls({ t, lang, L, children }) {
  if (!L.playing) return null;
  return (
    <>
      <div className="emote-row">
        {EMOTES.map((e) => <button key={e.id} className="chip" onClick={() => L.sendEmote(e.id)}>{e[lang] || e.en}</button>)}
      </div>
      <div className="match-actions">
        {children}
        <button className="btn ghost danger" onClick={L.resign}>{t.resign}</button>
      </div>
    </>
  );
}

/** End-of-match overlay with rating change, reason and rematch. */
export function RoomResult({ t, room, L, score, detail, taunt = null }) {
  if (!L.finished) return null;
  const mine = room.winner === L.seat;
  const reasonText = room.reason === 'resigned' ? (mine ? t.byResign : t.youResigned)
    : room.reason === 'timeout' ? (mine ? t.oppLeft : t.youTimedOut) : (detail || '');
  const delta = room.ratingChange?.[L.seat];
  const sub = [reasonText, Number.isFinite(delta) ? `${t.rating} ${delta >= 0 ? '+' : ''}${delta}` : ''].filter(Boolean).join(' · ');
  const title = room.winner === 'draw' ? t.draw : mine ? t.youWin : t.youLose;
  const tone = room.winner === 'draw' ? 'draw' : mine ? 'win' : 'lose';
  return (
    <ResultOverlay title={title} tone={tone} sub={sub} score={score} taunt={taunt}>
      <button className="btn primary" onClick={L.rematch}>{room.rematch ? t.joinRematch : t.rematch}</button>
      <button className="btn" onClick={L.exit}>{t.backHome}</button>
    </ResultOverlay>
  );
}
