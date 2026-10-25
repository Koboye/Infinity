// Win/lose flavour: the Gebeta taunt must use the exact words, in the loser's gender.
import assert from 'node:assert/strict';
import { gebetaTaunt, genderOfHero, resolveGender, winLine, loseLine, WIN_LINES, LOSE_LINES } from '../src/lib/celebrate.js';
import { thinkWaitMs, COMPUTER_WAIT_MS, TURN_SECONDS, ONLINE_TURN_SECONDS } from '../src/lib/games.js';

let n = 0; const t = (name, fn) => { fn(); n++; console.log('ok', name); };

t('taunt for a man', () => assert.equal(gebetaTaunt('m').join(' '), 'እፍ እፍ ገምተሀል እወቀኝ አገማሁህ'));
t('taunt for a woman', () => assert.equal(gebetaTaunt('f').join(' '), 'እፍ እፍ ገምተሻል እወቂኝ አገማሁሽ'));
t('unknown gender falls back to the masculine form', () => assert.equal(gebetaTaunt().join(' '), 'እፍ እፍ ገምተሀል እወቀኝ አገማሁህ'));
t('gender: hero default, explicit setting wins', () => {
  assert.equal(genderOfHero('queen'), 'f'); assert.equal(genderOfHero('lion'), 'm');
  assert.equal(resolveGender('auto', 'queen'), 'f'); assert.equal(resolveGender(undefined, 'lion'), 'm');
  assert.equal(resolveGender('f', 'lion'), 'f'); assert.equal(resolveGender('m', 'queen'), 'm');
});
t('every language has win and lose lines', () => {
  for (const l of ['en', 'am']) { assert.ok(WIN_LINES[l].length >= 3 && LOSE_LINES[l].length >= 3); assert.ok(winLine(l) && loseLine(l)); }
});
t('computer pause is 2.5–3.5 s and timers share one setting', () => {
  for (let i = 0; i < 200; i++) { const ms = thinkWaitMs(); assert.ok(ms >= COMPUTER_WAIT_MS[0] && ms <= COMPUTER_WAIT_MS[1]); }
  assert.equal(TURN_SECONDS, 30); assert.equal(ONLINE_TURN_SECONDS, 60);
});
console.log(`${n} celebrate tests passed`);
