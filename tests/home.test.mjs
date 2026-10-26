import assert from 'node:assert/strict';
import fs from 'node:fs';
import { STRINGS } from '../src/lib/i18n.js';
import { GAME_LIST, GAMES } from '../src/lib/games.js';
// the Home grid draws its numbers from real strings in both languages
for (const lang of ['en', 'am']) {
  const t = STRINGS[lang];
  assert.equal(typeof t.homeRecord, 'function', `${lang}: homeRecord`);
  assert.ok(t.homeRecord(3, 2, 1).includes('3') && t.homeRecord(3, 2, 1).includes('2') && t.homeRecord(3, 2, 1).includes('1'), `${lang}: record shows w/l/d`);
  assert.ok(t.homeBoth && t.homeFresh, `${lang}: labels`);
  for (const id of GAME_LIST) assert.ok(t[`${id}Name`] && (GAMES[id].comingSoon || t[`${id}Tag`]), `${lang}: ${id} card text`);
}
// no self-playing demo boards on Home: everything on screen is real
const src = fs.readFileSync(new URL('../src/components/Screens.jsx', import.meta.url), 'utf8');
for (const fake of ['DemoBoard', 'CheckersDemo', 'BingoDemo', 'DominoDemo']) assert.ok(!src.includes(fake), `${fake} removed`);
console.log('home grid tests passed');
