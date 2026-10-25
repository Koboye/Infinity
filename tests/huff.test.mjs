// "Huff" rule (Flying kings and Classic): capturing is optional with ANY piece; a missed / abandoned capture only gives the
// opponent the right to TOUCH that piece and remove it (then he plays his turn). If he plays without touching it, nothing happens.
import assert from 'node:assert/strict';
import { playMove, legalMoves, counts, resolveHuff } from '../src/lib/checkers/engine.js';
import { chooseCheckersMove, chooseHuffPick } from '../src/lib/checkers/ai.js';
import { applyRoomAction } from '../src/lib/online/rooms.js';

let n = 0; const t = (name, fn) => { fn(); n++; console.log('ok', name); };
const RS = 'flying';
const sq = (r, c) => r * 8 + c;               // only squares with (r + c) odd are used
const empty = () => new Array(64).fill(0);
const st = (board, turn = 0) => ({ board, turn, over: false, winner: null, reason: null, noProgress: 0, seen: {} });
const has = (ms, from, to) => ms.some((m) => m.from === from && m.to === to);
// seat-0 man on (4,3) could capture the seat-1 man on (3,2); seat-0 man on (6,1) is free to move
const base = () => { const b = empty(); b[sq(4, 3)] = 1; b[sq(3, 2)] = 3; b[sq(6, 1)] = 1; b[sq(0, 1)] = 3; return b; };

t('men capture backwards in Flying kings, but not in Classic', () => {
  const b = empty(); b[sq(4, 3)] = 1; b[sq(5, 4)] = 3; b[sq(0, 1)] = 3; // enemy BEHIND the man
  assert.ok(has(legalMoves(st(b), 'flying'), sq(4, 3), sq(6, 5)), 'flying: backward capture');
  assert.ok(!legalMoves(st(b), 'american').some((m) => m.caps.length), 'classic: no backward capture');
});
t('seat-1 men capture forward (down) and, in Flying kings, backward too', () => {
  const b = empty(); b[sq(3, 2)] = 3; b[sq(4, 3)] = 1; b[sq(7, 0)] = 1;
  assert.ok(has(legalMoves(st(b, 1), RS), sq(3, 2), sq(5, 4)));
});
t('a flying king captures from a distance in all four diagonals and may land on any empty square behind', () => {
  for (const [dr, dc] of [[-1, -1], [-1, 1], [1, -1], [1, 1]]) {
    const b = empty(); b[sq(3, 4)] = 2; b[sq(3 + 2 * dr, 4 + 2 * dc)] = 3; b[sq(7, 0)] = 3;
    const ms = legalMoves(st(b), RS).filter((m) => m.caps.length && m.from === sq(3, 4));
    assert.ok(ms.length >= 1 && ms.every((m) => m.caps[0] === sq(3 + 2 * dr, 4 + 2 * dc)), `dir ${dr},${dc}`);
  }
});
t('capture is NOT compulsory: ordinary moves stay legal', () => {
  const ms = legalMoves(st(base()), RS);
  assert.ok(ms.some((m) => !m.caps.length) && ms.some((m) => m.caps.length));
});
t('skipping a capture does NOT remove anything by itself: the piece that missed is only put on offer', () => {
  const r = playMove(st(base()), sq(6, 1), [sq(5, 0)], RS); assert.ok(r.ok);
  assert.equal(r.huffed, null); assert.equal(r.state.board[sq(4, 3)], 1, 'still on the board'); assert.equal(r.state.board[sq(5, 0)], 1);
  assert.deepEqual(r.state.pendingHuff.options, [sq(4, 3)]); assert.equal(r.state.pendingHuff.by, 0); assert.equal(r.state.turn, 1);
  assert.deepEqual(counts(r.state.board), [2, 2]);
});
t('the opponent touches the piece: it is removed and it is STILL his turn to play', () => {
  const r = playMove(st(base()), sq(6, 1), [sq(5, 0)], RS);
  const c = resolveHuff(r.state, sq(4, 3), RS); assert.ok(c.ok);
  assert.equal(c.state.board[sq(4, 3)], 0); assert.equal(c.state.turn, 1, 'a claim does not use up the turn'); assert.equal(c.state.pendingHuff, null);
  assert.deepEqual(counts(c.state.board), [1, 2]);
  assert.ok(legalMoves(c.state, RS).length > 0);
  assert.ok(playMove(c.state, sq(0, 1), [sq(1, 2)], RS).ok, 'then he moves');
});
t('if the opponent forgets to touch it and just plays, the forfeit is gone for good', () => {
  const b = base(); b[sq(5, 4)] = 1; // blocks the landing square, so he has nothing to capture back
  const r = playMove(st(b), sq(6, 1), [sq(5, 0)], RS);
  const m = playMove(r.state, sq(0, 1), [sq(1, 2)], RS); assert.ok(m.ok, 'moving without claiming is allowed');
  assert.equal(m.state.pendingHuff, null); assert.equal(m.state.board[sq(4, 3)], 1);
  assert.equal(resolveHuff(m.state, sq(4, 3), RS).ok, false, 'too late');
});
t('nobody is obliged to move a particular piece, not even to capture (any piece may move)', () => {
  const ms = legalMoves(st(base()), RS);
  assert.ok(ms.some((m) => m.from === sq(6, 1) && !m.caps.length), 'the other piece may move');
  assert.ok(ms.some((m) => m.from === sq(4, 3) && !m.caps.length), 'the capturer itself may step away');
});
t('moving the capturing piece itself elsewhere puts it on offer where it lands', () => {
  const r = playMove(st(base()), sq(4, 3), [sq(3, 4)], RS); assert.ok(r.ok);
  assert.deepEqual(r.state.pendingHuff.options, [sq(3, 4)]); assert.equal(r.state.board[sq(3, 4)], 1);
  assert.equal(resolveHuff(r.state, sq(4, 3), RS).ok, false, 'the old square is empty / not on offer');
});
t('stopping a multi-capture early puts the piece on offer; finishing it does not', () => {
  const b = empty(); b[sq(6, 1)] = 1; b[sq(5, 2)] = 3; b[sq(3, 4)] = 3; b[sq(0, 7)] = 3; b[sq(7, 0)] = 1;
  const ms = legalMoves(st(b), RS);
  const stop = ms.find((m) => m.from === sq(6, 1) && m.caps.length === 1 && m.more);
  assert.ok(stop, 'partial move offered');
  const r1 = playMove(st(b), stop.from, stop.path, RS); assert.deepEqual(r1.state.pendingHuff.options, [stop.to]); assert.equal(r1.state.board[stop.to], 1);
  assert.equal(r1.state.board[sq(5, 2)], 0, 'the first capture still stands');
  const full = ms.find((m) => m.from === sq(6, 1) && m.caps.length === 2);
  const r2 = playMove(st(b), full.from, full.path, RS); assert.equal(r2.state.pendingHuff, null); assert.equal(r2.state.board[full.to], 1);
});
t('a plain move with nothing to capture offers nothing', () => {
  const b = empty(); b[sq(6, 1)] = 1; b[sq(1, 2)] = 3;
  assert.equal(playMove(st(b), sq(6, 1), [sq(5, 0)], RS).state.pendingHuff, null);
});
t('the computer never skips a capture that wins a piece for free', () => {
  const b = empty(); b[sq(4, 3)] = 3; b[sq(5, 4)] = 1; b[sq(0, 1)] = 3; b[sq(7, 0)] = 1;
  const m = chooseCheckersMove(st(b, 1), RS, 'hard');
  assert.ok(m.caps.length > 0);
});

// two pieces could have captured; the one that moves is judged where it lands, the opponent chooses
const twoAble = () => { const b = empty(); b[sq(4, 3)] = 1; b[sq(3, 2)] = 3; b[sq(6, 5)] = 1; b[sq(5, 6)] = 3; b[sq(7, 0)] = 1; b[sq(0, 1)] = 3; return b; };
t('two pieces missed a capture: the opponent MAY touch either of exactly those two', () => {
  const r = playMove(st(twoAble()), sq(7, 0), [sq(6, 1)], RS); assert.ok(r.ok);
  assert.deepEqual(r.state.pendingHuff.options, [sq(4, 3), sq(6, 5)]); assert.equal(r.state.turn, 1);
  assert.ok(legalMoves(r.state, RS).length > 0, 'he can simply play instead');
  assert.equal(playMove(r.state, sq(0, 1), [sq(1, 2)], RS).ok, true);
});
t('the opponent cannot remove a piece that did not miss a capture, nor one of his own', () => {
  const r = playMove(st(twoAble()), sq(7, 0), [sq(6, 1)], RS);
  assert.equal(resolveHuff(r.state, sq(6, 1), RS).ok, false, 'the piece that just moved had no capture');
  assert.equal(resolveHuff(r.state, sq(3, 2), RS).ok, false, 'his own piece');
});
t('a capturer that moves away is judged on its new square', () => {
  const r = playMove(st(twoAble()), sq(4, 3), [sq(3, 4)], RS); assert.ok(r.ok);
  assert.deepEqual(r.state.pendingHuff.options, [sq(3, 4), sq(6, 5)]);
});
t('claiming the opponent\'s last piece wins the game', () => {
  const b = empty(); b[sq(4, 3)] = 1; b[sq(3, 2)] = 3; b[sq(0, 1)] = 3;
  const r = playMove(st(b), sq(4, 3), [sq(3, 4)], RS); assert.ok(r.ok && !r.state.over);
  const c = resolveHuff(r.state, sq(3, 4), RS); assert.ok(c.ok);
  assert.equal(counts(c.state.board)[0], 0); assert.equal(c.state.over, true); assert.equal(c.state.winner, 1);
});
t('the computer, when it claims, always picks a piece that missed its capture', () => {
  const r = playMove(st(twoAble()), sq(7, 0), [sq(6, 1)], RS);
  assert.ok(r.state.pendingHuff.options.includes(chooseHuffPick(r.state, RS)));
});
t('the computer prefers to remove a king over a man', () => {
  const b = twoAble(); b[sq(6, 5)] = 2;
  const r = playMove(st(b), sq(7, 0), [sq(6, 1)], RS);
  assert.equal(chooseHuffPick(r.state, RS), sq(6, 5));
});
t('online: moving does not need a claim; only the player to move can touch an offered piece; a late claim is refused', () => {
  const b = twoAble();
  let room = { game: 'checkers', ruleset: RS, status: 'playing', players: ['u0', 'u1'], names: ['A', 'B'], avatars: ['lion', 'lion'], board: b, turn: 0, noProgress: 0, seen: {}, moveSeq: 0, drawOffer: null, deadline: 0 };
  const m = applyRoomAction(room, null, 'u0', 'move', { from: sq(7, 0), path: [sq(6, 1)] }, 1000);
  assert.ok(!m.error, m.error); room = m.room;
  assert.deepEqual(room.pendingHuff.options, [sq(4, 3), sq(6, 5)]); assert.equal(room.turn, 1); assert.equal(room.board[sq(4, 3)], 1, 'nothing removed yet');
  assert.ok(applyRoomAction(room, null, 'u0', 'huff', { square: sq(4, 3) }, 2000).error, 'the offender cannot claim');
  assert.ok(applyRoomAction(room, null, 'u1', 'huff', { square: sq(6, 1) }, 2000).error, 'not a piece on offer');
  const h = applyRoomAction(room, null, 'u1', 'huff', { square: sq(4, 3) }, 2000);
  assert.ok(!h.error, h.error); assert.equal(h.room.board[sq(4, 3)], 0); assert.equal(h.room.pendingHuff, null); assert.equal(h.room.turn, 1, 'still his turn');
  assert.equal(h.room.lastMove.huffed, sq(4, 3));
  const mv = applyRoomAction(h.room, null, 'u1', 'move', { from: sq(0, 1), path: [sq(1, 2)] }, 3000); assert.ok(!mv.error, mv.error);
  // forgetting: u1 just plays, the claim is gone
  const lapse = applyRoomAction(room, null, 'u1', 'move', { from: sq(0, 1), path: [sq(1, 2)] }, 2000);
  assert.ok(!lapse.error, lapse.error); assert.ok(!lapse.room.pendingHuff || lapse.room.pendingHuff.by === 1, 'the first offer lapsed'); assert.equal(lapse.room.board[sq(4, 3)], 1);
  assert.ok(applyRoomAction(lapse.room, null, 'u0', 'huff', { square: sq(4, 3) }, 3000).error, 'too late');
});

t('majority: taking a SHORTER capture lets the opponent huff the piece that could have taken more', () => {
  const b = empty();
  b[sq(7, 0)] = 1; b[sq(6, 1)] = 3;                       // piece A: single capture (7,0)x(6,1)->(5,2)
  b[sq(7, 4)] = 1; b[sq(6, 5)] = 3; b[sq(4, 5)] = 3;      // piece B: double capture (7,4)x(6,5)->(5,6)x(4,5)->(3,4)
  b[sq(0, 7)] = 3;
  const g = st(b);
  const single = legalMoves(g, RS).find((m) => m.from === sq(7, 0) && m.caps.length === 1);
  assert.ok(single, 'single capture exists');
  const r = playMove(g, single.from, single.path, RS);
  assert.ok(r.ok);
  assert.deepEqual(r.pendingHuff.options, [sq(7, 4)], 'the piece that could have made the longer chain is on offer');
});
t('majority: the full longest chain is clean (nothing on offer)', () => {
  const b = empty();
  b[sq(7, 4)] = 1; b[sq(6, 5)] = 3; b[sq(4, 5)] = 3; b[sq(0, 7)] = 3;
  const g = st(b);
  const best = legalMoves(g, RS).filter((m) => m.caps.length === 2 && !m.more);
  assert.ok(best.length);
  const r = playMove(g, best[0].from, best[0].path, RS);
  assert.ok(r.ok && !r.pendingHuff);
});
console.log(n, 'huff tests passed');
