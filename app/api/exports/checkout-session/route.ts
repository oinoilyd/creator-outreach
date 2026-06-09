/**
 * POST /api/exports/checkout-session — start a Stripe Checkout session
 * for a $25 one-off export charge.
 *
 * Flow:
 *   1. Auth-gated (user must be signed in).
 *   2. Look up the user's stripe_customer_id (created on first /api/stripe/
 *      checkout for a subscription, persisted on user_profile).
 *   3. Create a Stripe Checkout session in PAYMENT mode (one-off, not
 *      subscription) with inline price_data — no Stripe Product/Price
 *      object to maintain in the dashboard.
 *   4. metadata.kind='export' tags this session for the webhook handler,
 *      so subscription events and export events don't get confused.
 *   5. Success URL bounces back to the app with ?export_fulfilled=1 +
 *      &session_id=<sid> so the client can re-trigger the export.
 *
 * Why a one-off Checkout instead of metered billing? Cleaner UX — user
 * sees the exact charge before paying, no surprise on next invoice.
 * Matches the "I'm paying $25 right now to export this thing" mental
 * model.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { getStripe } from '@/lib/stripe/client'
import { PAID_EXPORT_PRICE_CENTS } from '@/lib/billing/exports'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) return null
  return createServiceClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  if (!process.env.STRIPE_SECRET_KEY) {
    return NextResponse.json({ error: 'Stripe not configured' }, { status: 503 })
  }

  const sb = getServiceClient()
  if (!sb) {
    return NextResponse.json({ error: 'service role not configured' }, { status: 500 })
  }

  // Resolve / lazily create the Stripe Customer — same pattern as the
  // subscription checkout. We REUSE the existing stripe_customer_id so
  // their saved cards + history travel with them.
  const { data: profileRow, error: profileErr } = await sb
    .from('user_profile')
    .select('stripe_customer_id, full_name, email')
    .eq('user_id', user.id)
    .maybeSingle()

  if (profileErr) {
    console.error('[exports/checkout-session] profile lookup failed', profileErr)
    return NextResponse.json({ error: 'profile lookup failed' }, { status: 500 })
  }

  const stripe = getStripe()
  let stripeCustomerId = profileRow?.stripe_customer_id ?? null
  if (!stripeCustomerId) {
    const customer = await stripe.customers.create({
      email: user.email ?? profileRow?.email ?? undefined,
      name: profileRow?.full_name ?? undefined,
      metadata: { supabase_user_id: user.id },
    })
    stripeCustomerId = customer.id
    const { error: persistErr } = await sb
      .from('user_profile')
      .update({ stripe_customer_id: stripeCustomerId })
      .eq('user_id', user.id)
    if (persistErr) {
      console.error('[exports/checkout-session] failed to persist stripe_customer_id', persistErr)
    }
  }

  const origin =
    req.headers.get('origin') ||
    `${req.nextUrl.protocol}//${req.nextUrl.host}`

  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    customer: stripeCustomerId,
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: 'usd',
          unit_amount: PAID_EXPORT_PRICE_CENTS,
          product_data: {
            name: 'Outreach Export',
            description: 'One Excel/CSV export of your Outreach pipeline.',
          },
        },
      },
    ],
    // metadata.kind='export' tells the webhook handler this is an export
    // charge, not a subscription event. supabase_user_id ties it back
    // to the user so the webhook can grant the credit even if the
    // redirect-fulfill path never fires.
    metadata: {
      kind: 'export',
      supabase_user_id: user.id,
    },
    // Encode the same metadata onto the PaymentIntent too — gives us
    // a belt-and-suspenders link if we ever need to reconcile from a
    // charge event instead of a session event.
    payment_intent_data: {
      metadata: {
        kind: 'export',
        supabase_user_id: user.id,
      },
    },
    // CHECKOUT_SESSION_ID is a Stripe template literal — they substitute
    // the real session id at redirect time. Used by /api/exports/fulfill
    // to verify the payment + grant the credit.
    success_url: `${origin}/?export_fulfilled=1&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/?export_canceled=1`,
  })

  if (!session.url || !session.id) {
    return NextResponse.json({ error: 'no checkout url' }, { status: 500 })
  }

  return NextResponse.json({ url: session.url, sessionId: session.id })
}
