// RC Phase 4: Wallet, ads/earn, Profile, Settings.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { STRINGS } from '../src/lib/i18n.js';
const read = (f) => fs.readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');
let n = 0; const t = (name, fn) => { fn(); n++; console.log('ok', name); };

t('On/Off and text-size labels exist in both languages and differ (no English left in Amharic)', () => {
  for (const k of ['on', 'off', 'textNormal', 'nameHint', 'savedOk']) { assert.ok(STRINGS.en[k] && STRINGS.am[k], k); assert.notEqual(STRINGS.en[k], STRINGS.am[k], k); }
});
t('Settings uses the translated On/Off, no hard-coded English toggles', () => {
  const s = read('src/components/Screens.jsx'); const a = s.indexOf('export function SettingsScreen'); const seg = s.slice(a);
  assert.ok(!/\[\w+, 'On'\]|\[\w+, 'Off'\]|\[true, 'On'\]|\[false, 'Off'\]/.test(seg), "no 'On'/'Off' literals");
  assert.ok(seg.includes('t.on') && seg.includes('t.off'));
});
t('Profile: editor first, Enter saves (a real form), stats below', () => {
  const s = read('src/components/Screens.jsx'); const p = s.slice(s.indexOf('export function ProfileScreen'), s.indexOf('Progress (on-device)'));
  assert.ok(p.indexOf('prof-form') < p.indexOf('<StatTable') && p.indexOf('<PhotoPicker') < p.indexOf('<StatTable'));
  assert.ok(p.includes('onSubmit') && p.includes('type="submit"') && p.includes('autoComplete="nickname"'));
});
t('Spin wheel scales with the screen; labels follow the wheel size', () => {
  assert.ok(read('src/components/Wallet.jsx').includes('var(--wd)'));
  const c = read('src/app/rc1.css'); assert.ok(c.includes('--wd: clamp(150px') && c.includes('.wallet-card { max-height'));
});
t('tap targets are at least 44px on the account screens', () => {
  const c = read('src/app/rc1.css'); for (const k of ['.seg button { min-height: 44px', '.earn-x { width: 44px', '.ad-skip, html body .ad-cta { min-height: 44px', '.hero-pick { min-height: 84px']) assert.ok(c.includes(k), k);
});
console.log(`rc1 account tests passed (${n})`);
