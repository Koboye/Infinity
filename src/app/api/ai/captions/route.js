import { NextResponse } from 'next/server';
import { requireAuth, adminDb } from '@/lib/firebase-admin';
import { rateLimit, clientIp } from '@/lib/rate-limit';

// Auto-generates translated, timestamped captions for a posted video, TikTok/Facebook
// "auto-translate" style, in effectively any language Gemini can translate to (not a
// fixed hardcoded pair).
//
// Two-stage, cost-conscious design:
//   1. TRANSCRIBE (once per video, ever): send the actual video bytes to Gemini and
//      get back a `source` track — the original spoken language, verbatim, timestamped.
//      Cached at videos/{id}.captions.source.
//   2. TRANSLATE (once per video, per language): a cheap *text-only* Gemini call that
//      translates the cached source segments into whatever language a viewer's
//      Settings → Video Captions is set to, preserving timestamps. Cached at
//      videos/{id}.captions.translations.{langCode}. If the requested language IS the
//      source language, no translation call is needed at all — the source track is
//      the answer.
// Every viewer after the first (per video, per language) gets a cached result with
// zero Gemini calls, same trust boundary as the old design — the admin SDK write
// bypasses firestore.rules, which is why viewers who aren't the video owner can still
// trigger/cache this.
const GEMINI_MODEL = 'gemini-2.5-flash';
const MAX_VIDEO_BYTES = 20 * 1024 * 1024; // 20MB — stays under Gemini's inline request-size limit

async function callGemini(parts, maxOutputTokens) {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${process.env.GEMINI_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts }],
        generationConfig: { temperature: 0.2, maxOutputTokens },
      }),
    }
  );
  if (!res.ok) {
    const errBody = await res.text();
    let reason = errBody;
    try { reason = JSON.parse(errBody)?.error?.message || errBody; } catch {}
    const err = new Error(String(reason).slice(0, 300));
    err.status = 502;
    throw err;
  }
  const data = await res.json();
  const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
  return rawText.trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim();
}

const sanitizeTrack = (arr) => (Array.isArray(arr) ? arr
  .filter(s => s && typeof s.text === 'string' && typeof s.start === 'number' && typeof s.end === 'number')
  .map(s => ({ start: Math.max(0, s.start), end: Math.max(0, s.end), text: s.text.trim() }))
  .filter(s => s.text.length > 0)
  : []);

export async function POST(req) {
  try {
    const decoded = await requireAuth(req);
    const ip = clientIp(req);
    // Transcription is far more expensive than a text/image caption call, so this
    // gets a tighter budget than /api/ai/caption's 15/hour. Translation-only requests
    // are cheap but still ride the same bucket for simplicity.
    const rl = await rateLimit(`ai-captions:${decoded.uid}:${ip}`, 20, 60 * 60);
    if (!rl.allowed) {
      return NextResponse.json({ error: 'Too many caption requests. Try again later.' }, { status: 429 });
    }

    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json({ error: 'AI captions are not configured on this server.' }, { status: 503 });
    }

    const { videoId, videoUrl, targetLang } = await req.json();
    if (!videoId || typeof videoId !== 'string') {
      return NextResponse.json({ error: 'videoId is required' }, { status: 400 });
    }
    if (!videoUrl || typeof videoUrl !== 'string' || !/^https:\/\//i.test(videoUrl)) {
      return NextResponse.json({ error: 'videoUrl must be a public https URL.' }, { status: 400 });
    }
    const lang = (typeof targetLang === 'string' && targetLang.trim()) ? targetLang.trim() : 'en';

    const videoRef = adminDb.collection('videos').doc(videoId);
    const existing = await videoRef.get();
    let source = existing.exists ? existing.data()?.captions?.source : null;
    const cachedTranslations = existing.exists ? (existing.data()?.captions?.translations || {}) : {};

    // ── Stage 1: transcribe, only if we've never done this video before ──
    if (!source) {
      const vidRes = await fetch(videoUrl);
      if (!vidRes.ok) {
        console.error('AI captions: failed to fetch source video', vidRes.status);
        return NextResponse.json({ error: 'Could not fetch the video to caption.' }, { status: 400 });
      }
      const mimeType = vidRes.headers.get('content-type') || 'video/mp4';
      const buf = Buffer.from(await vidRes.arrayBuffer());
      if (buf.length > MAX_VIDEO_BYTES) {
        return NextResponse.json({ error: 'Video is too large to auto-caption (max 20MB).' }, { status: 400 });
      }
      const base64Data = buf.toString('base64');

      const transcribePrompt = `Transcribe the spoken audio of this short social video into timed captions, TikTok-caption style.

Return ONLY minified JSON, no markdown fences, no commentary, matching exactly this shape:
{"language":"<BCP-47 code of the spoken language, e.g. en, am, ar, fr>","segments":[{"start":0.0,"end":4.2,"text":"..."}]}

Rules:
- Break the transcript into short segments of roughly 2-5 seconds each, matching natural speech pauses.
- Text must be the verbatim transcript in the language actually spoken, written in that language's own script.
- Keep each caption segment's text short (under ~12 words) like real closed captions, not full paragraphs.
- If there is no clear speech (music only, silence, etc), return {"language":"none","segments":[]}.`;

      let raw;
      try {
        raw = await callGemini(
          [{ text: transcribePrompt }, { inline_data: { mime_type: mimeType, data: base64Data } }],
          4096
        );
      } catch (e) {
        console.error('AI captions transcribe error', e.message);
        return NextResponse.json({ error: 'Failed to generate captions', detail: e.message }, { status: e.status || 502 });
      }

      let parsed;
      try { parsed = JSON.parse(raw); }
      catch {
        console.error('AI captions: failed to parse transcribe JSON:', raw.slice(0, 500));
        return NextResponse.json({ error: 'Could not parse caption output.' }, { status: 502 });
      }

      const segments = sanitizeTrack(parsed.segments);
      if (!segments.length) {
        return NextResponse.json({ error: 'No speech detected to caption.' }, { status: 422 });
      }
      source = { language: typeof parsed.language === 'string' ? parsed.language : 'other', segments };
      await videoRef.set({ captions: { source, generatedAt: Date.now() } }, { merge: true });
    }

    // ── Stage 2: the requested language is the source language — no translation needed ──
    if (lang === source.language) {
      return NextResponse.json({ ok: true, track: source.segments, language: lang, cached: true });
    }

    // ── Stage 2b: already translated into this language before — serve the cache ──
    if (Array.isArray(cachedTranslations[lang]) && cachedTranslations[lang].length) {
      return NextResponse.json({ ok: true, track: cachedTranslations[lang], language: lang, cached: true });
    }

    // ── Stage 2c: translate the cached source text into the requested language ──
    // Text-only call — no video bytes re-sent, so this is fast and cheap regardless
    // of how many different languages a video's viewers end up requesting.
    const translatePrompt = `Translate these video caption segments into the language with BCP-47 code "${lang}". Keep the exact same segment count, start/end times, and order — only translate the "text" field of each segment, into that language's own script.

Input segments (JSON):
${JSON.stringify(source.segments)}

Return ONLY minified JSON, no markdown fences, no commentary, matching exactly this shape:
{"segments":[{"start":0.0,"end":4.2,"text":"translated text"}]}`;

    let translatedRaw;
    try {
      translatedRaw = await callGemini([{ text: translatePrompt }], 4096);
    } catch (e) {
      console.error('AI captions translate error', e.message);
      return NextResponse.json({ error: 'Failed to translate captions', detail: e.message }, { status: e.status || 502 });
    }

    let translatedParsed;
    try { translatedParsed = JSON.parse(translatedRaw); }
    catch {
      console.error('AI captions: failed to parse translate JSON:', translatedRaw.slice(0, 500));
      return NextResponse.json({ error: 'Could not parse translated caption output.' }, { status: 502 });
    }

    const translatedSegments = sanitizeTrack(translatedParsed.segments);
    if (!translatedSegments.length) {
      return NextResponse.json({ error: 'Translation produced no captions.' }, { status: 502 });
    }

    // Dot-path update so this only ever adds/overwrites this one language, never
    // clobbers other languages other viewers already cached concurrently.
    await videoRef.set({ captions: { translations: { [lang]: translatedSegments } } }, { merge: true });

    return NextResponse.json({ ok: true, track: translatedSegments, language: lang, cached: false });
  } catch (e) {
    console.error('ai/captions error:', e);
    return NextResponse.json({ error: e.message || 'Internal error' }, { status: e.status || 500 });
  }
}
