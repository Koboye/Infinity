import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/firebase-admin';
import { rateLimit, clientIp } from '@/lib/rate-limit';

// Keeps the Gemini key server-side. Auth-gated and rate limited since every call
// costs quota against the Gemini account (free tier, but still rate-limited).
//
// Unlike OpenAI, Gemini doesn't fetch a remote image_url itself — it needs the
// actual image bytes sent inline as base64. So this route fetches the image
// server-side first, then sends the bytes to Gemini.
const GEMINI_MODEL = 'gemini-2.5-flash';

export async function POST(req) {
  try {
    const decoded = await requireAuth(req);
    const ip = clientIp(req);
    const rl = await rateLimit(`ai-caption:${decoded.uid}:${ip}`, 15, 60 * 60);
    if (!rl.allowed) {
      return NextResponse.json({ error: 'Too many caption requests. Try again later.' }, { status: 429 });
    }

    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json({ error: 'AI captions are not configured on this server.' }, { status: 503 });
    }

    const { imageUrl, hint } = await req.json();
    if (!imageUrl || typeof imageUrl !== 'string') {
      return NextResponse.json({ error: 'imageUrl is required' }, { status: 400 });
    }
    if (!/^https:\/\//i.test(imageUrl)) {
      return NextResponse.json(
        { error: 'imageUrl must be a public https URL.' },
        { status: 400 }
      );
    }

    // Fetch the image ourselves and convert to base64, since Gemini needs inline bytes.
    const imgRes = await fetch(imageUrl);
    if (!imgRes.ok) {
      console.error('AI caption: failed to fetch source image', imgRes.status);
      return NextResponse.json({ error: 'Could not fetch the image to caption.' }, { status: 400 });
    }
    const mimeType = imgRes.headers.get('content-type') || 'image/jpeg';
    const buf = Buffer.from(await imgRes.arrayBuffer());
    // Keep a sane cap so we don't send huge payloads to Gemini or blow past its request size limit.
    if (buf.length > 15 * 1024 * 1024) {
      return NextResponse.json({ error: 'Image is too large to caption (max 15MB).' }, { status: 400 });
    }
    const base64Data = buf.toString('base64');

    const prompt = `Write 3 short, catchy social media captions (each under 20 words, no numbering, one per line) for this photo.${hint ? ` Context from the user: ${String(hint).slice(0, 200)}` : ''}`;

    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                { text: prompt },
                { inline_data: { mime_type: mimeType, data: base64Data } },
              ],
            },
          ],
          generationConfig: { temperature: 0.9, maxOutputTokens: 200 },
        }),
      }
    );

    if (!res.ok) {
      const errBody = await res.text();
      console.error('AI caption error', res.status, errBody);
      let reason = errBody;
      try { reason = JSON.parse(errBody)?.error?.message || errBody; } catch {}
      return NextResponse.json(
        { error: 'Failed to generate caption', detail: String(reason).slice(0, 300) },
        { status: 502 }
      );
    }

    const data = await res.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    const captions = text.split('\n').map(s => s.replace(/^[-*\d.)\s]+/, '').trim()).filter(Boolean).slice(0, 3);

    return NextResponse.json({ ok: true, captions });
  } catch (e) {
    console.error('ai/caption error:', e);
    return NextResponse.json({ error: e.message || 'Internal error' }, { status: e.status || 500 });
  }
}
