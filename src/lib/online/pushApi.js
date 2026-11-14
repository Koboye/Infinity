// Daily study reminder by web push. pushSubs/{uid} = { sub, lang, enabled, lastSent }.
// Sent by /api/cron/remind once a day to learners who have not reached the daily goal yet. Off until the VAPID keys are set.
import * as webpush from 'web-push';
import { passDay } from '../passCore.js';
import { liveStreakOf, BONUS_GOAL } from '../studyCore.js';

export const pushConfigured = (env = process.env) => !!(env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY);
const subRef = (db, uid) => db.collection('pushSubs').doc(uid);

export async function pushState(db, uid) {
  const s = await subRef(db, uid).get();
  return { supported: pushConfigured(), publicKey: pushConfigured() ? process.env.VAPID_PUBLIC_KEY : '', enabled: !!(s.exists && s.data().enabled) };
}
export async function pushSubscribe(db, uid, sub, lang) {
  const ok = sub && typeof sub.endpoint === 'string' && /^https:\/\//.test(sub.endpoint) && sub.endpoint.length < 600 && sub.keys && typeof sub.keys.p256dh === 'string' && typeof sub.keys.auth === 'string';
  if (!ok) { const e = new Error('Invalid subscription'); e.status = 400; throw e; }
  await subRef(db, uid).set({ sub: { endpoint: sub.endpoint, keys: { p256dh: sub.keys.p256dh, auth: sub.keys.auth } }, lang: lang === 'am' ? 'am' : 'en', enabled: true, lastSent: '' });
  return pushState(db, uid);
}
export async function pushUnsubscribe(db, uid) { await subRef(db, uid).delete(); return pushState(db, uid); }

export const reminderText = (lang, streak) => (lang === 'am'
  ? { title: 'Infinity', body: streak ? `የ${streak} ቀን ተከታታይዎን ያቆዩ — አንድ ፈጣን ዙር ብቻ!` : 'ዛሬ ጥቂት ጥያቄዎችን ይመልሱ — ተከታታይዎን ይጀምሩ!' }
  : { title: 'Infinity', body: streak ? `Keep your ${streak}-day streak alive — one quick round!` : 'Answer a few questions today and start a streak!' });

/** Send today's reminder to everyone who enabled it and has not yet answered BONUS_GOAL questions today. */
export async function sendReminders(db, now = Date.now(), send = (sub, payload) => webpush.sendNotification(sub, payload)) {
  if (!pushConfigured()) return { skipped: 'not-configured' };
  webpush.setVapidDetails(process.env.VAPID_SUBJECT || 'mailto:admin@infinity.app', process.env.VAPID_PUBLIC_KEY, process.env.VAPID_PRIVATE_KEY);
  const today = passDay(now), snap = await db.collection('pushSubs').where('enabled', '==', true).limit(500).get();
  let sent = 0, dropped = 0, skipped = 0;
  for (const d of snap.docs) {
    const p = d.data();
    if (p.lastSent === today) { skipped++; continue; }
    const st = await db.collection('studyStats').doc(d.id).get(), r = st.exists ? st.data() : null;
    if (r && r.day === today && (r.dayAnswered || 0) >= BONUS_GOAL) { skipped++; continue; }
    try {
      await send(p.sub, JSON.stringify({ ...reminderText(p.lang, liveStreakOf(r, now)), url: '/' }));
      await d.ref.set({ ...p, lastSent: today }); sent++;
    } catch (e) {
      if (e && (e.statusCode === 404 || e.statusCode === 410)) { await d.ref.delete(); dropped++; }
    }
  }
  return { sent, dropped, skipped };
}
