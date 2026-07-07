// Shared AI content-moderation helper (OpenAI's free moderation endpoint).
// Previously this logic lived only inline in /api/videos/create/route.js, so nothing
// else in the app — comments, messages — ever got checked for harassment/abuse at all.
// Pulled out here so any endpoint can reuse the exact same categories/thresholds.
//
// REQUIRES the OPENAI_API_KEY env var to be set (Vercel → Project → Settings →
// Environment Variables). Without it, moderateText() soft-fails open (flagged: false)
// so posting/commenting still works, but NO harassment/content detection actually runs —
// this is almost certainly why "the AI moderation feature isn't functioning": it's wired
// up correctly in code, it just has nothing to call without a real key configured.
export async function moderateText(text) {
  if (!process.env.OPENAI_API_KEY || !text || !text.trim()) {
    return { flagged: false, categories: [] };
  }
  try {
    const res = await fetch('https://api.openai.com/v1/moderations', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({ model: 'omni-moderation-latest', input: text }),
    });
    if (!res.ok) {
      console.error('Moderation API error', res.status, await res.text());
      return { flagged: false, categories: [], error: true };
    }
    const data = await res.json();
    const result = data.results?.[0];
    if (!result) return { flagged: false, categories: [] };
    const categories = Object.entries(result.categories || {}).filter(([, v]) => v).map(([k]) => k);
    return { flagged: result.flagged, categories };
  } catch (e) {
    console.error('Moderation call failed', e);
    return { flagged: false, categories: [], error: true };
  }
}

// Categories severe enough to hard-block outright (never published) rather than route
// to human review. 'harassment' and 'harassment/threatening' are included here (the
// video-post route previously didn't hard-block plain "harassment", only violent/self-harm
// categories — comments are almost always where person-to-person harassment shows up, so
// this list is intentionally broader for the comment-check endpoint below).
export const HARD_BLOCK_CATEGORIES = [
  'sexual/minors', 'self-harm/intent', 'self-harm/instructions', 'violence/graphic',
];

export const HARASSMENT_BLOCK_CATEGORIES = [
  ...HARD_BLOCK_CATEGORIES, 'harassment', 'harassment/threatening',
];
