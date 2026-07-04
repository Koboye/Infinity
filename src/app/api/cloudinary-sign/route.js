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

    // Cloudinary requires every non-file param the client will actually upload with
    // (upload_preset, folder, etc.) to be included in the signed string, sorted
    // alphabetically by key. Previously this only ever signed `timestamp`, so any
    // upload that also sent `upload_preset` failed with "Invalid Signature" because
    // the string Cloudinary reconstructed didn't match what we signed here. The client
    // now tells us which extra params it intends to send, and we sign exactly that set.
    let extraParams = {};
    try {
      const body = await req.json();
      if (body && typeof body.params === 'object' && body.params !== null) {
        extraParams = body.params;
      }
    } catch {
      // No JSON body (or empty body) — fine, just sign the timestamp alone.
    }

    const timestamp = Math.round(Date.now() / 1000);
    const allParams = { ...extraParams, timestamp };
    const paramsToSign = Object.keys(allParams)
      .sort()
      .map(key => `${key}=${allParams[key]}`)
      .join('&');
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
