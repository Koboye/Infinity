// Release polish: seamless top bar, animated invite button, grouped Profile/Progress, and the account-safety rules.
import assert from 'node:assert/strict';
import fs from 'node:fs';
const read = (f) => fs.readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');
let n = 0; const t = (name, fn) => { fn(); n++; console.log('ok', name); };

t('spin badge is part of the coin chip flow (never absolutely laid over the amount)', () => {
  const css = read('src/app/rc1.css');
  assert.ok(/html body \.coin-chip \.coin-dot\s*\{[^}]*position:\s*static/.test(css));
});
t('invite button is a gamepad SVG whose online ring respects reduced motion', () => {
  const css = read('src/app/rc1.css'); const f = read('src/components/Friends.jsx');
  assert.ok(f.includes('<PlayGlyph />') && !f.includes('>🎮</button>'));
  assert.ok(f.includes('viewBox="0 0 64 44"') && css.includes('@keyframes pg-ring') && /prefers-reduced-motion: reduce\) \{ \.tg-play/.test(css));
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
import { cleanAttachment } from '../src/lib/social.js';
t('chat attachment must live in this project\'s own bucket', () => {
  const was = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET; process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET = 'mine.appspot.com';
  const mk = (b) => ({ kind: 'image', url: `https://firebasestorage.googleapis.com/v0/b/${b}/o/u%2Fabc%2Fp.jpg?alt=media&token=x` });
  assert.ok(cleanAttachment(mk('mine.appspot.com'), 'abc'));
  assert.equal(cleanAttachment(mk('evil.appspot.com'), 'abc'), null);
  if (was === undefined) delete process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET; else process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET = was;
});
console.log(`${n} checks passed`);
