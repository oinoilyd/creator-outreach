/**
 * /billing/sync — Stripe Customer Portal return-URL trampoline.
 *
 * When a user clicks "Return to creatoroutreach.net" in the Stripe
 * hosted Customer Portal, they land here. This page:
 *
 *   1. Looks up the user's stripe_customer_id from user_profile
 *   2. Calls Stripe to fetch the canonical current subscription state
 *   3. Updates Supabase to match Stripe (Stripe is source of truth)
 *   4. Redirects to /
 *
 * Why: webhook events for some Customer Portal actions (notably the
 * "reinstate subscription" / "Don't cancel" flow) don't reliably fire
 * a customer.subscription.updated. This trampoline ensures Supabase
 * never goes out of sync after a portal visit, regardless of whether
 * the corresponding webhook fired.
 *
 * The user-perceived latency is one extra Stripe API call (~150-250ms)
 * before the redirect — acceptable because they just spent seconds
 * navigating the portal anyway. No UI is shown; this is purely a
 * server-side sync point.
 *
 * If the sync fails (Stripe API down, missing customer_id, etc.) we
 * still redirect — the webhook is the primary path and the UI will
 * just show the last-known state. Failing here would trap users in
 * an error page after a successful portal interaction.
 */

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { syncSubscriptionByCustomerId } from '@/lib/stripe/sync-subscription'
import { getStripe } from '@/lib/stripe/client'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export default async function BillingSyncPage({
  searchParams,
}: {
  searchParams: Promise<{ to?: string; debug?: string }>
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/auth/signin')
  }

  const params = await searchParams
  // Allow caller to override the post-sync landing target (e.g. send
  // them back to /pricing, /billing, /settings instead of /). Default
  // to root app. Guard against open-redirect via origin check — only
  // allow relative paths starting with /.
  const target = params.to && params.to.startsWith('/') ? params.to : '/'

  // Debug mode — return a JSON-ish summary instead of redirecting.
  // Used for diagnosing sync issues without log archaeology. Visit
  // /billing/sync?debug=1 to see the actual sync result inline.
  const debugMode = params.debug === '1'

  // Collect diagnostic info for debug mode
  const debugInfo: Record<string, unknown> = {
    userId: user.id,
    userEmail: user.email,
    timestamp: new Date().toISOString(),
  }

  // Service-role client needed because the sync function updates a
  // user_profile row via stripe_customer_id (not user_id), which is
  // unfriendly to the RLS-aware server client.
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (url && serviceKey) {
    const sb = createServiceClient(url, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })

    const { data: profile, error: profileErr } = await sb
      .from('user_profile')
      .select('stripe_customer_id, stripe_subscription_id, subscription_status, subscription_cancel_at_period_end')
      .eq('user_id', user.id)
      .maybeSingle()

    debugInfo.profileBefore = profile
    debugInfo.profileError = profileErr?.message

    let customerId = profile?.stripe_customer_id as string | undefined

    // Backfill path: if user has no stripe_customer_id stored, try to
    // find one in Stripe by their auth email. This covers users whose
    // checkout's "persist customer_id" step silently failed (e.g.
    // because the migration adding the column hadn't run yet at the
    // time of their original subscription). After we find it, write
    // it back so subsequent syncs hit the fast path immediately.
    if (!customerId && user.email && process.env.STRIPE_SECRET_KEY) {
      try {
        const stripe = getStripe()
        const customers = await stripe.customers.list({
          email: user.email,
          limit: 1,
        })
        const found = customers.data[0]
        if (found) {
          console.log('[billing/sync] backfilling stripe_customer_id from email lookup', {
            userId: user.id,
            email: user.email,
            customerId: found.id,
          })
          const { error: backfillErr } = await sb
            .from('user_profile')
            .update({ stripe_customer_id: found.id })
            .eq('user_id', user.id)
          if (backfillErr) {
            console.error('[billing/sync] backfill update failed', backfillErr.message)
            debugInfo.backfillError = backfillErr.message
          } else {
            customerId = found.id
            debugInfo.backfilled = true
          }
        } else {
          debugInfo.backfillSearched = `no Stripe customer found for email ${user.email}`
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        console.error('[billing/sync] email-lookup backfill threw:', msg)
        debugInfo.backfillError = msg
      }
    }

    if (customerId) {
      // Best-effort. If Stripe is down or the customer object is
      // weird, log + continue to the redirect anyway — the webhook
      // is the primary sync path and we don't want a portal visit
      // to dead-end.
      try {
        console.log('[billing/sync] starting sync', { userId: user.id, customerId })
        const result = await syncSubscriptionByCustomerId(sb, customerId)
        console.log('[billing/sync] sync result', result)
        debugInfo.syncResult = result

        // Read back what's now in the row for debug verification
        const { data: profileAfter } = await sb
          .from('user_profile')
          .select('stripe_subscription_id, subscription_status, subscription_cancel_at_period_end, subscription_current_period_end')
          .eq('user_id', user.id)
          .maybeSingle()
        debugInfo.profileAfter = profileAfter

        if (!result.ok) {
          console.warn('[billing/sync] sync returned non-ok:', result.reason)
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        console.error('[billing/sync] sync threw:', msg)
        debugInfo.error = msg
      }
    } else {
      debugInfo.skipped = 'no stripe_customer_id on profile'
    }
  } else {
    debugInfo.skipped = 'Supabase service role env vars not configured'
    console.warn('[billing/sync] Supabase service role not configured — skipping sync')
  }

  // Debug mode renders the JSON inline so you can see exactly what
  // happened without hunting through Vercel logs.
  if (debugMode) {
    return (
      <main style={{ padding: 24, fontFamily: 'monospace', fontSize: 13, whiteSpace: 'pre-wrap' }}>
        <h1 style={{ fontSize: 18, marginBottom: 16 }}>/billing/sync debug</h1>
        {JSON.stringify(debugInfo, null, 2)}
      </main>
    )
  }

  redirect(target)
}
