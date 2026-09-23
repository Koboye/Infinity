import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { requireAdmin } from '@/lib/supabase/adminAuth';

export const runtime = 'nodejs';

// PATCH { active: boolean } — instantly cuts off or restores sync for
// this shop (fired agent, resolved dispute, etc.) without touching
// billing or any other shop.
export async function PATCH(req, { params }) {
  const admin = await requireAdmin(req);
  if (!admin) return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });

  let body;
  try { body = await req.json(); } catch { body = {}; }
  if (typeof body?.active !== 'boolean') {
    return NextResponse.json({ ok: false, error: 'missing_active' }, { status: 400 });
  }

  const db = supabaseAdmin();
  const { data, error } = await db
    .from('shops')
    .update({ active: body.active })
    .eq('id', params.id)
    .eq('company_id', admin.companyId) // ensures an admin can't touch another company's shop
    .select('id, active')
    .maybeSingle();

  if (error) return NextResponse.json({ ok: false, error: 'update_failed' }, { status: 500 });
  if (!data) return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 });

  return NextResponse.json({ ok: true, shop: data });
}

export async function DELETE(req, { params }) {
  const admin = await requireAdmin(req);
  if (!admin) return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });

  const db = supabaseAdmin();
  const { error, count } = await db
    .from('shops')
    .delete({ count: 'exact' })
    .eq('id', params.id)
    .eq('company_id', admin.companyId);

  if (error) return NextResponse.json({ ok: false, error: 'delete_failed' }, { status: 500 });
  if (!count) return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 });

  return NextResponse.json({ ok: true });
}
