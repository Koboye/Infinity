// Public ad endpoint. GET: the ads a phone may show on open / before a game (rewarded ads are only handed out by the
// signed-in /api/gebeta `adStart` action, which also times them). POST: impression / click counters.
// Neither can ever break the app: any failure answers with an empty list or a quiet ok.
import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebaseAdmin';
import { servableAds, bump, adsCol } from '@/lib/adsServer.js';
import { publicAd, isAdId } from '@/lib/adsCore.js';
import { makeGlobalGuard } from '@/lib/upstashGuard.js';
import { secretOf, signToken, verifyToken, claimToken } from '@/lib/adsTrust.js';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const hits = new Map();
function limited(ip, max = 60, windowMs = 60_000) {
  const now = Date.now();
  const arr = (hits.get(ip) || []).filter((t) => now - t < windowMs); arr.push(now); hits.set(ip, arr);
  if (hits.size > 5000) for (const [k, v] of hits) if (!v.length || now - v[v.length - 1] > windowMs) hits.delete(k);
  return arr.length > max;
}
const ipOf = (req) => String(req.headers.get('x-forwarded-for') || 'local').split(',')[0].trim();

export async function GET(req) {
  let fresh = false; try { fresh = new URL(req.url, 'http://x').searchParams.has('fresh'); } catch { /* called without a request */ }   // owner test mode: never cached
  try {
    const ads = (await servableAds(adminDb()))
      .map((a) => ({
        ...publicAd(a, 'splash'), start: a.start, end: a.end,   // v78: the phone re-checks the dates (an ad that ends while the feed is cached) — without them every paid ad was dropped and only the house ad ever showed
        placements: (a.placements || []).filter((p) => p !== 'rewarded'), weight: a.weight || 1,
        t: { langs: a.langs || [], games: a.games || [], hours: a.hours || null, maxPerUser: a.maxPerUser || 3 },   // targeting the phone applies
        createdAt: a.createdAt || 0, perf: a.perf, pace: Math.round(a.pace * 100) / 100,                                                      // learning + pacing the phone ranks with
      }))
      .filter((a) => a.placements.length);
    return NextResponse.json({ ads }, { headers: { 'Cache-Control': fresh ? 'no-store' : 'public, s-maxage=10, stale-while-revalidate=30' } });
  } catch (e) {
    return NextResponse.json({ ads: [] }, { headers: { 'Cache-Control': 'public, s-maxage=15' } }); // no Firebase configured / Firestore hiccup: show no ads
  }
}

const allow = makeGlobalGuard();
const EVENTS = { impression: 'impressions', click: 'clicks' };
export async function POST(req) {
  try {
    if (limited(ipOf(req))) return NextResponse.json({ ok: true });
    const body = await req.json().catch(() => ({}));
    const field = EVENTS[body.event]; const adId = String(body.adId || '').toLowerCase();
    if (!field || !isAdId(adId)) return NextResponse.json({ ok: true });
    if (!(await allow(body.event, ipOf(req), adId))) return NextResponse.json({ ok: true }); // over the per-address limit: ignored quietly
    const db = adminDb(); const secret = secretOf();
    if (!(await adsCol(db).doc(adId).get()).exists) return NextResponse.json({ ok: true });   // only real ads are counted
    if (field === 'clicks' && secret) {                                                     // v65: a tap counts only with a valid, unspent token for this ad
      const v = verifyToken(secret, body.token, adId);
      if (!v.ok || !(await claimToken(db, v.nonce, adId))) return NextResponse.json({ ok: true });
    }
    await bump(db, adId, field);
    if (field === 'impressions' && secret) return NextResponse.json({ ok: true, token: signToken(secret, adId) });
  } catch { /* stats are best effort */ }
  return NextResponse.json({ ok: true });
}
