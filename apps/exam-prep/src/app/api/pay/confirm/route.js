// Payment confirmation. Header x-admin-secret: ADMIN_SECRET (the owner) or WEBHOOK_SECRET (a payment provider or SMS forwarder).
//   POST { claim }            confirm one claim by its reference
//   POST { phone, amount }    confirm the single open claim made from that number (amount must be at least the price)
//   POST { claim, reject:true } (admin only)
//   GET                       open claims
import { secretRole, json, handle, fail } from '@/lib/http.js';
import { confirmClaim, confirmByPhone, rejectClaim, listOpenClaims } from '@/lib/server/store.js';

export const dynamic = 'force-dynamic';
const need = (req, role) => { const r = secretRole(req); if (!r) fail(401, 'Not allowed'); if (role === 'admin' && r !== 'admin') fail(403, 'Admin only'); return r; };
export async function GET(req) { try { need(req); return json({ claims: await listOpenClaims() }); } catch (e) { return handle(e); } }
export async function POST(req) {
  try {
    const body = await req.json().catch(() => ({}));
    if (body.reject) { need(req, 'admin'); return json(await rejectClaim(body.claim)); }
    need(req);
    if (body.claim) return json({ ok: true, ...(await confirmClaim(body.claim, Date.now(), body.amount)) });
    if (body.phone) return json({ ok: true, ...(await confirmByPhone(body.phone, body.amount)) });
    fail(400, 'Send a claim reference or a phone number and amount');
  } catch (e) { return handle(e); }
}
