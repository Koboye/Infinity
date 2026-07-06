import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/firebase-admin';
import { rateLimit, clientIp } from '@/lib/rate-limit';

// Keeps the OpenAI key server-side (it was never exposed to the client, but this route also
// didn't exist at all before — the "AI Caption" button was decorative). Auth-gated and rate
// limited since every call costs real money against the OpenAI account.
export async function POST(req) {
  try {
    const decoded = await requireAuth(req);
    const ip = clientIp(req);
    const rl = await rateLimit(`ai-caption:${decoded.uid}:${ip}`, 15, 60 * 60);
    if (!rl.allowed) {
      return NextResponse.json({ error: 'Too many caption requests. Try again later.' }, { status: 429 });
    }

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ error: 'AI captions are not configured on this server.' }, { status: 503 });
    }

    const { imageUrl, hint } = await req.json();
    if (!imageUrl || typeof imageUrl !== 'string') {
      return NextResponse.json({ error: 'imageUrl is required' }, { status: 400 });
    }

    const content = [
      { type: 'text', text: `Write 3 short, catchy social media captions (each under 20 words, no numbering, one per line) for this photo.${hint ? ` Context from the user: ${String(hint).slice(0, 200)}` : ''}` },
      { type: 'image_url', image_url: { url: imageUrl } },
    ];

    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content }],
        max_tokens: 150,
        temperature: 0.9,
      }),
    });

    if (!res.ok) {
      console.error('AI caption error', res.status, await res.text());
      return NextResponse.json({ error: 'Failed to generate caption' }, { status: 502 });
    }

    const data = await res.json();
    const text = data.choices?.[0]?.message?.content || '';
    const captions = text.split('\n').map(s => s.replace(/^[-*\d.)\s]+/, '').trim()).filter(Boolean).slice(0, 3);

    return NextResponse.json({ ok: true, captions });
  } catch (e) {
    console.error('ai/caption error:', e);
    return NextResponse.json({ error: e.message || 'Internal error' }, { status: e.status || 500 });
  }
}
