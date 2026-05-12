/**
 * lib/stripe/sync-subscription.ts — reusable Stripe → Supabase sync.
 *
 * Why this exists:
 *
 *   Webhooks are the happy path for keeping Supabase's mirror of
 *   subscription state in sync with Stripe. They're fast, push-based,
 *   and idempotent. BUT they're not 100% reliable:
 *
 *     - Stripe occasionally doesn't fire `customer.subscription.updated`
 *       for Customer Portal actions like "reinstate after cancel"
 *       (observed live in our test environment 2026-05-12).
 *     - Webhook events that hit a broken endpoint (missing env var,
 *       unrun migration, etc.) are retried for 3 days and then
 *       permanently abandoned by Stripe — the event becomes
 *       unreachable history.
 *     - Customer-id-based UPDATEs match 0 rows silently if the local
 *       row hasn't yet had its stripe_customer_id backfilled.
 *
 *   This module provides a polling-style fallback: given a customer
 *   ID, fetch the canonical state from Stripe and patch Supabase to
 *   match. Stripe is always the source of truth; we never push
 *   anything back to Stripe from here.
 *
 *   Usage:
 *
 *     - `/billing/sync` page calls this whenever the user returns
 *       from the Stripe Customer Portal — closes the loop for any
 *       portal action even if its webhook never fired.
 *     - Background reconciler (future) can call this in batch over
 *       all rows with `stripe_customer_id IS NOT NULL` to catch
 *       arbitrary drift.
 *     - Webhook handler fallback can call this if a customer_id-based
 *       UPDATE matched 0 rows (belt-and-suspenders).
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type Stripe from 'stripe'
import { getStripe } from './client'

export interface SubscriptionSyncResult {
  /** True if the sync completed without throwing. */
  ok: boolean
  /** True if at least one user_profile row was actually changed. */
  updated: boolean
  /** Short description of the outcome — useful for logs / debug pages. */
  reason: string
  /** The subscription ID written, if any. Null when the customer has no sub. */
  subscriptionId: string | null
  /** The subscription status written. Null when no sub. */
  status: string | null
}

/**
 * Fetch the most recent subscription for `stripeCustomerId` from Stripe
 * and update the matching `user_profile` row.
 *
 * If the customer has NO subscriptions at all (never subscribed or fully
 * deleted), we NULL out the subscription_* columns so the UI reverts to
 * "Upgrade" — important to avoid stale state.
 *
 * Caller must pass a service-role Supabase client (subscriptions live in
 * other users' rows when an admin reconciles in batch).
 */
export async function syncSubscriptionByCustomerId(
  sb: SupabaseClient,
  stripeCustomerId: string,
): Promise<SubscriptionSyncResult> {
  const stripe = getStripe()

  // status: 'all' so we see canceled / paused subs too. limit:1 + the
  // default ordering (created desc) means we always pull the most
  // recently created — which is the one the user cares about.
  const subs = await stripe.subscriptions.list({
    customer: stripeCustomerId,
    limit: 1,
    status: 'all',
  })

  const sub: Stripe.Subscription | undefined = subs.data[0]

  if (!sub) {
    // Customer exists but has no subscriptions. Clear any stale state
    // so the UI doesn't keep showing "Trial · Xd left" forever.
    const { data, error } = await sb
      .from('user_profile')
      .update({
        stripe_subscription_id: null,
        subscription_status: null,
        subscription_current_period_end: null,
        subscription_price_id: null,
        subscription_cancel_at_period_end: false,
      })
      .eq('stripe_customer_id', stripeCustomerId)
      .select('user_id')

    if (error) {
      return {
        ok: false,
        updated: false,
        reason: `clear-stale failed: ${error.message}`,
        subscriptionId: null,
        status: null,
      }
    }
    const updated = (data?.length ?? 0) > 0
    return {
      ok: true,
      updated,
      reason: updated ? 'cleared stale subscription state' : 'no sub on Stripe + no matching row to clear',
      subscriptionId: null,
      status: null,
    }
  }

  const periodEndIso = periodEnd(sub)
  const priceId = sub.items?.data?.[0]?.price?.id ?? null

  const { data, error } = await sb
    .from('user_profile')
    .update({
      stripe_subscription_id: sub.id,
      subscription_status: sub.status,
      subscription_current_period_end: periodEndIso,
      subscription_price_id: priceId,
      subscription_cancel_at_period_end: sub.cancel_at_period_end ?? false,
    })
    .eq('stripe_customer_id', stripeCustomerId)
    .select('user_id')

  if (error) {
    return {
      ok: false,
      updated: false,
      reason: `update failed: ${error.message}`,
      subscriptionId: sub.id,
      status: sub.status,
    }
  }

  const updated = (data?.length ?? 0) > 0
  return {
    ok: true,
    updated,
    reason: updated
      ? `synced ${sub.id} (${sub.status})`
      : `no row matched stripe_customer_id ${stripeCustomerId} — may need backfill`,
    subscriptionId: sub.id,
    status: sub.status,
  }
}

/**
 * Defensive read of current_period_end across Stripe SDK versions.
 * Older SDKs put it at the top level; newer ones nest it under
 * items.data[0]. Try both, return null if neither is present.
 */
function periodEnd(sub: Stripe.Subscription): string | null {
  const candidates: Array<number | null | undefined> = [
    (sub as unknown as { current_period_end?: number }).current_period_end,
    sub.items?.data?.[0]?.current_period_end,
  ]
  const epoch = candidates.find((v): v is number => typeof v === 'number' && v > 0)
  return epoch ? new Date(epoch * 1000).toISOString() : null
}
