// Regression: signing in merges cloud + local progress; it crashed with "GAMES3 is not defined" in v20.
import assert from 'node:assert/strict';
globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
const { mergeProgress } = await import('../src/lib/progress.js');
const a = { streak: 2, best: 4, last: '2026-10-24', rec: { gebeta: { w: 3, l: 1, d: 0 } }, hist: [], ach: {}, flags: {}, daily: null, dailyCount: 1 };
const b = { streak: 1, best: 6, last: '2026-10-25', rec: { checkers: { w: 2, l: 0, d: 1 }, dominoes: { w: 1 } }, hist: [], ach: {}, flags: {}, daily: null, dailyCount: 2 };
const m = mergeProgress(a, b);
assert.equal(m.rec.gebeta.w, 3); assert.equal(m.rec.checkers.w, 2); assert.equal(m.rec.dominoes.w, 1);
assert.equal(m.best, 6);
console.log('progress merge test passed');
