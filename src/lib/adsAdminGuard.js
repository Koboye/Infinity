// Shared by every admin ads endpoint: the ADS_ADMIN_KEY check with a 10-wrong-keys-per-10-minutes lockout.
import { NextResponse } from 'next/server';
import { createHash, timingSafeEqual } from 'node:crypto';

const sha = (v) => createHash('sha256').update(String(v)).digest();
const bad = new Map();
const ipOf = (req) => String(req.headers.get('x-forwarded-for') || 'local').split(',')[0].trim();
const tooMany = (ip) => { const now = Date.now(); const a = (bad.get(ip) || []).filter((t) => now - t < 600_000); bad.set(ip, a); return a.length >= 10; };

export function guard(req) {
  const key = process.env.ADS_ADMIN_KEY;
  if (!key || key.length < 16) return NextResponse.json({ error: 'Ad admin is not enabled. Set ADS_ADMIN_KEY (16+ characters).' }, { status: 503 });
  const ip = ipOf(req);
  if (tooMany(ip)) return NextResponse.json({ error: 'Too many wrong keys. Try again in 10 minutes.' }, { status: 429 });
  const given = req.headers.get('x-admin-key') || '';
  if (!timingSafeEqual(sha(given), sha(key))) { bad.set(ip, [...(bad.get(ip) || []), Date.now()]); return NextResponse.json({ error: 'Wrong admin key.' }, { status: 401 }); }
  return null;
}
