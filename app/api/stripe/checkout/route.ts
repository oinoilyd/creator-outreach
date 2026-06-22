/**
 * POST /api/stripe/checkout — create a Stripe Checkout session.
 *
 * Auth-gated (user must be signed in). Body: { priceId: string }.
 *
 * Flow:
 *   1. Resolve the authenticated user.
 *   2. Look up (or lazily create) their Stripe Customer. We persist
 *      stripe_customer_id on user_profile so subsequent checkouts /
 *      portal sessions reuse the same Customer — saved cards, promo
 *      history, invoice history all stick around.
 *   3. Create a Checkout session in subscription mode with a 7-day
 *      trial (was 14, shortened by Dylan 2026-05-24 — urgency dies
 *      past day 7). Stripe Checkout (hosted) keeps PCI scope at SAQ A
 *      — cards never touch our backend.
 *   4. Return { url } so the client can redirect.
 *
 * Errors are returned as JSON so the client can show a clear message;
 * we never leak Stripe internals.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { getStripe } from '@/lib/stripe/client'

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
  // Auth — must be signed in. The hosted Checkout will collect
  // payment, but we still tie the resulting Subscription back to a
  // real user via stripe_customer_id, so anonymous checkouts make
  // no sense.
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  let body: { priceId?: string; promotionCode?: string } = {}
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'invalid json body' }, { status: 400 })
  }
  const priceId = (body.priceId || '').trim()
  // Whitelist to our two known subscription prices. A bare `startsWith
  // ('price_')` let a caller POST ANY price on the Stripe account (a
  // cheaper plan, a test-mode price) and check out at the wrong amount.
  // (Audit P0, 2026-06-22.)
  const ALLOWED_PRICE_IDS = new Set(
    [
      process.env.NEXT_PUBLIC_STRIPE_PRICE_ID_MONTHLY,
      process.env.NEXT_PUBLIC_STRIPE_PRICE_ID_ANNUAL,
    ].filter((p): p is string => !!p),
  )
  if (!priceId || !ALLOWED_PRICE_IDS.has(priceId)) {
    return NextResponse.json({ error: 'invalid priceId' }, { status: 400 })
  }
  // Optional promotion code — user-facing alias of a Stripe coupon
  // (e.g. "VIPOUTREACH"). Validated against Stripe BEFORE we create
  // the checkout session so we can surface a clean error inline
  // instead of letting the user discover it at Stripe's hosted page.
  const promotionCodeRaw = (body.promotionCode || '').trim()

  // Defensive env check — if Stripe isn't configured the client
  // shouldn't have called us, but fail clearly instead of surfacing
  // a Stripe SDK error to the user.
  if (!process.env.STRIPE_SECRET_KEY) {
    return NextResponse.json({ error: 'Stripe not configured' }, { status: 503 })
  }

  // Service-role client — we need to read/write stripe_customer_id
  // on user_profile. The RLS-friendly server client could read the
  // user's own row, but writes are simpler with the service role.
  const sb = getServiceClient()
  if (!sb) {
    return NextResponse.json({ error: 'service role not configured' }, { status: 500 })
  }

  const { data: profileRow, error: profileErr } = await sb
    .from('user_profile')
    .select('stripe_customer_id, full_name, email')
    .eq('user_id', user.id)
    .maybeSingle()

  if (profileErr) {
    console.error('[stripe/checkout] profile lookup failed', profileErr)
    return NextResponse.json({ error: 'profile lookup failed' }, { status: 500 })
  }

  const stripe = getStripe()

  // Find-or-create the Stripe Customer. Lazy on purpose — most
  // signups never start Checkout, so we don't burn Customer rows
  // for them.
  let stripeCustomerId = profileRow?.stripe_customer_id ?? null
  if (!stripeCustomerId) {
    const customer = await stripe.customers.create({
      email: user.email ?? profileRow?.email ?? undefined,
      name: profileRow?.full_name ?? undefined,
      // Stash our user_id on the Stripe Customer so the dashboard
      // and webhook payloads can both cross-reference it.
      metadata: { supabase_user_id: user.id },
    })
    stripeCustomerId = customer.id

    const { error: persistErr } = await sb
      .from('user_profile')
      .update({ stripe_customer_id: stripeCustomerId })
      .eq('user_id', user.id)
    if (persistErr) {
      // Non-fatal — the webhook will reconcile on first event using
      // the customer.metadata.supabase_user_id we just set. We still
      // log it loudly so the admin can spot a drift if it persists.
      console.error('[stripe/checkout] failed to persist stripe_customer_id', persistErr)
    }
  }

  // Trial-abuse guard (audit 2026-06-10). Stripe honors
  // trial_period_days even for a customer who already used a trial,
  // so a user could cancel and re-checkout for another free 7 days
  // indefinitely. Only grant the trial if this customer has NEVER had
  // a subscription. Failure to list defaults to "grant trial" (we'd
  // rather over-grant a trial than block a legit new signup on a
  // transient Stripe error).
  let grantTrial = true
  try {
    const priorSubs = await stripe.subscriptions.list({
      customer: stripeCustomerId,
      status: 'all',
      limit: 1,
    })
    if (priorSubs.data.length > 0) grantTrial = false
  } catch (e) {
    console.error('[stripe/checkout] prior-subscription lookup failed; granting trial by default', e)
  }

  // Build the success/cancel URLs from the request's OWN host (set by the
  // platform), NOT the client-supplied Origin header — trusting that
  // header let a caller point the post-checkout redirect off-site. This
  // still works on prod, preview deploys, and localhost. (Audit, 2026-06-22.)
  const origin = `${req.nextUrl.protocol}//${req.nextUrl.host}`

  // Resolve promo code → Stripe promotion_code id, if user supplied
  // one in the body. Stripe's allow_promotion_codes:true also surfaces
  // a code input at the hosted checkout page, so we keep both paths
  // available — pre-applied via this API for /pricing's "Have a code?"
  // input, OR entered fresh at Stripe's UI. Invalid codes return a
  // friendly error here BEFORE we waste a checkout session.
  let preAppliedPromotionId: string | null = null
  if (promotionCodeRaw) {
    try {
      const promos = await stripe.promotionCodes.list({
        code: promotionCodeRaw,
        active: true,
        limit: 1,
      })
      const promo = promos.data[0]
      if (!promo) {
        return NextResponse.json(
          { error: `Promo code "${promotionCodeRaw}" not found or expired.` },
          { status: 400 },
        )
      }
      preAppliedPromotionId = promo.id
    } catch (e) {
      console.error('[stripe/checkout] promo lookup failed', e)
      return NextResponse.json(
        { error: 'Could not validate promo code. Try again.' },
        { status: 500 },
      )
    }
  }

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    customer: stripeCustomerId,
    line_items: [{ price: priceId, quantity: 1 }],
    subscription_data: {
      // 7-day trial (Dylan 2026-05-24, was 14) — but ONLY for
      // first-time customers. grantTrial is false when this Stripe
      // customer already had a subscription (trial-abuse guard above).
      ...(grantTrial ? { trial_period_days: 7 } : {}),
      metadata: { supabase_user_id: user.id },
    },
    // Pre-applied promo wins; otherwise let user enter one at Stripe UI.
    ...(preAppliedPromotionId
      ? { discounts: [{ promotion_code: preAppliedPromotionId }] }
      : { allow_promotion_codes: true }),
    // 2026-05-11 — using the auth email as billing email by default
    // gives Stripe one more signal for fraud detection. Customer
    // already has it but checkout-level helps when the user has
    // multiple emails on file.
    customer_update: { name: 'auto', address: 'auto' },
    billing_address_collection: 'auto',
    success_url: `${origin}/?stripe=success`,
    cancel_url: `${origin}/pricing?stripe=canceled`,
  })

  if (!session.url) {
    return NextResponse.json({ error: 'no checkout url' }, { status: 500 })
  }

  return NextResponse.json({ url: session.url })
}
