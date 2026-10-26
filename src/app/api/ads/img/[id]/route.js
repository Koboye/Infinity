// Public: serves an uploaded ad picture. The id is random and unguessable (24 hex), the content never changes for an id,
// so browsers and the CDN may keep it for a year.
import { adminDb } from '@/lib/firebaseAdmin';
import { AD_IMG_ID } from '@/lib/adImageCore.js';

export const runtime = 'nodejs';

export async function GET(_req, { params }) {
  const { id } = await params;
  if (!AD_IMG_ID.test(String(id || ''))) return new Response('Not found', { status: 404 });
  try {
    const snap = await adminDb().collection('adImages').doc(id).get();
    if (!snap.exists) return new Response('Not found', { status: 404 });
    const { mime, data } = snap.data();
    return new Response(Buffer.from(data), { headers: { 'Content-Type': mime, 'Cache-Control': 'public, max-age=31536000, immutable', 'X-Content-Type-Options': 'nosniff' } });
  } catch (e) { console.error('ad image read', e?.message); return new Response('Server error', { status: 500 }); }
}
