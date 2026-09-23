import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { requireAdmin } from '@/lib/supabase/adminAuth';
import { generateShopToken, hashShopToken } from '@/lib/supabase/shopToken';

export const runtime = 'nodejs';

// POST { name, town?, phone? } → { ok, shop, token }
// `token` is returned exactly once — show it to the admin as text and
// a copy button; it cannot be retrieved again (only its hash is stored).
export async function POST(req) {
  const admin = await requireAdmin(req);
  if (!admin) return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });

  let body;
  try { body = await req.json(); } catch { body = {}; }
  const name = String(body?.name || '').trim();
  if (!name) return NextResponse.json({ ok: false, error: 'missing_name' }, { status: 400 });

  const db = supabaseAdmin();

  const { data: company, error: companyErr } = await db
    .from('companies')
    .select('shop_limit')
    .eq('id', admin.companyId)
    .single();
  if (companyErr) return NextResponse.json({ ok: false, error: 'company_lookup_failed' }, { status: 500 });

  const { count, error: countErr } = await db
    .from('shops')
    .select('id', { count: 'exact', head: true })
    .eq('company_id', admin.companyId);
  if (countErr) return NextResponse.json({ ok: false, error: 'count_failed' }, { status: 500 });

  if ((count || 0) >= company.shop_limit) {
    return NextResponse.json(
      { ok: false, error: 'shop_limit_reached', limit: company.shop_limit },
      { status: 402 }
    );
  }

  const token = generateShopToken();
  const { data: shop, error: insertErr } = await db
    .from('shops')
    .insert({
      company_id: admin.companyId,
      name,
      town: String(body?.town || '').trim() || null,
      phone: String(body?.phone || '').trim() || null,
      token_hash: hashShopToken(token),
    })
    .select('id, name, town, phone, active, created_at')
    .single();
  if (insertErr) return NextResponse.json({ ok: false, error: 'create_failed' }, { status: 500 });

  return NextResponse.json({ ok: true, shop, token });
}
