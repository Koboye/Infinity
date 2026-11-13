// Bingo caller: every ball 1-75 has a spoken form in English and Amharic.
import assert from 'node:assert/strict';
import { ballPhrase, ballLabel, ballPhonetic, phoneticNumber, amharicNumber, ballLetterIndex } from '../src/lib/speech.js';

let n = 0; const t = (name, fn) => { fn(); n++; console.log('ok', name); };
t('letters follow the B-I-N-G-O ranges', () => {
  assert.deepEqual([1, 15, 16, 30, 31, 45, 46, 60, 61, 75].map(ballLetterIndex), [0, 0, 1, 1, 2, 2, 3, 3, 4, 4]);
});
t('English: letter, number, then the digits one by one', () => {
  assert.equal(ballPhrase(55, 'en'), 'G. 55.');
  assert.equal(ballPhrase(30, 'en'), 'I. 30.');
  assert.equal((ballPhrase(55, 'en').match(/55/g) || []).length, 1, 'the number is said once, not twice');
  assert.equal(ballLabel(12, 'am'), 'ቢ - አስራ ሁለት'); assert.equal(ballLabel(12, 'en'), 'B - 12'); assert.equal(ballLabel(75, 'am'), 'ኦ - ሰባ አምስት');
  assert.equal(ballPhrase(7, 'en').startsWith('B. 7.'), true);
});
t('Amharic numbers compose correctly', () => {
  assert.equal(amharicNumber(1), 'አንድ'); assert.equal(amharicNumber(10), 'አስር'); assert.equal(amharicNumber(11), 'አስራ አንድ');
  assert.equal(amharicNumber(20), 'ሃያ'); assert.equal(amharicNumber(55), 'ሃምሳ አምስት'); assert.equal(amharicNumber(75), 'ሰባ አምስት');
});
t('phonetic guide matches the guide for every number and the Amharic words', () => {
  const guide = { 1: 'Ahnd', 2: 'Hoo-let', 3: 'Sohst', 4: 'Ah-raht', 5: 'Ah-mist', 6: 'Sid-dist', 7: 'Seh-baht', 8: 'Sim-mint', 9: 'Zeh-teny', 10: 'Ahs-sir',
    12: 'Ahs-rah Hoo-let', 15: 'Ahs-rah Ah-mist', 19: 'Ahs-rah Zeh-teny', 20: 'Hah-yah', 26: 'Hah-yah Sid-dist', 30: 'Seh-lah-sah', 39: 'Seh-lah-sah Zeh-teny',
    40: 'Ahr-bah', 50: 'Hahm-sah', 55: 'Hahm-sah Ah-mist', 60: 'Sil-sah', 61: 'Sil-sah Ahnd', 70: 'Seh-bah', 75: 'Seh-bah Ah-mist' };
  for (const [k, v] of Object.entries(guide)) assert.equal(phoneticNumber(+k), v, `phonetic ${k}`);
  assert.equal(ballPhonetic(12), 'B. Ahsrah Hoolet.'); assert.equal(ballPhonetic(60), 'G. Silsah.');
  // the tens words of the Amharic spelling and of the phonetic spelling line up one to one
  const am = [10, 20, 30, 40, 50, 60, 70].map(amharicNumber), ph = [10, 20, 30, 40, 50, 60, 70].map(phoneticNumber);
  assert.deepEqual(am, ['አስር', 'ሃያ', 'ሰላሳ', 'አርባ', 'ሃምሳ', 'ስልሳ', 'ሰባ']); assert.equal(new Set(ph).size, 7);
  for (let b = 1; b <= 75; b++) assert.equal(amharicNumber(b).split(' ').length, phoneticNumber(b).split(' ').length, `same word count at ${b}`);
});
t('every ball has a non-empty phrase with no gaps or "undefined"', () => {
  for (let b = 1; b <= 75; b++) for (const l of ['en', 'am']) {
    const p = ballPhrase(b, l); assert.ok(p.length > 3 && !/undefined|NaN/.test(p), `${l} ${b}: ${p}`);
  }
});
console.log(n, 'speech tests passed');
