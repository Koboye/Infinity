// Server side of friends, chat and invites (v73). Every write happens here with the Admin SDK; clients only read (see firestore.rules).
import { randomUUID } from 'node:crypto';
import { fail } from './httpError.js';
import {
  emptyFriends, makeFriendCode, normalizeFriendCode, requestFriend, acceptFriend, severFriend, areFriends,
  pairId, pushChat, markRead, pushInvite, dropInvite, cleanText,
  editMsg, deleteMsg, reactMsg, setTyping, togglePin,
  hideMsg, starMsg, clearChat, toggleFlag, isBlocked, markDelivered,
} from '../social.js';

const friendsRef = (db, uid) => db.collection('friends').doc(uid);
const codeRef = (db, code) => db.collection('friendCodes').doc(code);
const chatRef = (db, a, b) => db.collection('chats').doc(pairId(a, b));
const inviteRef = (db, uid) => db.collection('invites').doc(uid);

async function profileOf(tx, db, uid) {
  const s = await tx.get(db.collection('users').doc(uid));
  if (!s.exists) return null;
  const d = s.data();
  return { uid, name: d.displayName || 'Player', avatar: d.avatar || 'lion' };
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

/** Send a friend request by friend code (or by uid, from a room or the leaderboard). Two requests that cross become a friendship. */
export async function sendRequest(db, uid, { code, to }) {
  let target = to ? String(to) : null;
  if (!target) {
    const c = normalizeFriendCode(code);
    if (c.length !== 6) fail(400, 'Enter the 6-letter friend code');
    const s = await codeRef(db, c).get();
    if (!s.exists) fail(404, 'No player has that friend code');
    target = s.data().uid;
  }
  if (target === uid) fail(400, 'That is your own code');
  await friendCode(db, uid); await friendCode(db, target).catch(() => {});   // both sides get a document
  return db.runTransaction(async (tx) => {
    const [me, them] = await Promise.all([profileOf(tx, db, uid), profileOf(tx, db, target)]);
    if (!me) fail(403, 'Sign in first');
    if (!them) fail(404, 'No such player');
    const [a, b] = await Promise.all([tx.get(friendsRef(db, uid)), tx.get(friendsRef(db, target))]);
    const out = requestFriend(a.exists ? a.data() : null, b.exists ? b.data() : null, me, them);
    if (out.result === 'full') fail(409, 'The friend list or request list is full');
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

/**
 * Direct message to a friend (friends only). If I blocked them I must unblock first; if THEY blocked me the line is kept for me
 * (one tick) but never reaches them, like WhatsApp. `fwd` marks a forwarded line.
 */
export async function chatSend(db, uid, to, text, replyTo = null, fwd = false) {
  to = String(to || '');
  if (!cleanText(text)) fail(400, 'Write a message first');
  return db.runTransaction(async (tx) => {
    const mine = await tx.get(friendsRef(db, uid));
    const mineData = mine.exists ? mine.data() : null;
    if (!areFriends(mineData, to)) fail(403, 'You can only chat with friends');
    if (isBlocked(mineData, to)) fail(403, 'Unblock this friend to send a message');
    const theirs = await tx.get(friendsRef(db, to));
    const held = isBlocked(theirs.exists ? theirs.data() : null, uid);
    const cur = await tx.get(chatRef(db, uid, to));
    const out = pushChat(cur.exists ? cur.data() : null, uid, to, text, Date.now(), replyTo ? String(replyTo) : null, { fwd: !!fwd, held });
    if (out.error) fail(400, out.error);
    tx.set(chatRef(db, uid, to), out.chat);
    return { ok: true, id: out.chat.msgs.at(-1).id };
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
  if (await blockedBy(db, to, uid)) return { code, status: 'waiting' };   // blocked: the room opens for me, the invite never arrives
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

/**
 * Invite a friend to a Hill Climb Racer online race (v3.8). `code` is a waiting race room I host; without it `makeRoom()` opens one.
 * The invite carries game 'car', so the friend's inbox shows it like any other game and sends them to the car page.
 */
export async function inviteFriendRace(db, uid, { to, code, makeRoom }) {
  to = String(to || '');
  const mine = await friendsRef(db, uid).get();
  if (!areFriends(mine.exists ? mine.data() : null, to)) fail(403, 'You can only invite friends');
  let c = code;
  if (c) {
    const r = await db.collection('raceRooms').doc(c).get();
    if (!r.exists || r.data().host !== uid || r.data().status !== 'wait') fail(409, 'Your race room is no longer waiting');
  } else c = await makeRoom();
  if (await blockedBy(db, to, uid)) return { code: c, status: 'wait', game: 'car' };
  await db.runTransaction(async (tx) => {
    const me = await profileOf(tx, db, uid);
    const cur = await tx.get(inviteRef(db, to));
    tx.set(inviteRef(db, to), pushInvite(cur.exists ? cur.data() : null, {
      id: randomUUID().slice(0, 8), from: uid, name: me?.name || 'Player', avatar: me?.avatar || 'lion', game: 'car', ruleset: '', code: c, fee: 0,
    }));
  });
  return { code: c, status: 'wait', game: 'car' };
}

/** Friends the car page can invite (names only): same data the Friends tab uses. */
export async function friendNames(db, uid) {
  const fs = await friendsRef(db, uid).get();
  const ids = Object.keys((fs.exists ? fs.data().list : null) || {}).slice(0, 50);
  const out = [];
  await Promise.all(ids.map(async (id) => { const u = await db.collection('users').doc(id).get().catch(() => null); out.push({ id, name: (u && u.exists && u.data().displayName) || 'Player' }); }));
  return out;
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
  await db.collection('presence').doc(uid).set({ at: Date.now() });
  return { ok: true };
}

/** Edit, delete or react to one line of a chat (`kind` = 'edit' | 'delete' | 'react' | 'hide' | 'star'). Only the two people in the chat can touch it. */
export async function chatChange(db, uid, other, kind, id, value) {
  other = String(other || ''); id = String(id || '');
  return db.runTransaction(async (tx) => {
    const mine = await tx.get(friendsRef(db, uid));
    if (!areFriends(mine.exists ? mine.data() : null, other)) fail(403, 'You can only chat with friends');
    const cur = await tx.get(chatRef(db, uid, other));
    if (!cur.exists) fail(404, 'That chat is empty');
    const c = cur.data();
    const out = kind === 'edit' ? editMsg(c, uid, id, value) : kind === 'delete' ? deleteMsg(c, uid, id)
      : kind === 'hide' ? hideMsg(c, uid, id) : kind === 'star' ? starMsg(c, uid, id) : reactMsg(c, uid, id, String(value || ''));
    if (out.error) fail(400, out.error);
    tx.set(chatRef(db, uid, other), out.chat);
    return { ok: true };
  });
}

/** "I am typing": one small write, and only when the chat already exists (the phone sends it at most every 3 s). */
export async function chatTyping(db, uid, other) {
  other = String(other || '');
  const ref = chatRef(db, uid, other);
  const s = await ref.get();
  if (s.exists && (s.data().users || []).includes(uid)) await ref.set(setTyping(s.data(), uid));
  return { ok: true };
}

/** Pin or unpin a friend at the top of my list. */
export async function friendPin(db, uid, other) {
  return db.runTransaction(async (tx) => {
    const s = await tx.get(friendsRef(db, uid));
    const next = togglePin(s.exists ? s.data() : null, String(other || ''));
    tx.set(friendsRef(db, uid), next);
    return { ok: true, pins: next.pins };
  });
}

/** "Clear chat": my view of the chat is emptied; the other person's is untouched. */
export async function chatClearMine(db, uid, other) {
  other = String(other || '');
  const ref = chatRef(db, uid, other);
  return db.runTransaction(async (tx) => {
    const s = await tx.get(ref);
    if (s.exists && (s.data().users || []).includes(uid)) tx.set(ref, clearChat(s.data(), uid));
    return { ok: true };
  });
}

/** Block / unblock (flag 'blocked') or mute / unmute (flag 'muted') a friend. Kept on my own friends document. */
export async function friendFlag(db, uid, other, flag) {
  other = String(other || '');
  if (!['blocked', 'muted'].includes(flag)) fail(400, 'Unknown option');
  return db.runTransaction(async (tx) => {
    const s = await tx.get(friendsRef(db, uid));
    const cur = s.exists ? s.data() : null;
    if (!areFriends(cur, other) && !(cur?.[flag] || []).includes(other)) fail(404, 'That player is not your friend');
    const next = toggleFlag(cur, flag, other);
    tx.set(friendsRef(db, uid), next);
    return { ok: true, [flag]: next[flag] };
  });
}

/** Has `uid` been blocked by `by`? Used so a blocked player's game invites never reach the person who blocked them. */
async function blockedBy(db, by, uid) {
  const s = await friendsRef(db, by).get();
  return isBlocked(s.exists ? s.data() : null, uid);
}

/** Find players by name (starts-with, case-sensitive on the stored name) so a friend can be added without a code. */
export async function friendSearch(db, uid, q) {
  const term = cleanText(q, 20);
  if (term.length < 2) fail(400, 'Type at least 2 letters');
  const snap = await db.collection('users').where('displayName', '>=', term).where('displayName', '<', term + '\uf8ff').limit(10).get();
  const mine = await friendsRef(db, uid).get(); const f = mine.exists ? mine.data() : {};
  return {
    players: snap.docs.filter((d) => d.id !== uid).map((d) => ({
      uid: d.id, name: d.data().displayName || 'Player', avatar: d.data().avatar || 'lion',
      status: f.list?.[d.id] ? 'friend' : f.outgoing?.[d.id] ? 'sent' : f.incoming?.[d.id] ? 'incoming' : 'none',
    })),
  };
}

/**
 * Everything social in one answer: friends + requests, all my chats, my invites and my friends' last-seen times.
 * The phone calls this when the live Firestore listeners are not available (rules or indexes not deployed, bad network),
 * and keeps calling it while a chat is open so two friends always reach each other.
 */
export async function socialSync(db, uid) {
  await friendCode(db, uid);
  const [fs, inv, cs] = await Promise.all([
    friendsRef(db, uid).get(), inviteRef(db, uid).get(),
    db.collection('chats').where('users', 'array-contains', uid).get(),
  ]);
  const friends = fs.exists ? fs.data() : emptyFriends();
  // my phone is open: lines waiting for me are now "delivered" (grey double tick for the sender). Written only when something is new.
  const chats = await Promise.all(cs.docs.map(async (d) => {
    const raw = d.data(); const data = { id: d.id, ...raw };
    if (markDelivered(raw, uid) === raw) return data;   // nothing new for me: no transaction, no write
    const ref = db.collection('chats').doc(d.id);
    const upd = await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists) return null;
      const cur = snap.data(); const next = markDelivered(cur, uid);
      if (next !== cur) tx.set(ref, next);
      return next;
    }).catch(() => null);
    return upd ? { id: d.id, ...upd } : data;
  }));
  const ids = Object.keys(friends.list || {}).slice(0, 100);
  const seen = {};
  await Promise.all(ids.map(async (id) => { const p = await db.collection('presence').doc(id).get(); if (p.exists) seen[id] = p.data().at; }));
  await db.collection('presence').doc(uid).set({ at: Date.now() });
  return { friends, invites: inv.exists ? inv.data() : null, chats, seen, now: Date.now() };
}
