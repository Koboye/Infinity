import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
let n = 0; const t = (name, fn) => { fn(); n++; console.log('ok', name); };
const cfg = JSON.parse(readFileSync('android-bluetooth/capacitor.config.json', 'utf8'));
const html = readFileSync('android-bluetooth/android-web/index.html', 'utf8');
t('app loads its own bundled files (no remote server.url) and may navigate to the live site', () => {
  assert.equal(cfg.webDir, 'android-web'); assert.equal(cfg.server.url, undefined);
  assert.ok(cfg.server.allowNavigation.includes('infinity-now.vercel.app')); assert.equal(cfg.appId, 'com.koboye.infinity');
});
t('launcher: online → live site, offline → menu linking the bundled car game', () => {
  assert.match(html, /https:\/\/infinity-now\.vercel\.app\//); assert.match(html, /location\.replace\(LIVE\)/);
  assert.match(html, /games\/hillclimb-racing\/index\.html/); assert.match(html, /offline/i);
});
t('the bundled car game and its launcher target exist in the source public folder', () => {
  assert.ok(existsSync('public/games/hillclimb-racing/index.html')); assert.ok(existsSync('public/icon-192.png'));
});
t('car game: bundled copy refuses online race with a clear message and offers NEARBY', () => {
  const r = readFileSync('public/games/hillclimb-racing/race.js', 'utf8');
  assert.match(r, /location\.hostname === 'localhost'/); assert.match(r, /NEARBY/);
});
t('car game: equal cars override is always undone (stopRace, finishAll, leave, pagehide) and autosave-safe', () => {
  const r = readFileSync('public/games/hillclimb-racing/race.js', 'utf8');
  assert.ok((r.match(/eqRestore\(\)/g) || []).length >= 5); assert.match(r, /pagehide/); assert.match(r, /window\.save\.__eq/);
});
console.log(n, 'android-web tests passed');
