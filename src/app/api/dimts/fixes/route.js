import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/firebase-admin';
import { loadFixes, replaceFixes, fixesRows } from '@/lib/dimts/memory';
import { fail } from '@/lib/dimts/http';

// "My Fixes": the sentences/words a person corrected. Per-user, stored in Firestore.
export async function GET(req) {
  try {
    const { uid } = await requireAuth(req);
    return NextResponse.json({ ok: true, ...fixesRows(await loadFixes(uid)) });
  } catch (e) { return fail(e); }
}

export async function PUT(req) {
  try {
    const { uid } = await requireAuth(req);
    const { lines, words } = await req.json();
    if (!Array.isArray(lines) || !Array.isArray(words)) {
      return NextResponse.json({ error: 'lines and words arrays are required' }, { status: 400 });
    }
    if (lines.length > 2000 || words.length > 2000) {
      return NextResponse.json({ error: 'Too many fixes (max 2000 each).' }, { status: 400 });
    }
    const saved = await replaceFixes(uid, lines, words);
    return NextResponse.json({ ok: true, lines: Object.keys(saved.lines).length, words: Object.keys(saved.words).length });
  } catch (e) { return fail(e); }
}
