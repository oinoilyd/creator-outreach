/**
 * POST /api/team/checkout — start a Stripe Checkout session for the
 * Team plan ($150/mo for 5 seats included; $35/mo per extra seat).
 *
 * Body: { teamName: string }
 *
 * Pre-conditions:
 *   1. User must be authenticated.
 *   2. User must NOT already be a member of any org (one-org-per-user
 *      constraint enforced at the DB level by UNIQUE(user_id)).
 *
 * Flow:
 *   1. Resolve / lazily create Stripe Customer (reuse existing
 *      stripe_customer_id from user_profile if present).
 *   2. Ensure Team-plan Prices exist via resolveTeamPriceIds.
 *   3. Create a subscription-mode Checkout session with ONE item:
 *      the base $150/mo price. We start with no seat add-on; the
 *      seat quantity is bumped later when the org grows past 5.
 *   4. Stash the teamName in session.metadata so the
 *      checkout.session.completed webhook knows what to name the
 *      newly-created Organization.
 *   5. Return { url } for the client to redirect.
 *
 * The actual ORGANIZATION row + Owner membership are created in the
 * webhook handler — that way payment must succeed before the user is
 * marked as having a Team plan, and the org never exists without a
 * paid subscription.
 *
 * Cancel path (?team_canceled=1) bounces them back to /pricing.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { getStripe } from '@/lib/stripe/client'
import { resolveTeamPriceIds } from '@/lib/stripe/team-pricing'

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

  let body: { teamName?: string } = {}
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'invalid json body' }, { status: 400 })
  }
  const teamName = (body.teamName || '').trim().slice(0, 80)
  if (!teamName) {
    return NextResponse.json({ error: 'teamName required (1–80 chars)' }, { status: 400 })
  }

  if (!process.env.STRIPE_SECRET_KEY) {
    return NextResponse.json({ error: 'Stripe not configured' }, { status: 503 })
  }

  const sb = getServiceClient()
  if (!sb) {
    return NextResponse.json({ error: 'service role not configured' }, { status: 500 })
  }

  // Block users who are already in an org. One-org-per-user rule from
  // the design discussion; also enforced by DB UNIQUE(user_id), but
  // we'd rather show a clean error than rely on the constraint
  // tripping later.
  const { data: existingMember } = await sb
    .from('organization_members')
    .select('organization_id, role')
    .eq('user_id', user.id)
    .maybeSingle()
  if (existingMember) {
    return NextResponse.json(
      { error: 'You are already in a team. Leave your current team before creating a new one.' },
      { status: 409 },
    )
  }

  // Block users with an active INDIVIDUAL subscription — they should
  // cancel that first to avoid double-billing. Owner of a new Team
  // shouldn't also be paying for the individual plan.
  const { data: profileRow } = await sb
    .from('user_profile')
    .select('stripe_customer_id, full_name, email, subscription_status')
    .eq('user_id', user.id)
    .maybeSingle()

  const indivStatus = profileRow?.subscription_status
  if (indivStatus && ['active', 'trialing', 'past_due'].includes(indivStatus)) {
    return NextResponse.json(
      {
        error: 'You have an active individual subscription. Cancel it first (Settings → Billing → Manage), then come back to create a team.',
        requiresIndividualCancel: true,
      },
      { status: 409 },
    )
  }

  const stripe = getStripe()
  const { basePriceId } = await resolveTeamPriceIds()

  // Find-or-create Stripe Customer (reuse same one used for any
  // individual subscription, so payment methods + invoice history
  // carry over).
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
      console.error('[team/checkout] failed to persist stripe_customer_id', persistErr)
    }
  }

  const origin =
    req.headers.get('origin') ||
    `${req.nextUrl.protocol}//${req.nextUrl.host}`

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    customer: stripeCustomerId,
    line_items: [
      { price: basePriceId, quantity: 1 },
    ],
    subscription_data: {
      // Team plan trial — same 7 days as individual. Per Dylan's
      // monetization call, urgency dies past day 7 for either tier.
      trial_period_days: 7,
      // metadata.kind='team' tags the subscription so the webhook
      // handler routes it to the org-creation branch instead of the
      // individual-subscription branch.
      // supabase_user_id ties this to the user who'll be Owner.
      // team_name is what we'll call the new Organization.
      metadata: {
        kind: 'team',
        supabase_user_id: user.id,
        team_name: teamName,
      },
    },
    // Mirror metadata on the session too so the
    // checkout.session.completed event has it directly.
    metadata: {
      kind: 'team',
      supabase_user_id: user.id,
      team_name: teamName,
    },
    customer_update: { name: 'auto', address: 'auto' },
    billing_address_collection: 'auto',
    success_url: `${origin}/?team_created=1`,
    cancel_url: `${origin}/pricing?team_canceled=1`,
  })

  if (!session.url) {
    return NextResponse.json({ error: 'no checkout url' }, { status: 500 })
  }

  return NextResponse.json({ url: session.url })
}
