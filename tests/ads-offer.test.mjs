// v66: smart "free spins" offers, the ad between rounds, and the wiring into every game.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { shouldOffer, noteShown, noteAccepted, noteIgnored, newOfferState, inNeed, OFFER } from '../src/lib/adsOffer.js';
import { CAPS } from '../src/lib/adsCore.js';
import { MIN_FEE } from '../src/lib/walletCore.js';
import { BONUS_CAP } from '../src/lib/adsCore.js';
const read = (f) => fs.readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');
let n = 0; const t = (name, fn) => { fn(); n++; console.log('ok', name); };
const NOW = Date.parse('2026-10-27T10:00:00Z');
const W = { ready: true, adsLeft: 10, spins: 0, coins: 1000, bonus: 0 };

t('a player with no spins is offered free spins when the app opens', () => assert.equal(shouldOffer({ ...W, context: 'open' }, null, NOW), true));
t('a player with spins and plenty of coins is left alone at app open', () => assert.equal(shouldOffer({ ...W, spins: 3, context: 'open' }, null, NOW), false));
t('low coins count as a need even with spins left', () => { assert.equal(inNeed({ spins: 3, coins: OFFER.lowCoins - 1 }), true); assert.equal(shouldOffer({ ...W, spins: 3, coins: 50, context: 'open' }, null, NOW), true); });
t('never when signed out (wallet not ready), no ads left today, or the bonus bank is full', () => {
  assert.equal(shouldOffer({ ...W, ready: false, context: 'open' }, null, NOW), false);
  assert.equal(shouldOffer({ ...W, adsLeft: 0, context: 'open' }, null, NOW), false);
  assert.equal(shouldOffer({ ...W, bonus: BONUS_CAP, context: 'open' }, null, NOW), false);
  assert.equal(shouldOffer({ ...W, ready: false, context: 'lowcoins', coins: 0 }, null, NOW), false);
});
t('after a loss the offer is shown even without a need; after a win only with a need', () => {
  assert.equal(shouldOffer({ ...W, spins: 5, context: 'result', tone: 'lose' }, null, NOW), true);
  assert.equal(shouldOffer({ ...W, spins: 5, context: 'result', tone: 'win' }, null, NOW), false);
  assert.equal(shouldOffer({ ...W, spins: 0, context: 'result', tone: 'win' }, null, NOW), true);
});
t('a player who cannot afford a match always sees the way out, whatever the history', () => {
  const muted = { ...newOfferState(), mutedUntil: NOW + 1e9, shown: 99 };
  assert.equal(shouldOffer({ ...W, context: 'lowcoins', coins: MIN_FEE - 1 }, muted, NOW), true);
  assert.equal(shouldOffer({ ...W, context: 'lowcoins', coins: MIN_FEE }, muted, NOW), false);
});
t('a gap separates offers of the same kind, and a new day resets the daily count', () => {
  let s = noteShown(null, 'open', NOW);
  assert.equal(shouldOffer({ ...W, context: 'open' }, s, NOW + OFFER.gapMs.open - 1), false);
  assert.equal(shouldOffer({ ...W, context: 'open' }, s, NOW + OFFER.gapMs.open), true);
  s = { ...newOfferState() }; for (let i = 0; i < OFFER.maxPerDay; i++) s = noteShown(s, 'result', NOW + i * 1000);
  assert.equal(shouldOffer({ ...W, context: 'result', tone: 'lose' }, s, NOW + 3600_000), false, 'daily limit');
  assert.equal(shouldOffer({ ...W, context: 'result', tone: 'lose' }, s, NOW + 86_400_000), true, 'next day');
});
t('two ignored offers in a row mean a quiet day; watching ends the streak', () => {
  let s = noteIgnored(noteShown(null, 'open', NOW), NOW);
  assert.equal(s.mutedUntil, 0);
  s = noteIgnored(s, NOW + 1000); assert.ok(s.mutedUntil > NOW);
  assert.equal(shouldOffer({ ...W, context: 'open' }, s, NOW + 2 * 3600_000), false);
  assert.equal(shouldOffer({ ...W, context: 'open' }, s, NOW + OFFER.muteMs + 1000), true, 'back after a day');
  const a = noteAccepted(s, NOW + 5000); assert.equal(a.ignored, 0); assert.equal(a.mutedUntil, 0);
});
t('garbage saved state never breaks the decision', () => {
  for (const bad of ['x', 5, [], { shown: 'a', last: null }]) assert.equal(typeof shouldOffer({ ...W, context: 'open' }, bad, NOW), 'boolean');
});
t('the ad between rounds: a gap rule and a safe gate', async () => {
  const ads = read('src/lib/ads.js');
  assert.ok(CAPS.rematchGapMs >= 60_000);
  assert.match(ads, /export const rematchDue/); assert.match(ads, /export async function gate/); assert.match(ads, /catch \{ \/\* an ad problem never stops a game \*\/ \}/);
  assert.match(ads, /rematchDue\(read\(CAP_KEY\)/);
});
t('every game asks the gate before "Play again", online rematch does too, and a double tap cannot restart twice', () => {
  for (const f of ['src/components/LocalGame.jsx', 'src/components/checkers/CheckersLocal.jsx', 'src/components/dominoes/DominoesLocal.jsx', 'src/components/bingo/BingoGame.jsx']) {
    const s = read(f); assert.match(s, /await Ads\.gate\(\)/, f); assert.match(s, /const doAgain = /, f); assert.match(s, /againBusy\.current/, f);
  }
  const ludo = read('src/components/ludo/LudoGame.jsx'); assert.match(ludo, /await Ads\.gate\(\)/); assert.match(ludo, /restartBusy\.current/);
  assert.match(read('src/components/online/useMatch.js'), /await Ads\.gate\(\);\s*const r = await api\(\{ action: 'rematch' \}\)/);
});
t('the shell registers the gate, waits for the opening ad before the banner, and shows it only on menu screens', () => {
  const app = read('src/components/GebetaApp.jsx');
  assert.match(app, /Ads\.setGate\(/); assert.match(app, /runAd\('splash'\)\.finally\(\(\) => setSplashDone\(true\)\)/);
  assert.match(app, /<EarnOffer[^>]*context="open"[^>]*active=\{splashDone && !sheet\}/); assert.match(app, /view\.name === 'home' \|\| view\.name === 'modes'\) && !adShow/);
});
t('the offer card sits on every result screen (all games, local and online) and in the low-coins lobby', () => {
  assert.match(read('src/components/ResultOverlay.jsx'), /<EarnOffer[^>]*context="result"/);
  assert.match(read('src/components/Screens.jsx'), /<EarnOffer[^>]*context="lowcoins"/);
});
t('rewarded ads promise what they pay: coins AND spins, in both languages', () => {
  const o = read('src/components/AdOverlay.jsx');
  assert.match(o, /rewardSpins/); assert.match(o, /earn: \(n, sp\)/g); assert.match(o, /claim: \(n, sp\)/g);
  for (const f of ['src/components/RewardedAdButton.jsx', 'src/components/Wallet.jsx', 'src/components/EarnOffer.jsx']) assert.match(read(f), /rewardSpins=\{/, f);
});
t('the offer never pays by itself: it only starts and finishes the server-timed ad', () => {
  const e = read('src/components/EarnOffer.jsx');
  assert.match(e, /W\.adStart\(\)/); assert.match(e, /W\.adDone\(cur\.session\.id\)/); assert.doesNotMatch(e, /coins:\s*\d|setCoins|localStorage\.setItem\([^)]*coins/);
  assert.match(read('src/app/layout.tsx'), /import '\.\/earn\.css'/);
});
console.log(`ads-offer tests passed (${n})`);
