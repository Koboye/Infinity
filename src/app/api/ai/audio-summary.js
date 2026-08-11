// pages/api/ai/audio-summary.js
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  const { audioUrl, text } = req.body;
  let transcript = text;
  if (!transcript) {
    const r = await fetch(`${process.env.APP_URL}/api/ai/transcribe`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ audioUrl }),
    });
    transcript = (await r.json()).text;
  }

  const completion = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 200,
      messages: [{ role: 'user', content: `Summarize this voice message in one short sentence:\n\n${transcript}` }],
    }),
  });
  const data = await completion.json();
  const summary = data.content?.[0]?.text?.trim() || '';

  return res.status(200).json({ summary });
}
