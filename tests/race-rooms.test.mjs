import assert from 'node:assert/strict';
import * as R from '../src/lib/online/race.js';

let n = 0; const t = (name, fn) => { fn(); n++; console.log('ok', name); };
const mk = () => R.newRaceRoom({ code: 'ABCDE', uid: 'A', name: 'Abel', veh: 2, world: 3, level: 4, now: 0 });
const err = (fn, status) => assert.throws(fn, (e) => e.status === status);

t('code is 5 safe letters/digits and normalizes', () => {
  assert.match(R.makeCode(), /^[A-HJ-NP-Z2-9]{5}$/);
  assert.equal(R.normalizeCode(' ab-c1d2x '), 'ABC1D');
});
t('new room: host seated, road clamped', () => {
  const r = R.newRaceRoom({ code: 'ZZZZZ', uid: 'A', name: '<b>x', veh: 999, world: -4, level: 1e9, now: 5 });
  assert.deepEqual(r.players, ['A']); assert.equal(r.veh.A, 99); assert.equal(r.world, 0); assert.equal(r.level, R.LEVELS_MAX);
  assert.equal(r.names.A.includes('<'), false);
});
t('join up to 4, then full; rejoin is harmless', () => {
  const r = mk();
  for (const u of ['B', 'C', 'D']) R.joinRaceRoom(r, { uid: u, name: u, veh: 0 });
  assert.equal(r.players.length, 4);
  err(() => R.joinRaceRoom(r, { uid: 'E', name: 'E', veh: 0 }), 409);
  R.joinRaceRoom(r, { uid: 'B', name: 'B2', veh: 1 }); assert.equal(r.players.length, 4); assert.equal(r.names.B, 'B2');
});
t('only the host starts, and needs 2 racers', () => {
  const r = mk(); err(() => R.startRace(r, 'A', 0), 409);
  R.joinRaceRoom(r, { uid: 'B', name: 'B', veh: 0 });
  err(() => R.startRace(r, 'B', 0), 403);
  R.startRace(r, 'A', 1000); assert.equal(r.status, 'race'); assert.equal(r.startAt, 1000 + R.COUNTDOWN_MS);
  err(() => R.joinRaceRoom(r, { uid: 'C', name: 'C', veh: 0 }), 409);
});
t('finishing uses the server clock; impossible times are rejected; order and done', () => {
  const r = mk(); R.joinRaceRoom(r, { uid: 'B', name: 'B', veh: 0 }); R.startRace(r, 'A', 0);
  err(() => R.finishRace(r, 'A', R.COUNTDOWN_MS + 1000), 400);
  R.finishRace(r, 'B', R.COUNTDOWN_MS + 30000);
  assert.equal(r.results[0].uid, 'B'); assert.equal(r.results[0].ms, 30000); assert.equal(r.status, 'race');
  R.finishRace(r, 'B', R.COUNTDOWN_MS + 31000); assert.equal(r.results.length, 1, 'second finish ignored');
  R.finishRace(r, 'A', R.COUNTDOWN_MS + 42000); assert.equal(r.status, 'done'); assert.equal(r.results[1].place, 2);
});
t('last-chance timer closes the race and lists DNF', () => {
  const r = mk(); R.joinRaceRoom(r, { uid: 'B', name: 'B', veh: 0 }); R.startRace(r, 'A', 0);
  R.finishRace(r, 'A', R.COUNTDOWN_MS + 20000);
  R.closeRace(r, R.COUNTDOWN_MS + 20000 + R.LAST_CHANCE_MS - 1); assert.equal(r.status, 'race');
  R.closeRace(r, R.COUNTDOWN_MS + 20000 + R.LAST_CHANCE_MS); assert.equal(r.status, 'done'); assert.deepEqual(r.dnf, ['B']);
});
t('leaving: host passes on, empty room is deleted, a leaver cannot block the finish', () => {
  const r = mk(); R.joinRaceRoom(r, { uid: 'B', name: 'B', veh: 0 }); R.joinRaceRoom(r, { uid: 'C', name: 'C', veh: 0 });
  R.leaveRaceRoom(r, 'A'); assert.equal(r.host, 'B');
  R.startRace(r, 'B', 0); R.finishRace(r, 'B', R.COUNTDOWN_MS + 20000);
  R.leaveRaceRoom(r, 'C'); assert.equal(r.status, 'done');
  assert.equal(R.leaveRaceRoom(R.leaveRaceRoom(mk(), 'Z'), 'A'), null);
});
t('rematch resets to the lobby only when done, only for the host', () => {
  const r = mk(); R.joinRaceRoom(r, { uid: 'B', name: 'B', veh: 0 }); R.startRace(r, 'A', 0);
  err(() => R.rematch(r, 'A'), 409);
  R.finishRace(r, 'A', R.COUNTDOWN_MS + 20000); R.finishRace(r, 'B', R.COUNTDOWN_MS + 25000);
  err(() => R.rematch(r, 'B'), 403);
  R.rematch(r, 'A'); assert.equal(r.status, 'wait'); assert.equal(r.round, 2); assert.deepEqual(r.results, []);
});
t('only the host can change the road, only in the lobby', () => {
  const r = mk(); err(() => R.setTrack(r, 'B', { world: 1, level: 1 }), 403);
  R.setTrack(r, 'A', { world: 7, level: 2 }); assert.equal(r.world, 7);
});
console.log(`${n} race-room tests passed`);
