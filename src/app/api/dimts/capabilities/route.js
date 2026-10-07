import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/firebase-admin';
import { callWorker, workerConfigured } from '@/lib/dimts/worker';
import { fail } from '@/lib/dimts/http';

// One cheap call on startup: tells the screen what the server can do, so it only shows what works.
export async function GET(req) {
  try {
    await requireAuth(req);
    if (!workerConfigured()) return NextResponse.json({ ok: true, online: false, text: Boolean(process.env.GEMINI_API_KEY),
      uploads: Boolean(process.env.CLOUDINARY_API_SECRET) });
    try {
      const c = await callWorker('/capabilities', { method: 'GET', timeoutMs: 6000 });
      return NextResponse.json({ ok: true, online: true, text: true, uploads: Boolean(process.env.CLOUDINARY_API_SECRET), ...c });
    } catch {
      return NextResponse.json({ ok: true, online: false, text: Boolean(process.env.GEMINI_API_KEY), uploads: Boolean(process.env.CLOUDINARY_API_SECRET) });
    }
  } catch (e) { return fail(e); }
}
