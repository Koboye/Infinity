import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/firebase-admin';
import { rateLimit, clientIp } from '@/lib/rate-limit';
import { callWorker } from '@/lib/dimts/worker';
import { fail } from '@/lib/dimts/http';

// "Speak in a voice": ~10 s sample + Amharic text -> audio in that voice. Consent is mandatory.
export async function POST(req) {
  try {
    const { uid } = await requireAuth(req);
    const rl = await rateLimit(`dimts-voice:${uid}:${clientIp(req)}`, 20, 60 * 60);
    if (!rl.allowed) return NextResponse.json({ error: 'Too many voice requests. Try again later.' }, { status: 429 });

    const inForm = await req.formData();
    const sample = inForm.get('sample'); const text = String(inForm.get('text') || '').trim();
    if (inForm.get('consent') !== 'true') return NextResponse.json({ error: 'Confirm you have permission to use this voice.' }, { status: 400 });
    if (!(sample instanceof Blob) || sample.size > 8_000_000) return NextResponse.json({ error: 'A voice sample under 8 MB is required.' }, { status: 400 });
    if (!text || text.length > 600) return NextResponse.json({ error: 'Text must be 1-600 characters.' }, { status: 400 });

    const form = new FormData(); form.append('sample', sample, 'sample.webm'); form.append('text', text);
    const r = await callWorker('/speak', { form, timeoutMs: 180000, raw: true });
    if (!r.ok) return NextResponse.json({ error: (await r.json().catch(() => ({}))).error || 'Voice generation failed.' }, { status: 502 });
    return new Response(r.body, { headers: { 'Content-Type': 'audio/wav', 'Cache-Control': 'no-store' } });
  } catch (e) { return fail(e); }
}
