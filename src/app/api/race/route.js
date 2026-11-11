// Online car race endpoint (Hill Climb Racer). Rooms live in Firestore `raceRooms/{code}`; clients can read their room but never write it.
// Live car positions are written by each phone straight to raceRooms/{code}/cars/{uid} (see firestore.rules); this route only
// creates / joins / starts rooms and decides finishing order with the SERVER clock.
import { NextResponse } from 'next/server';
import { adminDb, adminAuth } from '@/lib/firebaseAdmin';
import * as Social from '@/lib/online/socialApi.js';
import { HttpError, fail } from '@/lib/online/httpError.js';
import {
  makeCode, normalizeCode, newRaceRoom, joinRaceRoom, leaveRaceRoom, setTrack, startRace, finishRace, closeRace, rematch,
} from '@/lib/online/race.js';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const hits = new Map();
function rateLimit(uid, windowMs = 10_000, max = 30) {
  const now = Date.now(), arr = (hits.get(uid) || []).filter((t) => now - t < windowMs);
  arr.push(now); hits.set(uid, arr);
  if (hits.size > 5000) for (const [k, v] of hits) if (!v.length || now - v[v.length - 1] > windowMs) hits.delete(k);
  if (arr.length > max) fail(429, 'Too many requests, slow down');
}
const ok = (o) => NextResponse.json({ ...o, serverNow: Date.now() });
const rooms = (db) => db.collection('raceRooms');

// The browser Firebase keys are public by design (they are in every page of the app); the standalone car page reads them here.
export async function GET() {
  const cfg = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY, authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID, storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID, appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  };
  if (!cfg.apiKey || !cfg.projectId) return NextResponse.json({ error: 'Online play is not set up' }, { status: 503 });
  return NextResponse.json({ cfg, serverNow: Date.now() }, { headers: { 'Cache-Control': 'no-store' } });
}

async function displayName(db, uid, decoded) {
  try { const s = await db.collection('users').doc(uid).get(); const n = s.exists && s.data().displayName; if (n) return n; } catch { /* fall through */ }
  return decoded.name || (decoded.email ? decoded.email.split('@')[0] : 'Racer');
}

async function mutate(db, code, fn) {
  const ref = rooms(db).doc(code);
  return db.runTransaction(async (tx) => {
    const s = await tx.get(ref);
    if (!s.exists) fail(404, 'Room not found');
    const next = fn(s.data(), Date.now());
    if (next === null) { tx.delete(ref); return { code, deleted: true }; }
    tx.set(ref, next);
    return { code, room: pub(next) };
  });
}
const pub = (r) => ({ ...r, expireAt: undefined, createdAt: undefined });

export async function POST(req) {
  try {
    const header = req.headers.get('authorization') || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) fail(401, 'Sign in to race online');
    let decoded;
    try { decoded = await adminAuth().verifyIdToken(token); } catch { fail(401, 'Session expired, sign in again'); }
    const uid = decoded.uid;
    rateLimit(uid);
    if (Number(req.headers.get('content-length') || 0) > 4096) fail(413, 'Request too large');
    const body = await req.json().catch(() => ({}));
    const db = adminDb();
    const code = normalizeCode(body.code);
    const now = Date.now();

    switch (body.action) {
      case 'create': {
        const name = await displayName(db, uid, decoded);
        for (let i = 0; i < 6; i++) {
          const c = makeCode();
          const ref = rooms(db).doc(c);
          const made = await db.runTransaction(async (tx) => {
            if ((await tx.get(ref)).exists) return false;
            tx.set(ref, newRaceRoom({ code: c, uid, name, veh: body.veh, world: body.world, level: body.level, now }));
            return true;
          });
          if (made) return ok({ code: c });
        }
        fail(503, 'Could not make a room, try again');
        break;
      }
      case 'join': {
        if (code.length !== 5) fail(400, 'Enter the 5-letter room code');
        const name = await displayName(db, uid, decoded);
        return ok(await mutate(db, code, (r) => joinRaceRoom(r, { uid, name, veh: body.veh })));
      }
      case 'track': return ok(await mutate(db, code, (r) => setTrack(r, uid, body)));
      case 'start': return ok(await mutate(db, code, (r, t) => startRace(r, uid, t)));
      case 'finish': return ok(await mutate(db, code, (r, t) => finishRace(r, uid, t)));
      case 'close': return ok(await mutate(db, code, (r, t) => closeRace(r, t)));
      case 'again': return ok(await mutate(db, code, (r) => rematch(r, uid)));
      case 'leave': return ok(await mutate(db, code, (r) => leaveRaceRoom(r, uid)));
      case 'friends': return ok({ friends: await Social.friendNames(db, uid) });
      case 'invite': return ok(await Social.inviteFriendRace(db, uid, { to: body.to, code }));
      case 'time': return ok({});
      default: fail(400, 'Unknown action');
    }
  } catch (e) {
    const status = e instanceof HttpError ? e.status : (e && e.status) || 500;
    return NextResponse.json({ error: status >= 500 ? 'Server problem, try again' : e.message }, { status });
  }
}
