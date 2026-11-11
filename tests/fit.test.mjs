import assert from 'node:assert/strict';
import fs from 'node:fs';
import { fitScale, K_MIN, K_MAX } from '../src/lib/fit.js';
const t = (n, f) => { f(); console.log('ok -', n); };

t('a 390px phone is shown at design size', () => assert.equal(fitScale(390, 844), 1));
t('small phones shrink a little, never below the floor', () => { assert.ok(fitScale(360, 780) < 1); assert.equal(fitScale(240, 500), K_MIN); });
t('wide portrait screens (tablet, desktop-site mode) scale up, capped', () => { assert.ok(fitScale(745, 1650) > 1.5); assert.equal(fitScale(1200, 2000), K_MAX); });
t('landscape is limited by the short side so nothing is huge', () => { assert.ok(fitScale(844, 390) <= 1); assert.ok(fitScale(1920, 1080) <= K_MAX); assert.ok(fitScale(1366, 768) < 1.4); });
t('scale is monotonic with width in portrait', () => { let last = 0; for (let w = 300; w <= 900; w += 20) { const k = fitScale(w, w * 2); assert.ok(k >= last); last = k; } });
t('the scale is wired in: layout imports fit.css last, ViewportFit writes the variables', () => {
  const layout = fs.readFileSync('src/app/layout.tsx', 'utf8');
  assert.ok(layout.indexOf("./fit.css") > layout.indexOf("./afro.css"), 'fit.css loads after every other layer');
  const vf = fs.readFileSync('src/components/ViewportFit.jsx', 'utf8');
  for (const v of ['--k', '--app-w-z', '--app-h-z']) assert.ok(vf.includes(v), v);
  const css = fs.readFileSync('src/app/fit.css', 'utf8');
  assert.match(css, /zoom: var\(--k/);
  assert.match(css, /html\.in-game \.app \{ zoom: 1; \}/, 'games are never zoomed');
});
