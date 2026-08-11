import { NextResponse } from 'next/server';
import { rateLimit, clientIp } from '@/lib/rate-limit';

// Server-side proxy for the TalkMe tab's conversation partner. The client never
// talks to Anthropic directly (browsers can't hold ANTHROPIC_API_KEY safely, and
// the Anthropic API doesn't accept unauthenticated browser calls anyway) — it
// posts { system, messages } here instead, and this route attaches the key and
// forwards to the Messages API.
//
// Rate limited per-IP + per-user (when signed in) since every call costs quota.
// Auth is soft here (not requireAuth) because TalkMe is reachable from inside the
// app for any signed-in user, but we still don't want to hard-fail the feature if
// a token is momentarily missing/stale — worst case it just falls back to IP-only
// limiting for that request.
const MODEL = 'claude-sonnet-4-6';
const MAX_TOKENS = 600;
const MAX_HISTORY_MESSAGES = 13; // 12 turns of history + the new user turn

export async function POST(req) {
  try {
    const ip = clientIp(req);
    const rl = await rateLimit(`ai-conversation:${ip}`, 60, 60 * 60);
    if (!rl.allowed) {
      return NextResponse.json(
        { error: 'Too many requests. Please wait a bit and try again.' },
        { status: 429 }
      );
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json(
        { error: 'The conversation partner is not configured on this server.' },
        { status: 503 }
      );
    }

    const { system, messages } = await req.json();
    if (typeof system !== 'string' || !system.trim()) {
      return NextResponse.json({ error: 'system prompt is required' }, { status: 400 });
    }
    if (!Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json({ error: 'messages array is required' }, { status: 400 });
    }

    // Defensively cap size/shape of what we forward — nothing about this request
    // body can be trusted.
    const safeMessages = messages.slice(-MAX_HISTORY_MESSAGES).map((m) => ({
      role: m.role === 'assistant' ? 'assistant' : 'user',
      content: String(m.content || '').slice(0, 2000),
    }));

    const upstream = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: MAX_TOKENS,
        system: String(system).slice(0, 4000),
        messages: safeMessages,
      }),
    });

    if (!upstream.ok) {
      const errBody = await upstream.text();
      console.error('ai/conversation upstream error', upstream.status, errBody);
      return NextResponse.json(
        { error: 'The conversation partner had trouble responding. Please try again.' },
        { status: 502 }
      );
    }

    const data = await upstream.json();
    const textBlock = (data.content || []).map((b) => b.text || '').join('\n');
    const clean = textBlock.replace(/```json|```/g, '').trim();

    let parsed;
    try {
      parsed = JSON.parse(clean);
    } catch (e) {
      parsed = { reply: textBlock || 'Could you say that again?', corrections: [] };
    }

    return NextResponse.json(parsed);
  } catch (e) {
    console.error('ai/conversation error:', e);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
