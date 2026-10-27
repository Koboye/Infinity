// Ludo online: the server rolls, validates every move, mirrors the turn, and a whole game reaches a winner.
import assert from 'node:assert/strict';
import { newRoomDoc, seatSecondPlayer, applyRoomAction } from '../src/lib/online/rooms.js';
import { legalMoves } from '../src/lib/ludo/engine.js';

const prof = (n) => ({ displayName: n, avatar: 'lion' });
for (const ruleset of ['classic', 'quick']) {
  let room = newRoomDoc({ game: 'ludo', uid: 'a', profile: prof('A'), ruleset, isPublic: false, now: 1 });
  room = seatSecondPlayer(room, { uid: 'b', profile: prof('B') }).room;
  assert.equal(room.status, 'playing');
  const uids = room.players;
  let steps = 0;
  while (room.status === 'playing' && steps++ < 6000) {
    const s = JSON.parse(room.lg), seat = s.turn;
    assert.equal(room.turn, seat, 'room.turn mirrors the engine');
    const other = applyRoomAction(room, {}, uids[1 - seat], s.phase === 'roll' ? 'roll' : 'move', { i: 0 }, 5);
    assert.ok(other.error, 'the other player cannot act');
    let r;
    if (s.phase === 'roll') r = applyRoomAction(room, {}, uids[seat], 'roll', {}, 10);
    else {
      const bad = applyRoomAction(room, {}, uids[seat], 'move', { i: 99 }, 10); assert.ok(bad.error, 'illegal token rejected');
      const mv = legalMoves(s); r = applyRoomAction(room, {}, uids[seat], 'move', { i: mv[Math.floor(Math.random() * mv.length)] }, 10);
    }
    assert.ok(!r.error, r.error); room = r.room;
  }
  assert.equal(room.status, 'finished', `${ruleset}: finished`);
  assert.ok(room.winner === 0 || room.winner === 1);
}
console.log('ludo online tests passed');
