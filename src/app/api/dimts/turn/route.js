import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/firebase-admin';
import { rateLimit } from '@/lib/rate-limit';
import { callWorker } from '@/lib/dimts/worker';
import { isLang } from '@/lib/dimts/langs';
import { fail } from '@/lib/dimts/http';

// "Talk to someone": one spoken turn in, {heard, translated, audio(base64 wav)} out.
// direction 'say' = you speak (answer is spoken in YOUR cloned voice); 'hear' = they speak.
export async function POST(req) {
  try {
    const { uid } = await requireAuth(req);
    const rl = await rateLimit(`dimts-turn:${uid}`, 240, 60 * 60);
    if (!rl.allowed) return NextResponse.json({ error: 'Slow down a little: too many turns.' }, { status: 429 });

    const inForm = await req.formData();
    const audio = inForm.get('audio'); const direction = String(inForm.get('direction') || 'say');
    const my = String(inForm.get('my_lang') || ''); const their = String(inForm.get('their_lang') || '');
    if (!(audio instanceof Blob) || audio.size > 8_000_000) return NextResponse.json({ error: 'Audio under 8 MB required.' }, { status: 400 });
    if (!['say', 'hear'].includes(direction) || !isLang(my) || !isLang(their) || my === their) {
      return NextResponse.json({ error: 'Pick two different supported languages.' }, { status: 400 });
    }
    const form = new FormData();
    form.append('audio', audio, 'turn.webm'); form.append('direction', direction);
    form.append('my_lang', my); form.append('their_lang', their); form.append('session', uid); // session = uid: a voice sample never crosses users
    return NextResponse.json(await callWorker('/turn', { form, timeoutMs: 60000 }));
  } catch (e) { return fail(e); }
}
