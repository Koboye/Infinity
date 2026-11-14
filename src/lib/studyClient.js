// Phone side of the study ledger and reminders. The server owns every number; this only asks and shows.
import { auth } from './firebase';

async function call(path, body) {
  const u = auth?.currentUser;
  if (!u) throw new Error('Sign in first.');
  const token = await u.getIdToken();
  const res = await fetch(path, { method: body ? 'POST' : 'GET', headers: { Authorization: 'Bearer ' + token, ...(body ? { 'Content-Type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined, cache: 'no-store' });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(j.error || 'Something went wrong.');
  return j;
}
export const fetchStudy = () => call('/api/study');
export const reportSession = (r) => call('/api/study', r);
export const fetchBoard = (kind) => call('/api/study?board=' + kind);
export const pushState = () => call('/api/push');
export const pushSubscribe = (sub, lang) => call('/api/push', { action: 'subscribe', sub, lang });
export const pushUnsubscribe = () => call('/api/push', { action: 'unsubscribe' });

/** The one-line study-to-play status shown on Home and above the games. Empty when the paywall is off (levels are free anyway). */
export function bonusLine(t, server) {
  if (!server?.paywall) return '';
  const b = server.bonus || {};
  if (b.left > 0) return t('bonusLeft', { n: b.left });
  if (b.granted) return t('bonusDone');
  return t('bonusEarn', { n: b.goal, m: b.levels });
}
