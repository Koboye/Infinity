// Owner review queue. Header x-admin-secret: ADMIN_SECRET.
//   GET                                   questions waiting for review
//   POST { id, decision: 'approve'|'reject', reason? }
import { secretRole, json, handle, fail } from '@/lib/http.js';
import { listPending, reviewContribution } from '@/lib/server/store.js';

export const dynamic = 'force-dynamic';
const admin = (req) => { if (secretRole(req) !== 'admin') fail(401, 'Not allowed'); };
export async function GET(req) { try { admin(req); return json({ pending: await listPending() }); } catch (e) { return handle(e); } }
export async function POST(req) {
  try { admin(req); const b = await req.json().catch(() => ({})); return json(await reviewContribution(b.id, b.decision, b.reason)); } catch (e) { return handle(e); }
}
