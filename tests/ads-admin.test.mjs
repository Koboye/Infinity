// Owner page: the dropdown presets map to exactly what the server stores, and the page renders with real-looking data.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import { PLACE_PRESETS, placeKey, TIMES, timeKey, autoId, daysBetween, addDays, plain, CTA_PRESETS, WEIGHTS, DURATIONS, STARTS } from '../src/lib/adsAdminKit.js';
import { sanitizeAd } from '../src/lib/adsCore.js';
let n = 0; const t = (name, fn) => { fn(); n++; console.log('ok', name); };

t('placement presets round-trip and are valid placements', () => {
  for (const [id, , pl] of PLACE_PRESETS) assert.equal(placeKey(pl), id);
  assert.equal(placeKey(['pre_game', 'rewarded']), 'custom');
});
t('time-of-day presets round-trip, "all day" has no window, custom is recognised', () => {
  assert.equal(timeKey('', ''), 'all'); assert.equal(timeKey(8, 8), 'all');
  for (const [id, , w] of TIMES) if (Array.isArray(w)) assert.equal(timeKey(w[0], w[1]), id);
  assert.equal(timeKey(9, 18), 'custom');
});
t('every preset is accepted by the server-side validator', () => {
  const base = { id: 'abay-bank-oct26', advertiser: 'Abay Bank', category: 'bank', image: 'https://firebasestorage.googleapis.com/x.png', clickUrl: 'https://abay.example', start: '2026-10-26', end: '2026-11-25' };
  for (const [, , pl] of PLACE_PRESETS) assert.ok(sanitizeAd({ ...base, placements: pl }).ok);
  for (const [, , w] of TIMES) if (Array.isArray(w)) { const r = sanitizeAd({ ...base, placements: ['splash'], hourFrom: w[0], hourTo: w[1] }); assert.ok(r.ok); assert.deepEqual(r.ad.hours, { from: w[0], to: w[1] }); }
  for (const [v] of WEIGHTS) assert.ok(sanitizeAd({ ...base, placements: ['splash'], weight: v }).ok);
  for (const [en] of CTA_PRESETS) assert.ok(sanitizeAd({ ...base, placements: ['splash'], cta: en }).ok);
});
t('ids and dates', () => {
  assert.equal(autoId('Abay Bank', '2026-10-26'), 'abay-bank-oct26'); assert.equal(autoId('', '2026-10-26'), '');
  assert.equal(daysBetween('2026-10-26', '2026-11-25'), 31); assert.equal(addDays('2026-10-26', 29), '2026-11-24');
  assert.ok(DURATIONS.some(([v]) => v === 0) && STARTS.some(([k]) => k === 'custom'));
});
t('plain-English summary mentions where, who, when', () => {
  const s = plain({ placements: ['splash'], langs: ['am'], games: [], hourFrom: 22, hourTo: 5, durationSec: 5, start: '2026-10-26', end: '2026-11-01', maxPerUser: 3, dailyCap: 1000 });
  assert.match(s, /App open/); assert.match(s, /አማርኛ/); assert.match(s, /22:00–05:00/); assert.match(s, /7 days/); assert.match(s, /1,000 views a day/);
});
t('the page renders with data (server-side render, no browser needed)', async () => {}); // async part below
const req = createRequire('/opt/npm-tools/package.json');
const es = req('esbuild');
const out = await es.build({
  stdin: { contents: "import React from 'react'; import { renderToString } from 'react-dom/server'; import AdminAds from '@/components/AdminAds'; export const html = (p) => renderToString(React.createElement(AdminAds, { preload: p }));", resolveDir: process.cwd(), loader: 'js' },
  bundle: true, write: false, format: 'cjs', platform: 'node', alias: { '@': process.cwd() + '/src' }, loader: { '.js': 'jsx', '.jsx': 'jsx' }, jsx: 'automatic', nodePaths: ['/opt/npm-tools/node_modules'], logLevel: 'error',
});
const tmp = new URL('./.adm-render.cjs', import.meta.url); fs.writeFileSync(tmp, out.outputFiles[0].text);
const { html } = createRequire(import.meta.url)(tmp.pathname); fs.unlinkSync(tmp);
const ad = { id: 'abay-bank-oct26', advertiser: 'Abay Bank', category: 'bank', placements: ['splash', 'pre_game'], image: 'https://x/y.png', clickUrl: 'https://a.example', start: '2026-10-01', end: '2026-12-01', active: true, durationSec: 5, weight: 3, langs: ['am'], games: ['gebeta', 'ludo'], hours: { from: 22, to: 5 }, maxPerUser: 3, dailyCap: 1000 };
const page = html({ today: '2026-10-26', ads: [ad, { ...ad, id: 'old', advertiser: 'Nile Cafe', end: '2026-10-02' }], stats: { 'abay-bank-oct26': { impressions: 120, clicks: 6, rewarded: 2, today: 40 } } });
t('rendered page has the guided steps and dropdowns', () => {
  for (const s of ['Client', 'Where and how long', 'The ad', 'Schedule', 'Who sees it', 'New advertiser', 'Abay Bank', 'Nile Cafe', 'Duplicate']) assert.ok(page.includes(s), s);
  assert.ok((page.match(/<select/g) || []).length >= 14, 'many dropdowns');
  assert.ok(page.includes('Filter ads'));
});
console.log(`ads-admin tests passed (${n})`);
