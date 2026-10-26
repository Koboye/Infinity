// Server-only ad helpers (Firestore via the Admin SDK). The client can never read or write these collections:
//   ads/{id}               the ads themselves (written by the admin API, read here)
//   adStats/{id}_{day}     counters: impressions, clicks, rewarded (written here with atomic increments)
//   adSessions/{uid}       the one rewarded ad a player is currently watching (proof that it ran its full length)
import { FieldValue } from 'firebase-admin/firestore';
import { isLive, todayKey } from './adsCore.js';
import { paceFactor } from './adsSmart.js';

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

/**
 * Live ads with what the smart layer needs: last-7-days performance `perf` { i: impressions, c: taps }, today's delivery `used`,
 * and `pace`. Ads that reached their `dailyCap` today are left out. If the stats cannot be read the ads are still returned
 * (without caps or learning): stats must never switch ads off.
 */
export async function servableAds(db, now = Date.now()) {
  const ads = await liveAds(db, now);
  const perf = {}, used = {};
  try {
    const today = todayKey(now), from = todayKey(now - 6 * 86_400_000);
    for (const d of (await db.collection('adStats').where('day', '>=', from).get()).docs) {
      const x = d.data(); if (!x.adId) continue;
      const p = (perf[x.adId] ||= { i: 0, c: 0 }); p.i += x.impressions || 0; p.c += x.clicks || 0;
      if (x.day === today) used[x.adId] = (x.impressions || 0) + (x.rewarded || 0);
    }
  } catch (e) { console.error('ad stats read failed', e?.message); }
  return ads
    .filter((a) => !(a.dailyCap > 0 && (used[a.id] || 0) >= a.dailyCap))
    .map((a) => ({ ...a, perf: perf[a.id] || { i: 0, c: 0 }, used: used[a.id] || 0, pace: paceFactor(used[a.id] || 0, a.dailyCap || 0, now) }));
}
