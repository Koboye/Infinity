import { NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/firebase/admin';
import { rateLimit } from '@/lib/utils/rateLimit';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: videoId } = await params;
    // Rate-limit by IP to prevent share-count inflation
    const ip =
      request.headers.get('cf-connecting-ip') ??
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
      'unknown';
    const { ok } = await rateLimit(`share:${ip}:${videoId}`, 3, 60_000);
    if (!ok) return NextResponse.json({ counted: false });
    await adminDb().collection('videos').doc(videoId).update({ shares: FieldValue.increment(1) });
    return NextResponse.json({ counted: true });
  } catch (err) {
    console.error('register share error', err);
    return NextResponse.json({ counted: false });
  }
}
