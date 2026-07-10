import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/firebase-admin';
import { rateLimit, clientIp } from '@/lib/rate-limit';

// "Catch Me Up" — summarizes everything that happened in a thread/group while you
// were away into a few short bullet points, so reopening a busy group chat doesn't
// mean scrolling through 80 messages. Same Gemini-behind-the-API pattern as
// ai/smart-reply and ai/captions, just a different prompt shape (many-to-one
// summary instead of a next-reply suggestion).
const GEMINI_MODEL = 'gemini-2.5-flash';

export async function POST(req) {
  try {
    const decoded = await requireAuth(req);
    const ip = clientIp(req);
    const rl = await rateLimit(`ai-catch-up:${decoded.uid}:${ip}`, 30, 60 * 60);
    if (!rl.allowed) {
      return NextResponse.json({ error: 'Too many catch-up requests. Try again later.' }, { status: 429 });
    }

    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json({ error: 'Catch Me Up is not configured on this server.' }, { status: 503 });
    }

    const { messages, isGroup } = await req.json();
    if (!Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json({ error: 'messages array is required' }, { status: 400 });
    }

    // Cap both count and per-message length — a catch-up is a summary, not a
    // transcript dump, and this keeps the request/bill bounded.
    const recent = messages.slice(-60).map(m => ({
      from: String(m.from || 'someone').slice(0, 40),
      text: String(m.text || '').slice(0, 300),
    })).filter(m => m.text);

    if (recent.length < 3) {
      // Not enough of a backlog to be worth summarizing — the UI shouldn't have
      // offered this in the first place, but stay defensive.
      return NextResponse.json({ ok: true, summary: [] });
    }

    const transcript = recent.map(m => `${m.from}: ${m.text}`).join('\n');
    const prompt = isGroup
      ? `Here are unread messages from a group chat, in order:\n\n${transcript}\n\nSummarize what was discussed in 2-4 short bullet points, each under 14 words. Mention who said what only when it matters (a decision, a question directed at someone, a plan). Skip small talk and greetings. No preamble, no numbering — start each line with "•".`
      : `Here are unread messages from a private conversation, in order:\n\n${transcript}\n\nSummarize what was said in 2-4 short bullet points, each under 14 words. Flag anything that needs a reply (a question, a request, a plan to confirm). No preamble, no numbering — start each line with "•".`;

    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.4, maxOutputTokens: 200 },
        }),
      }
    );

    if (!res.ok) {
      const errBody = await res.text();
      console.error('AI catch-up error', res.status, errBody);
      let reason = errBody;
      try { reason = JSON.parse(errBody)?.error?.message || errBody; } catch {}
      return NextResponse.json(
        { error: 'Failed to generate catch-up summary', detail: String(reason).slice(0, 300) },
        { status: 502 }
      );
    }

    const data = await res.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    const summary = text.split('\n')
      .map(s => s.replace(/^[-*•\d.)\s]+/, '').trim())
      .filter(Boolean)
      .slice(0, 4);

    return NextResponse.json({ ok: true, summary });
  } catch (e) {
    console.error('ai/catch-up error:', e);
    return NextResponse.json({ error: e.message || 'Internal error' }, { status: e.status || 500 });
  }
}
