import { NextResponse } from 'next/server';
import { requireAuth, adminDb } from '@/lib/firebase-admin';
import { rateLimit, clientIp } from '@/lib/rate-limit';

// Auto-generates bilingual (English + Amharic) timestamped captions for a posted
// video, TikTok-style. Unlike the image caption route, this one caches its result
// on the video document itself (via the Firestore admin SDK, which bypasses the
// client security rules) so the *first* viewer who turns on CC pays the Gemini
// cost, and every viewer after that — for the life of the post — gets the cached
// transcript instantly with no further API calls.
//
// Gemini needs the actual video bytes inline (it doesn't fetch arbitrary URLs
// itself), so this route downloads the video server-side first, same pattern as
// the image caption route, just with a lower size ceiling since video payloads
// are much larger. For clips over that ceiling this returns a clear error rather
// than silently truncating — the Gemini Files API would be the fix for bigger
// videos, but that's out of scope here.
const GEMINI_MODEL = 'gemini-2.5-flash';
const MAX_VIDEO_BYTES = 20 * 1024 * 1024; // 20MB — stays under Gemini's inline request-size limit

export async function POST(req) {
  try {
    const decoded = await requireAuth(req);
    const ip = clientIp(req);
    // Transcription is far more expensive than a text/image caption call, so this
    // gets a tighter budget than /api/ai/caption's 15/hour.
    const rl = await rateLimit(`ai-captions:${decoded.uid}:${ip}`, 10, 60 * 60);
    if (!rl.allowed) {
      return NextResponse.json({ error: 'Too many caption requests. Try again later.' }, { status: 429 });
    }

    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json({ error: 'AI captions are not configured on this server.' }, { status: 503 });
    }

    const { videoId, videoUrl } = await req.json();
    if (!videoId || typeof videoId !== 'string') {
      return NextResponse.json({ error: 'videoId is required' }, { status: 400 });
    }
    if (!videoUrl || typeof videoUrl !== 'string' || !/^https:\/\//i.test(videoUrl)) {
      return NextResponse.json({ error: 'videoUrl must be a public https URL.' }, { status: 400 });
    }

    const videoRef = adminDb.collection('videos').doc(videoId);
    const existing = await videoRef.get();
    // Already generated (by this viewer or an earlier one) — serve the cached copy,
    // no Gemini call needed.
    const cached = existing.exists ? existing.data()?.captions : null;
    if (cached?.en?.length && cached?.am?.length) {
      return NextResponse.json({ ok: true, captions: cached, cached: true });
    }

    const vidRes = await fetch(videoUrl);
    if (!vidRes.ok) {
      console.error('AI captions: failed to fetch source video', vidRes.status);
      return NextResponse.json({ error: 'Could not fetch the video to caption.' }, { status: 400 });
    }
    const mimeType = vidRes.headers.get('content-type') || 'video/mp4';
    const buf = Buffer.from(await vidRes.arrayBuffer());
    if (buf.length > MAX_VIDEO_BYTES) {
      return NextResponse.json(
        { error: 'Video is too large to auto-caption (max 20MB).' },
        { status: 400 }
      );
    }
    const base64Data = buf.toString('base64');

    const prompt = `You are transcribing the spoken audio of a short social video into timed captions, TikTok-caption style.

Return ONLY minified JSON, no markdown fences, no commentary, matching exactly this shape:
{"sourceLanguage":"am|en|other","en":[{"start":0.0,"end":4.2,"text":"..."}],"am":[{"start":0.0,"end":4.2,"text":"..."}]}

Rules:
- Break the transcript into short segments of roughly 2-5 seconds each, matching natural speech pauses.
- "en" and "am" must have the same number of segments with the same start/end times — one is the English track, the other the Amharic (\u12a0\u121b\u122d\u129b) track, both covering the full video.
- If the spoken language is already English, put the verbatim transcript in "en" and a natural Amharic translation in "am".
- If the spoken language is already Amharic, put the verbatim transcript in "am" (written in Amharic script) and a natural English translation in "en".
- If the spoken language is something else, translate it into both English and Amharic.
- If there is no clear speech (music only, silence, etc), return {"sourceLanguage":"none","en":[],"am":[]}.
- Keep each caption segment's text short (under ~12 words) like real closed captions, not full paragraphs.`;

    const geminiRes = await fetch(
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
          generationConfig: { temperature: 0.2, maxOutputTokens: 4096 },
        }),
      }
    );

    if (!geminiRes.ok) {
      const errBody = await geminiRes.text();
      console.error('AI captions error', geminiRes.status, errBody);
      let reason = errBody;
      try { reason = JSON.parse(errBody)?.error?.message || errBody; } catch {}
      return NextResponse.json(
        { error: 'Failed to generate captions', detail: String(reason).slice(0, 300) },
        { status: 502 }
      );
    }

    const data = await geminiRes.json();
    const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    // Defensively strip markdown code fences in case the model wraps its JSON anyway.
    const cleaned = rawText.trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim();

    let parsed;
    try {
      parsed = JSON.parse(cleaned);
    } catch (e) {
      console.error('AI captions: failed to parse Gemini JSON output:', rawText.slice(0, 500));
      return NextResponse.json({ error: 'Could not parse caption output.' }, { status: 502 });
    }

    const sanitizeTrack = (arr) => (Array.isArray(arr) ? arr
      .filter(s => s && typeof s.text === 'string' && typeof s.start === 'number' && typeof s.end === 'number')
      .map(s => ({ start: Math.max(0, s.start), end: Math.max(0, s.end), text: s.text.trim() }))
      .filter(s => s.text.length > 0)
      : []);

    const captions = {
      sourceLanguage: typeof parsed.sourceLanguage === 'string' ? parsed.sourceLanguage : 'other',
      en: sanitizeTrack(parsed.en),
      am: sanitizeTrack(parsed.am),
      generatedAt: Date.now(),
    };

    if (!captions.en.length && !captions.am.length) {
      return NextResponse.json({ error: 'No speech detected to caption.' }, { status: 422 });
    }

    // Cache on the video doc (admin write bypasses the client rule that normally
    // restricts video-doc updates to the owner) so future viewers skip Gemini entirely.
    await videoRef.set({ captions }, { merge: true });

    return NextResponse.json({ ok: true, captions, cached: false });
  } catch (e) {
    console.error('ai/captions error:', e);
    return NextResponse.json({ error: e.message || 'Internal error' }, { status: e.status || 500 });
  }
}
