import assert from 'node:assert/strict';
const { TEXT, makeT, GOALS } = await import('../src/lib/infText.js');
const { goalOf } = await import('../src/lib/studyStreak.js');
// every English key has an Amharic string and the same {placeholders}
const holes = (o) => (String(o).match(/\{\w+\}/g) || []).sort().join();
for (const k of Object.keys(TEXT.en)) {
  assert.ok(TEXT.am[k], 'missing Amharic for ' + k);
  assert.equal(holes(TEXT.am[k]), holes(TEXT.en[k]), 'placeholders differ for ' + k);
}
assert.equal(makeT('am')('levelN', { n: 3 }), 'ደረጃ 3');
assert.equal(makeT('en')('nope'), 'nope');
assert.equal(makeT('fr')('nav_home'), 'Home', 'unknown language falls back to English');
assert.deepEqual(GOALS, [5, 10, 20, 30]);
assert.equal(goalOf({ goal: 20 }), 20); assert.equal(goalOf({ goal: 7 }), 10); assert.equal(goalOf({}), 10);
console.log('ok inf-text');
