/**
 * POST /api/admin/migrate-trial-lengths — one-off admin tool to
 * force-shorten any active 14-day Stripe trial down to max 7 days.
 *
 * Run once after Phase 3 ships. Subsequent runs are safe — they re-list
 * all trialing customers and re-cap any that still have >7 days left
 * (idempotent).
 *
 * Strategy:
 *   1. List user_profile rows where subscription_status='trialing'.
 *   2. For each, retrieve the Stripe Subscription.
 *   3. If trial_end > now + 7 days, call subscriptions.update with
 *      trial_end = now + 7 days. Uses Stripe's `proration_behavior:
 *      'none'` to avoid issuing prorated invoices on the trial cap.
 *   4. Return a summary { migrated, unchanged, errors, total }.
 *
 * Auth: hard-gated to Dylan's email. If the bypass-paywall list
 * grows in the future this should probably read from there for
 * consistency.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { getStripe } from '@/lib/stripe/client'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const ADMIN_EMAIL = 'dmeehanj@gmail.com'

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) return null
  return createServiceClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

export async function POST(_req: NextRequest) {
  // Auth — admin only. The 404 (not 403) is deliberate: don't tell
  // non-admins this endpoint exists.
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user || user.email !== ADMIN_EMAIL) {
    return NextResponse.json({ error: 'not found' }, { status: 404 })
  }

  if (!process.env.STRIPE_SECRET_KEY) {
    return NextResponse.json({ error: 'Stripe not configured' }, { status: 503 })
  }

  const sb = getServiceClient()
  if (!sb) {
    return NextResponse.json({ error: 'service role not configured' }, { status: 500 })
  }

  const { data: rows, error } = await sb
    .from('user_profile')
    .select('user_id, email, stripe_subscription_id, subscription_status')
    .eq('subscription_status', 'trialing')

  if (error) {
    console.error('[admin/migrate-trial-lengths] list failed', error)
    return NextResponse.json({ error: 'list failed' }, { status: 500 })
  }

  const stripe = getStripe()
  const now = Math.floor(Date.now() / 1000)
  const sevenDaysFromNow = now + 7 * 24 * 60 * 60

  let migrated = 0
  let unchanged = 0
  let errors = 0
  const details: Array<{ user_id: string; email: string | null; action: string; reason?: string }> = []

  for (const row of rows ?? []) {
    const subId = row.stripe_subscription_id
    if (!subId) {
      unchanged++
      details.push({ user_id: row.user_id, email: row.email, action: 'skipped', reason: 'no stripe_subscription_id' })
      continue
    }
    try {
      const sub = await stripe.subscriptions.retrieve(subId)
      // Subscription's trial_end may have already passed if Stripe is
      // about to flip it to 'active'. Only act on subs still trialing
      // AND with trial_end > now + 7 days.
      const trialEnd = sub.trial_end ?? 0
      if (sub.status !== 'trialing') {
        unchanged++
        details.push({ user_id: row.user_id, email: row.email, action: 'skipped', reason: `status=${sub.status}` })
        continue
      }
      if (trialEnd <= sevenDaysFromNow) {
        unchanged++
        details.push({ user_id: row.user_id, email: row.email, action: 'skipped', reason: 'already <= 7 days' })
        continue
      }
      await stripe.subscriptions.update(subId, {
        trial_end: sevenDaysFromNow,
        proration_behavior: 'none',
      })
      migrated++
      details.push({ user_id: row.user_id, email: row.email, action: 'migrated' })

      // Mirror to local user_profile so UI reflects new trial end
      // immediately. The subscription.updated webhook will also fire
      // shortly with the same data — both writes are idempotent.
      const newEndIso = new Date(sevenDaysFromNow * 1000).toISOString()
      const { error: mirrorErr } = await sb
        .from('user_profile')
        .update({ subscription_current_period_end: newEndIso })
        .eq('user_id', row.user_id)
      if (mirrorErr) {
        console.warn('[admin/migrate-trial-lengths] mirror failed', row.user_id, mirrorErr.message)
      }
    } catch (err) {
      errors++
      const msg = err instanceof Error ? err.message : String(err)
      console.error('[admin/migrate-trial-lengths] sub update failed', subId, msg)
      details.push({ user_id: row.user_id, email: row.email, action: 'error', reason: msg })
    }
  }

  return NextResponse.json({
    total: rows?.length ?? 0,
    migrated,
    unchanged,
    errors,
    details,
  })
}
