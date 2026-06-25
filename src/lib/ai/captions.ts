import type { SmartCaptionResult, Language } from '@/types';

const LANG_RANGES: { lang: Language; re: RegExp }[] = [
  { lang: 'am', re: /[\u1200-\u137F]/ },
  { lang: 'ar', re: /[\u0600-\u06FF]/ },
  { lang: 'hi', re: /[\u0900-\u097F]/ },
  { lang: 'zh', re: /[\u4E00-\u9FFF]/ },
  { lang: 'ru', re: /[\u0400-\u04FF]/ },
];

export function detectLanguage(text: string): Language {
  for (const { lang, re } of LANG_RANGES) {
    if (re.test(text)) return lang;
  }
  return 'en';
}

const STOPWORDS = new Set(['the','a','an','and','or','but','is','are','was','were','this','that','with','for','to','of','in','on','at']);

function extractKeywords(text: string): string[] {
  return Array.from(new Set(
    text.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, ' ').split(/\s+/)
      .filter(w => w.length > 3 && !STOPWORDS.has(w))
  )).slice(0, 5);
}

export async function generateSmartCaption(input: string): Promise<SmartCaptionResult> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (apiKey) {
    try {
      const res = await fetch(`${process.env.OPENAI_BASE_URL ?? 'https://api.openai.com/v1'}/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: 'gpt-4o-mini', temperature: 0.7,
          response_format: { type: 'json_object' },
          messages: [
            { role: 'system', content: 'Generate a short social caption and 3-5 hashtags. Reply JSON: { "caption": string, "hashtags": ["#tag",...], "language": "en" }' },
            { role: 'user', content: input.slice(0, 1000) },
          ],
        }),
      });
      if (res.ok) {
        const json = await res.json() as { choices: { message: { content: string } }[] };
        const parsed = JSON.parse(json.choices?.[0]?.message?.content ?? '{}');
        return { caption: String(parsed.caption ?? input).slice(0, 280), hashtags: Array.isArray(parsed.hashtags) ? parsed.hashtags.slice(0, 6) : [], detectedLanguage: (parsed.language as Language) ?? 'en' };
      }
    } catch { /* fallback */ }
  }
  const lang = detectLanguage(input);
  const hashtags = extractKeywords(input).map(k => `#${k}`);
  if (hashtags.length < 2) hashtags.push('#dagu', '#viral');
  return { caption: input.slice(0, 280), hashtags: hashtags.slice(0, 6), detectedLanguage: lang };
}
