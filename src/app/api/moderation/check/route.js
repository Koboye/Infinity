import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/firebase-admin';
import { rateLimit, clientIp } from '@/lib/rate-limit';
import { moderateText, HARASSMENT_BLOCK_CATEGORIES } from '@/lib/moderation';

// Runs the same AI moderation used for video posts against arbitrary short text —
// comments and DM messages — which previously went straight to Firestore from the
// client with NO harassment/content check at all. Comments/messages are the single
// biggest surface for one user harassing another, so this was the real gap behind
// "AI harassment detection isn't working": it only ever covered video captions.
//
// Client usage: call this before writing the comment/message; if `blocked` comes back
// true, don't send it and show the reason to the user instead.
const MAX_LEN = 2000;

export async function POST(req) {
  try {
    const decoded = await requireAuth(req);
    const ip = clientIp(req);
    const rl = await rateLimit(`moderation-check:${decoded.uid}:${ip}`, 60, 60);
    if (!rl.allowed) {
      return NextResponse.json({ error: 'Too many requests. Slow down and try again shortly.' }, { status: 429 });
    }

    const { text } = await req.json();
    const clean = typeof text === 'string' ? text.slice(0, MAX_LEN) : '';
    if (!clean.trim()) {
      return NextResponse.json({ ok: true, blocked: false, flagged: false, categories: [] });
    }

    const moderation = await moderateText(clean);
    const blocked = moderation.flagged && moderation.categories.some(c => HARASSMENT_BLOCK_CATEGORIES.includes(c));

    return NextResponse.json({
      ok: true,
      blocked,
      flagged: moderation.flagged,
      categories: moderation.categories,
    });
  } catch (e) {
    return NextResponse.json({ error: e.message || 'Internal error' }, { status: e.status || 500 });
  }
}
