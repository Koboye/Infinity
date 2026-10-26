// Client side of the coin wallet. The server owns every coin; this module only asks for the balance and shows it.
// Nothing here is stored on the phone, so editing local storage or the phone's clock changes nothing.
import { apiCall } from './firebase';
export * from './walletCore.js';

let state = { coins: 0, spins: 0, bonus: 0, adsLeft: 0, adSpins: 2, topUp: false, ready: false };
const emit = () => { try { globalThis.dispatchEvent?.(new Event('wallet:change')); } catch { /* no window */ } };
const set = (next) => { state = { ...next, ready: true }; emit(); };

export const snapshot = () => state;
export const balance = () => state.coins;
export const spinsLeft = () => state.spins;

/** Ask the server for this account's wallet. `gift` is true exactly once: when the account was just created. */
export async function refresh() {
  try { const r = await apiCall({ action: 'wallet' }, { retries: 1 }); set(r.wallet); return { ok: true, gift: !!r.gift }; }
  catch (e) { return { ok: false, gift: false, error: e.message }; }
}
/** One lucky spin, decided and paid by the server. */
export async function spin() {
  try { const r = await apiCall({ action: 'spin' }, { retries: 0 }); set(r.wallet); return { ok: true, coins: r.coins, index: r.index }; }
  catch (e) { return { ok: false, error: e.message }; }
}
/** The daily refill for a player who is nearly out of coins, decided and paid by the server. */
export async function topUp() {
  try { const r = await apiCall({ action: 'topup' }, { retries: 0 }); set(r.wallet); return { ok: true, coins: r.coins }; }
  catch (e) { return { ok: false, error: e.message }; }
}
/** Signed out: forget the balance. */
export function reset() { state = { coins: 0, spins: 0, bonus: 0, adsLeft: 0, adSpins: 2, topUp: false, ready: false }; emit(); }

/** Ask the server for a rewarded ad. It picks the ad, starts the clock, and says how long the ad must run. */
export async function adStart() {
  try { const r = await apiCall({ action: 'adStart' }, { retries: 0 }); set(r.wallet); return { ok: true, session: r.session, ad: r.ad }; }
  catch (e) { return { ok: false, error: e.message }; }
}
/** Report that the ad ran to the end. The server checks the time itself and banks the bonus spins (or refuses). */
export async function adDone(session) {
  try { const r = await apiCall({ action: 'adDone', session }, { retries: 0 }); set(r.wallet); return { ok: true, spins: r.spins }; }
  catch (e) { refresh(); return { ok: false, error: e.message }; }   // a lost reply may still have paid: re-read the wallet
}
