// Dama "huff" rule: capturing is optional, a missed / abandoned capture costs the piece, kings and men capture in every straight direction.
import assert from 'node:assert/strict';
import { playMove, legalMoves, counts, resolveHuff } from '../src/lib/checkers/engine.js';
import { chooseCheckersMove, chooseHuffPick } from '../src/lib/checkers/ai.js';
import { applyRoomAction } from '../src/lib/online/rooms.js';

let n = 0; const t = (name, fn) => { fn(); n++; console.log('ok', name); };
const sq = (r, c) => r * 8 + c;
const empty = () => new Array(64).fill(0);
const st = (board, turn = 0) => ({ board, turn, over: false, winner: null, reason: null, noProgress: 0, seen: {} });
const has = (ms, from, to) => ms.some((m) => m.from === from && m.to === to);

t('a man may capture forward, backward and sideways (all four straight directions)', () => {
  for (const [dr, dc] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
    const b = empty(); b[sq(4, 4)] = 1; b[sq(4 + dr, 4 + dc)] = 3; b[sq(0, 0)] = 3;
    const ms = legalMoves(st(b), 'dama');
    assert.ok(has(ms, sq(4, 4), sq(4 + 2 * dr, 4 + 2 * dc)), `capture ${dr},${dc}`);
  }
});
t('seat-1 men capture in every direction too', () => {
  for (const [dr, dc] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
    const b = empty(); b[sq(3, 3)] = 3; b[sq(3 + dr, 3 + dc)] = 1; b[sq(7, 7)] = 1;
    assert.ok(has(legalMoves(st(b, 1), 'dama'), sq(3, 3), sq(3 + 2 * dr, 3 + 2 * dc)));
  }
});
t('a king captures from a distance in all four directions and may land on any empty square behind', () => {
  for (const [dr, dc] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
    const b = empty(); b[sq(3, 3)] = 2; b[sq(3 + 2 * dr, 3 + 2 * dc)] = 3; b[sq(7, 7)] = 3;
    const ms = legalMoves(st(b), 'dama').filter((m) => m.caps.length);
    assert.ok(ms.length >= 1 && ms.every((m) => m.caps[0] === sq(3 + 2 * dr, 3 + 2 * dc)));
  }
});
t('capture is NOT compulsory: ordinary moves stay legal', () => {
  const b = empty(); b[sq(4, 4)] = 1; b[sq(3, 4)] = 3; b[sq(6, 0)] = 1; b[sq(0, 0)] = 3;
  const ms = legalMoves(st(b), 'dama');
  assert.ok(ms.some((m) => !m.caps.length) && ms.some((m) => m.caps.length));
});
t('skipping a capture forfeits the piece that could have captured (it is removed)', () => {
  const b = empty(); b[sq(4, 4)] = 1; b[sq(3, 4)] = 3; b[sq(6, 0)] = 1; b[sq(0, 0)] = 3;
  const r = playMove(st(b), sq(6, 0), [sq(5, 0)], 'dama'); assert.ok(r.ok);
  assert.equal(r.huffed, sq(4, 4)); assert.equal(r.state.board[sq(4, 4)], 0); assert.equal(r.state.board[sq(5, 0)], 1);
  assert.deepEqual(counts(r.state.board), [1, 2]);
});
t('moving the capturing piece itself elsewhere forfeits it where it lands', () => {
  const b = empty(); b[sq(4, 4)] = 1; b[sq(3, 4)] = 3; b[sq(6, 0)] = 1; b[sq(0, 0)] = 3;
  const r = playMove(st(b), sq(4, 4), [sq(4, 5)], 'dama'); assert.ok(r.ok);
  assert.equal(r.huffed, sq(4, 5)); assert.equal(r.state.board[sq(4, 5)], 0);
});
t('stopping a multi-capture early forfeits the piece; finishing it does not', () => {
  const b = empty(); b[sq(6, 1)] = 1; b[sq(5, 1)] = 3; b[sq(3, 1)] = 3; b[sq(0, 7)] = 3; b[sq(7, 7)] = 1;
  const ms = legalMoves(st(b), 'dama');
  const stop = ms.find((m) => m.from === sq(6, 1) && m.caps.length === 1 && m.more);
  assert.ok(stop, 'partial move offered');
  const r1 = playMove(st(b), stop.from, stop.path, 'dama'); assert.equal(r1.huffed, stop.to); assert.equal(r1.state.board[stop.to], 0);
  assert.equal(r1.state.board[sq(5, 1)], 0, 'the first capture still stands');
  const full = ms.find((m) => m.from === sq(6, 1) && m.caps.length === 2);
  const r2 = playMove(st(b), full.from, full.path, 'dama'); assert.equal(r2.huffed, null); assert.equal(r2.state.board[full.to], 1);
});
t('a plain move with nothing to capture is never punished', () => {
  const g = st((() => { const b = empty(); b[sq(6, 0)] = 1; b[sq(1, 0)] = 3; return b; })());
  assert.equal(playMove(g, sq(6, 0), [sq(5, 0)], 'dama').huffed, null);
});
t('the computer never skips a capture', () => {
  const b = empty(); b[sq(4, 4)] = 3; b[sq(5, 4)] = 1; b[sq(0, 0)] = 3; b[sq(7, 7)] = 1;
  const m = chooseCheckersMove(st(b, 1), 'dama', 'hard');
  assert.ok(m.caps.length > 0);
});

// two pieces could have captured; the one that moves is judged where it lands, the opponent chooses
const twoAble = () => { const b = empty(); b[sq(4, 4)] = 1; b[sq(3, 4)] = 3; b[sq(6, 6)] = 1; b[sq(6, 5)] = 3; b[sq(7, 0)] = 1; b[sq(0, 0)] = 3; return b; };
t('two pieces missed a capture: the opponent chooses between exactly those two', () => {
  const r = playMove(st(twoAble()), sq(7, 0), [sq(6, 0)], 'dama'); assert.ok(r.ok);
  assert.ok(r.pendingHuff, 'a choice is pending'); assert.deepEqual(r.pendingHuff.options, [sq(4, 4), sq(6, 6)]);
  assert.equal(r.state.turn, 1, 'the opponent is the one choosing'); assert.equal(r.huffed, null);
  assert.deepEqual(legalMoves(r.state, 'dama'), [], 'nobody may move until the choice is made');
  assert.equal(playMove(r.state, sq(0, 0), [sq(1, 0)], 'dama').ok, false);
});
t('the opponent cannot remove a piece that did not miss a capture', () => {
  const r = playMove(st(twoAble()), sq(7, 0), [sq(6, 0)], 'dama');
  assert.equal(resolveHuff(r.state, sq(6, 0), 'dama').ok, false, 'the piece that just moved had no capture');
  assert.equal(resolveHuff(r.state, sq(3, 4), 'dama').ok, false, 'enemy pieces are never choosable');
});
t('choosing removes that piece and the game carries on with the opponent to move', () => {
  const r = playMove(st(twoAble()), sq(7, 0), [sq(6, 0)], 'dama');
  const c = resolveHuff(r.state, sq(6, 6), 'dama'); assert.ok(c.ok);
  assert.equal(c.state.board[sq(6, 6)], 0); assert.equal(c.state.board[sq(4, 4)], 1); assert.equal(c.state.pendingHuff, null);
  assert.equal(c.state.turn, 1); assert.ok(legalMoves(c.state, 'dama').length > 0);
});
t('a capturer that moves away is judged on its new square', () => {
  const r = playMove(st(twoAble()), sq(4, 4), [sq(4, 5)], 'dama'); assert.ok(r.ok);
  assert.deepEqual(r.pendingHuff.options, [sq(4, 5), sq(6, 6)]);
});
t('the computer, when it picks, always picks a piece that missed its capture', () => {
  const r = playMove(st(twoAble()), sq(7, 0), [sq(6, 0)], 'dama');
  assert.ok(r.pendingHuff.options.includes(chooseHuffPick(r.state, 'dama')));
});
t('the computer prefers to remove a king over a man', () => {
  const b = twoAble(); b[sq(6, 6)] = 2;
  const r = playMove(st(b), sq(7, 0), [sq(6, 0)], 'dama');
  assert.equal(chooseHuffPick(r.state, 'dama'), sq(6, 6));
});
t('online: the opponent picks through the server, only a legal candidate is accepted', () => {
  const b = twoAble();
  let room = { game: 'checkers', ruleset: 'dama', status: 'playing', players: ['u0', 'u1'], names: ['A', 'B'], avatars: ['lion', 'lion'], board: b, turn: 0, noProgress: 0, seen: {}, moveSeq: 0, drawOffer: null, deadline: 0 };
  const m = applyRoomAction(room, null, 'u0', 'move', { from: sq(7, 0), path: [sq(6, 0)] }, 1000);
  assert.ok(!m.error, m.error); room = m.room;
  assert.deepEqual(room.pendingHuff.options, [sq(4, 4), sq(6, 6)]); assert.equal(room.turn, 1);
  assert.ok(applyRoomAction(room, null, 'u1', 'move', { from: sq(0, 0), path: [sq(1, 0)] }, 2000).error, 'cannot move before choosing');
  assert.ok(applyRoomAction(room, null, 'u0', 'huff', { square: sq(4, 4) }, 2000).error, 'the offender cannot choose');
  assert.ok(applyRoomAction(room, null, 'u1', 'huff', { square: sq(6, 0) }, 2000).error, 'not a candidate');
  const h = applyRoomAction(room, null, 'u1', 'huff', { square: sq(4, 4) }, 2000);
  assert.ok(!h.error, h.error); assert.equal(h.room.board[sq(4, 4)], 0); assert.equal(h.room.pendingHuff, null); assert.equal(h.room.turn, 1);
  assert.equal(h.room.lastMove.huffed, sq(4, 4));
});
console.log(n, 'huff tests passed');
