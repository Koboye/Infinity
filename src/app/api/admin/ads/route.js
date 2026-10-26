// Ad management API for the owner. Protected by the ADS_ADMIN_KEY environment variable (sent as the x-admin-key header).
// Without that variable set, the whole endpoint is switched off (503). Used by the /admin/ads page; also fine with curl.
//   GET                          → every ad + the last 7 days of stats per ad
//   POST { action:'save', ad }   → create or replace an ad (validated by sanitizeAd)
//   POST { action:'toggle', id, active }
//   POST { action:'delete', id }
import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebaseAdmin';
import { adsCol } from '@/lib/adsServer.js';
import { sanitizeAd, isAdId, todayKey } from '@/lib/adsCore.js';
import { guard } from '@/lib/adsAdminGuard.js';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req) {
  const denied = guard(req); if (denied) return denied;
  try {
    const db = adminDb();
    const ads = (await adsCol(db).get()).docs.map((d) => ({ ...d.data(), id: d.id })).sort((a, b) => String(b.end).localeCompare(String(a.end)));
    const from = todayKey(Date.now() - 6 * 86_400_000);
    const stats = {};
    for (const d of (await db.collection('adStats').where('day', '>=', from).get()).docs) {
      const x = d.data(); const s = (stats[x.adId] ||= { impressions: 0, clicks: 0, rewarded: 0, today: 0 });
      s.impressions += x.impressions || 0; s.clicks += x.clicks || 0; s.rewarded += x.rewarded || 0;
      if (x.day === todayKey()) s.today += (x.impressions || 0) + (x.rewarded || 0);   // delivered today, compared with the ad's daily cap
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
