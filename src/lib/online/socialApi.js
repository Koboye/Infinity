// Server side of friends, chat and invites (v73). Every write happens here with the Admin SDK; clients only read (see firestore.rules).
import { randomUUID } from 'node:crypto';
import { fail } from './httpError.js';
import {
  emptyFriends, makeFriendCode, normalizeFriendCode, normalizeUsername, checkUsername, requestFriend, acceptFriend, severFriend, areFriends,
  blockPlayer, unblockPlayer, setContact, setProfile, suggestFriends, presenceView,
  pairId, pushChat, markRead, editMessage, deleteMessage, reactMessage, setTyping, pushInvite, dropInvite, cleanText,
} from '../social.js';

const friendsRef = (db, uid) => db.collection('friends').doc(uid);
const codeRef = (db, code) => db.collection('friendCodes').doc(code);
const chatRef = (db, a, b) => db.collection('chats').doc(pairId(a, b));
const inviteRef = (db, uid) => db.collection('invites').doc(uid);
const nameRef = (db, name) => db.collection('usernames').doc(name);
const presenceRef = (db, uid) => db.collection('presence').doc(uid);

async function profileOf(tx, db, uid) {
  const [s, f] = await Promise.all([tx.get(db.collection('users').doc(uid)), tx.get(friendsRef(db, uid))]);
  if (!s.exists) return null;
  const d = s.data();
  return { uid, name: d.displayName || 'Player', avatar: d.avatar || 'lion', username: (f.exists && f.data().username) || null };
}

/** My friend code (created on first use). Codes are looked up through friendCodes/{code}, which only the server can read. */
export async function friendCode(db, uid) {
  const snap = await friendsRef(db, uid).get();
  const have = snap.exists ? snap.data().code : null;
  if (have) return have;
  for (let i = 0; i < 10; i++) {
    const code = makeFriendCode();
    const made = await db.runTransaction(async (tx) => {
      if ((await tx.get(codeRef(db, code))).exists) return false;
      const mine = await tx.get(friendsRef(db, uid));
      if (mine.exists && mine.data().code) return mine.data().code;
      tx.set(codeRef(db, code), { uid });
      tx.set(friendsRef(db, uid), { ...emptyFriends(), ...(mine.exists ? mine.data() : {}), code });
      return code;
    });
    if (made) return made;
  }
  fail(500, 'Could not make a friend code, try again');
}

/** Resolve "who is this?" from a friend code, an @username or a uid (from a room or the leaderboard). */
async function resolveTarget(db, { code, to, username }) {
  if (to) return String(to);
  if (username) {
    const u = checkUsername(username);
    if (!u.ok) fail(400, u.error);
    const s = await nameRef(db, u.name).get();
    if (!s.exists) fail(404, 'No player has that username');
    return s.data().uid;
  }
  const c = normalizeFriendCode(code);
  if (c.length !== 6) fail(400, 'Enter a 6-letter friend code or an @username');
  const s = await codeRef(db, c).get();
  if (!s.exists) fail(404, 'No player has that friend code');
  return s.data().uid;
}

/** Send a friend request by friend code, @username or uid, with an optional note. Two requests that cross become a friendship. */
export async function sendRequest(db, uid, { code, to, username, note }) {
  const target = await resolveTarget(db, { code, to, username });
  if (target === uid) fail(400, 'That is you');
  await friendCode(db, uid); await friendCode(db, target).catch(() => {});   // both sides get a document
  return db.runTransaction(async (tx) => {
    const [me, them] = await Promise.all([profileOf(tx, db, uid), profileOf(tx, db, target)]);
    if (!me) fail(403, 'Sign in first');
    if (!them) fail(404, 'No such player');
    const [a, b] = await Promise.all([tx.get(friendsRef(db, uid)), tx.get(friendsRef(db, target))]);
    const out = requestFriend(a.exists ? a.data() : null, b.exists ? b.data() : null, me, them, Date.now(), note);
    if (out.result === 'full') fail(409, 'The friend list or request list is full');
    if (out.result === 'blocked') fail(403, 'You cannot send a request to this player');
    if (out.result === 'youBlocked') fail(409, 'You blocked this player. Unblock them first');
    if (out.result === 'sent' || out.result === 'accepted') { tx.set(friendsRef(db, uid), out.mine); tx.set(friendsRef(db, target), out.theirs); }
    return { result: out.result, name: them.name };
  });
}

/** Accept (accept = true) or decline an incoming request. */
export async function respond(db, uid, from, accept) {
  from = String(from || '');
  if (!from) fail(400, 'Choose a player');
  return db.runTransaction(async (tx) => {
    const [me, them] = await Promise.all([profileOf(tx, db, uid), profileOf(tx, db, from)]);
    const [a, b] = await Promise.all([tx.get(friendsRef(db, uid)), tx.get(friendsRef(db, from))]);
    const mine = a.exists ? a.data() : null, theirs = b.exists ? b.data() : null;
    if (!mine?.incoming?.[from]) fail(404, 'That request is no longer there');
    if (accept) {
      if (!me || !them) fail(404, 'No such player');
      const out = acceptFriend(mine, theirs, me, them);
      tx.set(friendsRef(db, uid), out.mine); tx.set(friendsRef(db, from), out.theirs);
    } else {
      const out = severFriend(mine, theirs, uid, from);
      tx.set(friendsRef(db, uid), out.mine); tx.set(friendsRef(db, from), out.theirs);
    }
    return { ok: true };
  });
}

/** Unfriend, or cancel a request I sent. */
export async function remove(db, uid, other) {
  other = String(other || '');
  if (!other) fail(400, 'Choose a player');
  return db.runTransaction(async (tx) => {
    const [a, b] = await Promise.all([tx.get(friendsRef(db, uid)), tx.get(friendsRef(db, other))]);
    const out = severFriend(a.exists ? a.data() : null, b.exists ? b.data() : null, uid, other);
    tx.set(friendsRef(db, uid), out.mine); tx.set(friendsRef(db, other), out.theirs);
    return { ok: true };
  });
}

/** Direct message to a friend (friends only). */
export async function chatSend(db, uid, to, text, replyTo = null) {
  to = String(to || '');
  if (!cleanText(text)) fail(400, 'Write a message first');
  return db.runTransaction(async (tx) => {
    const mine = await tx.get(friendsRef(db, uid));
    if (!areFriends(mine.exists ? mine.data() : null, to)) fail(403, 'You can only chat with friends');
    const cur = await tx.get(chatRef(db, uid, to));
    const out = pushChat(cur.exists ? cur.data() : null, uid, to, text, Date.now(), replyTo ? String(replyTo) : null);
    if (out.error) fail(400, out.error);
    tx.set(chatRef(db, uid, to), out.chat);
    return { ok: true, id: out.msg.id };
  });
}

export async function chatRead(db, uid, other) {
  other = String(other || '');
  const ref = chatRef(db, uid, other);
  return db.runTransaction(async (tx) => {
    const s = await tx.get(ref);
    if (s.exists && (s.data().users || []).includes(uid)) tx.set(ref, markRead(s.data(), uid));
    return { ok: true };
  });
}

/** Edit, delete or react to one message of a chat I am part of. `change(chat)` is one of the pure functions in social.js. */
async function changeMessage(db, uid, other, change) {
  other = String(other || '');
  const ref = chatRef(db, uid, other);
  return db.runTransaction(async (tx) => {
    const s = await tx.get(ref);
    if (!s.exists || !(s.data().users || []).includes(uid)) fail(404, 'No such chat');
    const out = change(s.data());
    if (out.error) fail(400, out.error);
    tx.set(ref, out.chat);
    return { ok: true };
  });
}
export const chatEdit = (db, uid, to, id, text) => changeMessage(db, uid, to, (c) => editMessage(c, uid, String(id || ''), text));
export const chatDelete = (db, uid, to, id) => changeMessage(db, uid, to, (c) => deleteMessage(c, uid, String(id || '')));
export const chatReact = (db, uid, to, id, emoji) => changeMessage(db, uid, to, (c) => reactMessage(c, uid, String(id || ''), String(emoji || '')));
/** "typing…": the client sends this at most every few seconds while the friend's chat has a draft. */
export async function chatTyping(db, uid, to) {
  to = String(to || '');
  const ref = chatRef(db, uid, to);
  return db.runTransaction(async (tx) => {
    const s = await tx.get(ref);
    if (s.exists && (s.data().users || []).includes(uid)) tx.set(ref, setTyping(s.data(), uid));
    return { ok: true };
  });
}

/**
 * Invite a friend to play. With `room` (a waiting room I own) the friend is sent straight into it; without, a new private room
 * is opened by `makeRoom()` (the route's createRoom, so coins and game rules are checked in one place).
 */
export async function inviteFriend(db, uid, { to, room, makeRoom }) {
  to = String(to || '');
  const mine = await friendsRef(db, uid).get();
  if (!areFriends(mine.exists ? mine.data() : null, to)) fail(403, 'You can only invite friends');
  let code = room;
  if (code) {
    const r = await db.collection('gebetaRooms').doc(code).get();
    if (!r.exists || r.data().players[0] !== uid || r.data().status !== 'waiting') fail(409, 'Your room is no longer waiting');
  } else code = await makeRoom();
  const r = (await db.collection('gebetaRooms').doc(code).get()).data();
  await db.runTransaction(async (tx) => {
    const me = await profileOf(tx, db, uid);
    const cur = await tx.get(inviteRef(db, to));
    const next = pushInvite(cur.exists ? cur.data() : null, {
      id: randomUUID().slice(0, 8), from: uid, name: me?.name || 'Player', avatar: me?.avatar || 'lion',
      game: r.game || 'gebeta', ruleset: r.ruleset || '', code, fee: Number(r.fee) || 0,
    });
    tx.set(inviteRef(db, to), next);
  });
  return { code, status: 'waiting' };
}

export async function inviteDismiss(db, uid, id) {
  return db.runTransaction(async (tx) => {
    const s = await tx.get(inviteRef(db, uid));
    if (s.exists) tx.set(inviteRef(db, uid), dropInvite(s.data(), String(id || '')));
    return { ok: true };
  });
}

/** "I am here": the friends list shows a green dot for anyone seen in the last 90 seconds. */
export async function presence(db, uid) {
  await presenceRef(db, uid).set({ at: Date.now() }, { merge: true });
  return { ok: true };
}

/** Last-seen of my friends, worded by each friend's own privacy choice (clients cannot read presence documents directly). */
export async function friendPresence(db, uid) {
  const mine = await friendsRef(db, uid).get();
  const ids = Object.keys((mine.exists ? mine.data().list : null) || {}).slice(0, 100);
  const now = Date.now(); const out = {};
  await Promise.all(ids.map(async (id) => {
    const s = await presenceRef(db, id).get();
    const d = s.exists ? s.data() : {};
    out[id] = presenceView({ lastSeen: d.vis }, d.at, now);
    if (d.vis !== 'nobody' && Number.isFinite(d.at)) out[id].at = d.at;       // the exact time only when they share it
  }));
  return { seen: out, now };
}

/** Pick my @username (unique, changeable; the old one is freed). */
export async function setUsername(db, uid, input) {
  const u = checkUsername(input);
  if (!u.ok) fail(400, u.error);
  await friendCode(db, uid);
  return db.runTransaction(async (tx) => {
    const [mine, taken] = await Promise.all([tx.get(friendsRef(db, uid)), tx.get(nameRef(db, u.name))]);
    const cur = mine.exists ? mine.data() : emptyFriends();
    if (taken.exists && taken.data().uid !== uid) fail(409, 'That username is taken');
    if (cur.username && cur.username !== u.name) tx.delete(nameRef(db, cur.username));
    tx.set(nameRef(db, u.name), { uid, key: u.name });
    tx.set(friendsRef(db, uid), { ...cur, username: u.name });
    return { username: u.name };
  });
}

/** Search players by @username (prefix). Never shows me, people who blocked me, or people I blocked. */
export async function findPlayers(db, uid, input) {
  const q = normalizeUsername(input);
  if (q.length < 3) fail(400, 'Type at least 3 letters');
  const [mineSnap, snap] = await Promise.all([
    friendsRef(db, uid).get(),
    db.collection('usernames').where('key', '>=', q).where('key', '<', q + '\uf8ff').limit(10).get(),
  ]);
  const mine = { ...emptyFriends(), ...(mineSnap.exists ? mineSnap.data() : {}) };
  const rows = [];
  for (const d of snap.docs) {
    const id = d.data().uid;
    if (id === uid || mine.blocked?.[id]) continue;
    const [u, f] = await Promise.all([db.collection('users').doc(id).get(), friendsRef(db, id).get()]);
    if (!u.exists) continue;
    const theirs = { ...emptyFriends(), ...(f.exists ? f.data() : {}) };
    if (theirs.blocked?.[uid]) continue;
    const mutual = Object.keys(theirs.list || {}).filter((k) => mine.list?.[k]).length;
    const status = mine.list?.[id] ? 'friend' : mine.incoming?.[id] ? 'incoming' : mine.outgoing?.[id] ? 'outgoing' : 'none';
    rows.push({ id, name: u.data().displayName || 'Player', avatar: u.data().avatar || 'lion', username: d.id, bio: theirs.bio || '', mutual, status });
  }
  rows.sort((a, b) => (b.username === q) - (a.username === q) || b.mutual - a.mutual);
  return { results: rows.slice(0, 8) };
}

/** Friends of my friends. */
export async function suggestions(db, uid) {
  const mineSnap = await friendsRef(db, uid).get();
  const mine = mineSnap.exists ? mineSnap.data() : emptyFriends();
  const ids = Object.keys(mine.list || {}).slice(0, 30);
  const docs = (await Promise.all(ids.map((id) => friendsRef(db, id).get()))).filter((s) => s.exists).map((s) => s.data());
  return { people: suggestFriends(mine, docs, uid) };
}

/** Pin, mute or rename (nickname) a friend. */
export async function contactSet(db, uid, to, opts) {
  to = String(to || '');
  return db.runTransaction(async (tx) => {
    const s = await tx.get(friendsRef(db, uid));
    const out = setContact(s.exists ? s.data() : null, to, opts);
    if (out.error) fail(403, out.error);
    tx.set(friendsRef(db, uid), out.mine);
    return { ok: true };
  });
}

/** Block (removes the friendship and silences requests) or unblock. */
export async function block(db, uid, other, on) {
  other = String(other || '');
  if (!other || other === uid) fail(400, 'Choose a player');
  return db.runTransaction(async (tx) => {
    const [me, them] = await Promise.all([profileOf(tx, db, uid), profileOf(tx, db, other)]);
    const [a, b] = await Promise.all([tx.get(friendsRef(db, uid)), tx.get(friendsRef(db, other))]);
    const mine = a.exists ? a.data() : null, theirs = b.exists ? b.data() : null;
    if (!on) { tx.set(friendsRef(db, uid), unblockPlayer(mine, other)); return { ok: true }; }
    if (!them) fail(404, 'No such player');
    const out = blockPlayer(mine, theirs, me || { uid, name: 'Player' }, them);
    if (out.result === 'full') fail(409, 'Your block list is full');
    tx.set(friendsRef(db, uid), out.mine); tx.set(friendsRef(db, other), out.theirs);
    return { ok: true };
  });
}

/** My bio and who can see my last-seen time. */
export async function profileSet(db, uid, { bio, lastSeen }) {
  await friendCode(db, uid);
  return db.runTransaction(async (tx) => {
    const s = await tx.get(friendsRef(db, uid));
    const out = setProfile(s.exists ? s.data() : null, { bio, lastSeen });
    if (out.error) fail(400, out.error);
    tx.set(friendsRef(db, uid), out.mine);
    if (lastSeen !== undefined) tx.set(presenceRef(db, uid), { vis: out.mine.privacy.lastSeen }, { merge: true });
    return { ok: true, bio: out.mine.bio, lastSeen: out.mine.privacy.lastSeen };
  });
}
