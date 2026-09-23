import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { supabaseAdmin } from '@/lib/supabase/admin';

export const runtime = 'nodejs';

// Stripe webhook. Configure this URL (https://yourapp.com/api/billing/webhook)
// in the Stripe dashboard, subscribed to at least:
//   checkout.session.completed, customer.subscription.updated,
//   customer.subscription.deleted
export async function POST(req) {
  if (!process.env.STRIPE_SECRET_KEY || !process.env.STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json({ ok: false, error: 'billing_not_configured' }, { status: 501 });
  }

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  const sig = req.headers.get('stripe-signature');
  const rawBody = await req.text();

  let event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    return NextResponse.json({ ok: false, error: `signature_verification_failed: ${err.message}` }, { status: 400 });
  }

  const db = supabaseAdmin();

  const mapStatus = (stripeStatus) => {
    if (stripeStatus === 'active' || stripeStatus === 'trialing') return stripeStatus;
    if (stripeStatus === 'past_due' || stripeStatus === 'unpaid') return 'past_due';
    return 'canceled';
  };

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        const companyId = session.metadata?.companyId;
        if (companyId && session.subscription) {
          await db.from('companies').update({
            stripe_subscription_id: session.subscription,
            subscription_status: 'active',
          }).eq('id', companyId);
        }
        break;
      }
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted': {
        const sub = event.data.object;
        await db.from('companies')
          .update({ subscription_status: mapStatus(sub.status) })
          .eq('stripe_customer_id', sub.customer);
        break;
      }
      default:
        break; // ignore events we don't act on
    }
  } catch (err) {
    return NextResponse.json({ ok: false, error: 'handler_failed' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
