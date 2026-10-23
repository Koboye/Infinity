import assert from 'node:assert/strict';
import { newRoomDoc, seatSecondPlayer, applyRoomMove, applyRoomAction, applyForfeit, settle, eloUpdate, normalizeCode, makeCode, statFields } from '../src/lib/online/rooms.js';

const prof = (n) => ({ displayName: n, avatar: 'lion' });
let room = newRoomDoc({ uid: 'A', profile: prof('Abebe'), ruleset: 'gebeta', isPublic: true, now: 0 });
assert.equal(room.status, 'waiting'); assert.equal(room.game, 'gebeta');
room = seatSecondPlayer(room, { uid: 'B', profile: prof('Almaz') }, () => 0.9, 1000).room;
assert.deepEqual(room.players, ['A', 'B']); assert.equal(room.status, 'playing');
room = seatSecondPlayer(newRoomDoc({ uid: 'A', profile: prof('Abebe'), ruleset: 'gebeta', now: 0 }), { uid: 'B', profile: prof('Almaz') }, () => 0.1).room;
assert.deepEqual(room.players, ['B', 'A']); assert.deepEqual(room.names, ['Almaz', 'Abebe']);
// Seat 0 is B now
assert.ok(applyRoomMove(room, {}, 'A', { pit: 0 }).error, 'wrong turn rejected');
assert.ok(applyRoomMove(room, {}, 'C', { pit: 0 }).error, 'stranger rejected');
assert.ok(applyRoomMove(room, {}, 'B', { pit: 9 }).error, 'opponent pit rejected');
const r = applyRoomMove(room, {}, 'B', { pit: 0 }, 5000);
assert.ok(r.room && r.room.moveSeq === 1 && r.room.deadline === 65000 && r.room.lastMove.steps.length > 0);
const f = applyForfeit(room, 0, 'resigned'); assert.equal(f.winner, 1); assert.equal(f.status, 'finished');
const s = settle(f, [1000, 1000]); assert.equal(s[0].result, 'loss'); assert.equal(s[1].rating, 1012); assert.equal(s[0].rating, 988);
assert.deepEqual(eloUpdate(1000, 1000, 0.5), [1000, 1000]);
assert.equal(normalizeCode(' ab-c12xyz '), 'ABC12'); assert.equal(makeCode().length, 5);

// every game can create + seat
for (const game of ['gebeta', 'checkers', 'dominoes']) {
  let rm = newRoomDoc({ game, uid: 'A', profile: prof('A'), ruleset: 'nope', isPublic: false, now: 0, options: { target: 100 } });
  assert.equal(rm.game, game); assert.equal(rm.status, 'waiting');
  const seated = seatSecondPlayer(rm, { uid: 'B', profile: prof('B') }, () => 0.9, 0);
  assert.equal(seated.room.status, 'playing');
  if (game === 'dominoes') {
    assert.equal(rm.target, 100); assert.deepEqual(seated.room.handCounts, [7, 7]); assert.equal(seated.room.boneyardCount, 14);
    assert.ok(seated.priv.A.hand.length === 7 && seated.priv.B.hand.length === 7 && seated.priv._boneyard.tiles.length === 14);
    assert.equal(JSON.stringify(seated.room).includes(seated.priv.A.hand.join('')), false, 'public doc must not leak hands');
  } else assert.equal(seated.priv, undefined);
}
assert.deepEqual(statFields('gebeta'), { rating: 'rating', wins: 'wins', losses: 'losses', draws: 'draws', games: 'games' });
assert.equal(statFields('checkers').rating, 'rating_checkers');
assert.equal(applyRoomAction(room, {}, 'B', 'bogus').error, 'Unknown action');
console.log('rooms tests passed');
