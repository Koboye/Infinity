// src/app/api/upload/route.ts
// Signed Cloudinary upload — the secret never leaves the server.
import { NextResponse } from 'next/server';
import { requireUser, AuthError } from '@/lib/firebase/admin';
import { rateLimit } from '@/lib/utils/rateLimit';
import crypto from 'crypto';

export async function POST(request: Request) {
  try {
    const { uid } = await requireUser(request);

    const { ok } = await rateLimit(`upload:${uid}`, 20, 10 * 60_000);
    if (!ok) return NextResponse.json({ error: 'Too many uploads' }, { status: 429 });

    const cloudName  = process.env.CLOUDINARY_CLOUD_NAME;
    const apiKey     = process.env.CLOUDINARY_API_KEY;
    const apiSecret  = process.env.CLOUDINARY_API_SECRET;
    if (!cloudName || !apiKey || !apiSecret) {
      return NextResponse.json({ error: 'Cloudinary not configured' }, { status: 500 });
    }

    const timestamp  = Math.floor(Date.now() / 1000).toString();
    const folder     = `infinity/users/${uid}`;
    // Sign: folder + timestamp + secret  (alphabetical param order required by Cloudinary)
    const toSign     = `folder=${folder}&timestamp=${timestamp}${apiSecret}`;
    const signature  = crypto.createHash('sha256').update(toSign).digest('hex');

    return NextResponse.json({ timestamp, signature, apiKey, cloudName, folder });
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    console.error('upload sign error', err);
    return NextResponse.json({ error: 'Failed to sign upload' }, { status: 500 });
  }
}
