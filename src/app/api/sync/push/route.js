import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { hashShopToken } from '@/lib/supabase/shopToken';

export const runtime = 'nodejs';

// POST { token: string, snapshot: object }
// snapshot is exactly what useStore.getState().exportData() (JSON.parse'd) produces.
export async function POST(req) {
  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'bad_json' }, { status: 400 });
  }
  const { token, snapshot } = body || {};
  if (!token || typeof token !== 'string') {
    return NextResponse.json({ ok: false, error: 'missing_token' }, { status: 400 });
  }
  if (!snapshot || typeof snapshot !== 'object' || snapshot.app !== 'gebeya-link') {
    return NextResponse.json({ ok: false, error: 'bad_snapshot' }, { status: 400 });
  }

  const db = supabaseAdmin();
  const tokenHash = hashShopToken(token);

  const { data: shop, error: findErr } = await db
    .from('shops')
    .select('id, active, company_id, companies(subscription_status, trial_ends_at)')
    .eq('token_hash', tokenHash)
    .maybeSingle();

  if (findErr) return NextResponse.json({ ok: false, error: 'lookup_failed' }, { status: 500 });
  if (!shop) return NextResponse.json({ ok: false, error: 'invalid_token' }, { status: 401 });
  if (!shop.active) return NextResponse.json({ ok: false, error: 'shop_deactivated' }, { status: 403 });

  const sub = shop.companies?.subscription_status;
  const trialActive = sub === 'trialing' && new Date(shop.companies.trial_ends_at) > new Date();
  if (sub !== 'active' && !trialActive) {
    // Data stays safe locally on the device either way — sync just pauses
    // until the company's billing is sorted out. Never lose local data.
    return NextResponse.json({ ok: false, error: 'subscription_inactive' }, { status: 402 });
  }

  const { error: updateErr } = await db
    .from('shops')
    .update({ snapshot, snapshot_updated_at: new Date().toISOString(), last_seen_at: new Date().toISOString() })
    .eq('id', shop.id);

  if (updateErr) return NextResponse.json({ ok: false, error: 'write_failed' }, { status: 500 });

  return NextResponse.json({ ok: true, syncedAt: new Date().toISOString() });
}
