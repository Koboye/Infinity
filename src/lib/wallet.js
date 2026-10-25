// Coin wallet: welcome gift, daily lucky spins, entry fees, winner-takes-the-pot. Pure logic, no UI.
// Coins are play-money only: they cannot be bought, sold or cashed out.
import { randomInt } from './fairRandom.js';

const KEY = 'gebeta.wallet.v1';
export const WELCOME_GIFT = 1000;
export const DAILY_SPINS = 10;
export const FEES = [50, 100, 200, 300, 500, 1000];
export const MIN_FEE = FEES[0];
export const HOUSE_CUT = 0.1; // winner receives 90% of the pot
// weight = chance out of the total; value = coins
export const SPIN_PRIZES = [
  { coins: 10, w: 26 }, { coins: 20, w: 22 }, { coins: 30, w: 18 }, { coins: 50, w: 14 },
  { coins: 75, w: 9 }, { coins: 100, w: 6 }, { coins: 150, w: 3.5 }, { coins: 250, w: 1.5 },
];
const WSUM = SPIN_PRIZES.reduce((a, p) => a + p.w * 10, 0);

const today = () => new Date().toLocaleDateString('en-CA');
const store = () => { try { return globalThis.localStorage || null; } catch { return null; } };
const blank = () => ({ coins: WELCOME_GIFT, welcome: true, spinDate: today(), spins: 0, stake: null, log: [{ k: 'welcome', n: WELCOME_GIFT, at: Date.now() }] });
const emit = () => { try { globalThis.dispatchEvent?.(new Event('wallet:change')); } catch { /* no window */ } };

export function load() {
  const s = store(); let w = null;
  try { w = JSON.parse(s?.getItem(KEY) || 'null'); } catch { w = null; }
  if (!w || typeof w.coins !== 'number') { w = blank(); save(w, false); }
  if (w.spinDate !== today()) { w.spinDate = today(); w.spins = 0; }
  return w;
}
function save(w, notify = true) { try { store()?.setItem(KEY, JSON.stringify(w)); } catch { /* storage unavailable */ } if (notify) emit(); }
const log = (w, k, n) => { w.log = [{ k, n, at: Date.now() }, ...(w.log || [])].slice(0, 30); };

export const balance = () => load().coins;
export const spinsLeft = () => Math.max(0, DAILY_SPINS - load().spins);
export const canAfford = (fee) => FEES.includes(fee) && load().coins >= fee;
export const affordableFees = () => FEES.filter((f) => f <= load().coins);
/** True once, right after the wallet was created: show the welcome gift. */
export function takeWelcome() { const w = load(); if (!w.welcome) return false; w.welcome = false; save(w); return true; }

/** One lucky spin. Returns { ok, coins, index } — index is the slice to land on. */
export function spin(next = randomInt) {
  const w = load();
  if (w.spins >= DAILY_SPINS) return { ok: false, reason: 'no-spins' };
  let r = next(WSUM), index = 0;
  for (let i = 0; i < SPIN_PRIZES.length; i++) { const span = SPIN_PRIZES[i].w * 10; if (r < span) { index = i; break; } r -= span; }
  const coins = SPIN_PRIZES[index].coins;
  w.spins += 1; w.coins += coins; log(w, 'spin', coins); save(w);
  return { ok: true, coins, index };
}

/** Pay the entry fee and open a stake. Refuses (ok:false) if the player cannot afford it — no match without coins. */
export function startMatch({ fee, seats = 2, game = '' }) {
  const w = load();
  if (!FEES.includes(fee)) return { ok: false, reason: 'bad-fee' };
  if (w.coins < fee) return { ok: false, reason: 'no-coins' };
  w.coins -= fee; w.stake = { fee, pot: fee * Math.max(2, seats), game, at: Date.now() }; log(w, 'fee', -fee); save(w);
  return { ok: true, fee };
}
export const prizeFor = (pot) => Math.floor(pot * (1 - HOUSE_CUT));

/** Close the open stake with the match result. win: prize from the pot · draw: fee back · lose: fee is gone. */
export function settle(tone) {
  const w = load(); const s = w.stake;
  if (!s) return { paid: 0, fee: 0 };
  w.stake = null; let paid = 0;
  if (tone === 'win') paid = prizeFor(s.pot); else if (tone === 'draw') paid = s.fee;
  if (paid) { w.coins += paid; log(w, tone === 'win' ? 'prize' : 'refund', paid); }
  save(w);
  return { paid, fee: s.fee, tone };
}
