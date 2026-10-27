// v68: last-played-first order, lazy-loaded games, and the home wiring.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { touchRecent, orderGames, RECENT_MAX } from '../src/lib/recent.js';
const read = (f) => fs.readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');
let n = 0; const t = (name, fn) => { fn(); n++; console.log('ok', name); };
const IDS = ['gebeta', 'checkers', 'dominoes', 'bingo', 'ludo']; const soon = (id) => id === 'dominoes';

t('no history keeps the catalogue order, coming-soon last', () => assert.deepEqual(orderGames(IDS, [], soon), ['gebeta', 'checkers', 'bingo', 'ludo', 'dominoes']));
t('the last played game comes first, then the earlier ones, then the unplayed in catalogue order', () => assert.deepEqual(orderGames(IDS, ['ludo', 'checkers'], soon), ['ludo', 'checkers', 'gebeta', 'bingo', 'dominoes']));
t('a coming-soon game never jumps ahead, even if it is in the history', () => assert.equal(orderGames(IDS, ['dominoes', 'bingo'], soon)[0], 'bingo'));
t('touchRecent moves to the front, never duplicates, stays short, survives garbage', () => {
  assert.deepEqual(touchRecent(['a', 'b', 'c'], 'b'), ['b', 'a', 'c']);
  assert.deepEqual(touchRecent(null, 'x'), ['x']); assert.deepEqual(touchRecent('junk', 'x'), ['x']); assert.deepEqual(touchRecent([1, null, 'a'], 'b'), ['b', 'a']);
  assert.equal(touchRecent(Array.from({ length: 20 }, (_, i) => `g${i}`), 'new').length, RECENT_MAX);
  assert.deepEqual(touchRecent(['a'], ''), ['a']);
});
t('garbage history never breaks the order', () => { for (const bad of [null, 'x', 5, {}]) assert.equal(orderGames(IDS, bad, soon).length, 5); });
t('every game screen is loaded on demand, and its download starts while the pre-game ad shows', () => {
  const app = read('src/components/GebetaApp.jsx');
  for (const c of ['LocalGame', 'CheckersLocal', 'DominoesLocal', 'BingoGame', 'LudoGame', 'OnlineRoom']) { assert.match(app, new RegExp(`const ${c} = lazy\\(`)); assert.doesNotMatch(app, new RegExp(`^import ${c} from`, 'm')); }
  assert.match(app, /preload\(extra\.game\); runAd\('pre_game'/);
});
t('home grid uses the order, marks the last played game, and playing a game records it', () => {
  const s = read('src/components/Screens.jsx'); assert.match(s, /orderGames\(GAME_LIST, recent/); assert.match(s, /gg-last/);
  assert.match(read('src/components/GebetaApp.jsx'), /touchRecent\(/);
  const i = read('src/lib/i18n.js'); assert.equal((i.match(/lastPlayed:/g) || []).length, 2);
});
console.log(`home-order tests passed (${n})`);
