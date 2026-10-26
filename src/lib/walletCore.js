// Coin wallet rules. Pure functions with no storage and no UI: the server (src/app/api/gebeta/route.js) is the only
// place that stores a wallet, and the client only ever shows what the server says. Coins are play-money: they
// cannot be bought, sold or cashed out.
import { randomInt } from './fairRandom.js';

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
export const SPIN_WSUM = SPIN_PRIZES.reduce((a, p) => a + p.w * 10, 0);
const LOG_MAX = 30;

/** The server's calendar day (UTC). A phone's clock is never consulted. */
export const dayKey = (now = Date.now()) => new Date(now).toISOString().slice(0, 10);
export const normalizeFee = (f) => (FEES.includes(Number(f)) ? Number(f) : MIN_FEE);
export const prizeFor = (pot) => Math.floor(pot * (1 - HOUSE_CUT));

const addLog = (w, k, n, now) => ({ ...w, log: [{ k, n, at: now }, ...(w.log || [])].slice(0, LOG_MAX) });

/** A brand-new account's wallet: the welcome gift, no spins used today. */
export const newWallet = (now = Date.now()) => ({ coins: WELCOME_GIFT, spinDay: dayKey(now), spins: 0, log: [{ k: 'welcome', n: WELCOME_GIFT, at: now }] });

/** What the client may see. Spins reset when the server day changes. */
export function view(w, now = Date.now()) {
  const used = w.spinDay === dayKey(now) ? w.spins : 0;
  return { coins: w.coins, spins: Math.max(0, DAILY_SPINS - used), log: (w.log || []).slice(0, 10) };
}
const rolled = (w, now) => (w.spinDay === dayKey(now) ? w : { ...w, spinDay: dayKey(now), spins: 0 });

/** One lucky spin. Returns { ok, wallet, coins, index } or { ok:false, reason }. */
export function spinOnce(w0, now = Date.now(), next = randomInt) {
  const w = rolled(w0, now);
  if (w.spins >= DAILY_SPINS) return { ok: false, reason: 'no-spins' };
  let r = next(SPIN_WSUM), index = 0;
  for (let i = 0; i < SPIN_PRIZES.length; i++) { const span = SPIN_PRIZES[i].w * 10; if (r < span) { index = i; break; } r -= span; }
  const coins = SPIN_PRIZES[index].coins;
  return { ok: true, coins, index, wallet: addLog({ ...w, spins: w.spins + 1, coins: w.coins + coins }, 'spin', coins, now) };
}

export const canAfford = (w, fee) => FEES.includes(fee) && w.coins >= fee;

/** Take the entry fee. Returns { ok, wallet } or { ok:false, reason }. */
export function charge(w, fee, now = Date.now()) {
  if (!FEES.includes(fee)) return { ok: false, reason: 'bad-fee' };
  if (w.coins < fee) return { ok: false, reason: 'no-coins' };
  return { ok: true, wallet: addLog({ ...w, coins: w.coins - fee }, 'fee', -fee, now) };
}

/** What each seat is paid when a two-player match with this fee ends. winner: 0 | 1 | 'draw'. */
export function payouts(fee, winner) {
  if (winner === 0) return [prizeFor(fee * 2), 0];
  if (winner === 1) return [0, prizeFor(fee * 2)];
  return [fee, fee]; // draw: everyone gets the fee back
}

export function pay(w, amount, kind, now = Date.now()) {
  return amount > 0 ? addLog({ ...w, coins: w.coins + amount }, kind, amount, now) : w;
}
