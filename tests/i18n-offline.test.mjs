// v68.1: Amharic and English stay in step, lazy games still work offline, install shortcuts point at playable games.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { STRINGS } from '../src/lib/i18n.js';
import { GAMES, isPlayable } from '../src/lib/games.js';
const read = (f) => fs.readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');
let n = 0; const t = (name, fn) => { fn(); n++; console.log('ok', name); };

t('every English text has an Amharic twin (and the other way round), of the same kind', () => {
  const en = Object.keys(STRINGS.en), am = Object.keys(STRINGS.am);
  assert.deepEqual(en.filter((k) => !am.includes(k)), [], 'missing in Amharic');
  assert.deepEqual(am.filter((k) => !en.includes(k)), [], 'missing in English');
  assert.deepEqual(en.filter((k) => typeof STRINGS.en[k] !== typeof STRINGS.am[k]), [], 'string vs function');
});
t('Amharic strings are not left in English (apart from the language name itself)', () => {
  const same = Object.keys(STRINGS.en).filter((k) => typeof STRINGS.en[k] === 'string' && STRINGS.en[k] === STRINGS.am[k] && /[A-Za-z]{4}/.test(STRINGS.en[k]) && k !== 'langEn');
  assert.deepEqual(same, []);
});
t('the service worker cache was bumped for the split game files', () => assert.match(read('public/sw.js'), /const V = 'gebeta-v(2[6-9]|[3-9]\d)'/));
t('after the opening ad the app quietly fetches every game (not on Data Saver, not offline) so offline play keeps working', () => {
  const a = read('src/components/GebetaApp.jsx');
  assert.match(a, /navigator\.connection\?\.saveData \|\| !navigator\.onLine/); assert.match(a, /Object\.keys\(PRELOAD\)\.forEach/);
  assert.match(a, /\[splashDone\]\);/);
  assert.ok(a.indexOf('const [splashDone') < a.indexOf('}, [splashDone]);'), 'effect must come after the state it reads');
});
t('install shortcuts exist for playable games only, each with a name and a working link', () => {
  const m = JSON.parse(read('public/manifest.json')); assert.ok(m.shortcuts.length >= 3);
  for (const s of m.shortcuts) { const g = new URL(s.url, 'https://x').searchParams.get('game'); assert.ok(GAMES[g] && isPlayable(g), s.url); assert.ok(s.name && s.icons?.length); }
});
console.log(`i18n-offline tests passed (${n})`);
