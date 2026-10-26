// Coin wallet rules. Pure functions with no storage and no UI: the server (src/app/api/gebeta/route.js) is the only
// place that stores a wallet, and the client only ever shows what the server says. Coins are play-money: they
// cannot be bought, sold or cashed out.
import { randomInt } from './fairRandom.js';
import { REWARD_SPINS, REWARD_MAX_PER_DAY, BONUS_CAP } from './adsCore.js';

export const WELCOME_GIFT = 1000;
export const DAILY_SPINS = 10;
export const FEES = [50, 100, 200, 300, 500, 1000];
export const MIN_FEE = FEES[0];
export const HOUSE_CUT = 0.1; // winner receives 90% of the pot
export const TOPUP_FLOOR = 200; // a player below this may claim one refill per server day, up to this amount
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

/** What the client may see. Daily spins reset when the server day changes; bonus spins (earned by watching ads) are banked until used.
 *  `spins` = everything the player can spin right now (daily left + bonus), `bonus` = the banked part, `adsLeft` = rewarded ads that can still pay today. */
export function view(w, now = Date.now()) {
  const used = w.spinDay === dayKey(now) ? w.spins : 0;
  const daily = Math.max(0, DAILY_SPINS - used);
  const bonus = Math.max(0, w.bonus || 0);
  const adViews = w.adDay === dayKey(now) ? (w.adViews || 0) : 0;
  return { coins: w.coins, spins: daily + bonus, daily, bonus, adsLeft: bonus >= BONUS_CAP ? 0 : Math.max(0, REWARD_MAX_PER_DAY - adViews), adSpins: REWARD_SPINS, topUp: w.coins < TOPUP_FLOOR && w.topDay !== dayKey(now), log: (w.log || []).slice(0, 10) };
}
const rolled = (w, now) => (w.spinDay === dayKey(now) ? w : { ...w, spinDay: dayKey(now), spins: 0 });

/** One lucky spin. The 10 daily spins go first, then banked bonus spins. Returns { ok, wallet, coins, index } or { ok:false, reason }. */
export function spinOnce(w0, now = Date.now(), next = randomInt) {
  const w = rolled(w0, now);
  const bonus = Math.max(0, w.bonus || 0);
  const useBonus = w.spins >= DAILY_SPINS;
  if (useBonus && bonus <= 0) return { ok: false, reason: 'no-spins' };
  let r = next(SPIN_WSUM), index = 0;
  for (let i = 0; i < SPIN_PRIZES.length; i++) { const span = SPIN_PRIZES[i].w * 10; if (r < span) { index = i; break; } r -= span; }
  const coins = SPIN_PRIZES[index].coins;
  const paid = useBonus ? { ...w, bonus: bonus - 1 } : { ...w, spins: w.spins + 1 };
  return { ok: true, coins, index, wallet: addLog({ ...paid, coins: w.coins + coins }, 'spin', coins, now) };
}

/** A finished rewarded ad: bank REWARD_SPINS bonus spins. At most REWARD_MAX_PER_DAY a server day, and the bank never exceeds BONUS_CAP. */
export function grantAdSpins(w0, now = Date.now()) {
  const w = w0.adDay === dayKey(now) ? w0 : { ...w0, adDay: dayKey(now), adViews: 0 };
  const have = Math.max(0, w.bonus || 0);
  if ((w.adViews || 0) >= REWARD_MAX_PER_DAY) return { ok: false, reason: 'ad-cap' };
  if (have >= BONUS_CAP) return { ok: false, reason: 'bank-full' };
  const bonus = Math.min(BONUS_CAP, have + REWARD_SPINS);
  return { ok: true, spins: bonus - have, wallet: addLog({ ...w, bonus, adViews: (w.adViews || 0) + 1 }, 'ad', bonus - have, now) };
}

/** The daily refill for a player who is nearly out of coins: lifts the balance to TOPUP_FLOOR, once per server day. */
export function topUpOnce(w, now = Date.now()) {
  if (w.coins >= TOPUP_FLOOR) return { ok: false, reason: 'not-needed' };
  if (w.topDay === dayKey(now)) return { ok: false, reason: 'used' };
  const coins = TOPUP_FLOOR - w.coins;
  return { ok: true, coins, wallet: addLog({ ...w, coins: TOPUP_FLOOR, topDay: dayKey(now) }, 'topup', coins, now) };
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
