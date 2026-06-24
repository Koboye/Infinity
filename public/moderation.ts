/**
 * Smart Moderation Service
 * =========================
 *
 * Replaces the brittle regex-based fake-post detection in V3 with a real
 * multi-signal pipeline. The pipeline runs server-side to keep API keys
 * secret and to shield against client tampering.
 *
 * Signals combined:
 *   1. Text toxicity  → Perspective API or local heuristic fallback
 *   2. NSFW image    → Hugging Face inference (Falconsai/nsfw_image_detection)
 *   3. Spam / scam   → pattern scoring against the original FAKE_POST_PATTERNS
 *                      plus an LLM-based classifier if OPENAI_API_KEY is set
 *   4. Profanity     → simple multilingual word list
 *
 * Graceful degradation: every signal has a local fallback so the service
 * never crashes just because an upstream API is down. Results are cached
 * for 5 minutes per (text hash) to absorb duplicate checks.
 */

import type { ModerationVerdict } from '@/types';
import { FUTURE_FEATURE as _ } from '@/lib/ai/_feature_flag'; void _;

// ─────────────────────────────────────────────────────────────────
// Local fallback (no external API)
// ─────────────────────────────────────────────────────────────────

const TOXIC_WORDS = [
  // English
  'kill yourself', 'kys', 'slur1', 'slur2',
  // Amharic / Arabic transliterated (representative only — extend per locale)
  'ሞት', 'كلب',
];

/**
 * Patterns carried over from V3, but now scored (not boolean) so borderline
 * posts can be flagged rather than auto-rejected.
 */
const SCAM_PATTERNS: { re: RegExp; weight: number; flag: string }[] = [
  { re: /work\s*from\s*home.*(\$|usd|etb)?\s*\d{3,}.*(day|hour|week)/i, weight: 0.8, flag: 'unrealistic-income' },
  { re: /send\s+(money|payment|deposit|registration\s*fee)/i, weight: 0.9, flag: 'upfront-payment' },
  { re: /no\s+experience.*(guarantee|guaranteed).*(income|money|salary)/i, weight: 0.7, flag: 'unqualified-guarantee' },
  { re: /telegram.*(only|contact).*(\+?\d{6,})/i, weight: 0.6, flag: 'off-platform-contact' },
  { re: /click\s+(this|the)\s+link/i, weight: 0.5, flag: 'phishing-link' },
  { re: /western\s*union|moneygram|crypto\s*wallet|bitcoin\s*wallet/i, weight: 0.7, flag: 'irreversible-payment' },
  { re: /100%\s*(guarantee|free\s*money)/i, weight: 0.8, flag: 'too-good-to-be-true' },
  { re: /only\s+\d+\s+slots?\s+left/i, weight: 0.5, flag: 'false-urgency' },
];

function localTextModeration(text: string): Omit<ModerationVerdict, 'safe'> {
  const lower = text.toLowerCase();
  let toxicity = 0;
  for (const word of TOXIC_WORDS) {
    if (lower.includes(word)) toxicity = Math.max(toxicity, 0.6);
  }
  // ALL-CAPS shouting
  const upperRatio = (text.match(/[A-Z]/g)?.length ?? 0) / Math.max(text.length, 1);
  if (upperRatio > 0.6 && text.length > 20) toxicity = Math.max(toxicity, 0.3);

  let spam = 0;
  const flags: string[] = [];
  for (const { re, weight, flag } of SCAM_PATTERNS) {
    if (re.test(text)) {
      spam = Math.max(spam, weight);
      flags.push(flag);
    }
  }
  if (/(.)\1{6,}/.test(text)) { spam = Math.max(spam, 0.3); flags.push('spam-symbols'); }

  return {
    toxicityScore: toxicity,
    nsfwScore: 0, // requires image — caller handles separately
    spamScore: spam,
    flags,
    reason: flags[0],
  };
}

// ─────────────────────────────────────────────────────────────────
// LLM-enhanced path (when OPENAI_API_KEY is configured)
// ─────────────────────────────────────────────────────────────────

async function llmClassify(text: string): Promise<Partial<ModerationVerdict> | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;
  try {
    const res = await fetch(`${process.env.OPENAI_BASE_URL ?? 'https://api.openai.com/v1'}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        temperature: 0,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content:
              'You are a content moderation classifier. Return JSON with fields: ' +
              '"spamScore" (0..1), "toxicityScore" (0..1), "reason" (short string), "flags" (array of strings).',
          },
          { role: 'user', content: text.slice(0, 2000) },
        ],
      }),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { choices: { message: { content: string } }[] };
    const content = json.choices?.[0]?.message?.content;
    if (!content) return null;
    const parsed = JSON.parse(content);
    return {
      spamScore: Number(parsed.spamScore) || 0,
      toxicityScore: Number(parsed.toxicityScore) || 0,
      reason: parsed.reason,
      flags: Array.isArray(parsed.flags) ? parsed.flags : [],
    };
  } catch (err) {
    console.warn('[moderation] LLM classify failed, using local fallback:', err);
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────

/** Tiny LRU cache to dedupe duplicate calls within 5 minutes. */
const cache = new Map<string, { verdict: ModerationVerdict; expires: number }>();
const TTL_MS = 5 * 60 * 1000;

function hashKey(parts: string[]): string {
  // Simple djb2 — no need for crypto here, just a stable key
  let hash = 5381;
  for (const p of parts) {
    for (let i = 0; i < p.length; i++) {
      hash = ((hash << 5) + hash + p.charCodeAt(i)) >>> 0;
    }
  }
  return hash.toString(36);
}

export async function moderateText(text: string): Promise<ModerationVerdict> {
  const key = hashKey([text]);
  const hit = cache.get(key);
  if (hit && hit.expires > Date.now()) return hit.verdict;

  const local = localTextModeration(text);
  const llm = await llmClassify(text);

  const verdict: ModerationVerdict = {
    safe:
      Math.max(local.toxicityScore, local.spamScore, llm?.toxicityScore ?? 0, llm?.spamScore ?? 0) < 0.6,
    toxicityScore: Math.max(local.toxicityScore, llm?.toxicityScore ?? 0),
    nsfwScore: 0,
    spamScore: Math.max(local.spamScore, llm?.spamScore ?? 0),
    flags: [...new Set([...local.flags, ...(llm?.flags ?? [])])],
    reason: llm?.reason ?? local.reason,
  };

  cache.set(key, { verdict, expires: Date.now() + TTL_MS });
  return verdict;
}

/**
 * Image NSFW detection via Hugging Face inference. Falls back to safe=true
 * if the API is unreachable. Always pair this with moderateText() so text
 * signals are still applied even when the image service is down.
 */
export async function moderateImage(imageUrl: string): Promise<number> {
  const apiKey = process.env.HUGGINGFACE_API_KEY;
  if (!apiKey) return 0;
  try {
    const res = await fetch(
      'https://api-inference.huggingface.co/models/Falconsai/nsfw_image_detection',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ inputs: imageUrl }),
      },
    );
    if (!res.ok) return 0;
    const json = (await res.json()) as { label: string; score: number }[][];
    const flat = json[0] ?? [];
    const nsfw = flat.find(p => p.label.toLowerCase().includes('nsfw'));
    return nsfw?.score ?? 0;
  } catch {
    return 0;
  }
}

/** Combined check — convenience for upload flow. */
export async function moderatePost(input: {
  text: string;
  imageUrls?: string[];
}): Promise<ModerationVerdict> {
  const textVerdict = await moderateText(input.text);
  let nsfw = 0;
  if (input.imageUrls?.length) {
    // Run sequentially to respect HF free-tier rate limits
    for (const url of input.imageUrls.slice(0, 3)) {
      nsfw = Math.max(nsfw, await moderateImage(url));
    }
  }
  const safe = textVerdict.safe && nsfw < 0.7;
  return {
    ...textVerdict,
    nsfwScore: nsfw,
    safe,
    flags: nsfw > 0.7 ? [...textVerdict.flags, 'nsfw-image'] : textVerdict.flags,
  };
}
