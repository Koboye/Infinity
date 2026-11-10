'use client';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { apiCall, serverNow } from '@/lib/firebase';
import { heroById } from '@/lib/i18n';
import { GAMES } from '@/lib/games.js';
import { isOnline, isTyping, lastSeenParts, normalizeFriendCode, pairId, REACTIONS } from '@/lib/social';
import { GameIcon } from './GameIcons';

const ONLINE_GAMES = Object.values(GAMES).filter((g) => !g.offlineOnly && !g.comingSoon);
const shareOrCopy = async (text, url) => {
  try { if (navigator.share) { await navigator.share({ title: 'Afro Zone', text, url }); return 'shared'; } } catch (e) { if (e?.name === 'AbortError') return 'cancelled'; }
  try { await navigator.clipboard.writeText(url ? `${text} ${url}` : text); return 'copied'; } catch { return 'failed'; }
};
const siteUrl = (params = {}) => { try { const u = new URL(window.location.href); u.search = ''; u.hash = ''; for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v); return u.toString(); } catch { return ''; } };
export const friendLink = (code) => siteUrl({ friend: code });

const hhmm = (at) => new Date(at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
const dayKey = (at) => new Date(at).toDateString();
function listTime(at, t, now = Date.now()) {
  if (!at) return '';
  const d = new Date(at), n = new Date(now);
  if (d.toDateString() === n.toDateString()) return hhmm(at);
  if (now - at < 6 * 86400000) return d.toLocaleDateString([], { weekday: 'short' });
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}
function seenText(t, at) {
  const [k, n] = lastSeenParts(at, serverNow());
  return k === 'now' ? t.frOnline : k === 'min' ? t.seenMin(n) : k === 'hour' ? t.seenHour(n) : k === 'day' ? t.seenDay(n) : t.seenLong;
}
const previewOf = (t, uid, m) => (!m ? '' : m.deleted ? t.deletedMsg : `${m.from === uid ? t.youPrefix : ''}${m.text}`);

function Avatar({ id, size = 44 }) {
  const h = heroById(id);
  return <span className="hero" style={{ background: h.color, width: size, height: size, fontSize: size * 0.55 }} aria-hidden="true">{h.glyph}</span>;
}
/** ✓ sent · ✓✓ read (the other person opened the chat after it was sent). */
function Ticks({ read }) { return <span className={`tg-ticks${read ? ' read' : ''}`} aria-label={read ? 'read' : 'sent'}>{read ? '✓✓' : '✓'}</span>; }

/** Friends hub: chat list (pinned first, last line, ticks, unread), requests, add by code or by name, my friend code. */
export default function FriendsScreen({ t, lang, uid, social, onEnterRoom, openChat, onOpenChat }) {
  const { friends, chats, seen = {} } = social;
  const [tab, setTab] = useState('chats');
  const [myCode, setMyCode] = useState(null);
  const [code, setCode] = useState('');
  const [q, setQ] = useState('');
  const [found, setFound] = useState(null);       // name-search results from the server
  const [note, setNote] = useState(''); const [err, setErr] = useState(''); const [busy, setBusy] = useState(false);
  const [inviting, setInviting] = useState(null); // friend uid while the "which game" sheet is open
  const list = useMemo(() => Object.entries(friends?.list || {}).map(([id, c]) => ({ id, ...c })), [friends]);
  const incoming = useMemo(() => Object.entries(friends?.incoming || {}).map(([id, c]) => ({ id, ...c })), [friends]);
  const outgoing = useMemo(() => Object.entries(friends?.outgoing || {}).map(([id, c]) => ({ id, ...c })), [friends]);
  const pins = friends?.pins || [];
  const chatOf = (fid) => chats.find((c) => c.id === pairId(uid, fid));

  const call = useCallback(async (body, ok) => {
    setBusy(true); setErr(''); setNote('');
    try { const r = await apiCall(body); ok?.(r); social.refresh?.(); return r; } catch (e) { setErr(e.message); return null; } finally { setBusy(false); }
  }, [social]);

  useEffect(() => { let live = true; apiCall({ action: 'friendCode' }).then((r) => live && setMyCode(r.code)).catch(() => {}); return () => { live = false; }; }, []);

  // the chat list: pinned on top, then the most recent conversation
  const rows = useMemo(() => {
    const term = q.trim().toLowerCase();
    return list.filter((f) => !term || f.name.toLowerCase().includes(term)).map((f) => {
      const c = chatOf(f.id); const last = c?.msgs?.at(-1);
      return { ...f, last, at: last?.at || 0, unread: c?.unread?.[uid] || 0, pinned: pins.includes(f.id), chat: c };
    }).sort((a, b) => (b.pinned - a.pinned) || (b.at - a.at) || a.name.localeCompare(b.name));
  }, [list, chats, q, pins, uid]);   // eslint-disable-line react-hooks/exhaustive-deps

  // typing in the search box finds other players by name (after a short pause)
  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) { setFound(null); return undefined; }
    let live = true;
    const id = setTimeout(() => { apiCall({ action: 'friendSearch', q: term }, { retries: 0 }).then((r) => live && setFound(r.players || [])).catch(() => live && setFound([])); }, 350);
    return () => { live = false; clearTimeout(id); };
  }, [q]);

  const addByCode = async (e) => {
    e?.preventDefault();
    const c = normalizeFriendCode(code); if (c.length !== 6) return;
    const r = await call({ action: 'friendRequest', friendCode: c });
    if (!r) return;
    setCode('');
    setNote(r.result === 'accepted' ? t.frNow(r.name) : r.result === 'already' ? t.frAlready : r.result === 'pending' ? t.frPending : t.frSent(r.name));
  };
  const addPlayer = async (p) => {
    const r = await call({ action: 'friendRequest', to: p.uid });
    if (!r) return;
    setFound((f) => (f || []).map((x) => (x.uid === p.uid ? { ...x, status: r.result === 'accepted' ? 'friend' : 'sent' } : x)));
    setNote(r.result === 'accepted' ? t.frNow(r.name) : t.frSent(r.name));
  };
  const shareCode = async () => {
    const how = await shareOrCopy(t.addMeText(myCode), friendLink(myCode));
    if (how === 'copied') { setNote(t.codeCopied); setTimeout(() => setNote(''), 1800); }
  };
  const invite = async (friend, game, ruleset) => {
    const r = await call({ action: 'friendInvite', to: friend.id, game, ruleset, fee: 0 });
    if (r?.code) { setInviting(null); onEnterRoom(r.code); }
  };

  const chatFriend = openChat ? list.find((f) => f.id === openChat) : null;
  if (chatFriend) return <FriendChat t={t} lang={lang} uid={uid} friend={chatFriend} chat={chatOf(chatFriend.id)} seenAt={seen[chatFriend.id]} social={social}
    onBack={() => onOpenChat(null)} onInvite={() => setInviting(chatFriend.id)}
    onUnfriend={async () => { if (window.confirm(t.frRemoveConfirm(chatFriend.name))) { await call({ action: 'friendRemove', to: chatFriend.id }); onOpenChat(null); } }}
    sheet={inviting === chatFriend.id ? <InviteSheet t={t} friend={chatFriend} busy={busy} onClose={() => setInviting(null)} onPick={(g, rs) => invite(chatFriend, g, rs)} /> : null} />;

  const strangers = (found || []).filter((p) => p.status !== 'friend');
  return (
    <div className="panel tg-screen">
      <div className="tg-search">
        <span aria-hidden="true">🔍</span>
        <input value={q} onChange={(e) => setQ(e.target.value.slice(0, 20))} placeholder={t.searchChats} aria-label={t.searchChats} autoComplete="off" />
        {q && <button className="icon-btn" aria-label="clear" onClick={() => setQ('')}>✕</button>}
      </div>

      <div className="seg tg-tabs" role="tablist">
        {[['chats', `${t.chats}${social.badge ? '' : ''}`], ['requests', `${t.frRequests}${incoming.length ? ` · ${incoming.length}` : ''}`], ['add', t.addFriend]].map(([id, label]) => (
          <button key={id} role="tab" aria-selected={tab === id} className={tab === id ? 'on' : ''} onClick={() => { setTab(id); setErr(''); setNote(''); }}>{label}</button>
        ))}
      </div>

      {tab === 'chats' && (
        <>
          {list.length === 0 && !q && <p className="muted center-text">{t.frNone}</p>}
          {q && rows.length === 0 && strangers.length === 0 && <p className="muted center-text">{t.noMatches}</p>}
          <ul className="tg-list">
            {rows.map((f) => {
              const on = isOnline(seen[f.id], serverNow()); const typing = isTyping(f.chat, f.id, serverNow());
              const mineLast = f.last && f.last.from === uid && !f.last.deleted;
              return (
                <li key={f.id} className={`tg-row${f.unread ? ' unread' : ''}`}>
                  <button className="tg-open" onClick={() => onOpenChat(f.id)} aria-label={`${t.chat}: ${f.name}`}>
                    <span className="tg-av"><Avatar id={f.avatar} size={52} /><i className={`dot${on ? ' on' : ''}`} title={on ? t.frOnline : t.frOffline} /></span>
                    <span className="tg-mid">
                      <b className="tg-name">{f.pinned && <span className="tg-pin" aria-hidden="true">📌</span>}{f.name}</b>
                      <small className={`tg-last${typing ? ' typing' : ''}`}>{typing ? t.typing : f.last ? previewOf(t, uid, f.last) : on ? t.frOnline : seenText(t, seen[f.id])}</small>
                    </span>
                    <span className="tg-end">
                      <small className="tg-time">{mineLast && <Ticks read={(f.chat?.readAt?.[f.id] || 0) >= f.last.at} />}{listTime(f.at, t, serverNow())}</small>
                      {f.unread > 0 && <em className="badge tg-badge">{f.unread > 99 ? '99+' : f.unread}</em>}
                    </span>
                  </button>
                  <span className="tg-quick">
                    <button className="icon-btn" aria-label={`${f.pinned ? t.unpinChat : t.pinChat}: ${f.name}`} onClick={() => call({ action: 'friendPin', to: f.id })}>{f.pinned ? '📍' : '📌'}</button>
                    <button className="icon-btn gold" aria-label={`${t.inviteToPlay}: ${f.name}`} onClick={() => setInviting(f.id)}>🎮</button>
                  </span>
                </li>
              );
            })}
          </ul>
          {q.trim().length >= 2 && (
            <div className="tg-found">
              <span className="fr-label">{t.findPlayers}</span>
              {found === null && <p className="muted small">…</p>}
              {strangers.map((p) => (
                <div key={p.uid} className="fr-row">
                  <span className="fr-av"><Avatar id={p.avatar} /></span>
                  <span className="fr-name"><b>{p.name}</b><small>{p.status === 'sent' ? t.statusSent : p.status === 'incoming' ? t.statusIncoming : ''}</small></span>
                  <button className="btn primary sm" disabled={busy || p.status === 'sent'} onClick={() => addPlayer(p)}>{p.status === 'incoming' ? t.frAccept : p.status === 'sent' ? '✓' : t.addFriend}</button>
                </div>
              ))}
              {found && strangers.length === 0 && <p className="muted small">{t.noMatches}</p>}
            </div>
          )}
        </>
      )}

      {tab === 'requests' && (
        <div className="fr-reqs">
          {incoming.length === 0 && outgoing.length === 0 && <p className="muted center-text">{t.frNoRequests}</p>}
          {incoming.map((r) => (
            <div key={r.id} className="fr-row">
              <span className="fr-av"><Avatar id={r.avatar} /></span>
              <span className="fr-name"><b>{r.name}</b></span>
              <button className="btn primary sm" disabled={busy} onClick={() => call({ action: 'friendAccept', to: r.id })}>{t.frAccept}</button>
              <button className="btn ghost sm" disabled={busy} onClick={() => call({ action: 'friendDecline', to: r.id })}>{t.frDecline}</button>
            </div>
          ))}
          {outgoing.map((r) => (
            <div key={r.id} className="fr-row">
              <span className="fr-av"><Avatar id={r.avatar} /></span>
              <span className="fr-name"><b>{r.name}</b><small>{t.frWaitingFor}</small></span>
              <button className="btn ghost sm" disabled={busy} onClick={() => call({ action: 'friendRemove', to: r.id })}>{t.frCancel}</button>
            </div>
          ))}
        </div>
      )}

      {tab === 'add' && (
        <div className="tg-add">
          <div className="fr-mine">
            <span className="fr-label">{t.myFriendCode}</span>
            <div className="code fr-code" aria-label={t.myFriendCode}>{myCode || '······'}</div>
            <p className="muted small">{t.friendCodeHint}</p>
            <button className="btn primary wide" onClick={shareCode} disabled={!myCode}>📨 {t.shareMyCode}</button>
          </div>
          <form className="joinrow" onSubmit={addByCode}>
            <input value={code} onChange={(e) => setCode(normalizeFriendCode(e.target.value))} placeholder={t.enterFriendCode} aria-label={t.enterFriendCode} autoCapitalize="characters" autoComplete="off" />
            <button className="btn primary" disabled={busy || code.length !== 6}>{t.sendRequest}</button>
          </form>
          <p className="muted small center-text">{t.addByNameHint}</p>
        </div>
      )}

      {note && <p className="fr-note" role="status">{note}</p>}
      {err && <p className="err" role="alert">{err}</p>}

      {inviting && list.find((f) => f.id === inviting) && <InviteSheet t={t} friend={list.find((f) => f.id === inviting)} busy={busy} onClose={() => setInviting(null)} onPick={(g, rs) => invite(list.find((f) => f.id === inviting), g, rs)} />}
    </div>
  );
}

/** Pick a game (and for Gebeta the type), then send the invite: the host waits in a private room, no coins. */
export function InviteSheet({ t, friend, busy, onClose, onPick }) {
  const [game, setGame] = useState('gebeta');
  const info = GAMES[game];
  const [rs, setRs] = useState(info.defaultRuleset);
  useEffect(() => { setRs(GAMES[game].defaultRuleset); }, [game]);
  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-label={t.inviteToPlay} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="dialog fr-invite">
        <h3>{t.inviteToPlay} · {friend.name}</h3>
        <p className="muted small">{t.inviteChoose}</p>
        <div className="fr-games">
          {ONLINE_GAMES.map((g) => (
            <button key={g.id} className={`fr-game${game === g.id ? ' on' : ''}`} aria-pressed={game === g.id} onClick={() => setGame(g.id)}>
              <GameIcon game={g.id} size={34} /><span>{t[`${g.id}Name`]}</span>
            </button>
          ))}
        </div>
        {info.rulesets.length > 1 && (
          <div className="seg fr-rs">
            {info.rulesets.map((id) => <button key={id} className={rs === id ? 'on' : ''} aria-pressed={rs === id} onClick={() => setRs(id)}>{t.rs[game][id][0]}</button>)}
          </div>
        )}
        <p className="muted small">{t.inviteFriendly}</p>
        <div className="result-actions">
          <button className="btn" onClick={onClose}>{t.cancel}</button>
          <button className="btn primary" disabled={busy} onClick={() => onPick(game, rs)}>{t.inviteToPlay}</button>
        </div>
      </div>
    </div>
  );
}

/** One-to-one chat: bubbles with reply quotes, edited mark, ticks, reactions, typing and last seen. Tap a bubble for its actions. */
export function FriendChat({ t, lang, uid, friend, chat, seenAt, social, onBack, onInvite, onUnfriend, sheet }) {
  const [text, setText] = useState(''); const [busy, setBusy] = useState(false); const [err, setErr] = useState('');
  const [menu, setMenu] = useState(null);       // message id whose action sheet is open
  const [reply, setReply] = useState(null);     // message being answered
  const [editing, setEditing] = useState(null); // message being edited
  const [pending, setPending] = useState([]);   // lines sent but not yet echoed back (shown at once, like Telegram)
  const [more, setMore] = useState(false);
  const box = useRef(null); const end = useRef(null); const lastPing = useRef(0); const stick = useRef(true);
  const online = isOnline(seenAt, serverNow());
  const typing = isTyping(chat, friend.id, serverNow());
  const unread = chat?.unread?.[uid] || 0;
  const readAt = chat?.readAt?.[friend.id] || 0;
  const real = chat?.msgs || [];
  const msgs = useMemo(() => {
    const ids = new Set(real.map((m) => m.id));
    const ghosts = pending.filter((p) => !ids.has(p.id) && !real.some((m) => m.from === uid && m.text === p.text && Math.abs(m.at - p.at) < 20000));
    return [...real, ...ghosts];
  }, [real, pending, uid]);
  const byId = useMemo(() => Object.fromEntries(real.map((m) => [m.id, m])), [real]);

  useEffect(() => { social?.boost?.(true); return () => social?.boost?.(false); }, [social?.boost]);   // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (stick.current) end.current?.scrollIntoView?.({ block: 'end' }); }, [msgs.length, typing]);
  useEffect(() => { if (unread > 0) apiCall({ action: 'chatRead', to: friend.id }, { retries: 0 }).then(() => social?.refresh?.()).catch(() => {}); }, [unread, friend.id]);   // eslint-disable-line react-hooks/exhaustive-deps
  const onScroll = () => { const b = box.current; if (b) stick.current = b.scrollHeight - b.scrollTop - b.clientHeight < 120; };

  const ping = () => { const n = Date.now(); if (n - lastPing.current > 3000) { lastPing.current = n; apiCall({ action: 'chatTyping', to: friend.id }, { retries: 0 }).catch(() => {}); } };
  const send = async () => {
    const v = text.trim(); if (!v || busy) return;
    setBusy(true); setErr('');
    try {
      if (editing) { await apiCall({ action: 'chatEdit', to: friend.id, id: editing.id, text: v }); setEditing(null); }
      else {
        const ghost = { id: `p${Date.now()}`, from: uid, text: v, at: Date.now(), pending: true, reply: reply ? { id: reply.id, from: reply.from, text: reply.deleted ? '' : reply.text.slice(0, 80) } : undefined };
        setPending((p) => [...p, ghost]); stick.current = true;
        try { await apiCall({ action: 'chatSend', to: friend.id, text: v, replyTo: reply?.id }); } catch (e) { setPending((p) => p.filter((x) => x.id !== ghost.id)); throw e; }
        setReply(null);
      }
      setText(''); social?.refresh?.();
    } catch (e) { setErr(e.message); }
    setBusy(false);
  };
  const act = async (body) => { setMenu(null); setErr(''); try { await apiCall(body); social?.refresh?.(); } catch (e) { setErr(e.message); } };
  const startEdit = (m) => { setMenu(null); setReply(null); setEditing(m); setText(m.text); };
  const startReply = (m) => { setMenu(null); setEditing(null); setReply(m); };
  const copy = async (m) => { setMenu(null); try { await navigator.clipboard.writeText(m.text); } catch { /* ignore */ } };
  const jump = (id) => { const el = box.current?.querySelector(`[data-mid="${id}"]`); if (el) { el.scrollIntoView({ block: 'center', behavior: 'smooth' }); el.classList.add('flash'); setTimeout(() => el.classList.remove('flash'), 1200); } };
  const menuMsg = menu ? byId[menu] : null;

  let lastDay = '';
  return (
    <div className="panel tg-chat">
      <div className="tg-head">
        <button className="icon-btn" onClick={onBack} aria-label={t.backHome}>‹</button>
        <span className="fr-av"><Avatar id={friend.avatar} size={40} /><i className={`dot${online ? ' on' : ''}`} /></span>
        <span className="fr-name"><b>{friend.name}</b><small className={typing ? 'typing' : ''}>{typing ? t.typing : online ? t.frOnline : seenText(t, seenAt)}</small></span>
        <button className="icon-btn fr-act gold" onClick={onInvite} aria-label={t.inviteToPlay}>🎮</button>
        <button className="icon-btn" onClick={() => setMore((v) => !v)} aria-label={t.moreActions} aria-expanded={more}>⋮</button>
        {more && <div className="tg-more" role="menu"><button role="menuitem" onClick={() => { setMore(false); onUnfriend(); }}>🚫 {t.frRemove}</button></div>}
      </div>

      <div className="tg-msgs" ref={box} onScroll={onScroll} role="log" aria-live="polite">
        {msgs.length === 0 && <p className="muted center-text">{t.chatEmpty}</p>}
        {msgs.map((m) => {
          const mine = m.from === uid; const day = dayKey(m.at); const sep = day !== lastDay; lastDay = day;
          const rx = Object.entries(m.reactions || {});
          return (
            <React.Fragment key={m.id}>
              {sep && <div className="tg-day"><span>{new Date(m.at).toDateString() === new Date().toDateString() ? t.today : new Date(m.at).toLocaleDateString([], { month: 'long', day: 'numeric' })}</span></div>}
              <div className={`tg-msg${mine ? ' me' : ''}${m.deleted ? ' gone' : ''}`} data-mid={m.id}>
                <button className="tg-bubble" disabled={m.pending || m.deleted} onClick={() => setMenu(m.id)} aria-label={t.moreActions}>
                  {m.reply && <span className="tg-quote" onClick={(e) => { e.stopPropagation(); jump(m.reply.id); }}><b>{m.reply.from === uid ? t.chatYou : friend.name}</b><span>{m.reply.text || t.deletedMsg}</span></span>}
                  <span className="tg-text">{m.deleted ? t.deletedMsg : m.text}</span>
                  <small className="tg-meta">{m.edited && !m.deleted && <i>{t.edited}</i>}{hhmm(m.at)}{mine && !m.deleted && (m.pending ? <span className="tg-ticks">🕓</span> : <Ticks read={readAt >= m.at} />)}</small>
                </button>
                {rx.length > 0 && <div className="tg-rx">{rx.map(([e, ids]) => (
                  <button key={e} className={`tg-chip${ids.includes(uid) ? ' mine' : ''}`} onClick={() => act({ action: 'chatReact', to: friend.id, id: m.id, emoji: e })}>{e}{ids.length > 1 ? <em>{ids.length}</em> : null}</button>
                ))}</div>}
              </div>
            </React.Fragment>
          );
        })}
        {typing && <div className="tg-msg"><span className="tg-bubble tg-dots" aria-label={t.typing}><i /><i /><i /></span></div>}
        <div ref={end} />
      </div>

      {(reply || editing) && (
        <div className="tg-ctx">
          <span className="tg-ctx-bar" />
          <span className="tg-ctx-txt"><b>{editing ? t.editing : `${t.replyTo} ${reply.from === uid ? t.chatYou : friend.name}`}</b><span>{(editing || reply).text}</span></span>
          <button className="icon-btn" aria-label={t.cancel} onClick={() => { setReply(null); setEditing(null); setText(''); }}>✕</button>
        </div>
      )}
      <form className="tg-send" onSubmit={(e) => { e.preventDefault(); send(); }}>
        <input value={text} onChange={(e) => { setText(e.target.value.slice(0, 1000)); if (e.target.value) ping(); }} placeholder={t.chatWrite} aria-label={t.chatWrite} maxLength={1000} autoComplete="off" enterKeyHint="send" />
        <button className="tg-go" disabled={busy || !text.trim()} aria-label={t.chatSend}>{editing ? '✓' : '➤'}</button>
      </form>
      {err && <p className="err" role="alert">{err}</p>}

      {menuMsg && (
        <div className="overlay" role="dialog" aria-modal="true" onClick={(e) => { if (e.target === e.currentTarget) setMenu(null); }}>
          <div className="dialog tg-sheet">
            <div className="tg-react-bar">{REACTIONS.map((e) => <button key={e} className={(menuMsg.reactions?.[e] || []).includes(uid) ? 'mine' : ''} onClick={() => act({ action: 'chatReact', to: friend.id, id: menuMsg.id, emoji: e })}>{e}</button>)}</div>
            <button className="tg-act" onClick={() => startReply(menuMsg)}>↩️ {t.replyTo}</button>
            <button className="tg-act" onClick={() => copy(menuMsg)}>📋 {t.copyMsg}</button>
            {menuMsg.from === uid && <button className="tg-act" onClick={() => startEdit(menuMsg)}>✏️ {t.editMsg}</button>}
            {menuMsg.from === uid && <button className="tg-act bad" onClick={() => act({ action: 'chatDelete', to: friend.id, id: menuMsg.id })}>🗑️ {t.deleteMsg}</button>}
          </div>
        </div>
      )}
      {sheet}
    </div>
  );
}

/** A friend invited me: shows on any screen until I join or dismiss it. */
export function InviteInbox({ t, invites, busy, onJoin, onDismiss }) {
  const inv = invites?.[0];
  if (!inv) return null;
  return (
    <div className="invite-card" role="alertdialog" aria-live="assertive">
      <Avatar id={inv.avatar} size={46} />
      <div className="invite-txt"><b>{t.inviteFrom(inv.name, t[`${inv.game}Name`] || inv.game)}</b><small>{inv.ruleset && t.rs?.[inv.game]?.[inv.ruleset] ? t.rs[inv.game][inv.ruleset][0] : ''}</small></div>
      <button className="btn primary sm" disabled={busy} onClick={() => onJoin(inv)}>{t.inviteJoin}</button>
      <button className="btn ghost sm" onClick={() => onDismiss(inv)}>{t.inviteLater}</button>
    </div>
  );
}

/** Waiting-room shortcut: invite one of my friends straight into the room I am waiting in. */
export function InviteFriendsRow({ t, code, friends }) {
  const list = Object.entries(friends?.list || {}).slice(0, 8).map(([id, c]) => ({ id, ...c }));
  const [sent, setSent] = useState({}); const [err, setErr] = useState('');
  if (!list.length) return <p className="muted small">{t.inviteNoFriends}</p>;
  const send = async (f) => {
    setErr('');
    try { await apiCall({ action: 'friendInvite', to: f.id, code }); setSent((s) => ({ ...s, [f.id]: true })); } catch (e) { setErr(e.message); }
  };
  return (
    <div className="fr-wait">
      <span className="fr-label">{t.inviteFromFriends}</span>
      <div className="fr-chips">
        {list.map((f) => (
          <button key={f.id} className={`fr-chip${sent[f.id] ? ' sent' : ''}`} disabled={!!sent[f.id]} onClick={() => send(f)}>
            <Avatar id={f.avatar} size={28} /><span>{sent[f.id] ? '✓' : f.name}</span>
          </button>
        ))}
      </div>
      {err && <p className="err" role="alert">{err}</p>}
    </div>
  );
}
