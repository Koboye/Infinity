// GET /api/bank                -> { counts }   how many questions each department has
// GET /api/bank?dept=<id>      -> { questions, total, access }   subscribers get the whole bank; everyone else a small preview
import { isDept } from '@/data/departments.js';
import { PREVIEW_COUNT } from '@/lib/core.js';
import { bankFor, bankCounts, getSub } from '@/lib/server/store.js';
import { json, handle, userOf, fail } from '@/lib/http.js';

export const dynamic = 'force-dynamic';
export async function GET(req) {
  try {
    const dept = new URL(req.url).searchParams.get('dept');
    if (!dept) return json({ counts: await bankCounts() });
    if (!isDept(dept)) fail(404, 'Unknown department');
    const uid = await userOf(req, { required: false });
    const access = uid ? await getSub(uid) : { subscribed: false, until: 0, daysLeft: 0 };
    const all = await bankFor(dept);
    const questions = access.subscribed ? all : all.slice(0, PREVIEW_COUNT);
    return json({ questions: questions.map(({ id, text, options, answer, explanation, topic }) => ({ id, text, options, answer, explanation, topic })), total: all.length, locked: !access.subscribed && all.length > questions.length, access });
  } catch (e) { return handle(e); }
}
