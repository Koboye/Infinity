import { NextResponse } from 'next/server';
import { generateSmartCaption } from '@/lib/ai/captions';
import { requireUser, AuthError } from '@/lib/firebase/admin';
import { rateLimit } from '@/lib/utils/rateLimit';

export async function POST(request: Request) {
  try {
    const { uid } = await requireUser(request);

    const { ok } = rateLimit(`smart-caption:${uid}`, 10, 60_000);
    if (!ok) return NextResponse.json({ error: 'Slow down — try again in a moment.' }, { status: 429 });

    const body = await request.json().catch(() => null) as { input?: string } | null;
    const input = body?.input?.trim();
    if (!input) return NextResponse.json({ error: 'Missing input' }, { status: 400 });
    if (input.length > 1000) return NextResponse.json({ error: 'Input too long' }, { status: 400 });

    const result = await generateSmartCaption(input);
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    console.error('smart-caption error', err);
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 });
  }
}
