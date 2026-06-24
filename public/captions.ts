/**
 * Smart Caption Generator
 * ========================
 *
 * Generates a caption + hashtag set from raw user input. Falls back to a
 * deterministic local algorithm when no LLM is configured.
 *
 * The local fallback does:
 *  1. Cleans whitespace and emoji overflow
 *  2. Detects language via simple Unicode ranges
 *  3. Extracts candidate hashtags from the text itself
 *  4. Adds 2–3 trending topic suggestions if the text is too sparse
 */

import type { SmartCaptionResult, Language } from '@/types';

const LANG_RANGES: { lang: Language; re: RegExp }[] = [
  { lang: 'am', re: /[\u1200-\u137F]/ },   // Ethiopic
  { lang: 'ar', re: /[\u0600-\u06FF]/ },   // Arabic
  { lang: 'hi', re: /[\u0900-\u097F]/ },   // Devanagari
  { lang: 'zh', re: /[\u4E00-\u9FFF]/ },   // CJK
  { lang: 'ja', re: /[\u3040-\u309F\u30A0-\u30FF]/ }, // Hiragana+Katakana
  { lang: 'ko', re: /[\uAC00-\uD7AF]/ },   // Hangul
  { lang: 'ru', re: /[\u0400-\u04FF]/ },   // Cyrillic
  { lang: 'tr', re: /[\u011F-\u0131]/ },   // Turkish-specific
  { lang: 'de', re: /[äöüßÄÖÜ]/ },
  { lang: 'fr', re: /[àâçéèêëîïôûùüÿœæÀÂÇÉÈÊËÎÏÔÛÙÜŸŒÆ]/ },
  { lang: 'es', re: /[ñáéíóúüÑÁÉÍÓÚÜ¿¡]/ },
  { lang: 'pt', re: /[ãõâêôáéíóúÃÕÂÊÔÁÉÍÓÚ]/ },
  { lang: 'it', re: /[àèéìòóùúÀÈÉÌÒÓÙÚ]/ },
];

export function detectLanguage(text: string): Language {
  for (const { lang, re } of LANG_RANGES) {
    if (re.test(text)) return lang;
  }
  return 'en';
}

const HASHTAG_RE = /#[\p{L}\p{N}_]+/gu;
const STOPWORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'but', 'is', 'are', 'was', 'were',
  'this', 'that', 'with', 'for', 'to', 'of', 'in', 'on', 'at',
]);

function extractHashtags(text: string): string[] {
  const matches = text.match(HASHTAG_RE) ?? [];
  return [...new Set(matches.map(t => t.toLowerCase()))].slice(0, 8);
}

function extractKeywords(text: string): string[] {
  return Array.from(
    new Set(
      text
        .toLowerCase()
        .replace(/[^\p{L}\p{N}\s#]/gu, ' ')
        .split(/\s+/)
        .filter(w => w.length > 3 && !STOPWORDS.has(w) && !w.startsWith('#')),
    ),
  ).slice(0, 5);
}

function cleanCaption(raw: string): string {
  return raw
    .replace(/\s+/g, ' ')
    .replace(/(.)\1{3,}/g, '$1$1') // collapse "loooove" → "loove"
    .trim();
}

/* ─────────────── LLM-enhanced path ─────────────── */

async function llmGenerate(input: string): Promise<SmartCaptionResult | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;
  try {
    const res = await fetch(`${process.env.OPENAI_BASE_URL ?? 'https://api.openai.com/v1'}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        temperature: 0.7,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content:
              'You generate a short social-media caption and 3-5 hashtags from a draft. ' +
              'Reply JSON: { "caption": string, "hashtags": ["#tag", ...], "language": "en"|"am"|... }',
          },
          { role: 'user', content: input.slice(0, 1000) },
        ],
      }),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { choices: { message: { content: string } }[] };
    const content = json.choices?.[0]?.message?.content;
    if (!content) return null;
    const parsed = JSON.parse(content);
    return {
      caption: String(parsed.caption ?? input).slice(0, 280),
      hashtags: Array.isArray(parsed.hashtags) ? parsed.hashtags.slice(0, 8) : [],
      detectedLanguage: (parsed.language as Language) ?? detectLanguage(input),
    };
  } catch {
    return null;
  }
}

/* ─────────────── Public API ─────────────── */

export async function generateSmartCaption(input: string): Promise<SmartCaptionResult> {
  const cleaned = cleanCaption(input);
  const llm = await llmGenerate(cleaned);

  if (llm) return llm;

  // Local fallback
  const lang = detectLanguage(cleaned);
  const hashtags = [
    ...extractHashtags(cleaned),
    ...extractKeywords(cleaned).map(k => `#${k}`),
  ];
  // Ensure we always emit 2–3 hashtags
  if (hashtags.length < 2) hashtags.push('#dagu', '#viral');
  return {
    caption: cleaned.length > 280 ? `${cleaned.slice(0, 277)}…` : cleaned,
    hashtags: [...new Set(hashtags)].slice(0, 6),
    detectedLanguage: lang,
  };
}
