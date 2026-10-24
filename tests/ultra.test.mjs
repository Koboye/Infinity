// v14: Dama Ultra meter + Sudden Death, Bingo multi-card / patterns / power-ups / shield.
import assert from 'node:assert/strict';
import { newGame as ck, playMove, suddenDeath, counts, legalMoves, ULTRA_MAX } from '../src/lib/checkers/engine.js';
import { newGame as bn, claim, cardsOf, completed, patterns, mark, instantDaub, doubleDaub, grantShield, toGo, chestAt, FREE } from '../src/lib/bingo/engine.js';

let n = 0; const t = (name, fn) => { fn(); n++; console.log('ok', name); };

t('Ultra meter only exists when asked for', () => {
  assert.equal(ck('dama').ultra, undefined);
  assert.deepEqual(ck('dama', { ultra: true }).ultra, [0, 0]);
});
t('a full Ultra meter grants an extra turn', () => {
  // seat 0 king on a1-ish with two men to eat in a row: build a position by hand
  const g = ck('dama', { ultra: true }); g.board.fill(0);
  g.board[56] = 2;                  // seat-0 king, bottom-left
  g.board[40] = 3; g.board[24] = 3; // two enemy men on the same file with gaps to land
  g.board[7] = 3;                   // a spare enemy man far away (so the game goes on)
  g.ultra = [ULTRA_MAX - 1, 0];
  const mv = legalMoves(g, 'dama').find((m) => m.caps.length === 2 && !m.more);
  assert.ok(mv, 'a double capture exists');
  const r = playMove(g, mv.from, mv.path, 'dama');
  assert.equal(r.ok, true); assert.equal(r.extraTurn, true);
  assert.equal(r.state.turn, 0); assert.deepEqual(r.state.ultra, [0, 0]);
});
t('a quiet move empties the meter and passes the turn', () => {
  const g = ck('dama', { ultra: true }); g.ultra = [2, 0];
  const mv = legalMoves(g, 'dama').find((m) => !m.caps.length);
  const r = playMove(g, mv.from, mv.path, 'dama');
  assert.equal(r.extraTurn, false); assert.equal(r.state.turn, 1);
  assert.equal(r.state.ultra[0], 0);
});
t('Sudden Death removes one piece per side and never the last one', () => {
  const g = ck('dama');
  const r = suddenDeath(g, 'dama');
  assert.equal(r.ok, true); assert.deepEqual(counts(r.state.board), [15, 15]);
  const lone = ck('dama'); lone.board.fill(0); lone.board[56] = 1; lone.board[0] = 3; lone.board[1] = 3;
  const r2 = suddenDeath(lone, 'dama');
  assert.deepEqual(counts(r2.state.board), [1, 1]);
});

const rng = () => 0.37;
t('new bingo patterns have the right shape', () => {
  assert.equal(patterns('stamp').length, 4); assert.ok(patterns('stamp').every((p) => p.length === 4));
  assert.equal(patterns('xshape')[0].length, 9); assert.equal(patterns('plus')[0].length, 9);
});
t('1 to 4 cards; any card can win', () => {
  for (const k of [1, 2, 3, 4]) assert.equal(cardsOf(bn('line', Math.random, k), 0).length, k);
  assert.equal(cardsOf(bn('line', Math.random, 9), 0).length, 4);
  let s = bn('stamp', Math.random, 3);
  const c = cardsOf(s, 0)[2];
  for (const i of [0, 1, 5, 6]) { s.called.push(c.card[i]); s = mark(s, 0, i, 2); }
  assert.ok(completed(s, 0));
  const r = claim(s, 0); assert.equal(r.ok, true); assert.equal(r.state.winCard, 2);
});
t('Instant Daub marks a called number; Double Daub marks two uncalled ones', () => {
  let s = bn('line', Math.random, 2);
  s.called.push(s.cards[0][0]);
  const a = instantDaub(s, 0); assert.equal(a.picked.length, 1);
  const b = doubleDaub(s, 0); assert.equal(b.picked.length, 2);
  const marked = cardsOf(b.state, 0).reduce((m, c) => m + c.marks.filter(Boolean).length, 0);
  assert.equal(marked, 2 + 2);   // two FREE centres + two new marks
});
t('Shield absorbs one false BINGO; the next one still costs', () => {
  let s = grantShield(bn('line'), 0);
  let r = claim(s, 0); assert.equal(r.error, 'shielded'); assert.equal(r.state.lock[0], 0);
  r = claim(r.state, 0); assert.equal(r.error, 'false'); assert.ok(r.state.lock[0] > 0);
});
t('three treasure chests hide behind numbers', () => {
  const s = bn('line'); const keys = Object.keys(s.chests);
  assert.equal(keys.length, 3); assert.ok(chestAt(s, Number(keys[0])) > 0); assert.equal(toGo(s, 0), 4);
});
console.log(`${n} ultra tests passed`);

// ── v14: collect a four WHILE the stones are still travelling ──
import { newGame as gb, playMove as gplay, collect as gcollect, legalMoves as glegal } from '../src/lib/gebeta/engine.js';
t('a timed collect banks the four before a later stone can freeze it', () => {
  let found = 0, seed = 7;
  const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 2 ** 32; };
  for (let trial = 0; trial < 4000 && found < 5; trial++) {
    const g = gb('gebeta');
    for (const i of [0, 1, 2, 3, 4, 5, 7, 8, 9, 10, 11, 12]) g.pits[i] = Math.floor(rnd() * 7);
    if (!glegal(g).length) continue;
    const pit = glegal(g)[Math.floor(rnd() * glegal(g).length)];
    const plain = gplay(g, pit); if (!plain.ok) continue;
    // a hole that became ripe and was then frozen by a later stone of the SAME move
    const ripeIdx = plain.steps.findIndex((s, k) => s.t === 'ripe' && plain.steps.slice(k + 1).some((x) => x.t === 'share' && x.i === s.i));
    if (ripeIdx < 0) continue;
    const ripe = plain.steps[ripeIdx];
    const r = gplay(g, pit, 'gebeta', [{ at: ripeIdx + 1, hole: ripe.i, seat: ripe.by }]);
    assert.equal(r.ok, true);
    const fam = r.steps[ripeIdx + 1];
    assert.equal(fam.t, 'family'); assert.equal(fam.i, ripe.i); assert.equal(fam.n, 4);
    assert.equal(r.steps.slice(0, ripeIdx + 1).map((s) => s.t + s.i).join(), plain.steps.slice(0, ripeIdx + 1).map((s) => s.t + s.i).join());
    assert.ok(r.state.pits[6] + r.state.pits[13] >= plain.state.pits[6] + plain.state.pits[13]);
    const total = (st) => st.pits.reduce((a, b) => a + b, 0);
    assert.equal(total(r.state), total(g)); assert.equal(total(plain.state), total(g)); // never loses a stone
    found++;
  }
  assert.ok(found >= 3, `only ${found} scenarios found`);
});
console.log(`${n} ultra tests passed (with timed collect)`);

// ── server: the same timed collect through the room API ──
import { newRoomDoc, seatSecondPlayer, applyRoomAction } from '../src/lib/online/rooms.js';
t('online: a collect sent with the animation step replays the move; a late one is refused', () => {
  const prof = (n) => ({ displayName: n, avatar: 'lion', rating: 1000 });
  let seed = 99; const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 2 ** 32; };
  let done = 0;
  for (let trial = 0; trial < 3000 && done < 3; trial++) {
    let room = seatSecondPlayer(newRoomDoc({ game: 'gebeta', uid: 'A', profile: prof('A'), ruleset: 'gebeta', now: 0 }), { uid: 'B', profile: prof('B') }, () => 0.1, 0).room;
    const pits = room.pits.slice();
    for (const i of [0, 1, 2, 3, 4, 5, 7, 8, 9, 10, 11, 12]) pits[i] = Math.floor(rnd() * 7);
    room = { ...room, pits, turn: 0, flag: new Array(14).fill(0) };
    const mine = [0, 1, 2, 3, 4, 5].filter((i) => pits[i] > 0); if (!mine.length) continue;
    const pit = mine[Math.floor(rnd() * mine.length)];
    const plain = gplay({ pits, own: room.own, flag: room.flag, turn: 0, over: false, winner: null }, pit);
    const k = plain.steps.findIndex((s, j) => s.t === 'ripe' && plain.steps.slice(j + 1).some((x) => x.t === 'share' && x.i === s.i));
    if (k < 0) continue;
    const ripe = plain.steps[k];
    const moved = applyRoomAction(room, null, room.players[0], 'move', { pit }, 1000);
    assert.ok(!moved.error);
    // only the player entitled to the four may collect it
    const wrong = applyRoomAction(moved.room, null, room.players[1 - ripe.by], 'collect', { pit: ripe.i, at: k + 1 }, 1100);
    assert.ok(!wrong.room || wrong.room.lastMove.collect, 'wrong player cannot replay the move');
    const who = room.players[ripe.by];
    const res = applyRoomAction(moved.room, null, who, 'collect', { pit: ripe.i, at: k + 1 }, 1100);
    assert.ok(!res.error, res.error);
    assert.equal(res.room.lastMove.rescript, true); assert.equal(res.room.lastMove.steps[k + 1].t, 'family');
    assert.equal(res.room.pits.reduce((a, b) => a + b, 0), pits.reduce((a, b) => a + b, 0));
    assert.notEqual(res.room.flag[ripe.i], 3, 'the four was banked, not frozen');
    done++;
  }
  assert.ok(done >= 2, `only ${done} scenarios`);
});
console.log(`${n} tests passed incl. online timed collect`);

t('either side can be drawn to start (Gebeta and Dama)', () => {
  assert.equal(gb('gebeta').turn, 0); assert.equal(gb('gebeta', 1).turn, 1);
  assert.equal(ck('dama').turn, 0); assert.equal(ck('dama', { first: 1 }).turn, 1);
  const g = ck('dama', { first: 1 }); const mv = legalMoves(g, 'dama')[0];
  const r = playMove(g, mv.from, mv.path, 'dama'); assert.equal(r.ok, true); assert.equal(r.state.turn, 0);
});
