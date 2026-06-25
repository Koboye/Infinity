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
