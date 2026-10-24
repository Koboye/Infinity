// Authoritative multiplayer endpoint for every game (Gebeta, Checkers, Dominoes).
// Clients can read their room (Firestore rules) but can never write it directly.
import { NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { adminDb, adminAuth } from '@/lib/firebaseAdmin';
import {
  makeCode, normalizeCode, newRoomDoc, seatSecondPlayer, applyRoomAction, applyForfeit, settle, statFields,
  WAIT_MS, ROOM_TTL_MS,
} from '@/lib/online/rooms.js';
import { gameOf, normalizeGame } from '@/lib/online/games.js';
import { BONEYARD_DOC } from '@/lib/online/dominoes.js';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

class HttpError extends Error { constructor(status, msg) { super(msg); this.status = status; } }
const fail = (status, msg) => { throw new HttpError(status, msg); };

// Best-effort per-instance rate limit (add Upstash/Redis for a hard global limit).
const hits = new Map();
function rateLimit(uid, windowMs = 10_000) {
  const max = Number(process.env.GEBETA_RATE_MAX) || 40;
  const now = Date.now();
  const arr = (hits.get(uid) || []).filter((t) => now - t < windowMs);
  arr.push(now); hits.set(uid, arr);
  if (hits.size > 5000) for (const [k, v] of hits) if (!v.length || now - v[v.length - 1] > windowMs) hits.delete(k);
  if (arr.length > max) fail(429, 'Too many requests, slow down');
}

const rooms = (db) => db.collection('gebetaRooms');
const privRef = (db, code, id) => rooms(db).doc(code).collection('private').doc(id);
const expiry = () => new Date(Date.now() + ROOM_TTL_MS);

async function getProfile(db, uid, tokenName, game) {
  const snap = await db.collection('users').doc(uid).get();
  const d = snap.exists ? snap.data() : {};
  const rf = statFields(game).rating;
  return {
    displayName: d.displayName || tokenName || `Player ${uid.slice(0, 4)}`,
    avatar: d.avatar || 'lion',
    rating: Number.isFinite(d[rf]) ? d[rf] : 1000,
  };
}

async function freshCode(db) {
  for (let i = 0; i < 8; i++) {
    const code = makeCode();
    if (!(await rooms(db).doc(code).get()).exists) return code;
  }
  fail(500, 'Could not allocate a room code, try again');
}

async function createRoom(db, uid, tokenName, { game, ruleset, options, isPublic }) {
  const profile = await getProfile(db, uid, tokenName, game);
  const code = await freshCode(db);
  const doc = newRoomDoc({ game, uid, profile, ruleset, options, isPublic, now: FieldValue.serverTimestamp(), expireAt: expiry() });
  await rooms(db).doc(code).set(doc);
  return code;
}

async function joinRoom(db, uid, tokenName, code) {
  const ref = rooms(db).doc(code);
  const peek = await ref.get();
  if (!peek.exists) fail(404, 'No room with that code');
  const profile = await getProfile(db, uid, tokenName, peek.data().game);
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) fail(404, 'No room with that code');
    const room = snap.data();
    if (room.players.includes(uid)) return { code, status: room.status };
    if (room.status !== 'waiting' || room.players.length !== 1) fail(409, 'That room is already full');
    const { room: seated, priv } = seatSecondPlayer(room, { uid, profile });
    tx.set(ref, seated);
    for (const [id, data] of Object.entries(priv || {})) tx.set(privRef(db, code, id), data);
    return { code, status: 'playing' };
  });
}

async function quickMatch(db, uid, tokenName, { game, ruleset, options }) {
  const mod = gameOf(game);
  const rs = mod.rulesets.includes(ruleset) ? ruleset : mod.defaultRuleset;
  const opts = mod.normalizeOptions(options);
  const q = await rooms(db)
    .where('status', '==', 'waiting').where('public', '==', true)
    .where('createdAt', '>=', new Date(Date.now() - WAIT_MS))
    .orderBy('createdAt', 'asc').limit(30).get();
  for (const d of q.docs) {
    const r = d.data();
    if ((r.game || 'gebeta') !== game || r.ruleset !== rs || r.players[0] === uid) continue;
    if (game === 'dominoes' && r.options?.target !== opts.target) continue;
    try { return await joinRoom(db, uid, tokenName, d.id); } catch (e) { if (!(e instanceof HttpError)) throw e; }
  }
  return { code: await createRoom(db, uid, tokenName, { game, ruleset: rs, options: opts, isPublic: true }), status: 'waiting' };
}

// Runs a mutation on a room; if it ends the match, updates both players' rating and stats in the same transaction.
async function mutateRoom(db, code, mutator) {
  const ref = rooms(db).doc(code);
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) fail(404, 'No room with that code');
    const room = snap.data();
    const mod = gameOf(room.game);

    let priv = {};
    if (mod.hidden && room.players.length === 2) {
      const ids = [...room.players, BONEYARD_DOC];
      const snaps = await Promise.all(ids.map((id) => tx.get(privRef(db, code, id))));
      ids.forEach((id, i) => { if (snaps[i].exists) priv[id] = snaps[i].data(); });
    }

    const res = mutator(room, priv);
    if (res.error) fail(res.status || 400, res.error);
    if (res.noop) return { code, status: room.status };
    const next = res.room;

    if (room.status !== 'finished' && next.status === 'finished' && next.players.length === 2) {
      const f = statFields(room.game);
      const refs = next.players.map((u) => db.collection('users').doc(u));
      const snaps = await Promise.all(refs.map((r) => tx.get(r)));
      const ratings = snaps.map((s) => (s.exists && Number.isFinite(s.data()[f.rating]) ? s.data()[f.rating] : 1000));
      const out = settle(next, ratings);
      next.ratingChange = out.map((o) => o.delta);
      out.forEach((o, i) => {
        const field = o.result === 'win' ? f.wins : o.result === 'loss' ? f.losses : f.draws;
        tx.set(refs[i], { [f.rating]: o.rating, [field]: FieldValue.increment(1), [f.games]: FieldValue.increment(1) }, { merge: true });
      });
    }
    for (const [id, data] of Object.entries(res.priv || {})) tx.set(privRef(db, code, id), data);
    tx.set(ref, next);
    return { code, status: next.status };
  });
}

const gameAction = (db, code, uid, action, body) =>
  mutateRoom(db, code, (room, priv) => applyRoomAction(room, priv, uid, action, body));

export async function POST(req) {
  try {
    const header = req.headers.get('authorization') || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) fail(401, 'Sign in to play online');
    let decoded;
    try { decoded = await adminAuth().verifyIdToken(token); } catch { fail(401, 'Session expired, sign in again'); }
    const uid = decoded.uid;
    rateLimit(uid);
    const body = await req.json().catch(() => ({}));
    const db = adminDb();
    const game = normalizeGame(body.game);
    const code = normalizeCode(body.code);
    const common = { game, ruleset: String(body.ruleset || ''), options: body.options || {} };

    switch (body.action) {
      case 'create':
        return NextResponse.json({ code: await createRoom(db, uid, decoded.name, { ...common, isPublic: false }), status: 'waiting' });
      case 'quick':
        return NextResponse.json(await quickMatch(db, uid, decoded.name, common));
      case 'join':
        return NextResponse.json(await joinRoom(db, uid, decoded.name, code));
      case 'move':
      case 'drawTile':
      case 'offerDraw':
      case 'declineDraw':
      case 'nextRound':
        return NextResponse.json(await gameAction(db, code, uid, body.action, body));
      case 'resign':
        return NextResponse.json(await mutateRoom(db, code, (room) => {
          const seat = room.players.indexOf(uid);
          if (seat < 0) return { error: 'You are not in this match', status: 403 };
          if (room.status !== 'playing') return { error: 'Match is not in progress' };
          return { room: applyForfeit(room, seat, 'resigned') };
        }));
      case 'timeout':
        return NextResponse.json(await mutateRoom(db, code, (room) => {
          const seat = room.players.indexOf(uid);
          if (seat < 0) return { error: 'You are not in this match', status: 403 };
          if (room.status !== 'playing') return { error: 'Match is not in progress' };
          if (room.turn === seat) return { error: 'It is your turn' };
          if (!room.deadline || Date.now() < room.deadline) return { error: 'Opponent still has time' };
          return { room: applyForfeit(room, room.turn, 'timeout') };
        }));
      case 'cancel': {
        const ref = rooms(db).doc(code);
        await db.runTransaction(async (tx) => {
          const s = await tx.get(ref);
          if (s.exists && s.data().status === 'waiting' && s.data().players[0] === uid) tx.delete(ref);
        });
        return NextResponse.json({ ok: true });
      }
      case 'emote': {
        const id = String(body.id || '').slice(0, 12);
        return NextResponse.json(await mutateRoom(db, code, (room) => {
          const seat = room.players.indexOf(uid);
          if (seat < 0) return { error: 'You are not in this match', status: 403 };
          return { room: { ...room, emote: { by: seat, id, at: Date.now() } } };
        }));
      }
      case 'rematch': {
        const oldRef = rooms(db).doc(code);
        const old = await oldRef.get();
        if (!old.exists || !old.data().players.includes(uid)) fail(403, 'You are not in this match');
        const o = old.data();
        if (o.status !== 'finished') fail(400, 'Match is not finished');
        if (o.rematch) return NextResponse.json(await joinRoom(db, uid, decoded.name, o.rematch));
        const newCode = await createRoom(db, uid, decoded.name, { game: o.game || 'gebeta', ruleset: o.ruleset, options: o.options || {}, isPublic: false });
        await oldRef.update({ rematch: newCode });
        return NextResponse.json({ code: newCode, status: 'waiting' });
      }
      default:
        fail(400, 'Unknown action');
    }
  } catch (e) {
    if (e instanceof HttpError) return NextResponse.json({ error: e.message }, { status: e.status });
    console.error('gebeta api error', e);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
