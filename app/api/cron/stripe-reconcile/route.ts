/**
 * GET /api/cron/stripe-reconcile — daily Vercel cron (8 AM UTC).
 *
 * Backstop for any Stripe state drift that the webhook + portal-return
 * sync paths might miss. Iterates every user_profile row with a
 * stripe_customer_id and pulls the canonical subscription state from
 * Stripe, patches Supabase if anything diverged.
 *
 * Why this exists:
 *
 *   The webhook handler is the primary push-based sync. /billing/sync
 *   covers Customer Portal exits (the path that misses webhooks most
 *   often). The metadata fallback handles orphan-customer_id cases.
 *   But there are still drift sources those don't cover:
 *
 *     • Admin manually cancels a subscription in Stripe Dashboard
 *       without going through the Portal. Stripe fires
 *       customer.subscription.updated, but if our endpoint is down
 *       for the duration of Stripe's retry window, we miss it.
 *     • Stripe-side automation (e.g. dunning auto-cancellation
 *       after N failed payments) fires events that may not deliver.
 *     • Schema changes on our side that nuke part of the mirrored
 *       state until the next webhook lands.
 *
 *   A daily reconcile catches all of these within 24h, which is fine
 *   for our scale. The cost is one stripe.subscriptions.list call per
 *   user with a customer_id, batched.
 *
 * Hard rules (safety first):
 *   • Hard cap of 200 customers per run — caps Stripe API calls
 *     well below the rate limit (100/sec). Once we cross 200 users
 *     we need to paginate / split across multiple runs.
 *   • Best-effort per user: a failure on one user logs + skips,
 *     does NOT halt the whole batch. The next run will retry.
 *   • Auth: standard Vercel cron Authorization: Bearer <CRON_SECRET>
 *     same as /api/cron/send-followups.
 */

import { NextRequest, NextResponse } from 'next/server'
import { timingSafeEqual } from 'crypto'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { syncSubscriptionByCustomerId } from '@/lib/stripe/sync-subscription'

export const runtime = 'nodejs'
export const maxDuration = 60
export const dynamic = 'force-dynamic'

const HARD_CAP_PER_RUN = 200

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) return null
  return createServiceClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

function authorized(req: NextRequest): boolean {
  const expected = process.env.CRON_SECRET
  if (!expected) return false
  const header = req.headers.get('authorization')
  if (!header) return false
  const presented = header.replace(/^Bearer\s+/i, '')
  const a = Buffer.from(expected)
  const b = Buffer.from(presented)
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}

export async function GET(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  if (!process.env.STRIPE_SECRET_KEY) {
    return NextResponse.json({ error: 'Stripe not configured' }, { status: 503 })
  }

  const sb = getServiceClient()
  if (!sb) {
    return NextResponse.json({ error: 'service role not configured' }, { status: 500 })
  }

  // Pull all customers with a stripe_customer_id set. Cap to keep
  // Stripe API call volume sane.
  const { data: rows, error: queryErr } = await sb
    .from('user_profile')
    .select('user_id, stripe_customer_id')
    .not('stripe_customer_id', 'is', null)
    .limit(HARD_CAP_PER_RUN)

  if (queryErr) {
    console.error('[cron/stripe-reconcile] user_profile query failed', queryErr.message)
    return NextResponse.json({ error: queryErr.message }, { status: 500 })
  }
  if (!rows || rows.length === 0) {
    return NextResponse.json({ checked: 0, updated: 0, errors: 0 })
  }

  let updated = 0
  let errors = 0
  const errorDetails: string[] = []

  for (const row of rows) {
    const customerId = row.stripe_customer_id as string
    try {
      const result = await syncSubscriptionByCustomerId(sb, customerId)
      if (result.updated) updated++
      if (!result.ok) {
        errors++
        errorDetails.push(`${row.user_id}: ${result.reason}`)
      }
    } catch (err) {
      errors++
      const msg = err instanceof Error ? err.message : String(err)
      errorDetails.push(`${row.user_id}: threw — ${msg}`)
      console.error('[cron/stripe-reconcile] sync threw', row.user_id, msg)
    }
  }

  console.log('[cron/stripe-reconcile] complete', {
    checked: rows.length,
    updated,
    errors,
  })

  return NextResponse.json({
    checked: rows.length,
    updated,
    errors,
    // First 10 error details only — full list lives in Vercel logs.
    errorSample: errorDetails.slice(0, 10),
  })
}
