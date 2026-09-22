import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { requireAdmin } from '@/lib/supabase/adminAuth';

export const runtime = 'nodejs';

export async function POST(req) {
  if (!process.env.STRIPE_SECRET_KEY) {
    return NextResponse.json({ ok: false, error: 'billing_not_configured' }, { status: 501 });
  }
  const admin = await requireAdmin(req);
  if (!admin) return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });

  const db = supabaseAdmin();
  const { data: company, error } = await db
    .from('companies')
    .select('stripe_customer_id')
    .eq('id', admin.companyId)
    .single();
  if (error || !company?.stripe_customer_id) {
    return NextResponse.json({ ok: false, error: 'no_billing_account_yet' }, { status: 404 });
  }

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  const origin = req.headers.get('origin') || process.env.NEXT_PUBLIC_APP_URL || '';
  const portal = await stripe.billingPortal.sessions.create({
    customer: company.stripe_customer_id,
    return_url: `${origin}/admin/billing`,
  });

  return NextResponse.json({ ok: true, url: portal.url });
}
