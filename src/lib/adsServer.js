// Server-only ad helpers (Firestore via the Admin SDK). The client can never read or write these collections:
//   ads/{id}               the ads themselves (written by the admin API, read here)
//   adStats/{id}_{day}     counters: impressions, clicks, rewarded (written here with atomic increments)
//   adSessions/{uid}       the one rewarded ad a player is currently watching (proof that it ran its full length)
import { FieldValue } from 'firebase-admin/firestore';
import { isLive, todayKey } from './adsCore.js';

export const adsCol = (db) => db.collection('ads');

/** Every ad that is switched on and inside its dates. */
export async function liveAds(db, now = Date.now()) {
  const snap = await adsCol(db).where('active', '==', true).get();
  return snap.docs.map((d) => ({ ...d.data(), id: d.id })).filter((a) => isLive(a, now));
}

/** Atomic counter bump for one ad on one server day. `field` is impressions | clicks | rewarded. Never throws: stats must not break play. */
export async function bump(db, adId, field, now = Date.now()) {
  try {
    const day = todayKey(now);
    await db.collection('adStats').doc(`${adId}_${day}`).set({ adId, day, [field]: FieldValue.increment(1) }, { merge: true });
  } catch (e) { console.error('ad stats failed', e?.message); }
}
