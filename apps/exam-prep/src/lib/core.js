// Pure rules of the app: money, subscription time, question checks and the duplicate test. No I/O here, so it is easy to test.
import { isDept } from '@/data/departments.js';

export const PRICE_ETB = 15;                       // one month
export const MONTH_MS = 30 * 86_400_000;
export const CREDIT_BATCH = 15;                    // approved questions that earn one free month
export const MAX_AHEAD_MS = 90 * 86_400_000;       // free months from contributions never run more than 90 days ahead
export const PREVIEW_COUNT = 5;                    // questions per department a non-subscriber can try
export const PENDING_CAP = 30;                     // unreviewed questions one person may have waiting
export const SIMILARITY = 0.6;                     // word-triple overlap at which a new question counts as already available

/** Subscription state from the stored `until` (ms since epoch). */
export const subState = (until, now = Date.now()) => ({ subscribed: Number(until) > now, until: Number(until) || 0, daysLeft: Math.max(0, Math.ceil(((Number(until) || 0) - now) / 86_400_000)) });

/** A month more, stacked after any time that is still left. `capAhead` limits how far ahead the result may be. */
export function extendUntil(until, now = Date.now(), months = 1, capAhead = false) {
  const base = Math.max(Number(until) || 0, now);
  const next = base + months * MONTH_MS;
  return capAhead ? Math.max(Number(until) || 0, Math.min(next, now + MAX_AHEAD_MS)) : next;
}

/** Ethiopian mobile number -> 09XXXXXXXX / 07XXXXXXXX, or '' when it is not one. */
export function cleanPhone(raw) {
  let d = String(raw || '').replace(/\D/g, '');
  if (d.startsWith('251') && d.length === 12) d = `0${d.slice(3)}`;
  else if (d.length === 9 && /^[79]/.test(d)) d = `0${d}`;
  return /^0[79]\d{8}$/.test(d) ? d : '';
}

// ── text checks
export const norm = (s) => String(s ?? '').normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim();
export function shingles(s, k = 3) {
  const w = norm(s).split(' ').filter(Boolean), out = new Set();
  if (w.length <= k) { out.add(w.join(' ')); return out; }
  for (let i = 0; i + k <= w.length; i++) out.add(w.slice(i, i + k).join(' '));
  return out;
}
export function jaccard(a, b) {
  if (!a.size || !b.size) return 0;
  let inter = 0; for (const x of a) if (b.has(x)) inter++;
  return inter / (a.size + b.size - inter);
}
// Options and numbers keep their symbols: "A + B" and "A - B", or x^3 and x^4, are different things.
const keep = (s) => String(s ?? '').normalize('NFKC').toLowerCase().replace(/\s+/g, ' ').trim();
const sig = (s) => (String(s ?? '').normalize('NFKC').match(/\d+(?:\.\d+)?|[+\-*/^=<>%]/g) || []).join(' ');
const optionKey = (q) => [...q.options].map(keep).sort().join('|');

/** The first question in `pool` that `q` repeats (same wording, near-same wording, or the same answer set), or null. */
export function findDuplicate(q, pool, threshold = SIMILARITY) {
  const exact = keep(q.text), sh = shingles(q.text), sg = sig(q.text), ok = optionKey(q), right = keep(q.options[q.answer]);
  for (const p of pool) {
    if (keep(p.text) === exact) return { id: p.id, why: 'same question' };
    if (sig(p.text) === sg && jaccard(sh, shingles(p.text)) >= threshold) return { id: p.id, why: 'almost the same wording' }; // different numbers = a different question
    if (optionKey(p) === ok && keep(p.options[p.answer]) === right) return { id: p.id, why: 'same options and answer' };
  }
  return null;
}

/** Check one submitted question. { ok:true, q } with trimmed fields, or { ok:false, error }. */
export function cleanQuestion(raw, dept) {
  if (!isDept(dept)) return { ok: false, error: 'Unknown department' };
  const r = raw && typeof raw === 'object' ? raw : {};
  const text = String(r.text ?? '').trim(), explanation = String(r.explanation ?? '').trim(), topic = String(r.topic ?? '').trim().slice(0, 60);
  const options = Array.isArray(r.options) ? r.options.map((o) => String(o ?? '').trim()) : [];
  const answer = Number(r.answer);
  if (text.length < 15 || text.length > 600) return { ok: false, error: 'The question must be 15 to 600 characters' };
  if (options.length !== 4 || options.some((o) => !o || o.length > 200)) return { ok: false, error: 'Give exactly 4 options, each up to 200 characters' };
  if (new Set(options.map(keep)).size !== 4) return { ok: false, error: 'The 4 options must all be different' };
  if (!Number.isInteger(answer) || answer < 0 || answer > 3) return { ok: false, error: 'Mark which option is correct' };
  if (explanation.length < 20 || explanation.length > 1000) return { ok: false, error: 'Explain the answer in 20 to 1000 characters' };
  return { ok: true, q: { dept, text, options, answer, explanation, topic } };
}
