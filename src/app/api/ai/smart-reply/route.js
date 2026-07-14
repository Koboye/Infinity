import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/firebase-admin';
import { rateLimit, clientIp } from '@/lib/rate-limit';

// Generates short, tappable reply suggestions for a chat thread — the "smart replies"
// pattern from Gmail/iMessage/WhatsApp. Keeps the Gemini key server-side, same as
// ai/caption. Rate limited per-user+IP since every call costs quota.
const GEMINI_MODEL = 'gemini-2.5-flash';

export async function POST(req) {
  try {
    const decoded = await requireAuth(req);
    const ip = clientIp(req);
    const rl = await rateLimit(`ai-smart-reply:${decoded.uid}:${ip}`, 40, 60 * 60);
    if (!rl.allowed) {
      return NextResponse.json({ error: 'Too many smart-reply requests. Try again later.' }, { status: 429 });
    }

    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json({ error: 'Smart replies are not configured on this server.' }, { status: 503 });
    }

    const { messages, tone } = await req.json();
    if (!Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json({ error: 'messages array is required' }, { status: 400 });
    }

    // Optional tone for the suggestions — whitelisted so the value that reaches
    // the model prompt is always one of these, never arbitrary client input.
    const TONE_INSTRUCTIONS = {
      casual: 'casual tone',
      professional: 'polished, professional tone',
      playful: 'playful, lighthearted tone',
      warm: 'warm and affectionate tone',
      brief: 'extremely brief, to-the-point tone',
    };
    const toneInstruction = TONE_INSTRUCTIONS[tone] || TONE_INSTRUCTIONS.casual;

    // Only the last few turns matter for a reply suggestion, and we never want to
    // ship a huge chat history to the model — cap both message count and per-message
    // length so a pathological payload can't blow up the request or the bill.
    const recent = messages.slice(-8).map(m => ({
      from: m.from === 'me' ? 'me' : 'them',
      text: String(m.text || '').slice(0, 300),
    })).filter(m => m.text);

    if (recent.length === 0) {
      return NextResponse.json({ ok: true, replies: [] });
    }

    // Never suggest replies to our own last message — that's not a reply, it's a
    // continuation, and the UI shouldn't show "reply chips" in that state anyway.
    if (recent[recent.length - 1].from === 'me') {
      return NextResponse.json({ ok: true, replies: [] });
    }

    const transcript = recent.map(m => `${m.from === 'me' ? 'Me' : 'Them'}: ${m.text}`).join('\n');
    const prompt = `Here is the tail end of a private chat conversation:\n\n${transcript}\n\nSuggest 3 short, natural replies "Me" could send next, in a ${toneInstruction}. Each under 8 words, no quotes, no numbering, one per line. If the last message is a question, at least one suggestion should directly answer it. Do not repeat what "Them" said.`;

    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.7, maxOutputTokens: 80 },
        }),
      }
    );

    if (!res.ok) {
      const errBody = await res.text();
      console.error('AI smart-reply error', res.status, errBody);
      let reason = errBody;
      try { reason = JSON.parse(errBody)?.error?.message || errBody; } catch {}
      return NextResponse.json(
        { error: 'Failed to generate smart replies', detail: String(reason).slice(0, 300) },
        { status: 502 }
      );
    }

    const data = await res.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    const replies = text.split('\n')
      .map(s => s.replace(/^[-*\d.)\s]+/, '').replace(/^["']|["']$/g, '').trim())
      .filter(Boolean)
      .slice(0, 3);

    return NextResponse.json({ ok: true, replies });
  } catch (e) {
    console.error('ai/smart-reply error:', e);
    return NextResponse.json({ error: e.message || 'Internal error' }, { status: e.status || 500 });
  }
}
