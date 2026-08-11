// pages/api/ai/transcribe.js  (or app/api/ai/transcribe/route.js on the App Router)
// Same auth/response shape as your existing /api/ai/smart-reply route.
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  const { audioUrl } = req.body;
  if (!audioUrl) return res.status(400).json({ error: 'audioUrl required' });

  const audioRes = await fetch(audioUrl);
  const audioBuffer = await audioRes.arrayBuffer();

  const form = new FormData();
  form.append('file', new Blob([audioBuffer]), 'clip.m4a');
  form.append('model', 'whisper-1');

  const sttRes = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
    body: form,
  });
  const data = await sttRes.json();
  if (!sttRes.ok) return res.status(500).json({ error: data.error?.message || 'Transcription failed' });

  return res.status(200).json({ text: data.text });
}
