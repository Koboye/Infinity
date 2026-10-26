// Ad management API for the owner. Protected by the ADS_ADMIN_KEY environment variable (sent as the x-admin-key header).
// Without that variable set, the whole endpoint is switched off (503). Used by the /admin/ads page; also fine with curl.
//   GET                          → every ad + the last 7 days of stats per ad
//   GET ?report=csv[&ad=ID][&days=30] → daily delivery report as CSV (impressions, taps, tap rate, rewarded) to send to an advertiser
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
    const q = new URL(req.url, 'http://x').searchParams;
    if (q.get('report') === 'csv') {
      const days = Math.min(90, Math.max(1, Math.round(Number(q.get('days'))) || 30)), only = String(q.get('ad') || '').toLowerCase();
      if (only && !isAdId(only)) return NextResponse.json({ error: 'Bad ad id' }, { status: 400 });
      const rows = (await db.collection('adStats').where('day', '>=', todayKey(Date.now() - (days - 1) * 86_400_000)).get()).docs.map((d) => d.data())
        .filter((x) => x.adId && (!only || x.adId === only)).sort((a, b) => `${a.adId}${a.day}`.localeCompare(`${b.adId}${b.day}`));
      const esc = (v) => (/^[=+\-@]/.test(String(v)) ? `'${v}` : String(v));   // spreadsheet formula injection guard
      const csv = ['ad,day,impressions,taps,tap_rate_percent,rewarded_views', ...rows.map((x) => {
        const i = x.impressions || 0, c = x.clicks || 0;
        return [esc(x.adId), x.day, i, c, i ? (c / i * 100).toFixed(2) : '0.00', x.rewarded || 0].join(',');
      })].join('\n') + '\n';
      return new NextResponse(csv, { headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="ads-report${only ? `-${only}` : ''}.csv"`, 'Cache-Control': 'no-store' } });
    }
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
