'use client';
import React, { useEffect, useRef, useState } from 'react';
import { EMOTES } from '@/lib/i18n';
import ResultOverlay from '../ResultOverlay';

/** Free-text chat between the two players (v73): collapsed to one button, with a badge for what the opponent said while it was closed. */
function RoomChat({ t, L }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [read, setRead] = useState(() => (L.chat || []).length);
  const end = useRef(null);
  const msgs = L.chat || [];
  const fresh = msgs.slice(read).filter((m) => m.by !== L.seat).length;
  useEffect(() => { if (open) { setRead(msgs.length); end.current?.scrollIntoView?.({ block: 'end' }); } }, [open, msgs.length]);
  const send = (e) => { e.preventDefault(); const v = text.trim(); if (!v) return; L.sendChat(v); setText(''); };
  return (
    <div className="room-chat">
      <button className="btn" onClick={() => setOpen((o) => !o)} aria-expanded={open}>💬 {t.chat}{!open && fresh > 0 && <em className="badge inline">{fresh > 9 ? '9+' : fresh}</em>}</button>
      {open && (
        <div className="room-chat-box">
          <div className="fr-msgs" role="log" aria-live="polite">
            {msgs.length === 0 && <p className="muted center-text">{t.chatEmpty}</p>}
            {msgs.slice(-12).map((m, i) => <div key={`${m.at}-${i}`} className={`bubble${m.by === L.seat ? ' me' : ''}`}><span>{m.text}</span></div>)}
            <div ref={end} />
          </div>
          <form className="joinrow" onSubmit={send}>
            <input value={text} onChange={(e) => setText(e.target.value.slice(0, 120))} placeholder={t.roomChatHint} aria-label={t.roomChat} maxLength={120} autoComplete="off" />
            <button className="btn primary" disabled={!text.trim()}>{t.roomChatSend}</button>
          </form>
        </div>
      )}
    </div>
  );
}

/** Emote chips + chat + resign (+ game specific controls passed as children). */
export function RoomControls({ t, lang, L, children }) {
  if (!L.playing) return null;
  return (
    <>
      <div className="emote-row">
        {EMOTES.map((e) => <button key={e.id} className="chip" onClick={() => L.sendEmote(e.id)}>{e[lang] || e.en}</button>)}
      </div>
      <div className="match-actions">
        {children}
        <RoomChat t={t} L={L} />
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
    <ResultOverlay title={title} tone={tone} sub={sub} score={score} taunt={taunt} coins={room.fee > 0 ? room.coinChange?.[L.seat] : undefined}>
      <button className="btn primary" onClick={L.rematch}>{room.rematch ? t.joinRematch : t.rematch}</button>
      <button className="btn" onClick={L.exit}>{t.backHome}</button>
    </ResultOverlay>
  );
}
