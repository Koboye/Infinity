// Called once a day by Vercel Cron (vercel.json). Vercel sends `Authorization: Bearer $CRON_SECRET`; anything else is refused.
import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebaseAdmin';
import { sendReminders } from '@/lib/online/pushApi.js';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export async function GET(req) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  try { return NextResponse.json(await sendReminders(adminDb())); } catch { return NextResponse.json({ error: 'Failed' }, { status: 500 }); }
}
