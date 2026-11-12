'use client';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { uploadAttachment, shrinkImage, startRecording, storageAvailable, MAX_VOICE_SECONDS } from '@/lib/upload';
import { CAR_WORLDS, CAR_LEVELS, carTier } from '@/lib/carWorlds';
import { apiCall, serverNow } from '@/lib/firebase';
import { heroById } from '@/lib/i18n';
import { GAMES } from '@/lib/games.js';
import { firstUnreadId, isOnline, isTyping, lastSeenParts, normalizeFriendCode, pairId, REACTIONS, searchMsgs, tickState, visibleMsgs } from '@/lib/social';
import { GameIcon } from './GameIcons';

/** "Play together" joystick: base, stick and a red ball that wobbles like a thumb is on it. Pure SVG, animated in CSS, still when motion is reduced. */
function PlayGlyph() {
  return (
    <svg className="pg" viewBox="0 0 32 32" width="100%" height="100%" aria-hidden="true" focusable="false">
      <ellipse cx="16" cy="25.5" rx="11" ry="3.6" fill="#2A1500" opacity=".28" />
      <path d="M6 21.5c0-1.6 1.2-2.6 2.8-2.6h14.4c1.6 0 2.8 1 2.8 2.6v1.4c0 1.8-1.4 3-3.1 3H9.1C7.4 25.9 6 24.7 6 22.9z" fill="#3A210F" />
      <circle cx="10.6" cy="22.2" r="1.35" fill="#FFD85A" /><circle cx="14.2" cy="22.2" r="1.35" fill="#35E0C2" />
      <rect x="20.2" y="21.2" width="5" height="2" rx="1" fill="#FFF1B0" opacity=".9" />
      <g className="pg-stick">
        <rect x="14.7" y="8.5" width="2.6" height="11" rx="1.3" fill="#3A210F" />
        <circle cx="16" cy="7.6" r="5" fill="#E4572E" /><circle cx="16" cy="7.6" r="5" fill="none" stroke="#7A2410" strokeWidth="1.2" />
        <ellipse cx="14.4" cy="5.7" rx="1.7" ry="1.1" fill="#fff" opacity=".6" transform="rotate(-30 14.4 5.7)" />
      </g>
    </svg>
  );
}
import { EMOJI_TABS, splitEmoji, RECENT_KEY, pushRecent } from '@/lib/emoji.js';
import { groupFlags, isEmojiOnly, parseRich, safeUrl } from '@/lib/chatText.js';

const THEMES = ['classic', 'wa-light', 'wa-dark'];   // chat look: our own, WhatsApp light, WhatsApp dark
const THEME_KEY = 'afro.chatTheme';
const store = { get(k, d) { try { const v = window.localStorage.getItem(k); return v == null ? d : v; } catch { return d; } }, set(k, v) { try { window.localStorage.setItem(k, v); } catch { /* private mode */ } } };

const CAR = { id: 'car', rulesets: [], defaultRuleset: '' };   // Hill Climb Racer: a stand-alone page with its own race rooms
const ONLINE_GAMES = [...Object.values(GAMES).filter((g) => !g.offlineOnly && !g.comingSoon), CAR];
/** Where the invited (and inviting) player lands for the car game. */
export const carRaceUrl = (code) => `/games/hillclimb-racing/index.html?race=${encodeURIComponent(code)}`;
const shareOrCopy = async (text, url) => {
  try { if (navigator.share) { await navigator.share({ title: 'Afro Zone', text, url }); return 'shared'; } } catch (e) { if (e?.name === 'AbortError') return 'cancelled'; }
  try { await navigator.clipboard.writeText(url ? `${text} ${url}` : text); return 'copied'; } catch { return 'failed'; }
};
const siteUrl = (params = {}) => { try { const u = new URL(window.location.href); u.search = ''; u.hash = ''; for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v); return u.toString(); } catch { return ''; } };
export const friendLink = (code) => siteUrl({ friend: code });

const hhmm = (at) => new Date(at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
const dayKey = (at) => new Date(at).toDateString();
/** "Today", "Yesterday", the weekday for this week, otherwise the date (like WhatsApp). */
function dayLabel(t, at) {
  const d = new Date(at), n = new Date(), days = Math.round((new Date(n.getFullYear(), n.getMonth(), n.getDate()) - new Date(d.getFullYear(), d.getMonth(), d.getDate())) / 86400000);
  if (days <= 0) return t.today; if (days === 1) return t.yesterday || 'Yesterday';
  if (days < 7) return d.toLocaleDateString([], { weekday: 'long' });
  return d.toLocaleDateString([], { month: 'long', day: 'numeric', year: d.getFullYear() === n.getFullYear() ? undefined : 'numeric' });
}
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
/** WhatsApp ticks: ✓ sent · grey ✓✓ delivered (their app is open) · blue ✓✓ read (they opened the chat). */
function Ticks({ state = 'sent', t }) {
  const label = state === 'read' ? t?.tickRead || 'read' : state === 'delivered' ? t?.tickDelivered || 'delivered' : t?.tickSent || 'sent';
  return <span className={`tg-ticks${state === 'read' ? ' read' : state === 'delivered' ? ' delivered' : ''}`} aria-label={label}>{state === 'sent' ? '✓' : '✓✓'}</span>;
}

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
  const muted = friends?.muted || [];
  const blocked = friends?.blocked || [];
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
      const c = chatOf(f.id); const last = visibleMsgs(c, uid).at(-1);
      return { ...f, last, at: last?.at || 0, unread: c?.unread?.[uid] || 0, pinned: pins.includes(f.id), muted: muted.includes(f.id), blocked: blocked.includes(f.id), chat: c };
    }).sort((a, b) => (b.pinned - a.pinned) || (b.at - a.at) || a.name.localeCompare(b.name));
  }, [list, chats, q, pins, muted, blocked, uid]);   // eslint-disable-line react-hooks/exhaustive-deps

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
  const invite = async (friend, game, ruleset, track) => {
    const r = await call({ action: 'friendInvite', to: friend.id, game, ruleset, fee: 0, ...(track || {}) });
    if (r?.code && game === 'car') { setInviting(null); window.location.href = carRaceUrl(r.code); return; }   // host waits in the race lobby
    if (r?.code) { setInviting(null); onEnterRoom(r.code); }
  };

  const chatFriend = openChat ? list.find((f) => f.id === openChat) : null;
  if (chatFriend) return <FriendChat t={t} lang={lang} uid={uid} friend={chatFriend} chat={chatOf(chatFriend.id)} seenAt={seen[chatFriend.id]} social={social} muted={muted.includes(chatFriend.id)} blocked={blocked.includes(chatFriend.id)}
    onBack={() => onOpenChat(null)} onInvite={() => setInviting(chatFriend.id)}
    onUnfriend={async () => { if (window.confirm(t.frRemoveConfirm(chatFriend.name))) { await call({ action: 'friendRemove', to: chatFriend.id }); onOpenChat(null); } }}
    sheet={inviting === chatFriend.id ? <InviteSheet t={t} friend={chatFriend} busy={busy} onClose={() => setInviting(null)} onPick={(g, rs, tr) => invite(chatFriend, g, rs, tr)} /> : null} />;

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
              const on = !f.blocked && isOnline(seen[f.id], serverNow()); const typing = !f.blocked && isTyping(f.chat, f.id, serverNow());
              const mineLast = f.last && f.last.from === uid && !f.last.deleted;
              return (
                <li key={f.id} className={`tg-row${f.unread ? ' unread' : ''}${f.muted ? ' muted' : ''}`}>
                  <button className="tg-open" onClick={() => onOpenChat(f.id)} aria-label={`${t.chat}: ${f.name}`}>
                    <span className="tg-av"><Avatar id={f.avatar} size={52} /><i className={`dot${on ? ' on' : ''}`} title={on ? t.frOnline : t.frOffline} /></span>
                    <span className="tg-mid">
                      <b className="tg-name">{f.pinned && <span className="tg-pin" aria-hidden="true">📌</span>}{f.name}{f.muted && <span className="tg-mute" aria-hidden="true"> 🔕</span>}{f.blocked && <span className="tg-mute" aria-hidden="true"> 🚫</span>}</b>
                      <small className={`tg-last${typing ? ' typing' : ''}`}>{typing ? t.typing : f.last ? previewOf(t, uid, f.last) : f.blocked ? '' : on ? t.frOnline : seenText(t, seen[f.id])}</small>
                    </span>
                    <span className="tg-end">
                      <small className="tg-time">{mineLast && <Ticks t={t} state={tickState(f.chat, f.id, f.last)} />}{listTime(f.at, t, serverNow())}</small>
                      {f.unread > 0 && <em className={`badge tg-badge${f.muted ? ' muted' : ''}`}>{f.unread > 99 ? '99+' : f.unread}</em>}
                    </span>
                  </button>
                  <span className="tg-quick">
                    <button className="icon-btn" aria-label={`${f.pinned ? t.unpinChat : t.pinChat}: ${f.name}`} onClick={() => call({ action: 'friendPin', to: f.id })}>{f.pinned ? '📍' : '📌'}</button>
                    <button type="button" className={`tg-play${on ? ' live' : ''}`} aria-label={`${t.inviteToPlay}: ${f.name}`} title={t.inviteToPlay} onClick={() => setInviting(f.id)}><PlayGlyph /></button>
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

      {inviting && list.find((f) => f.id === inviting) && <InviteSheet t={t} friend={list.find((f) => f.id === inviting)} busy={busy} onClose={() => setInviting(null)} onPick={(g, rs, tr) => invite(list.find((f) => f.id === inviting), g, rs, tr)} />}
    </div>
  );
}

/** Pick a game (and for Gebeta the type), then send the invite: the host waits in a private room, no coins. */
export function InviteSheet({ t, friend, busy, onClose, onPick }) {
  const [game, setGame] = useState('gebeta');
  const info = game === 'car' ? CAR : GAMES[game];
  const [rs, setRs] = useState(info.defaultRuleset);
  const [world, setWorld] = useState(0); const [level, setLevel] = useState(0);   // car game: the road the host picks, like the ruleset of the board games
  useEffect(() => { setRs((game === 'car' ? CAR : GAMES[game]).defaultRuleset); }, [game]);
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
        {game === 'car' && (
          <div className="fr-car-pick">
            <label>{t.carWorld || 'World'}
              <select value={world} onChange={(e) => setWorld(+e.target.value)}>{CAR_WORLDS.map((n, i) => <option key={i} value={i}>{n}</option>)}</select>
            </label>
            <label>{t.carStage || 'Stage'}
              <select value={level} onChange={(e) => setLevel(+e.target.value)}>{Array.from({ length: CAR_LEVELS }, (_, l) => <option key={l} value={l}>{`${l + 1} · ${carTier(l)}`}</option>)}</select>
            </label>
          </div>
        )}
        <p className="muted small">{t.inviteFriendly}</p>
        <div className="result-actions">
          <button className="btn" onClick={onClose}>{t.cancel}</button>
          <button className="btn primary" disabled={busy} onClick={() => onPick(game, rs, game === 'car' ? { world, level } : undefined)}>{t.inviteToPlay}</button>
        </div>
      </div>
    </div>
  );
}

const attLabelOf = (a) => (a ? (a.kind === 'file' && a.name ? `📄 ${a.name}` : { image: '📷 Photo', voice: '🎤 Voice message', file: '📄 Document' }[a.kind]) : '');
const sizeText = (n) => (n >= 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);
/** The bubble is a button, except when it holds a file: a player or a link cannot live inside a button. */
function Bub({ m, children, disabled, onClick, ...rest }) {
  return m.att && !m.deleted
    ? <div role="button" tabIndex={0} onClick={onClick} onKeyDown={(e) => { if (e.key === 'Enter') onClick?.(e); }} {...rest}>{children}</div>
    : <button disabled={disabled} onClick={onClick} {...rest}>{children}</button>;
}
/** A photo, voice note or document inside a chat bubble. */
function Attachment({ att }) {
  const stop = (e) => e.stopPropagation();
  if (att.kind === 'image') return <a className="tg-att img" href={att.url} target="_blank" rel="noopener noreferrer" onClick={stop}><img src={att.url} alt="" loading="lazy" /></a>;
  if (att.kind === 'voice') return <span className="tg-att voice" onClick={stop}><audio controls preload="none" src={att.url} /></span>;
  return <a className="tg-att doc" href={att.url} target="_blank" rel="noopener noreferrer" download={att.name || true} onClick={stop}><span aria-hidden="true">📄</span><b>{att.name || 'Document'}</b><small>{sizeText(att.size || 0)}</small></a>;
}

/** Message text with WhatsApp formatting (*bold* _italic_ ~strike~ `mono`) and tappable web links. Rendered as React elements, never as HTML. */
function RichText({ text }) {
  return parseRich(text).map((p, i) => {
    if (p.t === 'text') return <React.Fragment key={i}>{p.v}</React.Fragment>;
    if (p.t === 'bold') return <strong key={i}>{p.v}</strong>;
    if (p.t === 'italic') return <em key={i}>{p.v}</em>;
    if (p.t === 'strike') return <s key={i}>{p.v}</s>;
    if (p.t === 'mono') return <code key={i} className="tg-mono">{p.v}</code>;
    const url = safeUrl(p.v);
    return url ? <span key={i} role="link" tabIndex={0} className="tg-link" onClick={(e) => { e.stopPropagation(); window.open(url, '_blank', 'noopener,noreferrer'); }} onKeyDown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); window.open(url, '_blank', 'noopener,noreferrer'); } }}>{p.v}</span> : <React.Fragment key={i}>{p.v}</React.Fragment>;
  });
}

/** One-to-one chat: bubbles with reply quotes, edited mark, ticks, reactions, typing and last seen. Tap a bubble for its actions. */
export function FriendChat({ t, lang, uid, friend, chat, seenAt, social, muted = false, blocked = false, onBack, onInvite, onUnfriend, sheet }) {
  const [text, setText] = useState(''); const [busy, setBusy] = useState(false); const [err, setErr] = useState('');
  const [menu, setMenu] = useState(null);       // message id whose action sheet is open
  const [reply, setReply] = useState(null);     // message being answered
  const [editing, setEditing] = useState(null); // message being edited
  const [pending, setPending] = useState([]);   // lines sent but not yet echoed back (shown at once, like Telegram)
  const [more, setMore] = useState(false);
  const [view, setView] = useState(null);       // null | 'search' | 'starred': filters what the chat shows
  const [term, setTerm] = useState('');
  const [fwd, setFwd] = useState(null);         // message being forwarded (friend picker open)
  const [note, setNote] = useState('');
  const [divider, setDivider] = useState(null); // { id, n }: where "N unread messages" is drawn (kept after the chat is marked read)
  const [theme, setTheme] = useState('wa-light');
  const [emojiOpen, setEmojiOpen] = useState(false); const [etab, setEtab] = useState('smile'); const [recent, setRecent] = useState([]);
  const [down, setDown] = useState(0);              // floating "jump to latest" button: number of new lines while scrolled up
  const [rec, setRec] = useState(null);           // { stop, cancel, sec } while a voice note is being recorded
  const [up, setUp] = useState(null);             // { label, pct } while a file is uploading
  const input = useRef(null); const seenLen = useRef(0); const photoIn = useRef(null); const fileIn = useRef(null);
  useEffect(() => { const dark = typeof window.matchMedia === 'function' && window.matchMedia('(prefers-color-scheme: dark)').matches; const v = store.get(THEME_KEY, dark ? 'wa-dark' : 'wa-light'); if (THEMES.includes(v)) setTheme(v); try { setRecent(JSON.parse(store.get(RECENT_KEY, '[]')).slice(0, 24)); } catch { /* ignore */ } }, []);
  const nextTheme = () => { const n = THEMES[(THEMES.indexOf(theme) + 1) % THEMES.length]; setTheme(n); store.set(THEME_KEY, n); setMore(false); };
  const addEmoji = (e) => {
    const el = input.current; const a = el?.selectionStart ?? text.length, b = el?.selectionEnd ?? text.length;
    const v = (text.slice(0, a) + e + text.slice(b)).slice(0, 1000); setText(v);
    const r = pushRecent(recent, e); setRecent(r); store.set(RECENT_KEY, JSON.stringify(r)); ping();
    requestAnimationFrame(() => { try { el?.setSelectionRange(a + e.length, a + e.length); } catch { /* ignore */ } });
  };
  const toBottom = () => { stick.current = true; setDown(0); end.current?.scrollIntoView?.({ block: 'end', behavior: 'smooth' }); };
  const box = useRef(null); const end = useRef(null); const lastPing = useRef(0); const stick = useRef(true);
  const online = !blocked && isOnline(seenAt, serverNow());
  const typing = !blocked && isTyping(chat, friend.id, serverNow());
  const unread = chat?.unread?.[uid] || 0;
  const real = useMemo(() => visibleMsgs(chat, uid), [chat, uid]);   // not cleared, not deleted for me, nothing held back from a block
  const msgs = useMemo(() => {
    const ids = new Set(real.map((m) => m.id));
    const ghosts = pending.filter((p) => !ids.has(p.id) && !real.some((m) => m.from === uid && m.text === p.text && Math.abs(m.at - p.at) < 20000));
    return [...real, ...ghosts];
  }, [real, pending, uid]);
  const byId = useMemo(() => Object.fromEntries(real.map((m) => [m.id, m])), [real]);
  const starredCount = useMemo(() => real.filter((m) => !m.deleted && (m.starred || []).includes(uid)).length, [real, uid]);
  const shown = useMemo(() => (view === 'starred' ? msgs.filter((m) => !m.deleted && (m.starred || []).includes(uid)) : view === 'search' && term.trim() ? searchMsgs(msgs, term) : msgs), [msgs, view, term, uid]);
  useEffect(() => { if (divider || unread <= 0) return; const id = firstUnreadId(real, friend.id, unread); if (id) setDivider({ id, n: unread }); }, [unread, real, divider, friend.id]);

  useEffect(() => { social?.boost?.(true); return () => social?.boost?.(false); }, [social?.boost]);   // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (stick.current) end.current?.scrollIntoView?.({ block: 'end' }); }, [msgs.length, typing]);
  useEffect(() => { if (unread > 0) apiCall({ action: 'chatRead', to: friend.id }, { retries: 0 }).then(() => social?.refresh?.()).catch(() => {}); }, [unread, friend.id]);   // eslint-disable-line react-hooks/exhaustive-deps
  const onScroll = () => { const b = box.current; if (b) { stick.current = b.scrollHeight - b.scrollTop - b.clientHeight < 120; if (stick.current) setDown(0); } };
  useEffect(() => { const add = msgs.length - seenLen.current; seenLen.current = msgs.length; if (add > 0 && !stick.current && seenLen.current > add) setDown((d) => d + add); }, [msgs.length]);

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
  const sendAtt = async (kind, blob, extra = {}) => {
    setErr(''); setUp({ label: kind === 'image' ? '📷' : kind === 'voice' ? '🎤' : '📄', pct: 0 });
    try {
      const att = await uploadAttachment(uid, kind, blob, { ...extra, onProgress: (p) => setUp((u) => (u ? { ...u, pct: p } : u)) });
      stick.current = true;
      await apiCall({ action: 'chatSend', to: friend.id, att, replyTo: reply?.id });
      setReply(null); social?.refresh?.();
    } catch (e) { setErr(e.message || 'Could not send the file'); }
    setUp(null);
  };
  const pickPhoto = async (e) => { const f = e.target.files?.[0]; e.target.value = ''; if (!f) return; try { await sendAtt('image', await shrinkImage(f)); } catch (x) { setErr(x.message); } };
  const pickFile = async (e) => { const f = e.target.files?.[0]; e.target.value = ''; if (!f) return; await sendAtt(/^image\//.test(f.type) ? 'image' : 'file', /^image\//.test(f.type) ? await shrinkImage(f).catch(() => f) : f, { name: f.name }); };
  useEffect(() => { if (!rec) return undefined; const id = setInterval(() => setRec((r) => { if (!r) return r; if (r.sec + 1 >= MAX_VOICE_SECONDS) { finishRec(true); return r; } return { ...r, sec: r.sec + 1 }; }), 1000); return () => clearInterval(id); }, [!!rec]);   // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => { rec?.cancel?.(); }, []);   // eslint-disable-line react-hooks/exhaustive-deps
  const startRec = async () => { setErr(''); try { const r = await startRecording(); setRec({ ...r, sec: 0 }); } catch (e) { setErr(e.name === 'NotAllowedError' ? 'Allow the microphone to record a voice note.' : e.message); } };
  const finishRec = async (send) => { const r = rec; if (!r) return; setRec(null); if (!send) { r.cancel(); return; } const { blob, dur } = await r.stop(); if (dur < 0.6 || blob.size < 500) return; await sendAtt('voice', blob, { dur }); };
  const act = async (body) => { setMenu(null); setErr(''); try { await apiCall(body); social?.refresh?.(); } catch (e) { setErr(e.message); } };
  const flag = async (body, confirm) => { setMore(false); if (confirm && !window.confirm(confirm)) return; setErr(''); try { await apiCall(body); social?.refresh?.(); } catch (e) { setErr(e.message); } };
  const openView = (v) => { setMore(false); setTerm(''); setView(v); };
  const forwardTo = async (f) => {
    const m = fwd; setFwd(null); if (!m) return; setErr('');
    try { await apiCall({ action: 'chatSend', to: f.id, text: m.text, fwd: true }); setNote(t.forwardDone(f.name)); setTimeout(() => setNote(''), 2200); social?.refresh?.(); } catch (e) { setErr(e.message); }
  };
  const startEdit = (m) => { setMenu(null); setReply(null); setEditing(m); setText(m.text); };
  const startReply = (m) => { setMenu(null); setEditing(null); setReply(m); };
  const copy = async (m) => { setMenu(null); try { await navigator.clipboard.writeText(m.text); } catch { /* ignore */ } };
  const jump = (id) => { const el = box.current?.querySelector(`[data-mid="${id}"]`); if (el) { el.scrollIntoView({ block: 'center', behavior: 'smooth' }); el.classList.add('flash'); setTimeout(() => el.classList.remove('flash'), 1200); } };
  const menuMsg = menu ? byId[menu] : null;
  const flags = useMemo(() => groupFlags(shown), [shown]);
  // swipe a message to the right to reply (like WhatsApp): only a mostly-horizontal drag counts, vertical scrolling is untouched
  const sw = useRef(null); const SWIPE = 56;
  const swReset = (s, row) => { if (s?.el) { s.el.style.transition = 'transform .18s ease'; s.el.style.transform = ''; } if (row) delete row.dataset.swipe; };
  const swStart = (m) => (e) => { if (m.pending || m.deleted || e.touches.length !== 1) { sw.current = null; return; } const c = e.touches[0]; sw.current = { x: c.clientX, y: c.clientY, done: false, lock: false, el: e.currentTarget.querySelector('.tg-bubble') }; if (sw.current.el) sw.current.el.style.transition = 'none'; };
  const swMove = (e) => {
    const s = sw.current; if (!s?.el) return; const c = e.touches[0]; const dx = c.clientX - s.x, dy = c.clientY - s.y;
    if (!s.lock) { if (Math.abs(dy) > 10 && Math.abs(dy) > Math.abs(dx)) { swReset(s, e.currentTarget); sw.current = null; return; } if (dx > 10 && dx > Math.abs(dy)) s.lock = true; else return; }
    const x = Math.max(0, Math.min(dx, 72)); s.el.style.transform = `translateX(${x}px)`; e.currentTarget.dataset.swipe = x >= SWIPE ? 'ready' : 'pull';
    if (x >= SWIPE && !s.done) { s.done = true; try { navigator.vibrate?.(12); } catch { /* not supported */ } } else if (x < SWIPE) s.done = false;
  };
  const swCancel = (e) => { const s = sw.current; sw.current = null; if (s) swReset(s, e.currentTarget); };
  const swEnd = (m) => (e) => { const s = sw.current; sw.current = null; if (!s) return; const row = e.currentTarget; swReset(s, row); if (s.done) { startReply(m); requestAnimationFrame(() => input.current?.focus()); } };

  let lastDay = '';
  return (
    <div className={`panel tg-chat th-${theme}`}>
      <div className="tg-head">
        <button className="icon-btn" onClick={onBack} aria-label={t.backHome}>‹</button>
        <span className="fr-av"><Avatar id={friend.avatar} size={40} /><i className={`dot${online ? ' on' : ''}`} /></span>
        <span className="fr-name"><b>{friend.name}</b><small className={typing ? 'typing' : ''}>{typing ? t.typing : online ? t.frOnline : seenText(t, seenAt)}</small></span>
        <button type="button" className="tg-play head" onClick={onInvite} aria-label={t.inviteToPlay} title={t.inviteToPlay}><PlayGlyph /></button>
        <button className="icon-btn" onClick={() => setMore((v) => !v)} aria-label={t.moreActions} aria-expanded={more}>⋮</button>
        {more && <div className="tg-more" role="menu">
          <button role="menuitem" className="neutral" onClick={() => openView('search')}>🔍 {t.searchInChat}</button>
          <button role="menuitem" className="neutral" onClick={() => openView('starred')}>⭐ {t.starredMsgs}{starredCount ? ` · ${starredCount}` : ''}</button>
          <button role="menuitem" className="neutral" onClick={() => flag({ action: 'friendMute', to: friend.id })}>{muted ? '🔔' : '🔕'} {muted ? t.unmuteChat : t.muteChat}</button>
          <button role="menuitem" className="neutral" onClick={nextTheme}>🎨 {t.chatTheme}: {t[`chatTheme_${theme}`]}</button>
          <button role="menuitem" onClick={() => flag({ action: 'chatClear', to: friend.id }, t.clearChatConfirm)}>🧹 {t.clearChat}</button>
          <button role="menuitem" onClick={() => flag({ action: 'friendBlock', to: friend.id }, blocked ? null : t.blockConfirm(friend.name))}>⛔ {blocked ? t.unblockFriend : t.blockFriend}</button>
          <button role="menuitem" onClick={() => { setMore(false); onUnfriend(); }}>🚫 {t.frRemove}</button>
        </div>}
      </div>

      {view && (
        <div className="tg-find" role="search">
          {view === 'search'
            ? <input autoFocus value={term} onChange={(e) => setTerm(e.target.value.slice(0, 40))} placeholder={t.searchPh} aria-label={t.searchPh} autoComplete="off" />
            : <b className="tg-find-title">⭐ {t.starredMsgs}</b>}
          <small>{view === 'search' ? (term.trim() ? t.searchCount(shown.length) : '') : starredCount ? '' : t.noStarred}</small>
          <button className="icon-btn" aria-label={t.cancel} onClick={() => { setView(null); setTerm(''); }}>✕</button>
        </div>
      )}

      <div className="tg-msgs" ref={box} onScroll={onScroll} role="log" aria-live="polite">
        {msgs.length === 0 && <p className="muted center-text">{t.chatEmpty}</p>}
        {msgs.length > 0 && !view && <div className="tg-note" role="note">💬 {t.chatNotice(friend.name)}</div>}
        {shown.map((m, mi) => {
          const mine = m.from === uid; const day = dayKey(m.at); const sep = day !== lastDay; lastDay = day;
          const rx = Object.entries(m.reactions || {}); const fl = flags[mi] || { first: true, last: true }; const big = !m.deleted && isEmojiOnly(m.text);
          return (
            <React.Fragment key={m.id}>
              {sep && <div className="tg-day"><span>{dayLabel(t, m.at)}</span></div>}
              {!view && divider && divider.id === m.id && <div className="tg-unread" role="separator" data-divider><span>{t.unreadDivider(divider.n)}</span></div>}
              <div className={`tg-msg${mine ? ' me' : ''}${m.deleted ? ' gone' : ''}${sep || fl.first ? ' first' : ''}${fl.last ? ' last' : ''}${big ? ' big' : ''}`} data-mid={m.id} onTouchStart={swStart(m)} onTouchMove={swMove} onTouchEnd={swEnd(m)} onTouchCancel={swCancel}>
                <Bub m={m} className="tg-bubble" disabled={m.pending || m.deleted} onClick={() => setMenu(m.id)} aria-label={t.moreActions}>
                  {m.fwd && !m.deleted && <span className="tg-fwd">↪ {t.forwarded}</span>}
                  {m.reply && <span className="tg-quote" onClick={(e) => { e.stopPropagation(); jump(m.reply.id); }}><b>{m.reply.from === uid ? t.chatYou : friend.name}</b><span>{m.reply.text || t.deletedMsg}</span></span>}
                  {!m.deleted && m.att && <Attachment att={m.att} />}
                  {(!m.att || m.deleted || (m.text && m.text !== attLabelOf(m.att))) && <span className="tg-text">{m.deleted ? t.deletedMsg : <RichText text={m.text} />}</span>}
                  <small className="tg-meta">{(m.starred || []).includes(uid) && !m.deleted && <span className="tg-star" aria-label={t.starMsg}>★</span>}{m.edited && !m.deleted && <i>{t.edited}</i>}{hhmm(m.at)}{mine && !m.deleted && (m.pending ? <span className="tg-ticks">🕓</span> : <Ticks t={t} state={tickState(chat, friend.id, m)} />)}</small>
                </Bub>
                {rx.length > 0 && <div className="tg-rx">{rx.map(([e, ids]) => (
                  <button key={e} className={`tg-chip${ids.includes(uid) ? ' mine' : ''}`} onClick={() => act({ action: 'chatReact', to: friend.id, id: m.id, emoji: e })}>{e}{ids.length > 1 ? <em>{ids.length}</em> : null}</button>
                ))}</div>}
              </div>
            </React.Fragment>
          );
        })}
        {typing && !view && <div className="tg-msg"><span className="tg-bubble tg-dots" aria-label={t.typing}><i /><i /><i /></span></div>}
        <div ref={end} />
      </div>

      {(reply || editing) && (
        <div className="tg-ctx">
          <span className="tg-ctx-bar" />
          <span className="tg-ctx-txt"><b>{editing ? t.editing : `${t.replyTo} ${reply.from === uid ? t.chatYou : friend.name}`}</b><span>{(editing || reply).text}</span></span>
          <button className="icon-btn" aria-label={t.cancel} onClick={() => { setReply(null); setEditing(null); setText(''); }}>✕</button>
        </div>
      )}
      {down > 0 || !stick.current ? <button className="tg-down" onClick={toBottom} aria-label={t.chatDown}>⌄{down > 0 ? <em>{down}</em> : null}</button> : null}
      {up && <p className="fr-note tg-toast" role="status">{up.label} {Math.round(up.pct * 100)}%</p>}
      {blocked && <p className="tg-blocked" role="status">⛔ {t.blockedNote}</p>}
      {note && <p className="fr-note tg-toast" role="status">{note}</p>}
      <form className="tg-send" hidden={blocked} onSubmit={(e) => { e.preventDefault(); send(); }}>
        <span className="tg-pill">
          <button type="button" className="tg-emoji-btn" aria-label={t.chatEmoji} aria-expanded={emojiOpen} onClick={() => setEmojiOpen((v) => !v)}>{emojiOpen ? '⌨️' : '😊'}</button>
          {rec ? <span className="tg-rec" role="status"><i /> {Math.floor(rec.sec / 60)}:{String(rec.sec % 60).padStart(2, '0')}</span> : null}
          <input hidden={!!rec} ref={input} value={text} onChange={(e) => { setText(e.target.value.slice(0, 1000)); if (e.target.value) ping(); }} onFocus={() => setEmojiOpen(false)} placeholder={t.chatWrite} aria-label={t.chatWrite} maxLength={1000} autoComplete="off" enterKeyHint="send" />
        </span>
        {!rec && !editing && storageAvailable() && <>
          <button type="button" className="tg-att-btn" aria-label="Document" disabled={!!up} onClick={() => fileIn.current?.click()}>📎</button>
          <button type="button" className="tg-att-btn" aria-label="Photo" disabled={!!up} onClick={() => photoIn.current?.click()}>📷</button>
        </>}
        {rec ? (<>
          <button type="button" className="tg-att-btn" aria-label={t.cancel} onClick={() => finishRec(false)}>🗑</button>
          <button type="button" className="tg-go" aria-label={t.chatSend} onClick={() => finishRec(true)}>➤</button>
        </>) : (!text.trim() && !editing && storageAvailable())
          ? <button type="button" className="tg-go" disabled={!!up} aria-label="Voice message" onClick={startRec}>🎤</button>
          : <button className="tg-go" disabled={busy || !text.trim()} aria-label={t.chatSend}>{editing ? '✓' : '➤'}</button>}
        <input ref={photoIn} type="file" accept="image/*" hidden onChange={pickPhoto} />
        <input ref={fileIn} type="file" hidden onChange={pickFile} />
      </form>
      {emojiOpen && (
        <div className="tg-emoji" role="group" aria-label={t.chatEmoji}>
          <div className="tg-etabs" role="tablist">
            {EMOJI_TABS.map((c) => <button key={c.id} type="button" role="tab" aria-selected={etab === c.id} className={etab === c.id ? 'on' : ''} onClick={() => setEtab(c.id)}>{c.icon}</button>)}
          </div>
          <div className="tg-egrid">
            {(etab === 'recent' ? recent : splitEmoji(EMOJI_TABS.find((c) => c.id === etab)?.list || '')).map((e) => <button key={e} type="button" onClick={() => addEmoji(e)}>{e}</button>)}
            {etab === 'recent' && !recent.length && <p className="muted small">{t.chatNoRecent}</p>}
          </div>
        </div>
      )}
      {err && <p className="err" role="alert">{err}</p>}

      {menuMsg && (
        <div className="overlay" role="dialog" aria-modal="true" onClick={(e) => { if (e.target === e.currentTarget) setMenu(null); }}>
          <div className="dialog tg-sheet">
            <div className="tg-react-bar">{REACTIONS.map((e) => <button key={e} className={(menuMsg.reactions?.[e] || []).includes(uid) ? 'mine' : ''} onClick={() => act({ action: 'chatReact', to: friend.id, id: menuMsg.id, emoji: e })}>{e}</button>)}</div>
            <button className="tg-act" onClick={() => startReply(menuMsg)}>↩️ {t.replyTo}</button>
            <button className="tg-act" onClick={() => copy(menuMsg)}>📋 {t.copyMsg}</button>
            <button className="tg-act" onClick={() => act({ action: 'chatStar', to: friend.id, id: menuMsg.id })}>{(menuMsg.starred || []).includes(uid) ? '☆' : '⭐'} {(menuMsg.starred || []).includes(uid) ? t.unstarMsg : t.starMsg}</button>
            <button className="tg-act" onClick={() => { setFwd(menuMsg); setMenu(null); }}>↪️ {t.forwardMsg}</button>
            <button className="tg-act" onClick={() => act({ action: 'chatHide', to: friend.id, id: menuMsg.id })}>🗑️ {t.deleteForMe}</button>
            {menuMsg.from === uid && <button className="tg-act" onClick={() => startEdit(menuMsg)}>✏️ {t.editMsg}</button>}
            {menuMsg.from === uid && <button className="tg-act bad" onClick={() => act({ action: 'chatDelete', to: friend.id, id: menuMsg.id })}>🗑️ {t.deleteMsg}</button>}
          </div>
        </div>
      )}
      {fwd && (
        <div className="overlay" role="dialog" aria-modal="true" aria-label={t.forwardTo} onClick={(e) => { if (e.target === e.currentTarget) setFwd(null); }}>
          <div className="dialog tg-sheet tg-fwd-sheet">
            <h3>{t.forwardTo}</h3>
            {(() => { const fl = Object.entries(social?.friends?.list || {}).filter(([id]) => !(social?.friends?.blocked || []).includes(id)).map(([id, c]) => ({ id, ...c })); return fl.length === 0 ? <p className="muted small">{t.forwardNone}</p> : fl.map((f) => (
              <button key={f.id} className="tg-act tg-fwd-row" onClick={() => forwardTo(f)}><Avatar id={f.avatar} size={34} /><span>{f.name}</span></button>
            )); })()}
            <button className="tg-act" onClick={() => setFwd(null)}>{t.cancel}</button>
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
