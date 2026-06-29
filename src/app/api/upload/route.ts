import { NextResponse } from 'next/server';
import { requireUser, AuthError } from '@/lib/firebase/admin';
import { rateLimit } from '@/lib/utils/rateLimit';
import crypto from 'crypto';

export async function POST(request: Request) {
  try {
    const { uid } = await requireUser(request);

    const { ok } = await rateLimit(`upload:${uid}`, 20, 10 * 60_000);
    if (!ok) return NextResponse.json({ error: 'Too many uploads' }, { status: 429 });

    const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
    const apiKey    = process.env.CLOUDINARY_API_KEY;
    const apiSecret = process.env.CLOUDINARY_API_SECRET;

    if (!cloudName || !apiKey || !apiSecret) {
      console.error('[upload] Missing Cloudinary env vars:', {
        cloudName: !!cloudName,
        apiKey: !!apiKey,
        apiSecret: !!apiSecret,
      });
      return NextResponse.json({ error: 'Cloudinary not configured' }, { status: 500 });
    }

    const timestamp = Math.floor(Date.now() / 1000).toString();
    const folder    = `infinity/users/${uid}`;

    // Cloudinary signed upload: params MUST be sorted alphabetically,
    // joined with &, then the API secret is appended with NO separator.
    // Only include params you will actually send in the FormData.
    const paramsToSign = [
      `folder=${folder}`,
      `timestamp=${timestamp}`,
    ].sort().join('&');          // sort() is a no-op here (f < t) but is required by spec

    const signature = crypto
      .createHash('sha1')
      .update(`${paramsToSign}${apiSecret}`)
      .digest('hex');

    return NextResponse.json({ timestamp, signature, apiKey, cloudName, folder });
  } catch (err) {
    if (err instanceof AuthError) {
      console.error('[upload] AuthError:', err.message);
      return NextResponse.json({ error: 'Unauthorized', detail: err.message }, { status: 401 });
    }
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[upload] error:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
