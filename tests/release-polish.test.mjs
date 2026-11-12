// Release polish: seamless top bar, animated invite button, grouped Profile/Progress, and the account-safety rules.
import assert from 'node:assert/strict';
import fs from 'node:fs';
const read = (f) => fs.readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');
let n = 0; const t = (name, fn) => { fn(); n++; console.log('ok', name); };

t('spin badge is part of the coin chip flow (never absolutely laid over the amount)', () => {
  const css = read('src/app/rc1.css');
  assert.ok(/html body \.coin-chip \.coin-dot\s*\{[^}]*position:\s*static/.test(css));
});
t('invite button is an animated SVG that respects reduced motion', () => {
  const css = read('src/app/rc1.css'); const f = read('src/components/Friends.jsx');
  assert.ok(f.includes('<PlayGlyph />') && !f.includes('>🎮</button>'));
  assert.ok(css.includes('@keyframes pg-roll') && /prefers-reduced-motion: reduce\) \{ \.tg-play/.test(css));
});
t('Progress is tabbed and Profile sections are grouped', () => {
  const s = read('src/components/Screens.jsx');
  assert.ok(s.includes('role="tablist"') && s.includes('role="tabpanel"') && s.includes('<details className="prof-group"'));
});
t('rules: sign-up cannot smuggle per-game ratings; revoked sessions cannot spend coins', () => {
  const r = read('firestore.rules');
  assert.ok(/allow create:[\s\S]*?keys\(\)\.hasOnly\(\['displayName', 'avatar', 'lang', 'rating', 'wins', 'losses', 'draws', 'games', 'createdAt'\]\)/.test(r));
  assert.ok(read('src/app/api/gebeta/route.js').includes('verifyIdToken(token, true)'));
});
console.log(`${n} checks passed`);
