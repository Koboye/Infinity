// Friends, direct chat and game invites (v73) — the pure rules, shared by the server (src/lib/online/socialApi.js) and the tests.
// Nothing here touches Firebase: every function takes plain documents and returns new ones.
//
// friends/{uid}  = { code, username, bio, privacy: { lastSeen }, list, incoming, outgoing, blocked, pinned, muted, nick }
//                  list / incoming / outgoing / blocked = { uid: card }, card = { name, avatar, username?, note?, at }
//                  pinned / muted = { uid: true }, nick = { uid: "my own name for this contact" }
// usernames/{name} = { uid, key }   (server-only; @username → uid, searched by prefix on `key`)
// chats/{a_b}    = { users: [a, b], msgs: [{ id, from, text, at, re?, ed?, rx? }], unread, read: { a: ms, b: ms }, typing: { uid: ms }, seq, updatedAt }
// invites/{uid}  = { items: [{ id, from, name, avatar, game, ruleset, code, fee, at }] }
// Firestore cannot hold arrays inside arrays, so people are keyed by uid in maps and messages are flat objects.

export const MAX_FRIENDS = 100;
export const MAX_REQUESTS = 50;
export const MAX_MSGS = 50;
export const MAX_TEXT = 300;
export const MAX_ROOM_MSGS = 30;
export const MAX_INVITES = 10;
export const INVITE_TTL_MS = 10 * 60 * 1000;     // an invite is only good while the host is still waiting in the room
export const ONLINE_MS = 90 * 1000;              // seen within this long = online
export const EDIT_MS = 48 * 60 * 60 * 1000;      // a message can be edited for 48 hours (same as Telegram)
export const TYPING_MS = 6 * 1000;               // "typing…" fades after this long without a new keystroke
export const MAX_NOTE = 100;                     // optional line sent with a friend request
export const MAX_NICK = 20;
export const MAX_BIO = 70;
export const MAX_BLOCKED = 100;
export const REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🔥'];
export const LAST_SEEN = ['everyone', 'friends', 'nobody'];

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const FRIEND_CODE_LEN = 6;
export const makeFriendCode = (rng = Math.random) => Array.from({ length: FRIEND_CODE_LEN }, () => CODE_CHARS[Math.floor(rng() * CODE_CHARS.length)]).join('');
export const normalizeFriendCode = (c) => String(c || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, FRIEND_CODE_LEN);

// @username: 5–20 characters, a–z 0–9 and _, starting with a letter (Telegram allows 5–32; shorter keeps links friendly).
export const USERNAME_MIN = 5, USERNAME_MAX = 20;
const RESERVED = new Set(['admin', 'infinity', 'support', 'moderator', 'official', 'system', 'gebeta', 'staff']);
export const normalizeUsername = (u) => String(u ?? '').trim().replace(/^@+/, '').toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, USERNAME_MAX);
export function checkUsername(u) {
  const n = normalizeUsername(u);
  if (n.length < USERNAME_MIN) return { ok: false, error: `At least ${USERNAME_MIN} characters` };
  if (!/^[a-z]/.test(n)) return { ok: false, error: 'Start with a letter' };
  if (RESERVED.has(n)) return { ok: false, error: 'That name is reserved' };
  return { ok: true, name: n };
}

export const pairId = (a, b) => [a, b].sort().join('_');
export const isOnline = (at, now = Date.now()) => Number.isFinite(at) && now - at < ONLINE_MS;

const MAPS = ['list', 'incoming', 'outgoing', 'blocked', 'pinned', 'muted', 'nick'];
export const emptyFriends = () => ({ code: null, username: null, bio: '', privacy: { lastSeen: 'everyone' }, list: {}, incoming: {}, outgoing: {}, blocked: {}, pinned: {}, muted: {}, nick: {} });
const card = (p, now, note) => {
  const c = { name: String(p.name || 'Player').slice(0, 20), avatar: String(p.avatar || 'lion').slice(0, 12), at: now };
  if (p.username) c.username = String(p.username).slice(0, USERNAME_MAX);
  if (note) c.note = note;
  return c;
};
const without = (o, k) => { const c = { ...o }; delete c[k]; return c; };
const norm = (d) => {
  const out = { ...emptyFriends(), ...(d || {}), privacy: { lastSeen: 'everyone', ...(d?.privacy || {}) } };
  for (const k of MAPS) out[k] = { ...(d?.[k] || {}) };
  return out;
};

/** One line of free text: control characters removed, spaces collapsed, cut to MAX_TEXT. '' when there is nothing to send. */
export function cleanText(text, max = MAX_TEXT) {
  return String(text ?? '').replace(/[\u0000-\u001f\u007f]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
}

/**
 * `me` asks `them` to be friends. If `them` had already asked `me`, the two requests meet and the friendship starts at once.
 * Returns { mine, theirs, result } where result is 'sent' | 'accepted' | 'already' | 'self' | 'full' | 'pending'.
 */
export function requestFriend(mineIn, theirsIn, me, them, now = Date.now(), note = '') {
  const mine = norm(mineIn), theirs = norm(theirsIn);
  if (me.uid === them.uid) return { mine, theirs, result: 'self' };
  if (mine.blocked[them.uid]) return { mine, theirs, result: 'youBlocked' };
  if (theirs.blocked[me.uid]) return { mine, theirs, result: 'blocked' };
  if (mine.list[them.uid]) return { mine, theirs, result: 'already' };
  if (mine.incoming[them.uid]) return { ...acceptFriend(mine, theirs, me, them, now), result: 'accepted' };
  if (mine.outgoing[them.uid]) return { mine, theirs, result: 'pending' };
  if (Object.keys(mine.list).length >= MAX_FRIENDS || Object.keys(theirs.list).length >= MAX_FRIENDS) return { mine, theirs, result: 'full' };
  if (Object.keys(theirs.incoming).length >= MAX_REQUESTS) return { mine, theirs, result: 'full' };
  const n = cleanText(note, MAX_NOTE);
  mine.outgoing[them.uid] = card(them, now);
  theirs.incoming[me.uid] = card(me, now, n);
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
  // a pin, mute or nickname belongs to the friendship: it goes when the friendship does
  for (const k of ['pinned', 'muted', 'nick']) mine[k] = without(mine[k], themUid);
  return { mine, theirs };
}

/** Block: whatever links the two is removed, and `them` can no longer send me requests or find me by name. Returns { mine, theirs, result }. */
export function blockPlayer(mineIn, theirsIn, me, them, now = Date.now()) {
  if (me.uid === them.uid) return { mine: norm(mineIn), theirs: norm(theirsIn), result: 'self' };
  const out = severFriend(mineIn, theirsIn, me.uid, them.uid);
  if (!out.mine.blocked[them.uid] && Object.keys(out.mine.blocked).length >= MAX_BLOCKED) return { ...out, result: 'full' };
  out.mine.blocked[them.uid] = card(them, now);
  return { ...out, result: 'blocked' };
}
export function unblockPlayer(mineIn, themUid) {
  const mine = norm(mineIn);
  mine.blocked = without(mine.blocked, themUid);
  return mine;
}

/** Pin / mute a friend's chat, or give the friend a nickname only I see (empty clears it). Only friends can be changed. */
export function setContact(mineIn, themUid, { pin, mute, nick } = {}) {
  const mine = norm(mineIn);
  if (!mine.list[themUid]) return { mine, error: 'Not your friend' };
  const flag = (k, on) => { mine[k] = on ? { ...mine[k], [themUid]: true } : without(mine[k], themUid); };
  if (typeof pin === 'boolean') flag('pinned', pin);
  if (typeof mute === 'boolean') flag('muted', mute);
  if (nick !== undefined) { const n = cleanText(nick, MAX_NICK); mine.nick = n ? { ...mine.nick, [themUid]: n } : without(mine.nick, themUid); }
  return { mine };
}

/** My own profile bits: bio (shown to friends) and who may see my last-seen time. */
export function setProfile(mineIn, { bio, lastSeen } = {}) {
  const mine = norm(mineIn);
  if (bio !== undefined) mine.bio = cleanText(bio, MAX_BIO);
  if (lastSeen !== undefined) { if (!LAST_SEEN.includes(lastSeen)) return { mine, error: 'Unknown privacy choice' }; mine.privacy = { ...mine.privacy, lastSeen }; }
  return { mine };
}

/** The name to show for a friend: my own nickname for them if I gave one. */
export const displayName = (friendsDoc, uid, card) => friendsDoc?.nick?.[uid] || card?.name || 'Player';

/** "People you may know": friends of my friends I have no link with yet, most shared friends first. */
export function suggestFriends(mineIn, friendDocs, myUid, limit = 8) {
  const mine = norm(mineIn); const seen = new Map();
  for (const doc of friendDocs) {
    const d = norm(doc);
    for (const [uid, c] of Object.entries(d.list)) {
      if (uid === myUid || mine.list[uid] || mine.incoming[uid] || mine.outgoing[uid] || mine.blocked[uid]) continue;
      const row = seen.get(uid) || { id: uid, name: c.name, avatar: c.avatar, username: c.username || null, mutual: 0 };
      row.mutual++; seen.set(uid, row);
    }
  }
  return [...seen.values()].sort((a, b) => b.mutual - a.mutual || a.name.localeCompare(b.name)).slice(0, limit);
}

export const areFriends = (friendsDoc, uid) => !!friendsDoc?.list?.[uid];

/** Append a message to a pair's chat (newest last, capped) and count it as unread for the other person. `replyTo` is the id of a message to answer. */
export function pushChat(chatIn, from, to, text, now = Date.now(), replyTo = null) {
  const t = cleanText(text);
  if (!t) return { chat: chatIn, error: 'Write a message first' };
  const chat = { ...(chatIn || {}), users: [from, to].sort(), msgs: [...(chatIn?.msgs || [])], unread: { ...(chatIn?.unread || {}) }, read: { ...(chatIn?.read || {}) }, typing: { ...(chatIn?.typing || {}) }, updatedAt: now };
  chat.seq = (chat.seq || 0) + 1;
  const m = { id: `${now.toString(36)}${chat.seq.toString(36)}`, from, text: t, at: now };
  const quoted = replyTo ? chat.msgs.find((x) => x.id === replyTo) : null;
  if (quoted) m.re = { id: quoted.id, from: quoted.from, text: quoted.text.slice(0, 60) };
  chat.msgs.push(m);
  if (chat.msgs.length > MAX_MSGS) chat.msgs = chat.msgs.slice(-MAX_MSGS);
  chat.unread[to] = (chat.unread[to] || 0) + 1;
  chat.unread[from] = 0;
  chat.typing[from] = 0;                    // sending ends "typing…"
  return { chat, msg: m };
}
export function markRead(chatIn, uid, now = Date.now()) {
  if (!chatIn) return chatIn;
  return { ...chatIn, unread: { ...(chatIn.unread || {}), [uid]: 0 }, read: { ...(chatIn.read || {}), [uid]: now } };
}
/** Have they seen this message? (two ticks). A message is read once the other person has opened the chat after it was sent. */
export const isSeen = (chat, msg, otherUid) => !!chat?.read && (chat.read[otherUid] || 0) >= msg.at;

/** Edit my own message (within 48 h). Old messages without an id cannot be edited. */
export function editMessage(chatIn, uid, id, text, now = Date.now()) {
  const t = cleanText(text);
  if (!t) return { chat: chatIn, error: 'Write a message first' };
  const m = (chatIn?.msgs || []).find((x) => x.id === id);
  if (!m) return { chat: chatIn, error: 'That message is gone' };
  if (m.from !== uid) return { chat: chatIn, error: 'You can only edit your own messages' };
  if (now - m.at > EDIT_MS) return { chat: chatIn, error: 'Too old to edit' };
  return { chat: { ...chatIn, msgs: chatIn.msgs.map((x) => (x.id === id ? { ...x, text: t, ed: now } : x)) } };
}
/** Delete my own message for both of us. If they had not read it yet, their unread count goes down too. */
export function deleteMessage(chatIn, uid, id) {
  const m = (chatIn?.msgs || []).find((x) => x.id === id);
  if (!m) return { chat: chatIn, error: 'That message is gone' };
  if (m.from !== uid) return { chat: chatIn, error: 'You can only delete your own messages' };
  const other = (chatIn.users || []).find((u) => u !== uid);
  const unread = { ...(chatIn.unread || {}) };
  if (other && (chatIn.read?.[other] || 0) < m.at) unread[other] = Math.max(0, (unread[other] || 0) - 1);
  return { chat: { ...chatIn, msgs: chatIn.msgs.filter((x) => x.id !== id), unread } };
}
/** One reaction per person per message; tapping the same one again takes it back. */
export function reactMessage(chatIn, uid, id, emoji) {
  if (!REACTIONS.includes(emoji)) return { chat: chatIn, error: 'Unknown reaction' };
  const m = (chatIn?.msgs || []).find((x) => x.id === id);
  if (!m) return { chat: chatIn, error: 'That message is gone' };
  const rx = { ...(m.rx || {}) };
  if (rx[uid] === emoji) delete rx[uid]; else rx[uid] = emoji;
  const next = { ...m }; if (Object.keys(rx).length) next.rx = rx; else delete next.rx;
  return { chat: { ...chatIn, msgs: chatIn.msgs.map((x) => (x.id === id ? next : x)) } };
}
/** "typing…" marker: stamped by the typist, shown to the other side while it is fresh. */
export const setTyping = (chatIn, uid, now = Date.now()) => ({ ...chatIn, typing: { ...(chatIn?.typing || {}), [uid]: now } });
export const isTyping = (chat, otherUid, now = Date.now()) => now - (chat?.typing?.[otherUid] || 0) < TYPING_MS;

/**
 * How to word someone's last-seen time, as a bucket the screen turns into text (Amharic or English).
 * Telegram style: online, "just now", "N min ago", "today", "yesterday", and for hidden times only "recently" / "within a week" / "within a month" / "long ago".
 */
export function seenBucket(at, now = Date.now(), hidden = false) {
  if (!Number.isFinite(at) || at <= 0) return { kind: 'long' };
  const age = now - at;
  if (hidden) return { kind: age < 3 * 864e5 ? 'recent' : age < 7 * 864e5 ? 'week' : age < 30 * 864e5 ? 'month' : 'long' };
  if (age < ONLINE_MS) return { kind: 'online' };
  if (age < 60e3 * 2) return { kind: 'just' };
  if (age < 3600e3) return { kind: 'min', n: Math.floor(age / 60e3) };
  const a = new Date(at), b = new Date(now);
  const day = (d) => Math.floor(new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime() / 864e5);
  const diff = day(b) - day(a);
  if (diff <= 0) return { kind: 'today', at };
  if (diff === 1) return { kind: 'yesterday', at };
  if (diff < 7) return { kind: 'days', n: diff };
  return { kind: 'long', at };
}

/** What a viewer may learn about someone's presence, given their privacy choice. `at` is the real timestamp or null. */
export function presenceView(privacy, at, now = Date.now()) {
  const mode = privacy?.lastSeen || 'everyone';
  if (!Number.isFinite(at)) return { kind: 'long' };
  if (mode === 'nobody') return seenBucket(at, now, true);
  return seenBucket(at, now);
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
  const muted = (c) => { const other = (c.users || []).find((u) => u !== uid); return !!(other && friends?.muted?.[other]); };   // muted chats stay quiet
  const unread = chats.reduce((n, c) => n + (muted(c) ? 0 : (c.unread?.[uid] || 0)), 0);
  return req + unread + liveInvites(invites, now).length;
}

/** A message that is only 1–3 emoji is drawn big, without a bubble (like Telegram's jumbo emoji). */
export function isJumbo(text) {
  const t = String(text || '').trim();
  if (!t || t.length > 24) return false;
  if (!/^[\p{Extended_Pictographic}\uFE0F\u200D\s]+$/u.test(t)) return false;
  return (t.match(/\p{Extended_Pictographic}/gu) || []).length <= 3;
}

/**
 * Smart replies: up to three one-tap answers to the last thing the friend said. Pure keyword rules (English + Amharic), no network.
 * Returns text keys (the screen translates them), so the same rules serve both languages.
 */
export function smartReplies(lastText) {
  const t = String(lastText || '').toLowerCase();
  if (!t.trim()) return [];
  const has = (re) => re.test(t);
  if (has(/thank|thx|አመሰግናለሁ|አመሰግናለው|እናመሰግናለን/)) return ['srThanks', 'srNice'];
  if (has(/good game|\bgg\b|well played|nice|great|ጥሩ ጨዋታ|በጣም ጥሩ/)) return ['srNice', 'srRematch', 'srThanks'];
  if (has(/rematch|play|game|match|tuz|ludo|bingo|dominoes|checkers|gebeta|ተጫወት|ጨዋታ|እንጫወት|ገበጣ/)) return ['srPlay', 'srReady', 'srLater'];
  if (has(/how are|how r u|what's up|whats up|እንዴት ነህ|እንዴት ነሽ|እንዴት ናችሁ|እንዴት/)) return ['srFine', 'srHi'];
  if (has(/^(hi|hello|hey|yo)\b|ሰላም|ታዲያስ|ሀሎ/)) return ['srHi', 'srFine'];
  if (has(/[?፧？]\s*$/)) return ['srYes', 'srNo', 'srLater'];
  return ['srOk', 'srNice'];
}
