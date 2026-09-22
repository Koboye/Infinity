import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';

export const runtime = 'nodejs';

// POST { companyName } with Authorization: Bearer <access_token> from a
// freshly-signed-up Supabase Auth user (email/password, confirmed).
// Creates their company + makes them its owner. Called once, right
// after sign-up, from the admin dashboard.
export async function POST(req) {
  const authHeader = req.headers.get('authorization') || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });

  const db = supabaseAdmin();
  const { data: userData, error: userErr } = await db.auth.getUser(token);
  if (userErr || !userData?.user) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }

  const { data: existing } = await db
    .from('company_admins')
    .select('company_id')
    .eq('user_id', userData.user.id)
    .maybeSingle();
  if (existing) {
    return NextResponse.json({ ok: false, error: 'already_has_company' }, { status: 409 });
  }

  let body;
  try { body = await req.json(); } catch { body = {}; }
  const companyName = String(body?.companyName || '').trim();
  if (!companyName) return NextResponse.json({ ok: false, error: 'missing_name' }, { status: 400 });

  const { data: company, error: companyErr } = await db
    .from('companies')
    .insert({ name: companyName })
    .select('id, name, plan, subscription_status, trial_ends_at, shop_limit')
    .single();
  if (companyErr) return NextResponse.json({ ok: false, error: 'create_failed' }, { status: 500 });

  const { error: memberErr } = await db
    .from('company_admins')
    .insert({ user_id: userData.user.id, company_id: company.id, role: 'owner' });
  if (memberErr) return NextResponse.json({ ok: false, error: 'membership_failed' }, { status: 500 });

  return NextResponse.json({ ok: true, company });
}
