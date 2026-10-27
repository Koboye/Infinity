// Server side of friends, chat and invites (v73). Every write happens here with the Admin SDK; clients only read (see firestore.rules).
import { randomUUID } from 'node:crypto';
import { fail } from './httpError.js';
import {
  emptyFriends, makeFriendCode, normalizeFriendCode, requestFriend, acceptFriend, severFriend, areFriends,
  pairId, pushChat, markRead, pushInvite, dropInvite, cleanText,
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

/** Direct message to a friend (friends only). */
export async function chatSend(db, uid, to, text) {
  to = String(to || '');
  if (!cleanText(text)) fail(400, 'Write a message first');
  return db.runTransaction(async (tx) => {
    const mine = await tx.get(friendsRef(db, uid));
    if (!areFriends(mine.exists ? mine.data() : null, to)) fail(403, 'You can only chat with friends');
    const cur = await tx.get(chatRef(db, uid, to));
    const out = pushChat(cur.exists ? cur.data() : null, uid, to, text);
    if (out.error) fail(400, out.error);
    tx.set(chatRef(db, uid, to), out.chat);
    return { ok: true };
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
  await db.collection('presence').doc(uid).set({ at: Date.now() });
  return { ok: true };
}
