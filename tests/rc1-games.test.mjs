// RC Phase 2: in-game shell + Afro Climb page identity.
import assert from 'node:assert/strict';
import fs from 'node:fs';
const read = (f) => fs.readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');
let n = 0; const t = (name, fn) => { fn(); n++; console.log('ok', name); };

t('in-game shell uses the measured visible height and 44px tap targets', () => {
  const css = read('src/app/rc1.css');
  assert.match(css, /html\.in-game \.app \{ height: var\(--app-h, 100dvh\); \}/);
  assert.match(css, /html\.in-game \.icon-btn \{ width: 44px; height: 44px;/);
  assert.match(css, /safe-area-inset-left/); assert.match(css, /safe-area-inset-right/);
});
t('short landscape phones get a compact game bar', () => assert.match(read('src/app/rc1.css'), /orientation: landscape\) and \(max-height: 480px\) \{\s*html\.in-game \.topbar/));
t('Afro Climb page carries the Afro brand, theme colour and install icons', () => {
  const h = read('public/games/hillclimb-racing/index.html').slice(0, 2500);
  assert.ok(h.includes('<title>Afro Climb</title>') && !h.includes('Infinity Climb'));
  for (const k of ['theme-color', 'rel="icon"', 'apple-touch-icon', 'rel="manifest"', 'viewport-fit=cover']) assert.ok(h.includes(k), k);
  for (const f of ['icon.svg', 'icon-192.png', 'apple-touch-icon.png', 'manifest.json']) assert.ok(fs.existsSync(`public/${f}`), f);
});
console.log(`rc1 games tests passed (${n})`);
