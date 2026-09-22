import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { hashShopToken } from '@/lib/supabase/shopToken';

export const runtime = 'nodejs';

// POST { token: string } → { ok, snapshot } — used when a shopkeeper
// gets a new phone: enter the same shop code, pull the last backup down.
export async function POST(req) {
  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'bad_json' }, { status: 400 });
  }
  const { token } = body || {};
  if (!token || typeof token !== 'string') {
    return NextResponse.json({ ok: false, error: 'missing_token' }, { status: 400 });
  }

  const db = supabaseAdmin();
  const { data: shop, error } = await db
    .from('shops')
    .select('id, active, snapshot, snapshot_updated_at')
    .eq('token_hash', hashShopToken(token))
    .maybeSingle();

  if (error) return NextResponse.json({ ok: false, error: 'lookup_failed' }, { status: 500 });
  if (!shop) return NextResponse.json({ ok: false, error: 'invalid_token' }, { status: 401 });
  if (!shop.active) return NextResponse.json({ ok: false, error: 'shop_deactivated' }, { status: 403 });
  if (!shop.snapshot) return NextResponse.json({ ok: false, error: 'no_backup_yet' }, { status: 404 });

  await db.from('shops').update({ last_seen_at: new Date().toISOString() }).eq('id', shop.id);

  return NextResponse.json({ ok: true, snapshot: shop.snapshot, syncedAt: shop.snapshot_updated_at });
}
