// Rules tab: a hub of every game; a tap opens that game's rules; back returns to the hub.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { STRINGS } from '../src/lib/i18n.js';
import { GAME_LIST, GAMES } from '../src/lib/games.js';
const read = (f) => fs.readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');
let n = 0; const t = (name, fn) => { fn(); n++; console.log('ok', name); };

t('hub strings exist in both languages', () => {
  for (const k of ['rulesHub', 'rulesHubSub', 'rulesSearch', 'rulesCount', 'rulesTypes', 'rulesNone', 'rulesPlay', 'rulesOpenAll', 'rulesCloseAll', 'rulesAllGames', 'rulesMatch']) assert.ok(STRINGS.en[k] && STRINGS.am[k], k);
  assert.notEqual(STRINGS.en.rulesHub, STRINGS.am.rulesHub);
});
t('every released game has rules in both languages (Gebeta has its own rulebook)', () => {
  for (const g of GAME_LIST.filter((x) => !GAMES[x].comingSoon && x !== 'gebeta')) for (const L of ['en', 'am']) assert.ok(Array.isArray(STRINGS[L][`rules_${g}`]) && STRINGS[L][`rules_${g}`].length > 0, `${L}:${g}`);
});
t('the Rules tab opens the hub; a card opens that game; back goes game → hub → home', () => {
  const app = read('src/components/GebetaApp.jsx');
  assert.ok(app.includes("if (to === 'rules') return go('rules', { hub: true })"));
  assert.ok(app.includes("go('rules', { game: g, fromHub: true })"));
  assert.ok(app.includes("view.hub) home(); else go('rules', { hub: true })"));
  const s = read('src/components/Screens.jsx');
  assert.ok(s.includes('className="rh-card') && s.includes('rh-search') && s.includes('<details className="rd-item"'));
});
console.log(`${n} checks passed`);
