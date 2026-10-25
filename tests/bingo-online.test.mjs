import assert from 'node:assert/strict';
import { newRoomDoc, seatSecondPlayer, applyRoomAction, settle } from '../src/lib/online/rooms.js';
import { patterns, FREE } from '../src/lib/bingo/engine.js';

const prof = (n) => ({ displayName: n, avatar: 'lion' });
let n = 0; const t = (name, fn) => { fn(); n++; console.log('ok', name); };

const base = newRoomDoc({ game: 'bingo', uid: 'A', profile: prof('A'), ruleset: 'line', isPublic: false, now: 0 });
const { room: r0, priv: p0 } = seatSecondPlayer(base, { uid: 'B', profile: prof('B') }, () => 0.9, 1000);
const [s0, s1] = r0.players;
const step = (room, priv, uid, action, body, now) => {
  const r = applyRoomAction(room, priv, uid, action, body, now);
  if (r.error || r.noop) return r;
  return { ...r, priv: { ...priv, ...(r.priv || {}) } };
};

t('a bingo room seats two players and deals a private card each plus a server-only deck', () => {
  assert.equal(r0.status, 'playing'); assert.deepEqual(r0.called, []);
  assert.equal(p0[s0].card.length, 25); assert.equal(p0[s1].card.length, 25); assert.equal(p0._boneyard.deck.length, 75);
  assert.equal(JSON.stringify(r0).includes('"deck"'), false, 'public room must not leak the deck');
  assert.equal(JSON.stringify(r0).includes(JSON.stringify(p0[s0].card)), false, 'public room must not leak cards');
});
t('the ball is only called once the clock says so, and duplicates are ignored', () => {
  assert.ok(step(r0, p0, s0, 'call', { n: 0 }, 2000).noop, 'too early');
  const a = step(r0, p0, s0, 'call', { n: 0 }, r0.nextCallAt);
  assert.equal(a.room.called.length, 1); assert.equal(a.room.called[0], p0._boneyard.deck[0]);
  assert.ok(step(a.room, a.priv, s1, 'call', { n: 0 }, r0.nextCallAt).noop, 'a second phone asking for the same ball does nothing');
});
t('marking needs a called number; claiming needs a real pattern', () => {
  let room = r0, priv = p0, now = r0.nextCallAt;
  const cardOf = (u) => priv[u].card;
  assert.ok(step(room, priv, s0, 'mark', { idx: 0 }, now).error, 'not called yet');
  // call every ball on s0's first line, marking as we go
  const line = patterns('line')[0].filter((i) => i !== FREE);
  const wanted = line.map((i) => cardOf(s0)[i]);
  // force the deck so the wanted numbers come first
  priv = { ...priv, _boneyard: { ...priv._boneyard, deck: [...wanted, ...priv._boneyard.deck.filter((x) => !wanted.includes(x))] } };
  let falseClaim = step(room, priv, s0, 'claim', {}, now);
  assert.equal(falseClaim.room.lock[s0 === r0.players[0] ? 0 : 1] > 0, true, 'false BINGO locks the caller');
  assert.ok(step(falseClaim.room, falseClaim.priv, s0, 'claim', {}, now).error, 'still locked');
  for (const idx of line) {
    const c = step(room, priv, s0, 'call', { n: room.called.length }, now); room = c.room; priv = c.priv; now += 6000;
    const m = step(room, priv, s0, 'mark', { idx }, now); assert.ok(!m.error, m.error); room = m.room; priv = m.priv;
  }
  assert.ok(step(room, priv, s0, 'mark', { idx: FREE }, now).error, 'the free square cannot be marked');
  assert.ok(step(room, priv, s1, 'claim', {}, now).room.lock, 'the opponent cannot win with your marks');
  const win = step(room, priv, s0, 'claim', {}, now);
  assert.equal(win.room.status, 'finished'); assert.equal(win.room.winner, 0 + r0.players.indexOf(s0)); assert.ok(win.room.winLine.length);
  const st = settle(win.room, [1000, 1000]); assert.equal(st.find((x) => x.uid === s0).result, 'win');
});
t('a stranger cannot act', () => { assert.equal(applyRoomAction(r0, p0, 'Z', 'claim', {}, 9999).status, 403); });
console.log(`${n} bingo-online tests passed`);
