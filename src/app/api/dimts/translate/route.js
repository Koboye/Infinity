import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/firebase-admin';
import { rateLimit, clientIp } from '@/lib/rate-limit';
import { loadFixes, lookup, fixWords } from '@/lib/dimts/memory';
import { checkTranslation, checkLabel } from '@/lib/dimts/quality';
import { callWorker, workerConfigured } from '@/lib/dimts/worker';
import { isLang } from '@/lib/dimts/langs';
import { fail } from '@/lib/dimts/http';

// Text -> Amharic. Order matters (same as dubber/translate.py):
//   1. a sentence the person fixed before comes straight from memory (no AI, exact)
//   2. the rest go to the GPU worker (NLLB), or to Gemini if no worker is connected
//   3. the person's word fixes are applied on top, then every line is quality-checked
const GEMINI_MODEL = 'gemini-2.5-flash';

async function geminiTranslate(texts, source) {
  if (!process.env.GEMINI_API_KEY) { const e = new Error('No translator is configured on this server.'); e.status = 503; throw e; }
  const prompt = `Translate each numbered line from ${source} to Amharic (Ge'ez script). Return ONLY a JSON array of strings, same order and length (${texts.length}).\n` +
    texts.map((t, i) => `${i + 1}. ${t}`).join('\n');
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${process.env.GEMINI_API_KEY}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature: 0.2, responseMimeType: 'application/json' } }),
  });
  if (!res.ok) { const e = new Error('Translation service failed.'); e.status = 502; throw e; }
  const data = await res.json();
  const arr = JSON.parse(data.candidates?.[0]?.content?.parts?.[0]?.text || '[]');
  if (!Array.isArray(arr) || arr.length !== texts.length) { const e = new Error('Translation came back malformed.'); e.status = 502; throw e; }
  return arr.map(String);
}

export async function POST(req) {
  try {
    const { uid } = await requireAuth(req);
    const rl = await rateLimit(`dimts-translate:${uid}:${clientIp(req)}`, 120, 60 * 60);
    if (!rl.allowed) return NextResponse.json({ error: 'Too many translations. Try again later.' }, { status: 429 });

    const { texts, source = 'en' } = await req.json();
    if (!Array.isArray(texts) || !texts.length || texts.length > 50) {
      return NextResponse.json({ error: 'texts must be 1-50 lines' }, { status: 400 });
    }
    if (!isLang(source)) return NextResponse.json({ error: 'Unknown source language' }, { status: 400 });
    const clean = texts.map((t) => String(t || '').slice(0, 500));

    const fixes = await loadFixes(uid);
    const out = clean.map((t) => lookup(fixes, t));
    const todo = out.map((v, i) => (v === null ? i : -1)).filter((i) => i >= 0);
    if (todo.length) {
      const pending = todo.map((i) => clean[i]);
      const got = workerConfigured()
        ? (await callWorker('/translate', { json: { texts: pending, source } })).texts
        : await geminiTranslate(pending, source);
      todo.forEach((i, k) => { out[i] = fixWords(fixes, got[k] || ''); });
    }
    const lines = clean.map((src, i) => ({ source: src, amharic: out[i], fromMemory: !todo.includes(i),
      check: checkLabel(checkTranslation(src, out[i])) }));
    return NextResponse.json({ ok: true, lines });
  } catch (e) { return fail(e); }
}
