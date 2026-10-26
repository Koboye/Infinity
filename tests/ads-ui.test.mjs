// Guard rails for the places ads are wired in: the app must stay usable, and the pieces must stay connected.
import assert from 'node:assert/strict';
import fs from 'node:fs';
const read = (p) => fs.readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
let n = 0; const t = (name, fn) => { fn(); n++; console.log('ok', name); };
const app = read('src/components/GebetaApp.jsx'), wallet = read('src/components/Wallet.jsx'), screens = read('src/components/Screens.jsx');
const overlay = read('src/components/AdOverlay.jsx'), css = read('next.config.mjs'), rules = read('firestore.rules'), layout = read('src/app/layout.tsx');

t('app open and game start both go through runAd; local games and online matchmaking are covered', () => {
  assert.match(app, /runAd\('splash'\)/); assert.match(app, /runAd\('pre_game'\)\.then\(enter\)/); assert.match(app, /beforeStart=\{\(\) => runAd\('pre_game'\)\}/);
  assert.match(screens, /await beforeStart\?\.\(\)/);
});
t('an ad can never block the app: failures resolve, only one ad at a time, rewards only from the server', () => {
  assert.match(app, /catch \{ ad = null; \}/); assert.match(app, /if \(adRef\.current\) return;/);
  assert.match(wallet, /W\.adStart\(\)/); assert.match(wallet, /W\.adDone\(cur\.session\.id\)/);
  assert.ok(!/bonus\s*[:=]\s*\d/.test(wallet.replace(/bonus: 0/g, '')), 'the client never writes bonus spins');
});
t('overlay: clock starts when the picture shows, pauses in the background, is closed once, and a broken picture closes it', () => {
  assert.match(overlay, /document\.hidden/); assert.match(overlay, /if \(!loaded\) return undefined/); assert.match(overlay, /closed\.current/); assert.match(overlay, /finish\(false, 'failed'\)/);
  assert.match(overlay, /if \(loaded\) return undefined;\s+const id = setTimeout\(\(\) => finish\(false, 'failed'\)/, 'the load timeout must stop once the picture is loaded');
  assert.match(overlay, /createPortal/); assert.match(overlay, /role="dialog"/);
});
t('security: ad pictures are allowed by the CSP, ad collections are closed to clients, the stylesheet is loaded', () => {
  assert.match(css, /firebasestorage\.googleapis\.com/); for (const c of ['ads', 'adStats', 'adSessions']) assert.match(rules, new RegExp(`match /${c}/\\{\\w+\\} \\{ allow read, write: if false; \\}`));
  assert.match(layout, /ads\.css/);
});
t('both languages have every ad string', () => {
  const m = overlay.match(/const TXT = \{[\s\S]*?\n\};/)[0]; for (const k of ['ad', 'skip', 'skipNo', 'earn', 'claim', 'secs']) assert.equal((m.match(new RegExp(`\\b${k}:`, 'g')) || []).length, 2, k);
  for (const k of ['watch', 'watchLeft', 'watchSub', 'adWon', 'adNone', 'adFail', 'bonusLeft']) assert.equal((wallet.match(new RegExp(`\\b${k}:`, 'g')) || []).length, 2, k);
});
console.log(`ads-ui tests passed (${n})`);
