import assert from 'node:assert/strict';
import { register } from 'node:module';
process.env.GEBETA_RATE_MAX = '1000000';
register('./fakes/loader.mjs', import.meta.url);
const { POST } = await import('../src/app/api/gebeta/route.js');
const { __store } = await import('./fakes/firebaseAdmin.mjs');
const { legalMoves, newGame } = await import('../src/lib/gebeta/engine.js');

const call = async (uid, body) => {
  const req = { headers: { get: (h) => (uid ? `Bearer tok:${uid}` : '') }, json: async () => body };
  return POST(req);
};
const ok = async (uid, body) => { const r = await call(uid, body); assert.equal(r.status, 200, JSON.stringify(r.body)); return r.body; };
const room = (code) => __store.get(`gebetaRooms/${code}`);

// auth required
assert.equal((await call(null, { action: 'quick' })).status, 401);
assert.equal((await call('x', { action: 'nope' })).status, 400);

__store.set('users/alice', { displayName: 'Alice', avatar: 'queen', rating: 1000, wins: 0, losses: 0, draws: 0, games: 0 });
__store.set('users/bob', { displayName: 'Bob', avatar: 'lion', rating: 1000, wins: 0, losses: 0, draws: 0, games: 0 });

// quick match: alice waits, bob gets paired, alice can't pair with herself
const a = await ok('alice', { action: 'quick', ruleset: 'gebeta' });
assert.equal(a.status, 'waiting');
const a2 = await ok('alice', { action: 'quick', ruleset: 'gebeta' });
assert.notEqual(a2.code, a.code, 'alice gets her own second room, not matched to herself');
const b = await ok('bob', { action: 'quick', ruleset: 'gebeta' });
assert.equal(b.code, a.code); assert.equal(b.status, 'playing');
const code = a.code; let r = room(code);
assert.equal(r.status, 'playing'); assert.deepEqual([...r.players].sort(), ['alice', 'bob']);
assert.equal(r.names[r.players.indexOf('bob')], 'Bob');
// third player can't join
__store.set('users/carl', { displayName: 'Carl' });
assert.equal((await call('carl', { action: 'join', code })).status, 409);

// moves: wrong player rejected, right player accepted, illegal pit rejected
const first = r.players[0], second = r.players[1];
assert.equal((await call(second, { action: 'move', code, pit: 7 })).status, 400);
assert.equal((await call(first, { action: 'move', code, pit: 9 })).status, 400);
assert.equal((await call('carl', { action: 'move', code, pit: 0 })).status, 403);
await ok(first, { action: 'move', code, pit: 0 });
r = room(code); assert.equal(r.moveSeq, 1); assert.ok(r.lastMove.steps.length > 0);
assert.equal(r.pits.reduce((x, y) => x + y, 0), 48);

// timeout not allowed early; emote works
assert.equal((await call(second, { action: 'timeout', code })).status, 400);
await ok(second, { action: 'emote', code, id: 'gobez' });
assert.equal(room(code).emote.id, 'gobez');

// play many random legal moves via the API (rounds roll over, so a game has no fixed length), then resign
let guard = 0;
while (room(code).status === 'playing' && guard++ < 200) {
  const cur = room(code); const who = cur.players[cur.turn];
  const moves = legalMoves({ pits: cur.pits, turn: cur.turn, over: false });
  await ok(who, { action: 'move', code, pit: moves[Math.floor(Math.random() * moves.length)] });
}
assert.equal(room(code).pits.reduce((x, y) => x + y, 0), 48, 'seeds are conserved across rounds');
if (room(code).status === 'playing') await ok(second, { action: 'resign', code });
r = room(code); assert.equal(r.status, 'finished'); assert.ok(r.winner !== null);
assert.ok(r.ratingChange && r.ratingChange.length === 2);
const ua = __store.get('users/alice'), ub = __store.get('users/bob');
assert.equal(ua.games, 1); assert.equal(ub.games, 1); assert.equal(ua.rating + ub.rating, 2000);
assert.equal((await call(first, { action: 'move', code, pit: 0 })).status, 400, 'no moves after finish');

// rematch flow
const rm = await ok('alice', { action: 'rematch', code });
assert.equal(rm.status, 'waiting');
const rj = await ok('bob', { action: 'rematch', code });
assert.equal(rj.code, rm.code); assert.equal(room(rm.code).status, 'playing');

// resign updates rating; private create/join/cancel
await ok('bob', { action: 'resign', code: rm.code });
assert.equal(room(rm.code).reason, 'resigned'); assert.equal(room(rm.code).winner, 1 - room(rm.code).players.indexOf('bob'));
assert.equal(__store.get('users/bob').games, 2);
const pc = await ok('carl', { action: 'create', ruleset: 'gebeta' });
assert.equal(room(pc.code).public, false);
await ok('carl', { action: 'cancel', code: pc.code }); assert.equal(room(pc.code), undefined);

// timeout claim after the deadline passes
const t1 = await ok('alice', { action: 'create' }); await ok('bob', { action: 'join', code: t1.code });
const tr = room(t1.code); const idle = tr.players[tr.turn], waiter = tr.players[1 - tr.turn];
tr.deadline = Date.now() - 1;
assert.equal((await call(idle, { action: 'timeout', code: t1.code })).status, 400, 'idle player cannot claim own timeout');
await ok(waiter, { action: 'timeout', code: t1.code });
assert.equal(room(t1.code).reason, 'timeout'); assert.equal(room(t1.code).players[room(t1.code).winner], waiter);

// ───────────────────────── Checkers online ─────────────────────────
{
  const { legalMoves: cLegal } = await import('../src/lib/checkers/engine.js');
  const c = await ok('alice', { action: 'quick', game: 'checkers', ruleset: 'american' });
  assert.equal(c.status, 'waiting'); assert.equal(room(c.code).game, 'checkers');
  const wrongGame = await ok('bob', { action: 'quick', game: 'gebeta', ruleset: 'gebeta' });
  assert.notEqual(wrongGame.code, c.code, 'different games never pair');
  await ok('bob', { action: 'cancel', code: wrongGame.code });
  const cb = await ok('bob', { action: 'quick', game: 'checkers', ruleset: 'american' });
  assert.equal(cb.code, c.code); assert.equal(cb.status, 'playing');
  let cr = room(c.code); assert.equal(cr.board.length, 64);
  const [p0, p1] = cr.players;
  assert.equal((await call(p1, { action: 'move', code: c.code, from: 0, path: [9] })).status, 400, 'not your turn');
  assert.equal((await call(p0, { action: 'move', code: c.code, from: 40, path: [10] })).status, 400, 'illegal move');
  assert.equal((await call(p0, { action: 'move', code: c.code, from: 'x', path: 'y' })).status, 400, 'garbage rejected');
  // draw offer: offer, decline, offer again, accept
  await ok(p0, { action: 'offerDraw', code: c.code }); assert.equal(room(c.code).drawOffer, 0);
  assert.equal((await call(p0, { action: 'offerDraw', code: c.code })).status, 400);
  await ok(p1, { action: 'declineDraw', code: c.code }); assert.equal(room(c.code).drawOffer, null);
  // play a random full game through the API
  let guard = 0;
  while (room(c.code).status === 'playing' && guard++ < 900) {
    const cur = room(c.code); const who = cur.players[cur.turn];
    const ms = cLegal({ board: cur.board, turn: cur.turn, over: false, seen: {} }, cur.ruleset);
    const m = ms[Math.floor(Math.random() * ms.length)];
    await ok(who, { action: 'move', code: c.code, from: m.from, path: m.path });
  }
  cr = room(c.code); assert.equal(cr.status, 'finished'); assert.ok(cr.winner !== null); assert.ok(cr.ratingChange.length === 2);
  assert.equal(__store.get('users/alice').games_checkers, 1, 'checkers stats are tracked separately');
  assert.ok(__store.get('users/alice').rating_checkers !== undefined);
  // draw by agreement ends the match as a draw with rating settled
  const d1 = await ok('alice', { action: 'create', game: 'checkers' }); await ok('bob', { action: 'join', code: d1.code });
  const dr = room(d1.code); await ok(dr.players[0], { action: 'offerDraw', code: d1.code }); await ok(dr.players[1], { action: 'offerDraw', code: d1.code });
  assert.equal(room(d1.code).winner, 'draw'); assert.equal(room(d1.code).detail, 'agreed');
  // rematch keeps the game
  const rmc = await ok('alice', { action: 'rematch', code: d1.code }); assert.equal(room(rmc.code).game, 'checkers');
}

// ───────────────────────── Dominoes online ─────────────────────────
{
  const { playsFor, dealRound } = await import('../src/lib/dominoes/engine.js');
  const dec = (x) => [Number(x[0]), Number(x[1])];
  const priv = (code, id) => __store.get(`gebetaRooms/${code}/private/${id}`);
  const d = await ok('alice', { action: 'create', game: 'dominoes', ruleset: 'draw', options: { target: 50 } });
  assert.equal(room(d.code).target, 50);
  await ok('bob', { action: 'join', code: d.code });
  let dr = room(d.code); const [q0, q1] = dr.players;
  assert.equal(dr.status, 'playing'); assert.deepEqual(dr.handCounts, [7, 7]); assert.equal(dr.boneyardCount, 14);
  assert.ok(priv(d.code, q0).hand.length === 7 && priv(d.code, q1).hand.length === 7 && priv(d.code, '_boneyard').tiles.length === 14);
  // (the opening tile is public by the rules: the player to lead is known to hold it)
  for (const h of [...priv(d.code, q0).hand, ...priv(d.code, q1).hand, ...priv(d.code, '_boneyard').tiles]) if (h !== dr.mustLead) assert.equal(JSON.stringify(dr).includes(`"${h}"`), false, 'room doc must not contain hidden tiles: ' + h);
  const lead = dr.turn === 0 ? q0 : q1, other = dr.turn === 0 ? q1 : q0;
  assert.equal((await call(other, { action: 'move', code: d.code, tile: '00', end: 'R' })).status, 400, 'not your turn');
  assert.equal((await call(lead, { action: 'move', code: d.code, tile: 'zz', end: 'R' })).status, 400, 'bad tile');
  assert.equal((await call(lead, { action: 'drawTile', code: d.code })).status, 400, 'cannot draw at the start');
  // play whole matches through the API with random legal choices
  for (const [rs, target] of [['draw', 50], ['block', 50], ['draw', 100]]) {
    const g = await ok('alice', { action: 'create', game: 'dominoes', ruleset: rs, options: { target } }); await ok('bob', { action: 'join', code: g.code });
    let n = 0, rounds = 1;
    while (room(g.code).status === 'playing' && n++ < 4000) {
      const cur = room(g.code);
      if (cur.phase === 'roundOver') {
        assert.ok(cur.roundResult && cur.roundResult.h0 && cur.roundResult.h1, 'hands revealed at round end'); assert.equal(cur.deadline, null);
        await ok(cur.players[0], { action: 'nextRound', code: g.code, round: cur.round });
        await ok(cur.players[1], { action: 'nextRound', code: g.code, round: cur.round }); // idempotent
        assert.equal(room(g.code).round, cur.round + 1); rounds++; continue;
      }
      const who = cur.players[cur.turn];
      const hand = priv(g.code, who).hand.map(dec);
      const chain = cur.chain.map(dec);
      const plays = playsFor(hand, chain, cur.mustLead ? dec(cur.mustLead) : null);
      if (!plays.length) { await ok(who, { action: 'drawTile', code: g.code }); continue; }
      const p = plays[Math.floor(Math.random() * plays.length)];
      await ok(who, { action: 'move', code: g.code, tile: p.tile, end: p.end });
      const after = room(g.code);
      assert.equal(after.handCounts[0] + after.handCounts[1] + after.boneyardCount + after.chain.length, 28);
    }
    const fin = room(g.code); assert.equal(fin.status, 'finished'); assert.ok(fin.winner === 0 || fin.winner === 1);
    assert.ok(fin.scores[fin.winner] >= target); assert.ok(fin.ratingChange.length === 2);
  }
  assert.ok(__store.get('users/alice').games_dominoes >= 3);
  assert.equal(__store.get('users/alice').rating_dominoes + __store.get('users/bob').rating_dominoes, 2000);
}

// rate limiting kicks in for a flooding client
process.env.GEBETA_RATE_MAX = '5';
let limited = 0; for (let i = 0; i < 8; i++) if ((await call('flooder', { action: 'nope' })).status === 429) limited++;
assert.ok(limited >= 3, 'flooder is rate limited'); process.env.GEBETA_RATE_MAX = '1000000';
console.log('API integration tests passed');
