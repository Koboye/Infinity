// The signed-in student's account actions.
//   { action: 'me' }                          subscription, open payment claim, contribution progress
//   { action: 'claim', phone }                "I will pay / I paid 15 birr from this number": opens a claim the owner or a webhook confirms
//   { action: 'contribute', dept, items[] }   up to 15 new questions for review (15 approved = one free month)
import { PRICE_ETB, CREDIT_BATCH } from '@/lib/core.js';
import { isDept } from '@/data/departments.js';
import { getSub, openClaim, submitQuestions, myContributions } from '@/lib/server/store.js';
import { adminDb } from '@/lib/firebaseAdmin';
import { json, handle, userOf, rateLimit, fail } from '@/lib/http.js';

export const dynamic = 'force-dynamic';
export async function POST(req) {
  try {
    const body = await req.json().catch(() => ({}));
    const uid = await userOf(req, { revoked: ['claim', 'contribute'].includes(body.action) });
    rateLimit(uid);
    switch (body.action) {
      case 'me': {
        const open = await adminDb().collection('claims').where('uid', '==', uid).where('status', '==', 'open').limit(1).get();
        return json({ sub: await getSub(uid), price: PRICE_ETB, batch: CREDIT_BATCH, openClaim: open.docs[0] ? { claim: open.docs[0].id, phone: open.docs[0].data().phone } : null, ...(await myContributions(uid)) });
      }
      case 'claim': return json({ ...(await openClaim(uid, body.phone)), sub: await getSub(uid) });
      case 'contribute':
        if (!isDept(body.dept)) fail(400, 'Choose a department');
        return json(await submitQuestions(uid, body.dept, body.items));
      default: fail(400, 'Unknown action');
    }
  } catch (e) { return handle(e); }
}
