import type { ModerationVerdict } from '@/types';

const SCAM_PATTERNS: { re: RegExp; weight: number; flag: string }[] = [
  { re: /work\s*from\s*home.*\d{3,}.*(day|hour)/i, weight: 0.8, flag: 'unrealistic-income' },
  { re: /send\s+(money|payment|deposit)/i, weight: 0.9, flag: 'upfront-payment' },
  { re: /western\s*union|bitcoin\s*wallet/i, weight: 0.7, flag: 'irreversible-payment' },
  { re: /100%\s*guarantee/i, weight: 0.8, flag: 'too-good-to-be-true' },
  { re: /click\s+(this|the)\s+link/i, weight: 0.5, flag: 'phishing-link' },
];

function localCheck(text: string): Omit<ModerationVerdict, 'safe'> {
  let spam = 0; const flags: string[] = [];
  for (const { re, weight, flag } of SCAM_PATTERNS) {
    if (re.test(text)) { spam = Math.max(spam, weight); flags.push(flag); }
  }
  if (/(.)\1{6,}/.test(text)) { spam = Math.max(spam, 0.3); flags.push('spam-symbols'); }
  return { toxicityScore: 0, nsfwScore: 0, spamScore: spam, flags, reason: flags[0] };
}

export async function moderatePost(input: { text: string; imageUrls?: string[] }): Promise<ModerationVerdict> {
  const local = localCheck(input.text);
  const safe = local.spamScore < 0.6;
  return { ...local, safe };
}

/**
 * Authoritative moderation used by server-side API routes. Combines the
 * fast local heuristic with an OpenAI moderation pass when an API key is
 * configured. This is intentionally NOT meant for direct client use — the
 * client only ever sees a *preview* (moderatePost above) for instant
 * feedback in the compose UI; the real decision that gets persisted to
 * Firestore always comes from here, running on the server.
 */
export async function moderatePostServer(input: { text: string; imageUrls?: string[] }): Promise<ModerationVerdict> {
  const local = localCheck(input.text);
  let toxicityScore = 0;
  let nsfwScore = 0;

  const apiKey = process.env.OPENAI_API_KEY;
  if (apiKey && input.text.trim()) {
    try {
      const res = await fetch('https://api.openai.com/v1/moderations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({ model: 'omni-moderation-latest', input: input.text.slice(0, 2000) }),
      });
      if (res.ok) {
        const json = await res.json() as { results?: { flagged: boolean; category_scores?: Record<string, number> }[] };
        const result = json.results?.[0];
        if (result) {
          const scores = result.category_scores ?? {};
          toxicityScore = Math.max(scores['harassment'] ?? 0, scores['hate'] ?? 0, scores['violence'] ?? 0);
          nsfwScore = Math.max(scores['sexual'] ?? 0, scores['sexual/minors'] ?? 0);
          if (result.flagged) local.flags.push('ai-flagged');
        }
      }
    } catch {
      // If the moderation API is unreachable, fall back to the local
      // heuristic rather than throwing and blocking publishing entirely.
    }
  }

  const spamScore = local.spamScore;
  const safe = spamScore < 0.6 && toxicityScore < 0.5 && nsfwScore < 0.3;
  return { toxicityScore, nsfwScore, spamScore, flags: local.flags, reason: local.flags[0], safe };
}
