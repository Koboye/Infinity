import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { requireAdmin } from '@/lib/supabase/adminAuth';

export const runtime = 'nodejs';

// POST { priceId } → { ok, url } — redirect the admin's browser to `url`.
// Requires STRIPE_SECRET_KEY. Returns a clear error instead of crashing
// if billing hasn't been configured yet (common right after deploy).
export async function POST(req) {
  if (!process.env.STRIPE_SECRET_KEY) {
    return NextResponse.json({ ok: false, error: 'billing_not_configured' }, { status: 501 });
  }
  const admin = await requireAdmin(req);
  if (!admin) return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });

  let body;
  try { body = await req.json(); } catch { body = {}; }
  const priceId = body?.priceId || process.env.STRIPE_DEFAULT_PRICE_ID;
  if (!priceId) return NextResponse.json({ ok: false, error: 'missing_price' }, { status: 400 });

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  const db = supabaseAdmin();

  const { data: company, error } = await db
    .from('companies')
    .select('id, name, stripe_customer_id')
    .eq('id', admin.companyId)
    .single();
  if (error) return NextResponse.json({ ok: false, error: 'company_lookup_failed' }, { status: 500 });

  let customerId = company.stripe_customer_id;
  if (!customerId) {
    const customer = await stripe.customers.create({ name: company.name, metadata: { companyId: company.id } });
    customerId = customer.id;
    await db.from('companies').update({ stripe_customer_id: customerId }).eq('id', company.id);
  }

  const origin = req.headers.get('origin') || process.env.NEXT_PUBLIC_APP_URL || '';
  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    customer: customerId,
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${origin}/admin/billing?checkout=success`,
    cancel_url: `${origin}/admin/billing?checkout=cancelled`,
    metadata: { companyId: company.id },
  });

  return NextResponse.json({ ok: true, url: session.url });
}
