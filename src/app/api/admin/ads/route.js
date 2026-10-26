// Ad management API for the owner. Protected by the ADS_ADMIN_KEY environment variable (sent as the x-admin-key header).
// Without that variable set, the whole endpoint is switched off (503). Used by the /admin/ads page; also fine with curl.
//   GET                          → every ad + the last 7 days of stats per ad
//   POST { action:'save', ad }   → create or replace an ad (validated by sanitizeAd)
//   POST { action:'toggle', id, active }
//   POST { action:'delete', id }
import { NextResponse } from 'next/server';
import { createHash, timingSafeEqual } from 'node:crypto';
import { adminDb } from '@/lib/firebaseAdmin';
import { adsCol } from '@/lib/adsServer.js';
import { sanitizeAd, isAdId, todayKey } from '@/lib/adsCore.js';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const sha = (v) => createHash('sha256').update(String(v)).digest();
const bad = new Map();
const ipOf = (req) => String(req.headers.get('x-forwarded-for') || 'local').split(',')[0].trim();
const tooMany = (ip) => { const now = Date.now(); const a = (bad.get(ip) || []).filter((t) => now - t < 600_000); bad.set(ip, a); return a.length >= 10; };

function guard(req) {
  const key = process.env.ADS_ADMIN_KEY;
  if (!key || key.length < 16) return NextResponse.json({ error: 'Ad admin is not enabled. Set ADS_ADMIN_KEY (16+ characters).' }, { status: 503 });
  const ip = ipOf(req);
  if (tooMany(ip)) return NextResponse.json({ error: 'Too many wrong keys. Try again in 10 minutes.' }, { status: 429 });
  const given = req.headers.get('x-admin-key') || '';
  if (!timingSafeEqual(sha(given), sha(key))) { bad.set(ip, [...(bad.get(ip) || []), Date.now()]); return NextResponse.json({ error: 'Wrong admin key.' }, { status: 401 }); }
  return null;
}

export async function GET(req) {
  const denied = guard(req); if (denied) return denied;
  try {
    const db = adminDb();
    const ads = (await adsCol(db).get()).docs.map((d) => ({ ...d.data(), id: d.id })).sort((a, b) => String(b.end).localeCompare(String(a.end)));
    const from = todayKey(Date.now() - 6 * 86_400_000);
    const stats = {};
    for (const d of (await db.collection('adStats').where('day', '>=', from).get()).docs) {
      const x = d.data(); const s = (stats[x.adId] ||= { impressions: 0, clicks: 0, rewarded: 0 });
      s.impressions += x.impressions || 0; s.clicks += x.clicks || 0; s.rewarded += x.rewarded || 0;
    }
    return NextResponse.json({ ads, stats, today: todayKey() });
  } catch (e) { console.error('ads admin', e); return NextResponse.json({ error: 'Server error' }, { status: 500 }); }
}

export async function POST(req) {
  const denied = guard(req); if (denied) return denied;
  try {
    const body = await req.json().catch(() => ({}));
    const db = adminDb();
    if (body.action === 'save') {
      const r = sanitizeAd(body.ad);
      if (!r.ok) return NextResponse.json({ error: r.errors.join('; ') }, { status: 400 });
      const ref = adsCol(db).doc(r.ad.id); const old = await ref.get(); const now = Date.now();
      await ref.set({ ...r.ad, createdAt: old.exists ? old.data().createdAt || now : now, updatedAt: now });
      return NextResponse.json({ ok: true, ad: r.ad });
    }
    const id = String(body.id || '').toLowerCase();
    if (!isAdId(id)) return NextResponse.json({ error: 'Bad ad id' }, { status: 400 });
    if (body.action === 'toggle') { await adsCol(db).doc(id).update({ active: !!body.active, updatedAt: Date.now() }); return NextResponse.json({ ok: true }); }
    if (body.action === 'delete') { await adsCol(db).doc(id).delete(); return NextResponse.json({ ok: true }); }
    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (e) { console.error('ads admin', e); return NextResponse.json({ error: 'Server error' }, { status: 500 }); }
}
