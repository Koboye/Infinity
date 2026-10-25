import assert from 'node:assert/strict';
import { register } from 'node:module';
process.env.GEBETA_RATE_MAX = '1000000';
register('./fakes/loader.mjs', import.meta.url);
const { POST } = await import('../src/app/api/gebeta/route.js');
const { __store } = await import('./fakes/firebaseAdmin.mjs');
const { SPIN_GRACE_MS } = await import('../src/lib/online/rooms.js');

const call = async (uid, body) => POST({ headers: { get: () => (uid ? `Bearer tok:${uid}` : '') }, json: async () => body });
const ok = async (uid, body) => { const r = await call(uid, body); assert.equal(r.status, 200, JSON.stringify(r.body)); return r.body; };
const room = (c) => __store.get(`gebetaRooms/${c}`);
for (const u of ['ann', 'ben', 'cy', 'dee']) __store.set(`users/${u}`, { displayName: u, avatar: 'lion', rating: 1000 });

// every reply carries the server clock
const tm = await ok('ann', { action: 'time' });
assert.ok(Math.abs(tm.serverNow - Date.now()) < 5000);

// a ghost (owner stopped pinging) is never matched with a real player
const w = await ok('ann', { action: 'quick', ruleset: 'gebeta' });
assert.equal(w.status, 'waiting');
assert.ok(room(w.code).lastSeen > 0 && room(w.code).turnMs > 0);
__store.set(`gebetaRooms/${w.code}`, { ...room(w.code), lastSeen: Date.now() - 120000 });
const b1 = await ok('ben', { action: 'quick', ruleset: 'gebeta' });
assert.equal(b1.status, 'waiting', 'ben must not be paired with a ghost room');
assert.notEqual(b1.code, w.code);

// a live owner (ping) is matched
await ok('ben', { action: 'ping', code: b1.code });
const c1 = await ok('cy', { action: 'quick', ruleset: 'gebeta' });
assert.equal(c1.code, b1.code); assert.equal(c1.status, 'playing');

// the opening spin does not eat the first mover's clock
const r = room(c1.code);
const left = r.deadline - Date.now();
assert.ok(left > r.turnMs + SPIN_GRACE_MS - 5000, `first deadline ${left}`);

// presence ping while playing records the seat; outsiders are refused
await ok('cy', { action: 'ping', code: c1.code });
assert.ok(room(c1.code).seen[room(c1.code).players.indexOf('cy')] > 0);
assert.equal((await call('dee', { action: 'ping', code: c1.code })).status, 403);

// a rematch (avoid set) has no spin, so no grace
await ok('ben', { action: 'resign', code: c1.code });
const rm = await ok('ben', { action: 'rematch', code: c1.code });
const rj = await ok('cy', { action: 'rematch', code: c1.code });
assert.equal(rj.status, 'playing');
const r2 = room(rm.code); assert.ok(r2.deadline - Date.now() <= r2.turnMs + 1000, 'rematch has no spin grace');
console.log('online smart tests passed');

// joining your own waiting room is reported as such (never silently "enters" a waiting screen)
const own = await ok('dee', { action: 'create', game: 'gebeta', ruleset: '', options: {} });
const self = await ok('dee', { action: 'join', code: own.code });
assert.equal(self.own, true); assert.equal(self.status, 'waiting');
const real = await ok('ann', { action: 'join', code: own.code });
assert.equal(real.status, 'playing'); assert.ok(!real.own);
console.log('own-room join tests passed');

// Gebeta: tapping a ripe four must work through the real API (it used to be rejected as "Unknown action")
{
  const { newGame, playMove, legalMoves, collectable, collect, validState } = await import('../src/lib/gebeta/engine.js');
  const x = await ok('ann', { action: 'create', game: 'gebeta', ruleset: 'gebeta', options: {} });
  await ok('ben', { action: 'join', code: x.code });
  let st = newGame('gebeta'), found = null, seatOf = null;
  for (let i = 0; i < 4000 && !found; i++) {
    const mv = legalMoves(st); if (!mv.length || st.over) { st = newGame('gebeta'); continue; }
    st = playMove(st, mv[Math.floor(Math.random() * mv.length)], 'gebeta').state;
    for (const s of [0, 1]) { const c = collectable(st, s); if (c.length && validState(st)) { found = c[0]; seatOf = s; break; } }
  }
  assert.ok(found != null, 'found a position with a ripe four');
  const rr = room(x.code);
  __store.set(`gebetaRooms/${x.code}`, { ...rr, pits: st.pits, own: st.own, flag: st.flag, turn: st.turn, starter: st.starter, lastMove: null });
  const uid = rr.players[seatOf];
  const expect = collect(st, found, seatOf);
  const res = await call(uid, { action: 'collect', code: x.code, pit: found });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.deepEqual(room(x.code).pits, expect.state.pits, 'server banked the four exactly like the engine');
  // the opponent cannot collect my four
  __store.set(`gebetaRooms/${x.code}`, { ...rr, pits: st.pits, own: st.own, flag: st.flag, turn: st.turn, starter: st.starter, lastMove: null });
  const other = await call(rr.players[1 - seatOf], { action: 'collect', code: x.code, pit: found });
  assert.equal(other.status, 400);
  console.log('gebeta online collect tests passed');
}
