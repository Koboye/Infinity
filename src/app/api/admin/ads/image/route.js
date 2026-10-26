// Upload an ad picture (owner only, same ADS_ADMIN_KEY as the rest of the ad manager).
//   POST { dataUrl: "data:image/jpeg;base64,…" }  →  { ok, url, id, kb }
// The picture is re-checked here (type, real file signature, size), kept in Firestore adImages/{id} and served from /api/ads/img/{id}.
// The returned url is an https link on this site: paste-free, and already allowed by the app's Content-Security-Policy.
import { NextResponse } from 'next/server';
import { randomBytes } from 'node:crypto';
import { adminDb } from '@/lib/firebaseAdmin';
import { guard } from '@/lib/adsAdminGuard.js';
import { parseImageDataUrl, AD_IMG_PATH } from '@/lib/adImageCore.js';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const originOf = (req) => {
  const host = req.headers.get('x-forwarded-host') || req.headers.get('host');
  if (host && !/^localhost|^127\./.test(host)) return `https://${host}`;
  return new URL(req.url).origin;
};

export async function POST(req) {
  const denied = guard(req); if (denied) return denied;
  try {
    if (Number(req.headers.get('content-length') || 0) > 1_200_000) return NextResponse.json({ error: 'That picture is too large. Choose a smaller one.' }, { status: 413 });
    const body = await req.json().catch(() => ({}));
    const r = parseImageDataUrl(body.dataUrl);
    if (!r.ok) return NextResponse.json({ error: r.error }, { status: 400 });
    const id = randomBytes(12).toString('hex');   // 24 hex characters; a new id for every upload, so a replaced picture is never served from an old cache
    await adminDb().collection('adImages').doc(id).set({ mime: r.mime, data: r.bytes, size: r.bytes.length, createdAt: Date.now() });
    return NextResponse.json({ ok: true, id, kb: Math.round(r.bytes.length / 1024), url: `${originOf(req)}${AD_IMG_PATH}${id}` });
  } catch (e) { console.error('ad image upload', e); return NextResponse.json({ error: 'Server error while saving the picture.' }, { status: 500 }); }
}
