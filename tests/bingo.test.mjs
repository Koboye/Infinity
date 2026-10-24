import assert from 'node:assert/strict';
import { makeCard, newGame, callNext, mark, canMark, claim, completed, toGo, patterns, FREE, LETTERS, letterOf, LOCKOUT_CALLS, shuffle } from '../src/lib/bingo/engine.js';

let n = 0; const t = (name, fn) => { fn(); n++; console.log('ok', name); };
const seeded = (seed) => () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 2 ** 32; };

t('cards obey the B-I-N-G-O ranges, are unique per column and have a FREE centre', () => {
  for (let k = 0; k < 300; k++) {
    const c = makeCard(seeded(k + 1));
    assert.equal(c.length, 25); assert.equal(c[FREE], 0);
    for (let col = 0; col < 5; col++) {
      const vals = [0, 1, 2, 3, 4].map((r) => c[r * 5 + col]).filter((v, i) => !(col === 2 && i === 2));
      assert.equal(new Set(vals).size, vals.length);
      vals.forEach((v) => { assert.ok(v >= col * 15 + 1 && v <= col * 15 + 15); assert.equal(letterOf(v), LETTERS[col]); });
    }
  }
});
t('12 lines, 1 corners pattern, 1 full house', () => {
  assert.equal(patterns('line').length, 12); assert.equal(patterns('corners')[0].length, 4); assert.equal(patterns('full')[0].length, 25);
});
t('you can only mark a number after it was called', () => {
  let s = newGame('line', seeded(7));
  const idx = s.cards[0].findIndex((v, i) => i !== FREE);
  assert.equal(canMark(s, 0, idx), false); assert.equal(mark(s, 0, idx).marks[0][idx], false);
  s.called.push(s.cards[0][idx]); // simulate the call
  assert.equal(canMark(s, 0, idx), true); assert.equal(mark(s, 0, idx).marks[0][idx], true);
});
t('a full game of 75 calls ends, never repeats a ball', () => {
  let s = newGame('line', seeded(3));
  for (let i = 0; i < 75; i++) s = callNext(s);
  assert.equal(new Set(s.called).size, 75); s = callNext(s); assert.equal(s.over, true); assert.equal(s.winner, 'draw');
});
t('claiming too early is a false claim with a lock-out that ticks down per call', () => {
  let s = newGame('line', seeded(5));
  const r = claim(s, 0); assert.equal(r.ok, false); assert.equal(r.error, 'false'); assert.equal(r.state.strikes[0], 1);
  s = r.state; assert.equal(claim(s, 0).error, 'locked');
  for (let i = 0; i < LOCKOUT_CALLS; i++) s = callNext(s);
  assert.equal(s.lock[0], 0);
});
t('a completed line wins; the computer needs the same', () => {
  let s = newGame('line', seeded(11));
  const row = [0, 1, 2, 3, 4];
  for (const i of row) { if (i !== FREE) { s.called.push(s.cards[0][i]); s = mark(s, 0, i); } }
  assert.ok(completed(s, 0)); assert.equal(toGo(s, 0), 0);
  const r = claim(s, 0); assert.equal(r.ok, true); assert.equal(r.state.winner, 0);
});
t('diagonals through the FREE centre need only four numbers; toGo counts down', () => {
  let s = newGame('line', seeded(13));
  assert.equal(toGo(s, 0), 4);
  const i = 0; s.called.push(s.cards[0][i]); s = mark(s, 0, i); assert.equal(toGo(s, 0), 3);
});
t('four corners and full house', () => {
  let s = newGame('corners', seeded(17));
  for (const i of [0, 4, 20, 24]) { s.called.push(s.cards[1][i]); s = mark(s, 1, i); }
  assert.equal(claim(s, 1).ok, true);
  let f = newGame('full', seeded(19));
  for (let i = 0; i < 25; i++) if (i !== FREE) { f.called.push(f.cards[0][i]); f = mark(f, 0, i); }
  assert.equal(claim(f, 0).ok, true);
});
t('shuffle is a permutation', () => assert.deepEqual(shuffle([1, 2, 3, 4, 5], seeded(1)).sort(), [1, 2, 3, 4, 5]));
console.log(n, 'bingo tests passed');
