// RC Phase 1: home screen + logos + install icons.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { STRINGS } from '../src/lib/i18n.js';
const read = (f) => fs.readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');
let n = 0; const t = (name, fn) => { fn(); n++; console.log('ok', name); };

t('Afro Climb card is translated in both languages', () => { for (const l of ['en', 'am']) assert.ok(STRINGS[l].climbName && STRINGS[l].climbTag, l); });
t('Afro Climb card uses the shared icon system, no hard-coded English or odd-sized image', () => {
  const src = read('src/components/Screens.jsx');
  assert.ok(src.includes('t.climbName') && src.includes('t.climbTag'));
  assert.ok(!src.includes('width={64} height={38}') && !src.includes('Hill-climb racing</small>'));
});
t('phase-1 stylesheet exists and is the last one loaded', () => {
  const lay = read('src/app/layout.tsx');
  const imports = [...lay.matchAll(/import '\.\/([\w-]+\.css)'/g)].map((m) => m[1]);
  assert.equal(imports[imports.length - 1], 'rc1.css');
  const css = read('src/app/rc1.css');
  for (const k of ['--rc-art', 'safe-area-inset', 'prefers-reduced-motion', 'max-width: 360px', 'orientation: landscape']) assert.ok(css.includes(k), k);
});
t('install metadata is complete', () => {
  const m = JSON.parse(read('public/manifest.json'));
  assert.ok(m.icons.some((i) => i.purpose === 'maskable'));
  assert.ok(m.shortcuts.some((s) => s.url.includes('hillclimb')));
  assert.ok(!/Dominoes|Tuz/.test(m.description), 'description lists only released games');
  assert.ok(fs.existsSync('public/apple-touch-icon.png'));
  for (const i of m.icons) assert.ok(fs.existsSync(`public${i.src}`), i.src);
});
t('service worker cache was bumped for this release', () => assert.ok(/gebeta-v(?:[4-9]\d)/.test(read('public/sw.js'))));
console.log(`rc1 home tests passed (${n})`);
