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

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export default async function BillingSyncPage({
  searchParams,
}: {
  searchParams: Promise<{ to?: string }>
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

  // Service-role client needed because the sync function updates a
  // user_profile row via stripe_customer_id (not user_id), which is
  // unfriendly to the RLS-aware server client.
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (url && serviceKey) {
    const sb = createServiceClient(url, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })

    const { data: profile } = await sb
      .from('user_profile')
      .select('stripe_customer_id')
      .eq('user_id', user.id)
      .maybeSingle()

    const customerId = profile?.stripe_customer_id as string | undefined
    if (customerId) {
      // Best-effort. If Stripe is down or the customer object is
      // weird, log + continue to the redirect anyway — the webhook
      // is the primary sync path and we don't want a portal visit
      // to dead-end.
      try {
        const result = await syncSubscriptionByCustomerId(sb, customerId)
        if (!result.ok) {
          console.warn('[billing/sync] sync returned non-ok:', result.reason)
        }
      } catch (err) {
        console.error('[billing/sync] sync threw:', err)
      }
    }
  } else {
    console.warn('[billing/sync] Supabase service role not configured — skipping sync')
  }

  redirect(target)
}
