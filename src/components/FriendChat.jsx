'use client';
// One-to-one chat with a friend, Telegram style (v98): replies, edit, delete for both, reactions, read ticks, "typing…",
// pin / mute / rename / block from the ⋮ menu. All writes go through /api/gebeta; the chat document is read live (useSocial).
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { apiCall, serverNow } from '@/lib/firebase';
import { EMOTES, heroById } from '@/lib/i18n';
import { REACTIONS, MAX_TEXT, isSeen, isTyping, EDIT_MS } from '@/lib/social';

export function Avatar({ id, size = 44 }) {
  const h = heroById(id);
  return <span className="hero fx-hero" style={{ background: h.color, width: size, height: size, fontSize: size * 0.55 }} aria-hidden="true">{h.glyph}</span>;
}

const locale = (lang) => (lang === 'am' ? 'am-ET' : undefined);
export const clock = (at, lang) => new Date(at).toLocaleTimeString(locale(lang), { hour: '2-digit', minute: '2-digit' });
const dayKey = (at) => { const d = new Date(at); return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`; };
const dayLabel = (t, lang, at, now) => {
  if (dayKey(at) === dayKey(now)) return t.fxToday;
  if (dayKey(at) === dayKey(now - 864e5)) return t.fxYesterday;
  return new Date(at).toLocaleDateString(locale(lang), { day: 'numeric', month: 'short', year: new Date(at).getFullYear() === new Date(now).getFullYear() ? undefined : 'numeric' });
};

/** "online", "last seen 5 min ago", "last seen recently"… from a presence view ({ kind, n?, at? }). */
export function seenText(t, lang, view) {
  switch (view?.kind) {
    case 'online': return t.frOnline;
    case 'just': return t.fxSeenJust;
    case 'min': return t.fxSeenMin(view.n);
    case 'today': return t.fxSeenToday(clock(view.at, lang));
    case 'yesterday': return t.fxSeenYesterday(clock(view.at, lang));
    case 'days': return t.fxSeenDays(view.n);
    case 'recent': return t.fxSeenRecent;
    case 'week': return t.fxSeenWeek;
    case 'month': return t.fxSeenMonth;
    default: return view ? t.fxSeenLong : t.frOffline;
  }
}

function Sheet({ label, onClose, children }) {
  return (
    <div className="overlay fx-sheet-bg" role="dialog" aria-modal="true" aria-label={label} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="fx-sheet">{children}</div>
    </div>
  );
}

export default function FriendChat({ t, lang, uid, friend, name, chat, view, pinned, muted, onBack, onInvite, onChanged }) {
  const [text, setText] = useState(''); const [busy, setBusy] = useState(false); const [err, setErr] = useState('');
  const [pick, setPick] = useState(null);       // message whose action sheet is open
  const [reply, setReply] = useState(null);     // message being answered
  const [editing, setEditing] = useState(null); // message being edited
  const [menu, setMenu] = useState(false);
  const [ask, setAsk] = useState(null);         // 'block' | 'remove' | 'rename'
  const [nick, setNick] = useState('');
  const [toast, setToast] = useState('');
  const end = useRef(null); const lastTyping = useRef(0); const input = useRef(null);
  const msgs = chat?.msgs || [];
  const unread = chat?.unread?.[uid] || 0;
  const now = serverNow();
  const typing = isTyping(chat, friend.id, now);
  const online = view?.kind === 'online';

  useEffect(() => { end.current?.scrollIntoView?.({ block: 'end' }); }, [msgs.length, typing]);
  useEffect(() => { if (unread > 0) apiCall({ action: 'chatRead', to: friend.id }, { retries: 0 }).catch(() => {}); }, [unread, friend.id, msgs.length]);
  const flash = (m) => { setToast(m); setTimeout(() => setToast(''), 1600); };

  const run = async (body, done) => {
    setBusy(true); setErr('');
    try { const r = await apiCall(body); done?.(r); return r; } catch (e) { setErr(e.message); return null; } finally { setBusy(false); }
  };

  const send = async (value) => {
    const v = (value ?? text).trim(); if (!v || busy) return;
    if (editing) {
      const r = await run({ action: 'chatEdit', to: friend.id, id: editing.id, text: v });
      if (r) { setEditing(null); setText(''); }
      return;
    }
    const r = await run({ action: 'chatSend', to: friend.id, text: v, replyTo: reply?.id });
    if (r) { if (value === undefined) setText(''); setReply(null); }
  };
  const onType = (v) => {
    setText(v.slice(0, MAX_TEXT));
    const t0 = Date.now();
    if (v && !editing && t0 - lastTyping.current > 4000) { lastTyping.current = t0; apiCall({ action: 'chatTyping', to: friend.id }, { retries: 0 }).catch(() => {}); }
  };

  const days = useMemo(() => {
    const out = []; let last = '';
    msgs.forEach((m, i) => { const k = dayKey(m.at); if (k !== last) { out.push({ sep: dayLabel(t, lang, m.at, now), key: `d${k}` }); last = k; } out.push({ m, key: m.id || `${m.at}-${i}` }); });
    return out;
  }, [msgs, lang, t]);   // eslint-disable-line react-hooks/exhaustive-deps

  const mine = pick && pick.from === uid;
  const canEdit = mine && pick.id && serverNow() - pick.at < EDIT_MS;
  const act = {
    reply: () => { setReply(pick); setEditing(null); setPick(null); input.current?.focus(); },
    copy: async () => { try { await navigator.clipboard.writeText(pick.text); flash(t.fxCopied); } catch { /* clipboard unavailable */ } setPick(null); },
    edit: () => { setEditing(pick); setReply(null); setText(pick.text); setPick(null); input.current?.focus(); },
    del: async () => { const id = pick.id; setPick(null); await run({ action: 'chatDelete', to: friend.id, id }); },
    react: async (emoji) => { const id = pick.id; setPick(null); await run({ action: 'chatReact', to: friend.id, id, emoji }); },
  };
  const setFlag = async (body) => { setMenu(false); await run({ action: 'friendSet', to: friend.id, ...body }); };

  return (
    <div className="panel fx-chat">
      <header className="fx-chat-head">
        <button className="icon-btn" onClick={onBack} aria-label={t.backHome}>‹</button>
        <span className="fx-av"><Avatar id={friend.avatar} size={40} /><i className={`dot${online ? ' on' : ''}`} /></span>
        <span className="fx-who">
          <b>{name}</b>
          <small className={typing ? 'typing' : online ? 'on' : ''}>{typing ? t.fxTyping : seenText(t, lang, view)}</small>
        </span>
        <button className="icon-btn fx-play" onClick={onInvite} aria-label={t.inviteToPlay}>🎮</button>
        <button className="icon-btn" onClick={() => setMenu(true)} aria-label={t.fxMore} aria-haspopup="menu">⋮</button>
      </header>

      <div className="fx-msgs" role="log" aria-live="polite">
        {msgs.length === 0 && <p className="muted center-text">{t.chatEmpty}</p>}
        {days.map((row) => row.sep
          ? <div key={row.key} className="fx-day"><span>{row.sep}</span></div>
          : (
            <div key={row.key} className={`fx-row${row.m.from === uid ? ' me' : ''}`}>
              <button className="fx-bubble" onClick={() => row.m.id && setPick(row.m)} aria-label={row.m.text}>
                {row.m.re && <span className="fx-quote"><b>{row.m.re.from === uid ? t.fxYou : name}</b>{row.m.re.text}</span>}
                <span className="fx-text">{row.m.text}</span>
                <span className="fx-meta">
                  {row.m.ed ? <em>{t.fxEdited}</em> : null}
                  <time>{clock(row.m.at, lang)}</time>
                  {row.m.from === uid && <i className={`tick${isSeen(chat, row.m, friend.id) ? ' seen' : ''}`} aria-hidden="true">{isSeen(chat, row.m, friend.id) ? '✓✓' : '✓'}</i>}
                </span>
              </button>
              {row.m.rx && <span className="fx-rx">{Object.entries(Object.values(row.m.rx).reduce((a, e) => ({ ...a, [e]: (a[e] || 0) + 1 }), {})).map(([e, n]) => <em key={e}>{e}{n > 1 ? n : ''}</em>)}</span>}
            </div>
          ))}
        {typing && <div className="fx-row"><span className="fx-bubble fx-dots" aria-label={t.fxTyping}><i /><i /><i /></span></div>}
        <div ref={end} />
      </div>

      {toast && <p className="fx-toast" role="status">{toast}</p>}
      <div className="emote-row fx-quick">{EMOTES.map((e) => <button key={e.id} className="chip" onClick={() => send(e[lang] || e.en)}>{e[lang] || e.en}</button>)}</div>

      {(reply || editing) && (
        <div className="fx-compose-bar">
          <span><b>{editing ? t.fxEditing : `${t.fxReply} · ${reply.from === uid ? t.fxYou : name}`}</b><small>{(editing || reply).text.slice(0, 80)}</small></span>
          <button className="icon-btn sm" onClick={() => { setReply(null); setEditing(null); setText(''); }} aria-label={t.cancel}>✕</button>
        </div>
      )}
      <form className="fx-compose" onSubmit={(e) => { e.preventDefault(); send(); }}>
        <input ref={input} value={text} onChange={(e) => onType(e.target.value)} placeholder={t.chatWrite} aria-label={t.chatWrite} maxLength={MAX_TEXT} autoComplete="off" />
        <button className="fx-send" disabled={busy || !text.trim()} aria-label={t.chatSend}>{editing ? '✓' : '➤'}</button>
      </form>
      {err && <p className="err" role="alert">{err}</p>}

      {pick && (
        <Sheet label={t.chat} onClose={() => setPick(null)}>
          <div className="fx-react">{REACTIONS.map((e) => <button key={e} className={pick.rx?.[uid] === e ? 'on' : ''} onClick={() => act.react(e)} aria-label={e}>{e}</button>)}</div>
          <button className="fx-item" onClick={act.reply}>↩ {t.fxReply}</button>
          <button className="fx-item" onClick={act.copy}>⧉ {t.fxCopy}</button>
          {canEdit && <button className="fx-item" onClick={act.edit}>✎ {t.fxEdit}</button>}
          {mine && <button className="fx-item danger" onClick={act.del}>🗑 {t.fxDeleteBoth}</button>}
        </Sheet>
      )}

      {menu && (
        <Sheet label={t.fxMore} onClose={() => setMenu(false)}>
          <button className="fx-item" onClick={() => setFlag({ pin: !pinned })}>📌 {pinned ? t.fxUnpin : t.fxPin}</button>
          <button className="fx-item" onClick={() => setFlag({ mute: !muted })}>{muted ? '🔔' : '🔕'} {muted ? t.fxUnmute : t.fxMute}</button>
          <button className="fx-item" onClick={() => { setMenu(false); setNick(name); setAsk('rename'); }}>✎ {t.fxRename}</button>
          <button className="fx-item" onClick={() => { setMenu(false); onInvite(); }}>🎮 {t.inviteToPlay}</button>
          <button className="fx-item danger" onClick={() => { setMenu(false); setAsk('remove'); }}>👋 {t.frRemove}</button>
          <button className="fx-item danger" onClick={() => { setMenu(false); setAsk('block'); }}>⛔ {t.fxBlock}</button>
        </Sheet>
      )}

      {ask && (
        <Sheet label={t.fxMore} onClose={() => setAsk(null)}>
          {ask === 'rename' ? (
            <form className="fx-form" onSubmit={async (e) => { e.preventDefault(); setAsk(null); await run({ action: 'friendSet', to: friend.id, nick: nick.trim() === friend.name ? '' : nick }); }}>
              <b>{t.fxRename}</b><small>{t.fxRenameHint}</small>
              <input value={nick} onChange={(e) => setNick(e.target.value.slice(0, 20))} aria-label={t.fxRename} autoFocus />
              <button className="btn primary">{t.fxSave}</button>
            </form>
          ) : (
            <div className="fx-form">
              <b>{ask === 'block' ? t.fxBlockConfirm(name) : t.frRemoveConfirm(name)}</b>
              <div className="result-actions">
                <button className="btn" onClick={() => setAsk(null)}>{t.cancel}</button>
                <button className="btn primary danger" onClick={async () => { const a = ask; setAsk(null); const r = await run({ action: a === 'block' ? 'friendBlock' : 'friendRemove', to: friend.id }); if (r) { onChanged?.(); onBack(); } }}>{ask === 'block' ? t.fxBlock : t.frRemove}</button>
              </div>
            </div>
          )}
        </Sheet>
      )}
    </div>
  );
}
