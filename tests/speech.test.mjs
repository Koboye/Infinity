// Bingo caller: every ball 1-75 has a spoken form in English and Amharic.
import assert from 'node:assert/strict';
import { ballPhrase, amharicNumber, ballLetterIndex } from '../src/lib/speech.js';

let n = 0; const t = (name, fn) => { fn(); n++; console.log('ok', name); };
t('letters follow the B-I-N-G-O ranges', () => {
  assert.deepEqual([1, 15, 16, 30, 31, 45, 46, 60, 61, 75].map(ballLetterIndex), [0, 0, 1, 1, 2, 2, 3, 3, 4, 4]);
});
t('English: letter, number, then the digits one by one', () => {
  assert.equal(ballPhrase(55, 'en'), 'G. 55. 5, 5.');
  assert.equal(ballPhrase(30, 'en'), 'I. 30. 3, 0.');
  assert.equal(ballPhrase(7, 'en').startsWith('B. 7.'), true);
});
t('Amharic numbers compose correctly', () => {
  assert.equal(amharicNumber(1), 'አንድ'); assert.equal(amharicNumber(10), 'አስር'); assert.equal(amharicNumber(11), 'አስራ አንድ');
  assert.equal(amharicNumber(20), 'ሃያ'); assert.equal(amharicNumber(55), 'ሃምሳ አምስት'); assert.equal(amharicNumber(75), 'ሰባ አምስት');
});
t('every ball has a non-empty phrase with no gaps or "undefined"', () => {
  for (let b = 1; b <= 75; b++) for (const l of ['en', 'am']) {
    const p = ballPhrase(b, l); assert.ok(p.length > 3 && !/undefined|NaN/.test(p), `${l} ${b}: ${p}`);
  }
});
console.log(n, 'speech tests passed');
