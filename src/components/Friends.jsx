'use client';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db, apiCall, serverNow } from '@/lib/firebase';
import { EMOTES, heroById } from '@/lib/i18n';
import { GAMES } from '@/lib/games.js';
import { isOnline, normalizeFriendCode, pairId } from '@/lib/social';
import { GameIcon } from './GameIcons';

const ONLINE_GAMES = Object.values(GAMES).filter((g) => !g.offlineOnly && !g.comingSoon);
const shareOrCopy = async (text, url) => {
  try { if (navigator.share) { await navigator.share({ title: 'Infinity', text, url }); return 'shared'; } } catch (e) { if (e?.name === 'AbortError') return 'cancelled'; }
  try { await navigator.clipboard.writeText(url ? `${text} ${url}` : text); return 'copied'; } catch { return 'failed'; }
};
const siteUrl = (params = {}) => { try { const u = new URL(window.location.href); u.search = ''; u.hash = ''; for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v); return u.toString(); } catch { return ''; } };
export const friendLink = (code) => siteUrl({ friend: code });

function Avatar({ id, size = 44 }) {
  const h = heroById(id);
  return <span className="hero" style={{ background: h.color, width: size, height: size, fontSize: size * 0.55 }} aria-hidden="true">{h.glyph}</span>;
}

/** Friends hub: my code, friend list with online dots, requests, add by code, chat and invites. */
export default function FriendsScreen({ t, lang, uid, social, onEnterRoom, openChat, onOpenChat }) {
  const { friends, chats } = social;
  const [tab, setTab] = useState('friends');
  const [myCode, setMyCode] = useState(null);
  const [code, setCode] = useState('');
  const [note, setNote] = useState(''); const [err, setErr] = useState(''); const [busy, setBusy] = useState(false);
  const [seen, setSeen] = useState({});            // uid -> last-seen ms (presence)
  const [inviting, setInviting] = useState(null);  // friend uid while the "which game" sheet is open
  const list = useMemo(() => Object.entries(friends?.list || {}).map(([id, c]) => ({ id, ...c })), [friends]);
  const incoming = useMemo(() => Object.entries(friends?.incoming || {}).map(([id, c]) => ({ id, ...c })), [friends]);
  const outgoing = useMemo(() => Object.entries(friends?.outgoing || {}).map(([id, c]) => ({ id, ...c })), [friends]);
  const unread = (fid) => chats.find((c) => c.id === pairId(uid, fid))?.unread?.[uid] || 0;

  const call = useCallback(async (body, ok) => {
    setBusy(true); setErr(''); setNote('');
    try { const r = await apiCall(body); ok?.(r); return r; } catch (e) { setErr(e.message); return null; } finally { setBusy(false); }
  }, []);

  useEffect(() => { let live = true; apiCall({ action: 'friendCode' }).then((r) => live && setMyCode(r.code)).catch(() => {}); return () => { live = false; }; }, []);

  // presence of every friend, refreshed every 30 s while this screen is open
  const ids = list.map((f) => f.id).join(',');
  useEffect(() => {
    if (!ids) return undefined;
    let live = true;
    const load = async () => {
      const out = {};
      await Promise.all(ids.split(',').slice(0, 50).map(async (id) => { try { const s = await getDoc(doc(db, 'presence', id)); if (s.exists()) out[id] = s.data().at; } catch { /* no presence yet */ } }));
      if (live) setSeen(out);
    };
    load(); const id = setInterval(load, 30000);
    return () => { live = false; clearInterval(id); };
  }, [ids]);

  const addByCode = async (e) => {
    e?.preventDefault();
    const c = normalizeFriendCode(code); if (c.length !== 6) return;
    const r = await call({ action: 'friendRequest', friendCode: c });
    if (!r) return;
    setCode('');
    setNote(r.result === 'accepted' ? t.frNow(r.name) : r.result === 'already' ? t.frAlready : r.result === 'pending' ? t.frPending : t.frSent(r.name));
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
  if (chatFriend) return <FriendChat t={t} lang={lang} uid={uid} friend={chatFriend} chat={chats.find((c) => c.id === pairId(uid, chatFriend.id))} online={isOnline(seen[chatFriend.id], serverNow())}
    onBack={() => onOpenChat(null)} onInvite={() => setInviting(chatFriend.id)} sheet={inviting === chatFriend.id ? <InviteSheet t={t} friend={chatFriend} busy={busy} onClose={() => setInviting(null)} onPick={(g, rs) => invite(chatFriend, g, rs)} /> : null} />;

  return (
    <div className="panel fr-screen">
      <div className="fr-mine">
        <span className="fr-label">{t.myFriendCode}</span>
        <div className="code fr-code" aria-label={t.myFriendCode}>{myCode || '······'}</div>
        <p className="muted small">{t.friendCodeHint}</p>
        <button className="btn primary wide" onClick={shareCode} disabled={!myCode}>📨 {t.shareMyCode}</button>
      </div>

      <div className="seg fr-tabs" role="tablist">
        {[['friends', `${t.friends} · ${list.length}`], ['requests', `${t.frRequests}${incoming.length ? ` · ${incoming.length}` : ''}`], ['add', t.addFriend]].map(([id, label]) => (
          <button key={id} role="tab" aria-selected={tab === id} className={tab === id ? 'on' : ''} onClick={() => { setTab(id); setErr(''); setNote(''); }}>{label}</button>
        ))}
      </div>

      {tab === 'friends' && (list.length === 0
        ? <p className="muted center-text">{t.frNone}</p>
        : <ul className="fr-list">
          {list.map((f) => {
            const on = isOnline(seen[f.id], serverNow()); const n = unread(f.id);
            return (
              <li key={f.id} className="fr-row">
                <span className="fr-av"><Avatar id={f.avatar} /><i className={`dot${on ? ' on' : ''}`} title={on ? t.frOnline : t.frOffline} /></span>
                <span className="fr-name"><b>{f.name}</b><small>{on ? t.frOnline : t.frOffline}</small></span>
                <button className="icon-btn fr-act" aria-label={`${t.chat}: ${f.name}`} onClick={() => onOpenChat(f.id)}>💬{n > 0 && <em className="badge">{n > 9 ? '9+' : n}</em>}</button>
                <button className="icon-btn fr-act gold" aria-label={`${t.inviteToPlay}: ${f.name}`} onClick={() => setInviting(f.id)}>🎮</button>
              </li>
            );
          })}
        </ul>)}

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
        <form className="joinrow" onSubmit={addByCode}>
          <input value={code} onChange={(e) => setCode(normalizeFriendCode(e.target.value))} placeholder={t.enterFriendCode} aria-label={t.enterFriendCode} autoCapitalize="characters" autoComplete="off" />
          <button className="btn primary" disabled={busy || code.length !== 6}>{t.sendRequest}</button>
        </form>
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

/** One-to-one chat with a friend. */
export function FriendChat({ t, lang, uid, friend, chat, online, onBack, onInvite, sheet }) {
  const [text, setText] = useState(''); const [busy, setBusy] = useState(false); const [err, setErr] = useState('');
  const end = useRef(null);
  const msgs = chat?.msgs || [];
  const unread = chat?.unread?.[uid] || 0;
  useEffect(() => { end.current?.scrollIntoView?.({ block: 'end' }); }, [msgs.length]);
  useEffect(() => { if (unread > 0) apiCall({ action: 'chatRead', to: friend.id }, { retries: 0 }).catch(() => {}); }, [unread, friend.id]);
  const send = async (value) => {
    const v = (value ?? text).trim(); if (!v || busy) return;
    setBusy(true); setErr('');
    try { await apiCall({ action: 'chatSend', to: friend.id, text: v }); if (value === undefined) setText(''); } catch (e) { setErr(e.message); }
    setBusy(false);
  };
  return (
    <div className="panel fr-chat">
      <div className="fr-chat-head">
        <button className="icon-btn" onClick={onBack} aria-label={t.backHome}>‹</button>
        <span className="fr-av"><Avatar id={friend.avatar} size={38} /><i className={`dot${online ? ' on' : ''}`} /></span>
        <span className="fr-name"><b>{friend.name}</b><small>{online ? t.frOnline : t.frOffline}</small></span>
        <button className="icon-btn fr-act gold" onClick={onInvite} aria-label={t.inviteToPlay}>🎮</button>
      </div>
      <div className="fr-msgs" role="log" aria-live="polite">
        {msgs.length === 0 && <p className="muted center-text">{t.chatEmpty}</p>}
        {msgs.map((m, i) => <div key={`${m.at}-${i}`} className={`bubble${m.from === uid ? ' me' : ''}`}><span>{m.text}</span></div>)}
        <div ref={end} />
      </div>
      <div className="emote-row">{EMOTES.map((e) => <button key={e.id} className="chip" onClick={() => send(e[lang] || e.en)}>{e[lang] || e.en}</button>)}</div>
      <form className="joinrow fr-send" onSubmit={(e) => { e.preventDefault(); send(); }}>
        <input value={text} onChange={(e) => setText(e.target.value.slice(0, 300))} placeholder={t.chatWrite} aria-label={t.chatWrite} maxLength={300} autoComplete="off" />
        <button className="btn primary" disabled={busy || !text.trim()}>{t.chatSend}</button>
      </form>
      {err && <p className="err" role="alert">{err}</p>}
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
