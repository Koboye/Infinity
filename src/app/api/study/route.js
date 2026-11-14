// Study ledger endpoint. POST { sid, answered, correct } reports a finished session; GET returns today's bonus, streak and rank;
// GET ?board=week|streak returns the leaderboard of the caller's own grade / department.
import { NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebaseAdmin';
import { studyInfo, studyReport, studyBoard } from '@/lib/online/studyApi.js';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
const H = { 'Cache-Control': 'no-store' };
const err = (m, s) => NextResponse.json({ error: m }, { status: s, headers: H });

async function who(req) {
  const m = /^Bearer (.+)$/.exec(req.headers.get('authorization') || '');
  if (!m) return null;
  try { const t = await adminAuth().verifyIdToken(m[1]); return { uid: t.uid, name: t.name || '' }; } catch { return null; }
}

export async function GET(req) {
  const u = await who(req);
  if (!u) return err('Sign in first.', 401);
  try {
    const board = new URL(req.url).searchParams.get('board');
    return NextResponse.json(board ? await studyBoard(adminDb(), u.uid, board) : await studyInfo(adminDb(), u.uid), { headers: H });
  } catch { return err('Could not load your study data.', 503); }
}

export async function POST(req) {
  const u = await who(req);
  if (!u) return err('Sign in first.', 401);
  let body = null;
  try { body = await req.json(); } catch { /* empty */ }
  try { return NextResponse.json(await studyReport(adminDb(), u.uid, body, u.name), { headers: H }); }
  catch { return err('Could not save your session.', 503); }
}
