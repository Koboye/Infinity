// Authoritative multiplayer endpoint for every game (Gebeta, Checkers, Dominoes).
// Clients can read their room (Firestore rules) but can never write it directly.
import { NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { adminDb, adminAuth } from '@/lib/firebaseAdmin';
import {
  makeCode, normalizeCode, newRoomDoc, seatSecondPlayer, applyRoomAction, applyForfeit, settle, statFields,
  WAIT_MS, ROOM_TTL_MS, PRESENCE_MS,
} from '@/lib/online/rooms.js';
import { gameOf, normalizeGame } from '@/lib/online/games.js';
import { isPlayable } from '@/lib/games.js';
import { BONEYARD_DOC } from '@/lib/online/dominoes.js';
import * as WC from '@/lib/walletCore.js';
import { randomUUID } from 'node:crypto';
import { servableAds, bump, withTargeting } from '@/lib/adsServer.js';
import { rotatePick } from '@/lib/adsSmart.js';
import { publicAd, clampSeconds, houseAd, SESSION_TTL_MS, DONE_TOLERANCE_MS } from '@/lib/adsCore.js';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { HttpError, fail } from '@/lib/online/httpError.js';
import * as Social from '@/lib/online/socialApi.js';
import { pushRoomChat } from '@/lib/social.js';

// Best-effort per-instance rate limit (add Upstash/Redis for a hard global limit).
const hits = new Map();
// Hard, global limit across every server instance when Upstash Redis is configured
// (UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN); otherwise the per-instance limiter below is used.
async function globalRateLimit(uid, windowMs = 10_000) {
  const url = process.env.UPSTASH_REDIS_REST_URL, token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return false;
  const max = Number(process.env.GEBETA_RATE_MAX) || 40;
  try {
    const key = `rl:${uid}:${Math.floor(Date.now() / windowMs)}`;
    const res = await fetch(`${url}/pipeline`, {
      method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify([['INCR', key], ['PEXPIRE', key, String(windowMs * 2)]]),
    });
    if (!res.ok) return false;
    const out = await res.json();
    const n = Number(out?.[0]?.result);
    if (Number.isFinite(n) && n > max) fail(429, 'Too many requests, slow down');
    return true;
  } catch (e) { if (e instanceof HttpError) throw e; return false; } // Redis down → fall back to the local limiter
}
function rateLimit(uid, windowMs = 10_000) {
  const max = Number(process.env.GEBETA_RATE_MAX) || 40;
  const now = Date.now();
  const arr = (hits.get(uid) || []).filter((t) => now - t < windowMs);
  arr.push(now); hits.set(uid, arr);
  if (hits.size > 5000) for (const [k, v] of hits) if (!v.length || now - v[v.length - 1] > windowMs) hits.delete(k);
  if (arr.length > max) fail(429, 'Too many requests, slow down');
}

const ok = (o) => NextResponse.json({ ...o, serverNow: Date.now() }); // every reply carries the server clock so timers never drift
const rooms = (db) => db.collection('gebetaRooms');
const privRef = (db, code, id) => rooms(db).doc(code).collection('private').doc(id);
const expiry = () => new Date(Date.now() + ROOM_TTL_MS);


// ── Coin wallet: one document per account, written only here (Admin SDK). The client can read its own, never write it.
const walletRef = (db, uid) => db.collection('wallets').doc(uid);
/** Read a wallet inside a transaction; an account that has none yet gets the welcome gift (created = true). */
async function readWallet(tx, db, uid, now) {
  const s = await tx.get(walletRef(db, uid));
  return s.exists ? { w: s.data(), created: false } : { w: WC.newWallet(now), created: true };
}
const putWallet = (tx, db, uid, w) => tx.set(walletRef(db, uid), w);
async function walletInfo(db, uid) {
  const now = Date.now();
  return db.runTransaction(async (tx) => {
    const { w, created } = await readWallet(tx, db, uid, now);
    if (created) putWallet(tx, db, uid, w);
    return { wallet: WC.view(w, now), gift: created };
  });
}
async function spinWallet(db, uid) {
  const now = Date.now();
  return db.runTransaction(async (tx) => {
    const { w } = await readWallet(tx, db, uid, now);
    const r = WC.spinOnce(w, now);
    if (!r.ok) { fail(409, 'No spins left today'); }
    putWallet(tx, db, uid, r.wallet);
    return { coins: r.coins, index: r.index, wallet: WC.view(r.wallet, now) };
  });
}
async function topUpWallet(db, uid) {
  const now = Date.now();
  return db.runTransaction(async (tx) => {
    const { w } = await readWallet(tx, db, uid, now);
    const r = WC.topUpOnce(w, now);
    if (!r.ok) { fail(409, r.reason === 'used' ? 'You already used today\'s refill' : 'You still have enough coins'); }
    putWallet(tx, db, uid, r.wallet);
    return { coins: r.coins, wallet: WC.view(r.wallet, now) };
  });
}
// ── Rewarded ads. The server picks the ad, remembers when it started, and pays the bonus spins only when the client
// comes back after the ad's full length. Time is the server's clock, so a modified client cannot shorten the ad,
// and a session pays once. (Daily cap + bank cap live in walletCore.grantAdSpins.)
const adSessionRef = (db, uid) => db.collection('adSessions').doc(uid);
async function adStart(db, uid) {
  const now = Date.now();
  const { wallet } = await walletInfo(db, uid);
  if (wallet.adsLeft <= 0) fail(409, 'No bonus ads left today. They come back tomorrow.');
  // Smart pick (tap-rate learning with exploration, daily pacing). No lang / hour here: the server does not know the phone's, so those rules are skipped rather than guessed.
  const prev = await adSessionRef(db, uid).get();   // v67: consecutive order — the ad after the one this player was shown last
  const ad = rotatePick((await servableAds(db, now)).map(withTargeting), { placement: 'rewarded', now, lastId: prev.exists ? prev.data().adId : null });
  const shownAd = ad || houseAd('rewarded');   // no paid ad live: the built-in ad, so the reward is always available
  const durationMs = clampSeconds(shownAd.durationSec, 'rewarded') * 1000;
  const id = randomUUID();
  await adSessionRef(db, uid).set({ id, adId: shownAd.id, startedAt: now, durationMs, used: false });
  return { session: { id, durationMs }, ad: publicAd(shownAd, 'rewarded'), wallet };
}
async function adDone(db, uid, sessionId) {
  const now = Date.now();
  const out = await db.runTransaction(async (tx) => {
    const s = await tx.get(adSessionRef(db, uid));
    const sess = s.exists ? s.data() : null;
    if (!sess || sess.used || !sessionId || sess.id !== String(sessionId)) fail(409, 'This ad was already counted.');
    if (now - sess.startedAt > SESSION_TTL_MS) fail(409, 'This ad expired. Watch it again.');
    if (now - sess.startedAt < sess.durationMs - DONE_TOLERANCE_MS) fail(409, 'The ad was not watched to the end.');
    const { w } = await readWallet(tx, db, uid, now);
    const r = WC.grantAdSpins(w, now);
    if (!r.ok) fail(409, 'No bonus ads left today. They come back tomorrow.');
    tx.set(adSessionRef(db, uid), { ...sess, used: true, doneAt: now });
    putWallet(tx, db, uid, r.wallet);
    return { spins: r.spins, coins: r.coins, adId: sess.adId, wallet: WC.view(r.wallet, now) };
  });
  await bump(db, out.adId, 'impressions', now); await bump(db, out.adId, 'rewarded', now);
  return { spins: out.spins, coins: out.coins, wallet: out.wallet };
}
/** Before opening or entering a match: the player must hold the entry fee. */
async function requireCoins(db, uid, fee) {
  const { wallet } = await walletInfo(db, uid);
  if (wallet.coins < fee) fail(402, 'Not enough coins for this entry fee. Spin the daily wheel to earn more.');
}

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

async function createRoom(db, uid, tokenName, { game, ruleset, options, isPublic, fee }) {
  if (!isPlayable(game)) fail(403, 'This game is coming soon');
  await requireCoins(db, uid, fee); // nobody can open a match they could not pay for
  const profile = await getProfile(db, uid, tokenName, game);
  const code = await freshCode(db);
  const doc = newRoomDoc({ game, uid, profile, ruleset, options, isPublic, fee, now: FieldValue.serverTimestamp(), expireAt: expiry() });
  await rooms(db).doc(code).set({ ...doc, lastSeen: Date.now() });
  return code;
}

async function joinRoom(db, uid, tokenName, code) {
  const ref = rooms(db).doc(code);
  const peek = await ref.get();
  if (!peek.exists) fail(404, 'No room with that code');
  if (!isPlayable(peek.data().game || 'gebeta')) fail(403, 'This game is coming soon');
  const profile = await getProfile(db, uid, tokenName, peek.data().game);
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) fail(404, 'No room with that code');
    const room = snap.data();
    if (room.players.includes(uid)) return { code, status: room.status, own: true }; // already seated (own room / rematch double-tap)
    if (room.status !== 'waiting' || room.players.length !== 1) fail(409, 'That room is already full');
    // The entry fee leaves BOTH wallets at the moment the match starts, in this same transaction.
    const fee = Number(room.fee) || 0, now = Date.now();
    let paid = false;
    if (fee > 0) {
      const mine = await readWallet(tx, db, uid, now), host = await readWallet(tx, db, room.players[0], now);
      const a = WC.charge(mine.w, fee, now); if (!a.ok) fail(402, 'Not enough coins for this entry fee. Spin the daily wheel to earn more.');
      const b = WC.charge(host.w, fee, now); if (!b.ok) fail(409, 'The host can no longer cover the entry fee');
      putWallet(tx, db, uid, a.wallet); putWallet(tx, db, room.players[0], b.wallet); paid = true;
    }
    const { room: seated, priv } = seatSecondPlayer(room, { uid, profile });
    tx.set(ref, { ...seated, paid });
    for (const [id, data] of Object.entries(priv || {})) tx.set(privRef(db, code, id), data);
    return { code, status: 'playing' };
  });
}

async function quickMatch(db, uid, tokenName, { game, ruleset, options, fee }) {
  if (!isPlayable(game)) fail(403, 'This game is coming soon');
  await requireCoins(db, uid, fee);
  const mod = gameOf(game);
  const rs = mod.rulesets.includes(ruleset) ? ruleset : mod.defaultRuleset;
  const opts = mod.normalizeOptions(options);
  const q = await rooms(db)
    .where('status', '==', 'waiting').where('public', '==', true)
    .where('createdAt', '>=', new Date(Date.now() - WAIT_MS))
    .orderBy('createdAt', 'asc').limit(30).get();
  for (const d of q.docs) {
    const r = d.data();
    if ((r.game || 'gebeta') !== game || r.ruleset !== rs || r.players[0] === uid || (Number(r.fee) || 0) !== fee) continue;
    if (Date.now() - (r.lastSeen || 0) > PRESENCE_MS) continue; // owner closed the app: never pair a real player with a ghost
    if (game === 'dominoes' && r.options?.target !== opts.target) continue;
    try { return await joinRoom(db, uid, tokenName, d.id); } catch (e) { if (!(e instanceof HttpError)) throw e; }
  }
  return { code: await createRoom(db, uid, tokenName, { game, ruleset: rs, options: opts, isPublic: true, fee }), status: 'waiting' };
}

// Runs a mutation on a room; if it ends the match, updates both players' rating and stats in the same transaction.
async function mutateRoom(db, code, mutator) {
  const ref = rooms(db).doc(code);
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) fail(404, 'No room with that code');
    const room = snap.data();
    if (!isPlayable(room.game || 'gebeta')) fail(403, 'This game is coming soon');
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
      const fee = Number(room.fee) || 0, doPay = fee > 0 && room.paid === true, now = Date.now();
      const wallets = doPay ? await Promise.all(next.players.map((u) => readWallet(tx, db, u, now))) : [];
      const ratings = snaps.map((s) => (s.exists && Number.isFinite(s.data()[f.rating]) ? s.data()[f.rating] : 1000));
      const out = settle(next, ratings);
      next.ratingChange = out.map((o) => o.delta);
      if (doPay) { // winner takes 90% of the pot, a draw refunds both fees, paid in the same transaction that ends the match
        const pays = WC.payouts(fee, next.winner);
        next.players.forEach((u, i) => putWallet(tx, db, u, WC.pay(wallets[i].w, pays[i], next.winner === 'draw' ? 'refund' : 'prize', now)));
        next.coinChange = pays.map((p) => p - fee); next.paid = false;
      }
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
    if (!(await globalRateLimit(uid))) rateLimit(uid);
    const body = await req.json().catch(() => ({}));
    const db = adminDb();
    const game = normalizeGame(body.game);
    const code = normalizeCode(body.code);
    const common = { game, ruleset: String(body.ruleset || ''), options: body.options || {}, fee: WC.normalizeFee(body.fee) };

    switch (body.action) {
      case 'wallet':
        return ok(await walletInfo(db, uid));
      case 'spin':
        return ok(await spinWallet(db, uid));
      case 'topup':
        return ok(await topUpWallet(db, uid));
      case 'adStart':
        return ok(await adStart(db, uid));
      case 'adDone':
        return ok(await adDone(db, uid, body.session));
      case 'create':
        return ok({ code: await createRoom(db, uid, decoded.name, { ...common, isPublic: false }), status: 'waiting' });
      case 'quick':
        return ok(await quickMatch(db, uid, decoded.name, common));
      case 'join':
        return ok(await joinRoom(db, uid, decoded.name, code));
      case 'move':
      case 'roll':  // Ludo: the SERVER rolls the die
      case 'collect': // Gebeta: tap a ripe four to bank it (free action, either player's turn)
      case 'drawTile':
      case 'offerDraw':
      case 'declineDraw':
      case 'nextRound':
      case 'call':  // Bingo: reveal the next ball (server checks the clock)
      case 'mark':  // Bingo: daub a called number
      case 'claim': // Bingo: shout BINGO
        return ok(await gameAction(db, code, uid, body.action, body));
      case 'resign':
        return ok(await mutateRoom(db, code, (room) => {
          const seat = room.players.indexOf(uid);
          if (seat < 0) return { error: 'You are not in this match', status: 403 };
          if (room.status !== 'playing') return { error: 'Match is not in progress' };
          return { room: applyForfeit(room, seat, 'resigned') };
        }));
      case 'timeout':
        return ok(await mutateRoom(db, code, (room) => {
          const seat = room.players.indexOf(uid);
          if (seat < 0) return { error: 'You are not in this match', status: 403 };
          if (room.status !== 'playing') return { error: 'Match is not in progress' };
          if (room.turn === seat) return { error: 'It is your turn' };
          if (!room.deadline || Date.now() < room.deadline) return { error: 'Opponent still has time' };
          return { room: applyForfeit(room, room.turn, 'timeout') };
        }));
      case 'time':
        return ok({ ok: true });
      case 'ping': { // presence heartbeat: keeps a waiting room alive and tells the opponent we are still here
        const ref = rooms(db).doc(code);
        const snap = await ref.get();
        if (!snap.exists) return ok({ ok: false });
        const r = snap.data(), seat = r.players.indexOf(uid);
        if (seat < 0) fail(403, 'You are not in this match');
        if (r.status === 'waiting') await ref.update({ lastSeen: Date.now() });
        else if (r.status === 'playing') await ref.update({ [`seen.${seat}`]: Date.now() });
        return ok({ ok: true, status: r.status });
      }
      case 'cancel': {
        const ref = rooms(db).doc(code);
        await db.runTransaction(async (tx) => {
          const s = await tx.get(ref);
          if (s.exists && s.data().status === 'waiting' && s.data().players[0] === uid) tx.delete(ref);
        });
        return ok({ ok: true });
      }
      // ── friends, direct chat and invites (v73): see src/lib/online/socialApi.js
      case 'friendCode':
        return ok({ code: await Social.friendCode(db, uid) });
      case 'friendRequest':
        return ok(await Social.sendRequest(db, uid, { code: body.friendCode, to: body.to }));
      case 'friendAccept':
        return ok(await Social.respond(db, uid, body.to, true));
      case 'friendDecline':
        return ok(await Social.respond(db, uid, body.to, false));
      case 'friendRemove':
        return ok(await Social.remove(db, uid, body.to));
      case 'chatSend':
        return ok(await Social.chatSend(db, uid, body.to, body.text));
      case 'chatRead':
        return ok(await Social.chatRead(db, uid, body.to));
      case 'friendInvite':
        return ok(await Social.inviteFriend(db, uid, { to: body.to, room: code || null, makeRoom: () => createRoom(db, uid, decoded.name, { ...common, isPublic: false }) }));
      case 'inviteDismiss':
        return ok(await Social.inviteDismiss(db, uid, body.id));
      case 'presence':
        return ok(await Social.presence(db, uid));
      case 'roomChat': // free text between the two players of a match (last 30 lines are kept on the room)
        return ok(await mutateRoom(db, code, (room) => {
          const seat = room.players.indexOf(uid);
          if (seat < 0) return { error: 'You are not in this match', status: 403 };
          const out = pushRoomChat(room.chat, seat, body.text);
          if (out.error) return { error: out.error };
          return { room: { ...room, chat: out.chat } };
        }));
      case 'emote': {
        const id = String(body.id || '').slice(0, 12);
        return ok(await mutateRoom(db, code, (room) => {
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
        if (o.rematch) return ok(await joinRoom(db, uid, decoded.name, o.rematch));
        const newCode = await createRoom(db, uid, decoded.name, { game: o.game || 'gebeta', ruleset: o.ruleset, options: { ...(o.options || {}), ...(o.opener ? { avoid: o.opener } : {}) }, isPublic: false, fee: WC.normalizeFee(o.fee) });
        await oldRef.update({ rematch: newCode });
        return ok({ code: newCode, status: 'waiting' });
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
