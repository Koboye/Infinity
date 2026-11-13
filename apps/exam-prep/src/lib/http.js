import { timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
import { adminAuth } from '@/lib/firebaseAdmin';

export class HttpError extends Error { constructor(status, msg) { super(msg); this.status = status; } }
export const fail = (status, msg) => { throw new HttpError(status, msg); };
export const json = (body, status = 200) => NextResponse.json(body, { status });
export const handle = (e) => (e instanceof HttpError ? json({ error: e.message }, e.status) : json({ error: 'Server error' }, 500));

/** The signed-in account behind `Authorization: Bearer <token>`. `revoked` also rejects tokens of reset or disabled accounts. */
export async function userOf(req, { required = true, revoked = false } = {}) {
  const h = req.headers.get('authorization') || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : null;
  if (!token) { if (required) fail(401, 'Sign in first'); return null; }
  try { return (await adminAuth().verifyIdToken(token, revoked)).uid; } catch { fail(401, 'Session expired, sign in again'); }
  return null;
}

const same = (a, b) => { const x = Buffer.from(String(a)), y = Buffer.from(String(b)); return x.length === y.length && timingSafeEqual(x, y); };
/** 'admin' (ADMIN_SECRET: reviews questions and payments) or 'webhook' (WEBHOOK_SECRET: may only confirm payments), or null. Secrets under 24 characters are treated as unset. */
export function secretRole(req, env = process.env) {
  const given = req.headers.get('x-admin-secret') || '';
  if (!given) return null;
  if (env.ADMIN_SECRET && env.ADMIN_SECRET.length >= 24 && same(given, env.ADMIN_SECRET)) return 'admin';
  if (env.WEBHOOK_SECRET && env.WEBHOOK_SECRET.length >= 24 && same(given, env.WEBHOOK_SECRET)) return 'webhook';
  return null;
}

// A small per-instance limiter so one account cannot hammer the API. (Add a shared limiter such as Upstash if you run many instances.)
const hits = new Map();
export function rateLimit(key, max = 60, windowMs = 60_000, now = Date.now()) {
  const h = (hits.get(key) || []).filter((t) => now - t < windowMs);
  if (h.length >= max) fail(429, 'Too many requests, slow down');
  h.push(now); hits.set(key, h);
}
