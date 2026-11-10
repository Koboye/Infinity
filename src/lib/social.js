// Friends, direct chat and game invites (v73) — the pure rules, shared by the server (src/lib/online/socialApi.js) and the tests.
// Nothing here touches Firebase: every function takes plain documents and returns new ones.
//
// friends/{uid}  = { code, list: {uid: card}, incoming: {uid: card}, outgoing: {uid: card} }      card = { name, avatar, at }
// chats/{a_b}    = { users: [a, b], msgs: [{ from, text, at }], unread: { a: n, b: n }, updatedAt }
// invites/{uid}  = { items: [{ id, from, name, avatar, game, ruleset, code, fee, at }] }
// Firestore cannot hold arrays inside arrays, so people are keyed by uid in maps and messages are flat objects.

export const MAX_FRIENDS = 100;
export const MAX_REQUESTS = 50;
export const MAX_MSGS = 200;
export const MAX_TEXT = 1000;
export const MAX_ROOM_MSGS = 30;
export const MAX_INVITES = 10;
export const INVITE_TTL_MS = 10 * 60 * 1000;     // an invite is only good while the host is still waiting in the room
export const ONLINE_MS = 90 * 1000;              // seen within this long = online

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const FRIEND_CODE_LEN = 6;
export const makeFriendCode = (rng = Math.random) => Array.from({ length: FRIEND_CODE_LEN }, () => CODE_CHARS[Math.floor(rng() * CODE_CHARS.length)]).join('');
export const normalizeFriendCode = (c) => String(c || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, FRIEND_CODE_LEN);

export const pairId = (a, b) => [a, b].sort().join('_');
export const isOnline = (at, now = Date.now()) => Number.isFinite(at) && now - at < ONLINE_MS;

export const emptyFriends = () => ({ code: null, list: {}, incoming: {}, outgoing: {} });
const card = (p, now) => ({ name: String(p.name || 'Player').slice(0, 20), avatar: String(p.avatar || 'lion').slice(0, 12), at: now });
const without = (o, k) => { const c = { ...o }; delete c[k]; return c; };
const norm = (d) => ({ ...emptyFriends(), ...(d || {}), list: { ...(d?.list || {}) }, incoming: { ...(d?.incoming || {}) }, outgoing: { ...(d?.outgoing || {}) } });

/** One line of free text: control characters removed, spaces collapsed, cut to MAX_TEXT. '' when there is nothing to send. */
export function cleanText(text, max = MAX_TEXT) {
  return String(text ?? '').replace(/[\u0000-\u001f\u007f]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
}

/**
 * `me` asks `them` to be friends. If `them` had already asked `me`, the two requests meet and the friendship starts at once.
 * Returns { mine, theirs, result } where result is 'sent' | 'accepted' | 'already' | 'self' | 'full' | 'pending'.
 */
export function requestFriend(mineIn, theirsIn, me, them, now = Date.now()) {
  const mine = norm(mineIn), theirs = norm(theirsIn);
  if (me.uid === them.uid) return { mine, theirs, result: 'self' };
  if (mine.list[them.uid]) return { mine, theirs, result: 'already' };
  if (mine.incoming[them.uid]) return { ...acceptFriend(mine, theirs, me, them, now), result: 'accepted' };
  if (mine.outgoing[them.uid]) return { mine, theirs, result: 'pending' };
  if (Object.keys(mine.list).length >= MAX_FRIENDS || Object.keys(theirs.list).length >= MAX_FRIENDS) return { mine, theirs, result: 'full' };
  if (Object.keys(theirs.incoming).length >= MAX_REQUESTS) return { mine, theirs, result: 'full' };
  mine.outgoing[them.uid] = card(them, now);
  theirs.incoming[me.uid] = card(me, now);
  return { mine, theirs, result: 'sent' };
}

/** `me` accepts the request `them` sent. Both lists gain each other; both request maps lose the entry. */
export function acceptFriend(mineIn, theirsIn, me, them, now = Date.now()) {
  const mine = norm(mineIn), theirs = norm(theirsIn);
  if (!mine.incoming[them.uid] && !theirs.outgoing[me.uid] && !mine.list[them.uid]) return { mine, theirs, result: 'none' };
  mine.list[them.uid] = card(them, now); theirs.list[me.uid] = card(me, now);
  mine.incoming = without(mine.incoming, them.uid); mine.outgoing = without(mine.outgoing, them.uid);
  theirs.incoming = without(theirs.incoming, me.uid); theirs.outgoing = without(theirs.outgoing, me.uid);
  return { mine, theirs, result: 'accepted' };
}

/** Decline an incoming request, cancel an outgoing one, or unfriend: whatever links the two is removed on both sides. */
export function severFriend(mineIn, theirsIn, meUid, themUid) {
  const mine = norm(mineIn), theirs = norm(theirsIn);
  for (const k of ['list', 'incoming', 'outgoing']) { mine[k] = without(mine[k], themUid); theirs[k] = without(theirs[k], meUid); }
  return { mine, theirs };
}

export const areFriends = (friendsDoc, uid) => !!friendsDoc?.list?.[uid];

export const REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🔥'];
export const TYPING_MS = 5000;                   // "typing…" shows for this long after the last keystroke ping
const newId = (now) => `${now.toString(36)}${Math.random().toString(36).slice(2, 6)}`;
const snippet = (m) => (m?.deleted ? '' : String(m?.text || '').slice(0, 80));

/** Append a message to a pair's chat (newest last, capped) and count it as unread for the other person. `replyTo` = id of the line answered. */
export function pushChat(chatIn, from, to, text, now = Date.now(), replyTo = null) {
  const t = cleanText(text);
  if (!t) return { chat: chatIn, error: 'Write a message first' };
  const chat = { ...(chatIn || {}), users: [from, to].sort(), msgs: [...(chatIn?.msgs || [])], unread: { ...(chatIn?.unread || {}) }, updatedAt: now };
  const msg = { id: newId(now), from, text: t, at: now };
  const target = replyTo ? chat.msgs.find((m) => m.id === replyTo && !m.deleted) : null;
  if (target) msg.reply = { id: target.id, from: target.from, text: snippet(target) };
  chat.msgs.push(msg);
  if (chat.msgs.length > MAX_MSGS) chat.msgs = chat.msgs.slice(-MAX_MSGS);
  chat.unread[to] = (chat.unread[to] || 0) + 1;
  chat.unread[from] = 0;
  chat.typing = { ...(chat.typing || {}), [from]: 0 };
  return { chat };
}
/** `uid` has opened the chat: their unread count is cleared and the time is kept so the sender sees the double tick. */
export function markRead(chatIn, uid, now = Date.now()) {
  if (!chatIn) return chatIn;
  return { ...chatIn, unread: { ...(chatIn.unread || {}), [uid]: 0 }, readAt: { ...(chatIn.readAt || {}), [uid]: now } };
}
/** One of my own lines, with new text (marked edited). */
export function editMsg(chatIn, uid, id, text) {
  const t = cleanText(text);
  if (!t) return { chat: chatIn, error: 'Write a message first' };
  const i = (chatIn?.msgs || []).findIndex((m) => m.id === id);
  if (i < 0 || chatIn.msgs[i].from !== uid || chatIn.msgs[i].deleted) return { chat: chatIn, error: 'You can only edit your own messages' };
  const msgs = chatIn.msgs.slice(); msgs[i] = { ...msgs[i], text: t, edited: true };
  return { chat: { ...chatIn, msgs } };
}
/** Delete my own line for both people (it stays as a grey "deleted" bubble, like Telegram's "delete for everyone"). */
export function deleteMsg(chatIn, uid, id) {
  const i = (chatIn?.msgs || []).findIndex((m) => m.id === id);
  if (i < 0 || chatIn.msgs[i].from !== uid) return { chat: chatIn, error: 'You can only delete your own messages' };
  const msgs = chatIn.msgs.slice(); msgs[i] = { id, from: uid, at: msgs[i].at, deleted: true, text: '' };
  return { chat: { ...chatIn, msgs } };
}
/** Add or take away my reaction on any line; one reaction per person per line (a new one replaces the old). */
export function reactMsg(chatIn, uid, id, emoji) {
  if (!REACTIONS.includes(emoji)) return { chat: chatIn, error: 'Unknown reaction' };
  const i = (chatIn?.msgs || []).findIndex((m) => m.id === id);
  if (i < 0 || chatIn.msgs[i].deleted) return { chat: chatIn, error: 'That message is gone' };
  const reactions = {};
  for (const [e, ids] of Object.entries(chatIn.msgs[i].reactions || {})) { const keep = ids.filter((u) => u !== uid); if (keep.length) reactions[e] = keep; }
  const had = (chatIn.msgs[i].reactions?.[emoji] || []).includes(uid);
  if (!had) reactions[emoji] = [...(reactions[emoji] || []), uid];
  const msgs = chatIn.msgs.slice(); msgs[i] = { ...msgs[i], reactions };
  return { chat: { ...chatIn, msgs } };
}
export const setTyping = (chatIn, uid, now = Date.now()) => (chatIn ? { ...chatIn, typing: { ...(chatIn.typing || {}), [uid]: now } } : chatIn);
export const isTyping = (chat, uid, now = Date.now()) => Number.isFinite(chat?.typing?.[uid]) && now - chat.typing[uid] < TYPING_MS;
/** Pin or unpin a friend at the top of my chat list (kept on my own friends document). */
export function togglePin(friendsIn, uid, max = 5) {
  const f = norm(friendsIn); const pins = (friendsIn?.pins || []).filter((x) => f.list[x]);
  const next = pins.includes(uid) ? pins.filter((x) => x !== uid) : f.list[uid] ? [uid, ...pins].slice(0, max) : pins;
  return { ...f, pins: next };
}
/** "Last seen" wording as a key plus a number, so the screen can translate it: ['now'] | ['min', n] | ['hour', n] | ['day', n] | ['long']. */
export function lastSeenParts(at, now = Date.now()) {
  if (!Number.isFinite(at)) return ['long'];
  const s = Math.max(0, (now - at) / 1000);
  if (s < ONLINE_MS / 1000) return ['now'];
  if (s < 3600) return ['min', Math.max(1, Math.round(s / 60))];
  if (s < 86400) return ['hour', Math.round(s / 3600)];
  if (s < 86400 * 7) return ['day', Math.round(s / 86400)];
  return ['long'];
}

/** Add an invite to a friend's inbox: newest first, expired ones dropped, one per host (a new one replaces the old). */
export function pushInvite(docIn, invite, now = Date.now()) {
  const items = (docIn?.items || []).filter((i) => now - i.at < INVITE_TTL_MS && i.from !== invite.from);
  items.unshift({ ...invite, at: now });
  return { items: items.slice(0, MAX_INVITES) };
}
export const dropInvite = (docIn, id) => ({ items: (docIn?.items || []).filter((i) => i.id !== id) });
export const liveInvites = (docIn, now = Date.now()) => (docIn?.items || []).filter((i) => now - i.at < INVITE_TTL_MS);

/** Free-text chat inside a running match: the last MAX_ROOM_MSGS lines, kept on the room itself. */
export function pushRoomChat(chatIn, seat, text, now = Date.now()) {
  const t = cleanText(text, 120);
  if (!t) return { chat: chatIn || [], error: 'Write a message first' };
  const chat = [...(chatIn || []), { by: seat, text: t, at: now }];
  return { chat: chat.slice(-MAX_ROOM_MSGS) };
}

/** How many things want this player's attention: requests, unread chats, live invites (the badge on the Friends tab). */
export function badgeCount({ friends, chats = [], invites }, uid, now = Date.now()) {
  const req = Object.keys(friends?.incoming || {}).length;
  const unread = chats.reduce((n, c) => n + (c.unread?.[uid] || 0), 0);
  return req + unread + liveInvites(invites, now).length;
}
