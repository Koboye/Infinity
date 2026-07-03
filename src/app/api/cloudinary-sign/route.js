import { NextResponse } from 'next/server';
import { createHash } from 'crypto';
import { requireAuth } from '@/lib/firebase-admin';
import { rateLimit, clientIp } from '@/lib/rate-limit';

// Signs Cloudinary upload requests server-side so the client never needs an
// unsigned preset or the API secret. Auth-gated + rate-limited since every
// signature is effectively a one-time permission slip to upload a file.
export async function POST(req) {
  try {
    const decoded = await requireAuth(req);
    const ip = clientIp(req);
    const rl = await rateLimit(`cloudinary-sign:${decoded.uid}:${ip}`, 60, 60 * 60);
    if (!rl.allowed) {
      return NextResponse.json({ error: 'Too many upload requests. Try again later.' }, { status: 429 });
    }

    if (!process.env.CLOUDINARY_API_SECRET || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_CLOUD_NAME) {
      return NextResponse.json({ error: 'Uploads are not configured on this server.' }, { status: 503 });
    }

    const timestamp = Math.round(Date.now() / 1000);
    const paramsToSign = `timestamp=${timestamp}`;
    const signature = createHash('sha1').update(paramsToSign + process.env.CLOUDINARY_API_SECRET).digest('hex');

    return NextResponse.json({
      signature,
      timestamp,
      apiKey: process.env.CLOUDINARY_API_KEY,
      cloudName: process.env.CLOUDINARY_CLOUD_NAME,
    });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: e.status || 500 });
  }
}
