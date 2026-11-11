// Account server side: unique usernames and deleting an account completely. Everything is written with the Admin SDK.
//   usernames/{name} = { uid, at }      (server-only; the document id IS the lowercase username, so two people can never hold the same one)
//   users/{uid}.username / usernameLower
import { fail } from './httpError.js';
import { normalizeUsername, usernameProblem, USERNAME_TEXT } from '../username.js';

const nameRef = (db, name) => db.collection('usernames').doc(name);

export async function usernameAvailable(db, raw, uid = null) {
  const name = normalizeUsername(raw);
  const bad = usernameProblem(name);
  if (bad) return { ok: false, name, reason: bad, message: USERNAME_TEXT[bad] };
  const s = await nameRef(db, name).get();
  const free = !s.exists || (uid && s.data().uid === uid);
  return free ? { ok: true, name } : { ok: false, name, reason: 'taken', message: USERNAME_TEXT.taken };
}

/** Give `uid` the username (and let go of the one they had before). The transaction makes a race between two people safe. */
export async function claimUsername(db, uid, raw) {
  const name = normalizeUsername(raw);
  const bad = usernameProblem(name);
  if (bad) fail(400, USERNAME_TEXT[bad]);
  return db.runTransaction(async (tx) => {
    const userRef = db.collection('users').doc(uid);
    const [u, taken] = await Promise.all([tx.get(userRef), tx.get(nameRef(db, name))]);
    if (!u.exists) fail(403, 'Finish creating your profile first');
    if (taken.exists && taken.data().uid !== uid) fail(409, USERNAME_TEXT.taken);
    const old = u.data().usernameLower;
    if (old && old !== name) tx.delete(nameRef(db, old));
    tx.set(nameRef(db, name), { uid, at: Date.now() });
    tx.update(userRef, { username: name, usernameLower: name });
    return { ok: true, username: name };
  });
}

/** Delete everything that belongs to `uid` and finally the sign-in itself. `bucket` (optional) is the Storage bucket holding their uploads. */
export async function deleteAccount(db, auth, uid, bucket = null) {
  const friendsSnap = await db.collection('friends').doc(uid).get();
  const f = friendsSnap.exists ? friendsSnap.data() : {};
  const others = new Set([...Object.keys(f.list || {}), ...Object.keys(f.incoming || {}), ...Object.keys(f.outgoing || {})]);
  for (const other of others) {   // take me out of every friend list and request, and clear the invites I sent
    try {
      await db.runTransaction(async (tx) => {
        const ref = db.collection('friends').doc(other); const s = await tx.get(ref);
        if (!s.exists) return;
        const d = s.data(); const cut = (o) => { const c = { ...(o || {}) }; delete c[uid]; return c; };
        tx.set(ref, { ...d, list: cut(d.list), incoming: cut(d.incoming), outgoing: cut(d.outgoing), blocked: (d.blocked || []).filter((x) => x !== uid), muted: (d.muted || []).filter((x) => x !== uid), pins: (d.pins || []).filter((x) => x !== uid) });
      });
    } catch { /* that friend's document is gone: nothing to clean */ }
  }
  const chats = await db.collection('chats').where('users', 'array-contains', uid).get();
  for (const c of chats.docs) await db.collection('chats').doc(c.id).delete();
  // race rooms: remove my live car position from every room I was racing in
  try {
    const races = await db.collection('raceRooms').where('players', 'array-contains', uid).get();
    for (const r of races.docs) await r.ref.collection('cars').doc(uid).delete().catch(() => {});
  } catch { /* no race rooms */ }
  // match rooms: remove my hidden hand (dominoes) from every room I played in
  try {
    const rooms = await db.collection('gebetaRooms').where('players', 'array-contains', uid).get();
    for (const r of rooms.docs) await r.ref.collection('private').doc(uid).delete().catch(() => {});
  } catch { /* no match rooms */ }
  const u = await db.collection('users').doc(uid).get();
  const name = u.exists ? u.data().usernameLower : null;
  if (name) { const n = await nameRef(db, name).get(); if (n.exists && n.data().uid === uid) await nameRef(db, name).delete(); }
  if (f.code) await db.collection('friendCodes').doc(f.code).delete().catch(() => {});
  for (const col of ['friends', 'invites', 'presence', 'wallets', 'users']) await db.collection(col).doc(uid).delete().catch(() => {});
  if (bucket) { try { await bucket.deleteFiles({ prefix: `u/${uid}/` }); } catch { /* no files */ } }
  await auth.deleteUser(uid);
  return { ok: true };
}
