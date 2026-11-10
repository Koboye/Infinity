'use client';
// Friends hub, Telegram style (v98): Chats · Contacts · Requests, a global search (@username, name or 6-letter code),
// my profile (@username, bio, last-seen privacy), blocked players, people you may know, game invites.
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { apiCall, serverNow } from '@/lib/firebase';
import { GAMES } from '@/lib/games.js';
import { normalizeFriendCode, normalizeUsername, checkUsername, pairId, displayName } from '@/lib/social';
import { GameIcon } from './GameIcons';
import FriendChat, { Avatar, clock, seenText } from './FriendChat';

export { Avatar, FriendChat };
const ONLINE_GAMES = Object.values(GAMES).filter((g) => !g.offlineOnly && !g.comingSoon);
const shareOrCopy = async (text, url) => {
  try { if (navigator.share) { await navigator.share({ title: 'Infinity', text, url }); return 'shared'; } } catch (e) { if (e?.name === 'AbortError') return 'cancelled'; }
  try { await navigator.clipboard.writeText(url ? `${text} ${url}` : text); return 'copied'; } catch { return 'failed'; }
};
const siteUrl = (params = {}) => { try { const u = new URL(window.location.href); u.search = ''; u.hash = ''; for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v); return u.toString(); } catch { return ''; } };
export const friendLink = (code) => siteUrl({ friend: code });
export const usernameLink = (name) => siteUrl({ u: name });

const preview = (t, uid, m) => (m ? `${m.from === uid ? `${t.fxYou}: ` : ''}${m.text}` : '');

/** Friends hub. */
export default function FriendsScreen({ t, lang, uid, social, myAvatar, onEnterRoom, openChat, onOpenChat }) {
  const { friends, chats } = social;
  const [tab, setTab] = useState('chats');
  const [q, setQ] = useState('');
  const [sort, setSort] = useState('seen');
  const [me, setMe] = useState({ code: null });
  const myName = friends?.username || null;             // live from friends/{uid}
  const [seen, setSeen] = useState({});                // uid -> presence view
  const [found, setFound] = useState(null);            // null = not searching, [] = nothing found
  const [searching, setSearching] = useState(false);
  const [people, setPeople] = useState([]);            // people you may know
  const [note, setNote] = useState(''); const [err, setErr] = useState(''); const [busy, setBusy] = useState(false);
  const [inviting, setInviting] = useState(null);
  const [settings, setSettings] = useState(false);
  const [composeFor, setComposeFor] = useState(null);  // player a request (with a note) is being written for

  const list = useMemo(() => Object.entries(friends?.list || {}).map(([id, c]) => ({ id, ...c, label: displayName(friends, id, c) })), [friends]);
  const incoming = useMemo(() => Object.entries(friends?.incoming || {}).map(([id, c]) => ({ id, ...c })), [friends]);
  const outgoing = useMemo(() => Object.entries(friends?.outgoing || {}).map(([id, c]) => ({ id, ...c })), [friends]);
  const chatOf = (fid) => chats.find((c) => c.id === pairId(uid, fid));

  const call = useCallback(async (body, ok) => {
    setBusy(true); setErr(''); setNote('');
    try { const r = await apiCall(body); ok?.(r); return r; } catch (e) { setErr(e.message); return null; } finally { setBusy(false); }
  }, []);
  const toast = (m) => { setNote(m); setTimeout(() => setNote(''), 2200); };

  useEffect(() => { let live = true; apiCall({ action: 'friendCode' }).then((r) => live && setMe((m) => ({ ...m, code: r.code }))).catch(() => {}); return () => { live = false; }; }, []);

  // last seen of every friend (worded by their privacy choice on the server), refreshed every 30 s while this screen is open
  const hasFriends = list.length > 0;
  useEffect(() => {
    if (!hasFriends) return undefined;
    let live = true;
    const load = () => apiCall({ action: 'friendPresence' }, { retries: 0 }).then((r) => live && setSeen(r.seen || {})).catch(() => {});
    load(); const id = setInterval(load, 30000);
    return () => { live = false; clearInterval(id); };
  }, [hasFriends]);

  useEffect(() => { if (tab === 'requests') apiCall({ action: 'friendSuggest' }, { retries: 0 }).then((r) => setPeople(r.people || [])).catch(() => {}); }, [tab, list.length]);

  // global search: 350 ms after the last key. "@name" or 3+ letters → players by username; 6 characters also offers "add by code".
  const query = q.trim();
  const handle = normalizeUsername(query);
  useEffect(() => {
    if (handle.length < 3) { setFound(null); setSearching(false); return undefined; }
    setSearching(true);
    let live = true;
    const id = setTimeout(() => apiCall({ action: 'friendFind', q: handle }, { retries: 0 }).then((r) => { if (live) { setFound(r.results || []); setSearching(false); } }).catch(() => { if (live) { setFound([]); setSearching(false); } }), 350);
    return () => { live = false; clearTimeout(id); };
  }, [handle]);

  const sendRequest = async (player, text) => {
    const r = await call({ action: 'friendRequest', to: player.id, note: text || undefined });
    if (!r) return;
    setComposeFor(null);
    toast(r.result === 'accepted' ? t.frNow(r.name) : r.result === 'already' ? t.frAlready : r.result === 'pending' ? t.frPending : t.frSent(r.name));
    setFound((f) => f && f.map((x) => (x.id === player.id ? { ...x, status: r.result === 'accepted' ? 'friend' : 'outgoing' } : x)));
    setPeople((p) => p.filter((x) => x.id !== player.id));
  };
  const addByCode = async () => {
    const r = await call({ action: 'friendRequest', friendCode: normalizeFriendCode(query) });
    if (r) { setQ(''); toast(r.result === 'accepted' ? t.frNow(r.name) : r.result === 'already' ? t.frAlready : r.result === 'pending' ? t.frPending : t.frSent(r.name)); }
  };
  const shareMe = async () => {
    const link = myName ? usernameLink(myName) : friendLink(me.code);
    const how = await shareOrCopy(t.addMeText(myName ? `@${myName}` : me.code), link);
    if (how === 'copied') toast(t.fxLinkCopied);
  };
  const invite = async (friend, game, ruleset) => {
    const r = await call({ action: 'friendInvite', to: friend.id, game, ruleset, fee: 0 });
    if (r?.code) { setInviting(null); onEnterRoom(r.code); }
  };

  const mySeen = (id) => seen[id];
  const filteredList = useMemo(() => {
    const needle = query.toLowerCase().replace(/^@/, '');
    let rows = list.filter((f) => !needle || f.label.toLowerCase().includes(needle) || f.name.toLowerCase().includes(needle) || (f.username || '').includes(needle));
    const weight = (id) => { const v = seen[id]; return v?.kind === 'online' ? Infinity : (v?.at || 0); };
    rows = rows.sort((a, b) => (friends?.pinned?.[b.id] ? 1 : 0) - (friends?.pinned?.[a.id] ? 1 : 0)
      || (sort === 'seen' ? weight(b.id) - weight(a.id) : 0) || a.label.localeCompare(b.label));
    return rows;
  }, [list, query, sort, seen, friends]);   // eslint-disable-line react-hooks/exhaustive-deps

  const convos = useMemo(() => {
    const needle = query.toLowerCase().replace(/^@/, '');
    return list.map((f) => ({ f, chat: chatOf(f.id) })).filter(({ chat }) => chat?.msgs?.length)
      .filter(({ f }) => !needle || f.label.toLowerCase().includes(needle))
      .sort((a, b) => (friends?.pinned?.[b.f.id] ? 1 : 0) - (friends?.pinned?.[a.f.id] ? 1 : 0) || (b.chat.updatedAt || 0) - (a.chat.updatedAt || 0));
  }, [list, chats, query, friends]);   // eslint-disable-line react-hooks/exhaustive-deps

  const chatFriend = openChat ? list.find((f) => f.id === openChat) : null;
  if (chatFriend) {
    return <FriendChat t={t} lang={lang} uid={uid} friend={chatFriend} name={chatFriend.label} chat={chatOf(chatFriend.id)} view={mySeen(chatFriend.id)}
      pinned={!!friends?.pinned?.[chatFriend.id]} muted={!!friends?.muted?.[chatFriend.id]} onBack={() => onOpenChat(null)} onInvite={() => setInviting(chatFriend.id)}
      onChanged={() => setSeen({})} />;
  }

  const unreadOf = (fid) => chatOf(fid)?.unread?.[uid] || 0;
  const tabs = [['chats', t.fxChats, 0], ['contacts', `${t.fxContacts}`, 0], ['requests', t.frRequests, incoming.length]];
  const searchingNow = query.length > 0 && tab !== 'requests';

  return (
    <div className="panel fx-screen">
      <section className="fx-me" aria-label={t.profile}>
        <Avatar id={myAvatar || 'lion'} size={52} />
        <span className="fx-me-txt">
          <button className="fx-me-name" onClick={() => setSettings(true)}>{myName ? `@${myName}` : t.fxSetUsername}</button>
          <small>{friends?.bio || `${t.myFriendCode}: ${me.code || '······'}`}</small>
        </span>
        <button className="icon-btn" onClick={shareMe} aria-label={t.fxShareLink} disabled={!me.code}>🔗</button>
        <button className="icon-btn" onClick={() => setSettings(true)} aria-label={t.fxSettings}>⚙</button>
      </section>

      <label className="fx-search">
        <span aria-hidden="true">⌕</span>
        <input value={q} onChange={(e) => setQ(e.target.value.slice(0, 40))} placeholder={t.fxSearch} aria-label={t.fxSearch} autoComplete="off" autoCapitalize="none" />
        {q && <button type="button" className="fx-clear" onClick={() => setQ('')} aria-label={t.cancel}>✕</button>}
      </label>

      <div className="fx-tabs" role="tablist">
        {tabs.map(([id, label, n]) => (
          <button key={id} role="tab" aria-selected={tab === id} className={tab === id ? 'on' : ''} onClick={() => { setTab(id); setErr(''); }}>{label}{n > 0 && <em className="badge">{n}</em>}</button>
        ))}
      </div>

      {/* ── global search results ── */}
      {query.length > 0 && handle.length >= 3 && tab !== 'requests' && (
        <section className="fx-block" aria-label={t.fxPlayers}>
          <h4>{t.fxPlayers}</h4>
          {searching && <p className="muted small">{t.fxSearching}</p>}
          {normalizeFriendCode(query).length === 6 && /^[A-Za-z0-9]{6}$/.test(query.replace(/\s/g, '')) && (
            <div className="fx-row"><span className="fx-ico">#</span><span className="fx-name"><b>{t.fxAddByCode(normalizeFriendCode(query))}</b></span><button className="btn primary sm" disabled={busy} onClick={addByCode}>{t.fxAdd}</button></div>
          )}
          {found && found.length === 0 && !searching && <p className="muted small">{t.fxNoPlayers}</p>}
          {(found || []).map((p) => <PlayerRow key={p.id} t={t} p={p} busy={busy} onAdd={() => setComposeFor(p)} onOpen={() => { setQ(''); onOpenChat(p.id); }} />)}
        </section>
      )}

      {/* ── chats ── */}
      {tab === 'chats' && (convos.length === 0
        ? (handle.length >= 3 && searchingNow ? null : <div className="fx-empty"><p className="muted">{searchingNow ? t.fxNoPlayers : t.fxNoChats}</p>{!searchingNow && <button className="btn primary" onClick={shareMe} disabled={!me.code}>🔗 {t.fxInviteFriends}</button>}</div>)
        : <ul className="fx-list">
          {convos.map(({ f, chat }) => {
            const last = chat.msgs[chat.msgs.length - 1]; const n = unreadOf(f.id); const muted = !!friends?.muted?.[f.id];
            const typingNow = Date.now() - (chat.typing?.[f.id] || 0) < 6000;
            return (
              <li key={f.id}><button className="fx-row fx-chatrow" onClick={() => onOpenChat(f.id)}>
                <span className="fx-av"><Avatar id={f.avatar} size={48} /><i className={`dot${mySeen(f.id)?.kind === 'online' ? ' on' : ''}`} /></span>
                <span className="fx-name">
                  <b>{friends?.pinned?.[f.id] && <span className="fx-pin" aria-hidden="true">📌</span>}{f.label}{muted && <span aria-hidden="true"> 🔕</span>}</b>
                  <small className={typingNow ? 'typing' : ''}>{typingNow ? t.fxTyping : preview(t, uid, last)}</small>
                </span>
                <span className="fx-end"><time>{clock(last.at, lang)}</time>{n > 0 && <em className={`badge${muted ? ' mute' : ''}`}>{n > 99 ? '99+' : n}</em>}</span>
              </button></li>
            );
          })}
        </ul>)}

      {/* ── contacts ── */}
      {tab === 'contacts' && (
        <>
          <div className="fx-sort" role="group" aria-label={t.fxContacts}>
            <span>{list.length} {t.friends.toLowerCase()}</span>
            <span>{[['seen', t.fxSortSeen], ['name', t.fxSortName]].map(([id, label]) => <button key={id} aria-pressed={sort === id} className={sort === id ? 'on' : ''} onClick={() => setSort(id)}>{label}</button>)}</span>
          </div>
          {filteredList.length === 0
            ? <div className="fx-empty"><p className="muted">{list.length === 0 ? t.frNone : t.fxNoPlayers}</p></div>
            : <ul className="fx-list">
              {filteredList.map((f) => {
                const v = mySeen(f.id); const n = unreadOf(f.id);
                return (
                  <li key={f.id} className="fx-row">
                    <button className="fx-rowmain" onClick={() => onOpenChat(f.id)}>
                      <span className="fx-av"><Avatar id={f.avatar} size={46} /><i className={`dot${v?.kind === 'online' ? ' on' : ''}`} /></span>
                      <span className="fx-name"><b>{friends?.pinned?.[f.id] && <span className="fx-pin" aria-hidden="true">📌</span>}{f.label}</b><small className={v?.kind === 'online' ? 'on' : ''}>{seenText(t, lang, v)}</small></span>
                      {n > 0 && <em className="badge">{n > 9 ? '9+' : n}</em>}
                    </button>
                    <button className="icon-btn fx-play" aria-label={`${t.inviteToPlay}: ${f.label}`} onClick={() => setInviting(f.id)}>🎮</button>
                  </li>
                );
              })}
            </ul>}
        </>
      )}

      {/* ── requests ── */}
      {tab === 'requests' && (
        <div className="fx-reqs">
          {incoming.length === 0 && outgoing.length === 0 && <p className="muted center-text">{t.frNoRequests}</p>}
          {incoming.map((r) => (
            <div key={r.id} className="fx-req">
              <div className="fx-row">
                <span className="fx-av"><Avatar id={r.avatar} size={46} /></span>
                <span className="fx-name"><b>{r.name}{r.username && <small> @{r.username}</small>}</b><small>{t.fxWantsFriend}</small></span>
              </div>
              {r.note && <p className="fx-notebox">“{r.note}”</p>}
              <div className="fx-req-act">
                <button className="btn primary sm" disabled={busy} onClick={() => call({ action: 'friendAccept', to: r.id })}>{t.frAccept}</button>
                <button className="btn ghost sm" disabled={busy} onClick={() => call({ action: 'friendDecline', to: r.id })}>{t.frDecline}</button>
                <button className="btn ghost sm" disabled={busy} onClick={() => call({ action: 'friendBlock', to: r.id })}>{t.fxBlock}</button>
              </div>
            </div>
          ))}
          {outgoing.map((r) => (
            <div key={r.id} className="fx-row">
              <span className="fx-av"><Avatar id={r.avatar} size={46} /></span>
              <span className="fx-name"><b>{r.name}</b><small>{t.frWaitingFor}</small></span>
              <button className="btn ghost sm" disabled={busy} onClick={() => call({ action: 'friendRemove', to: r.id })}>{t.frCancel}</button>
            </div>
          ))}
          {people.length > 0 && (
            <section className="fx-block"><h4>{t.fxMayKnow}</h4>
              {people.map((p) => <PlayerRow key={p.id} t={t} p={{ ...p, status: 'none' }} busy={busy} onAdd={() => setComposeFor(p)} />)}
            </section>
          )}
        </div>
      )}

      {note && <p className="fx-note" role="status">{note}</p>}
      {err && <p className="err" role="alert">{err}</p>}

      {composeFor && <RequestSheet t={t} player={composeFor} busy={busy} onClose={() => setComposeFor(null)} onSend={(text) => sendRequest(composeFor, text)} />}
      {settings && <SettingsSheet t={t} friends={friends} call={call} onClose={() => setSettings(false)} />}
      {inviting && list.find((f) => f.id === inviting) && <InviteSheet t={t} friend={list.find((f) => f.id === inviting)} busy={busy} onClose={() => setInviting(null)} onPick={(g, rs) => invite(list.find((f) => f.id === inviting), g, rs)} />}
    </div>
  );
}

function PlayerRow({ t, p, busy, onAdd, onOpen }) {
  return (
    <div className="fx-row">
      <span className="fx-av"><Avatar id={p.avatar} size={44} /></span>
      <span className="fx-name"><b>{p.name}</b><small>{p.username ? `@${p.username}` : ''}{p.mutual > 0 ? `${p.username ? ' · ' : ''}${t.fxMutual(p.mutual)}` : ''}</small></span>
      {p.status === 'friend' && (onOpen ? <button className="btn ghost sm" onClick={onOpen}>{t.chat}</button> : <span className="fx-tag">{t.fxIsFriend}</span>)}
      {p.status === 'outgoing' && <span className="fx-tag">{t.fxRequested}</span>}
      {p.status === 'incoming' && <span className="fx-tag gold">{t.fxRespond}</span>}
      {p.status === 'none' && <button className="btn primary sm" disabled={busy} onClick={onAdd}>{t.fxAdd}</button>}
    </div>
  );
}

/** A request can carry a short note, so the other person knows who is asking. */
function RequestSheet({ t, player, busy, onClose, onSend }) {
  const [text, setText] = useState('');
  return (
    <div className="overlay fx-sheet-bg" role="dialog" aria-modal="true" aria-label={t.fxNote} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <form className="fx-sheet fx-form" onSubmit={(e) => { e.preventDefault(); onSend(text.trim()); }}>
        <span className="fx-sheet-who"><Avatar id={player.avatar} size={52} /><b>{player.name}</b>{player.username && <small>@{player.username}</small>}</span>
        <label className="fx-field"><span>{t.fxNote}</span>
          <input value={text} onChange={(e) => setText(e.target.value.slice(0, 100))} placeholder={t.fxNoteHint} maxLength={100} autoFocus />
        </label>
        <div className="result-actions"><button type="button" className="btn" onClick={onClose}>{t.cancel}</button><button className="btn primary" disabled={busy}>{t.sendRequest}</button></div>
      </form>
    </div>
  );
}

/** My @username, bio, who can see my last seen, and the people I blocked. */
function SettingsSheet({ t, friends, call, onClose }) {
  const [name, setName] = useState(friends?.username || '');
  const [bio, setBio] = useState(friends?.bio || '');
  const [msg, setMsg] = useState('');
  const check = name ? checkUsername(name) : { ok: true };
  const blocked = Object.entries(friends?.blocked || {}).map(([id, c]) => ({ id, ...c }));
  const lastSeen = friends?.privacy?.lastSeen || 'everyone';
  const saveName = async (e) => { e.preventDefault(); const r = await call({ action: 'friendUsername', username: name }); if (r) { setName(r.username); setMsg(t.fxUsernameSaved); } };
  return (
    <div className="overlay fx-sheet-bg" role="dialog" aria-modal="true" aria-label={t.fxSettings} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="fx-sheet fx-settings">
        <header><b>{t.fxSettings}</b><button className="icon-btn sm" onClick={onClose} aria-label={t.fxClose}>✕</button></header>

        <form className="fx-form" onSubmit={saveName}>
          <label className="fx-field"><span>{t.fxUsername}</span>
            <span className="fx-at"><i>@</i><input value={name} onChange={(e) => setName(normalizeUsername(e.target.value))} placeholder="username" autoCapitalize="none" autoComplete="off" /></span>
          </label>
          <small className={check.ok ? 'muted' : 'bad'}>{check.ok ? t.fxUsernameHint : check.error}</small>
          <button className="btn primary sm" disabled={!name || !check.ok}>{t.fxSave}</button>
        </form>

        <form className="fx-form" onSubmit={async (e) => { e.preventDefault(); const r = await call({ action: 'profileSet', bio }); if (r) setMsg(t.fxSave + ' ✓'); }}>
          <label className="fx-field"><span>{t.fxBio}</span><input value={bio} onChange={(e) => setBio(e.target.value.slice(0, 70))} placeholder={t.fxBioHint} maxLength={70} /></label>
          <button className="btn ghost sm">{t.fxSave}</button>
        </form>

        <div className="fx-form">
          <span className="fx-field"><span>{t.fxLastSeenWho}</span></span>
          <div className="fx-seg" role="radiogroup" aria-label={t.fxPrivacy}>
            {[['everyone', t.fxEveryone], ['friends', t.fxFriendsOnly], ['nobody', t.fxNobody]].map(([id, label]) => (
              <button key={id} role="radio" aria-checked={lastSeen === id} className={lastSeen === id ? 'on' : ''} onClick={() => call({ action: 'profileSet', lastSeen: id })}>{label}</button>
            ))}
          </div>
          <small className="muted">{t.fxLastSeenHint}</small>
        </div>

        <div className="fx-form">
          <span className="fx-field"><span>{t.fxBlockedList}</span></span>
          {blocked.length === 0 && <small className="muted">{t.fxNoBlocked}</small>}
          {blocked.map((b) => (
            <div key={b.id} className="fx-row"><span className="fx-av"><Avatar id={b.avatar} size={38} /></span><span className="fx-name"><b>{b.name}</b></span>
              <button className="btn ghost sm" onClick={() => call({ action: 'friendUnblock', to: b.id })}>{t.fxUnblock}</button></div>
          ))}
        </div>
        {msg && <p className="fx-note" role="status">{msg}</p>}
      </div>
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
