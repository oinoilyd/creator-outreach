/**
 * POST /api/stripe/portal — redirect to Stripe Customer Portal.
 *
 * Auth-gated. The Portal is Stripe-hosted; we just mint a single-use
 * session URL bound to the user's Stripe Customer and hand it back
 * to the client. The Portal lets the user:
 *   • update payment method
 *   • view + download invoices
 *   • change plans (if multiple prices configured in Stripe dashboard)
 *   • cancel subscription (sets cancel_at_period_end=true; we get a
 *     customer.subscription.updated webhook and mirror it)
 *
 * Customer Portal config (which features are exposed) is set in the
 * Stripe dashboard under "Settings → Billing → Customer portal", not
 * here.
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

  const { data: profileRow, error: profileErr } = await sb
    .from('user_profile')
    .select('stripe_customer_id')
    .eq('user_id', user.id)
    .maybeSingle()
  if (profileErr) {
    console.error('[stripe/portal] profile lookup failed', profileErr)
    return NextResponse.json({ error: 'profile lookup failed' }, { status: 500 })
  }
  const stripeCustomerId = profileRow?.stripe_customer_id
  if (!stripeCustomerId) {
    // The UI should hide the portal CTA when the user has no
    // stripe_customer_id, but guard anyway.
    return NextResponse.json({ error: 'No subscription' }, { status: 400 })
  }

  const origin =
    req.headers.get('origin') ||
    `${req.nextUrl.protocol}//${req.nextUrl.host}`

  // return_url points at /billing/sync (not /) so we run an explicit
  // Stripe-to-Supabase sync on portal exit. This closes the gap when
  // a portal action's webhook doesn't reliably fire (notably the
  // "Don't cancel subscription" / reinstate flow). /billing/sync
  // fetches the canonical state from Stripe, updates Supabase, then
  // redirects to /. See lib/stripe/sync-subscription.ts for details.
  const session = await getStripe().billingPortal.sessions.create({
    customer: stripeCustomerId,
    return_url: `${origin}/billing/sync`,
  })

  return NextResponse.json({ url: session.url })
}
