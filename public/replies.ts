/**
 * Smart Reply Suggestions
 * ========================
 *
 * Given an incoming message, propose 3 short contextual replies the user
 * can send with one tap. Used in chat to match Telegram's "quick reply"
 * feature while adding AI awareness.
 *
 * Local fallback uses intent matching against a small dictionary of
 * common conversational intents. LLM path uses gpt-4o-mini for richer
 * replies when OPENAI_API_KEY is configured.
 */

const INTENT_TEMPLATES: { test: RegExp; replies: string[] }[] = [
  { test: /\?$/, replies: ['Good question!', 'Let me think…', 'I\'ll get back to you'] },
  { test: /\b(thanks|thank you|thx|ty)\b/i, replies: ['You\'re welcome! 🙏', 'Anytime!', 'Happy to help'] },
  { test: /\b(love|❤️|😍|🥰)\b/, replies: ['Aww thanks ❤️', 'That means a lot', '❤️❤️'] },
  { test: /\b(where|when|how much)\b/i, replies: ['Let me check', 'I\'ll DM you', 'Hold on a sec'] },
  { test: /\b(meet|coffee|lunch|dinner)\b/i, replies: ['Sounds good!', 'Count me in', 'What time?'] },
  { test: /\b(sorry|apologize|my bad)\b/i, replies: ['No worries!', 'It\'s all good', 'Don\'t worry about it'] },
  { test: /\b(birthday|bday)\b/i, replies: ['🎉 Happy birthday!', 'Have an amazing day 🎂', 'Cheers! 🥳'] },
  { test: /\?.*\b(sure|ok|yes|yeah)\b/i, replies: ['Awesome!', 'Great 👍', 'Let\'s do it'] },
];

function localReplies(text: string): string[] {
  const stripped = text.trim().slice(0, 200);
  for (const { test, replies } of INTENT_TEMPLATES) {
    if (test.test(stripped)) return replies.slice(0, 3);
  }
  // Default — three safe, neutral replies
  return ['👍', 'Sounds good!', 'Got it 👌'];
}

async function llmReplies(text: string): Promise<string[] | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;
  try {
    const res = await fetch(`${process.env.OPENAI_BASE_URL ?? 'https://api.openai.com/v1'}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        temperature: 0.8,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content:
              'Generate 3 short (max 6 words) casual reply suggestions. Reply JSON: ' +
              '{ "replies": ["...", "...", "..."] }. Each reply on its own. No numbering.',
          },
          { role: 'user', content: text.slice(0, 500) },
        ],
      }),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { choices: { message: { content: string } }[] };
    const content = json.choices?.[0]?.message?.content;
    if (!content) return null;
    const parsed = JSON.parse(content);
    return Array.isArray(parsed.replies) ? parsed.replies.slice(0, 3).map(String) : null;
  } catch {
    return null;
  }
}

export async function suggestReplies(message: string): Promise<string[]> {
  const llm = await llmReplies(message);
  return llm ?? localReplies(message);
}
