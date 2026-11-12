// Client side of the daily level pass. The server owns every pass; this module asks and shows. Nothing is stored on the phone.
import { apiCall } from './firebase';
import { DEFAULT_USSD, ussdLink, PASS_LEVELS } from './passCore.js';
export { PASS_LEVELS };

/** Build-time switch for the client (the server has its own PAYWALL switch). Off = every level is free, as before. */
export const paywallEnabled = process.env.NEXT_PUBLIC_PAYWALL === '1' || process.env.NEXT_PUBLIC_PAYWALL === 'true';
export const ussdCode = process.env.NEXT_PUBLIC_PAY_USSD || DEFAULT_USSD;

let state = { active: false, left: 0, total: PASS_LEVELS, locked: true, pending: false, ready: false };
const emit = () => { try { globalThis.dispatchEvent?.(new Event('pass:change')); } catch { /* no window */ } };
const set = (p) => { state = { ...p, ready: true }; emit(); };
export const snapshot = () => state;
export const reset = () => { state = { active: false, left: 0, total: PASS_LEVELS, locked: true, pending: false, ready: false }; emit(); };

export async function refresh() {
  try { const r = await apiCall({ action: 'pass' }, { retries: 1 }); set(r.pass); return { ok: true, pass: r.pass }; }
  catch (e) { return { ok: false, error: e.message }; }
}
/** Spend one level start. { ok:true } lets the game begin; { ok:false, locked:true } means "show the pay screen". */
export async function start() {
  try { const r = await apiCall({ action: 'passStart' }, { retries: 0 }); set(r.pass); return { ok: true, free: !!r.free, pass: r.pass }; }
  catch (e) { return { ok: false, locked: e.status === 402, error: e.message }; }
}
/** Tell the server "I am paying now" (optionally with the payer's number), then open the phone dialer with the code filled in. */
export async function pay(phone) {
  try {
    const r = await apiCall({ action: 'passClaim', phone: phone || '' }, { retries: 0 });
    set(r.pass);
    try { globalThis.location.href = ussdLink(ussdCode); } catch { /* the code is also shown on screen */ }
    return { ok: true, claim: r.claim };
  } catch (e) { return { ok: false, error: e.message }; }
}
