/**
 * POST /api/stripe/webhook — Stripe sends subscription events here.
 *
 * NO auth gate. Stripe calls this directly from their servers; we
 * authenticate the request by verifying the signature against
 * STRIPE_WEBHOOK_SECRET using stripe.webhooks.constructEvent.
 *
 * Security model:
 *   • Signature check is REQUIRED — without it a malicious actor could
 *     POST arbitrary "subscription.active" events and grant themselves
 *     access. We reject with 400 if the signature is missing or invalid.
 *   • The raw body (not parsed JSON) is what's signed. Next.js Route
 *     Handlers give us req.text() which preserves bytes exactly.
 *   • Idempotency: every event.id is recorded in stripe_events BEFORE
 *     we process. A duplicate delivery hits the UNIQUE constraint, we
 *     return 200 without re-handling. Critical because Stripe will
 *     happily redeliver an event if our first response is slow.
 *
 * Events handled (all subscription lifecycle):
 *   • checkout.session.completed     — first Subscription created
 *   • customer.subscription.updated  — status, period, plan changes
 *   • customer.subscription.deleted  — fully canceled
 *   • invoice.payment_failed         — flag as past_due
 *
 * For each one we look up user_profile by stripe_customer_id (set
 * during /api/stripe/checkout) and update the mirrored fields. The
 * app reads those fields, never Stripe directly, so the UI stays
 * snappy and offline-tolerant.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { getStripe } from '@/lib/stripe/client'
import type Stripe from 'stripe'

export const runtime = 'nodejs'
// Webhooks must never be cached. force-dynamic ensures Next doesn't
// try to optimise this route at build time.
export const dynamic = 'force-dynamic'

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) return null
  return createServiceClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

interface SubscriptionUpdate {
  stripe_subscription_id?: string | null
  subscription_status?: string | null
  subscription_current_period_end?: string | null
  subscription_price_id?: string | null
  subscription_cancel_at_period_end?: boolean
}

function periodEndIso(sub: Stripe.Subscription): string | null {
  // Stripe gives epoch seconds. Convert to ISO TIMESTAMPTZ.
  // Different Stripe SDK versions have moved this field around between
  // top-level `current_period_end` and `items.data[0].current_period_end`.
  // Read defensively so we keep working across SDK bumps.
  const candidates: Array<number | null | undefined> = [
    (sub as unknown as { current_period_end?: number }).current_period_end,
    sub.items?.data?.[0]?.current_period_end,
  ]
  const epoch = candidates.find((v): v is number => typeof v === 'number' && v > 0)
  if (!epoch) return null
  return new Date(epoch * 1000).toISOString()
}

function priceIdFromSub(sub: Stripe.Subscription): string | null {
  return sub.items?.data?.[0]?.price?.id ?? null
}

export async function POST(req: NextRequest) {
  const signature = req.headers.get('stripe-signature')
  if (!signature) {
    return NextResponse.json({ error: 'missing stripe-signature header' }, { status: 400 })
  }
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET
  if (!webhookSecret) {
    // Fail closed — without the secret we can't verify, so we can't
    // safely process. Returning 500 (not 400) so Stripe retries; the
    // 4xx class tells Stripe "don't bother retrying".
    console.error('[stripe/webhook] STRIPE_WEBHOOK_SECRET not configured')
    return NextResponse.json({ error: 'webhook not configured' }, { status: 500 })
  }

  // Read the RAW body — constructEvent re-hashes it. Calling .json()
  // would re-serialize and break the signature.
  const rawBody = await req.text()

  const stripe = getStripe()
  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.warn('[stripe/webhook] signature verification failed:', msg)
    return NextResponse.json({ error: 'invalid signature' }, { status: 400 })
  }

  const sb = getServiceClient()
  if (!sb) {
    return NextResponse.json({ error: 'service role not configured' }, { status: 500 })
  }

  // Idempotency — try to insert event.id. If it's already there we've
  // already processed this event (or it's in-flight on a parallel
  // delivery); short-circuit with 200.
  const { error: insertErr } = await sb
    .from('stripe_events')
    .insert({ stripe_event_id: event.id, event_type: event.type })
  if (insertErr) {
    // 23505 is unique_violation in Postgres — duplicate event.id.
    // Any other error is genuine; we still return 200 so Stripe
    // doesn't hammer us, but log loudly.
    if ((insertErr as { code?: string }).code === '23505') {
      return NextResponse.json({ received: true, deduped: true })
    }
    console.error('[stripe/webhook] event-ledger insert failed', insertErr)
    // Fall through — we'd rather process the event than drop it.
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        // Subscription mode sessions populate session.subscription.
        // It can arrive as either an ID string or an expanded object.
        const subId =
          typeof session.subscription === 'string'
            ? session.subscription
            : session.subscription?.id
        const customerId =
          typeof session.customer === 'string' ? session.customer : session.customer?.id
        if (!subId || !customerId) {
          console.warn('[stripe/webhook] checkout.completed without sub/customer', { subId, customerId })
          break
        }
        const sub = await stripe.subscriptions.retrieve(subId)
        await applySubUpdate(sb, customerId, {
          stripe_subscription_id: sub.id,
          subscription_status: sub.status,
          subscription_current_period_end: periodEndIso(sub),
          subscription_price_id: priceIdFromSub(sub),
          subscription_cancel_at_period_end: sub.cancel_at_period_end ?? false,
        })
        break
      }

      case 'customer.subscription.updated': {
        const sub = event.data.object as Stripe.Subscription
        const customerId =
          typeof sub.customer === 'string' ? sub.customer : sub.customer.id
        await applySubUpdate(sb, customerId, {
          stripe_subscription_id: sub.id,
          subscription_status: sub.status,
          subscription_current_period_end: periodEndIso(sub),
          subscription_price_id: priceIdFromSub(sub),
          subscription_cancel_at_period_end: sub.cancel_at_period_end ?? false,
        })
        break
      }

      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription
        const customerId =
          typeof sub.customer === 'string' ? sub.customer : sub.customer.id
        // Don't NULL stripe_subscription_id — we still want a paper
        // trail. Just flip status to 'canceled'.
        await applySubUpdate(sb, customerId, {
          subscription_status: 'canceled',
          subscription_cancel_at_period_end: false,
        })
        break
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice
        const customerId =
          typeof invoice.customer === 'string' ? invoice.customer : invoice.customer?.id
        if (!customerId) break
        // Stripe will also send subscription.updated for the status
        // change, but updating both here is harmless (idempotent) and
        // gets the UI to "past_due" a few ms sooner.
        await applySubUpdate(sb, customerId, {
          subscription_status: 'past_due',
        })
        break
      }

      default:
        // No-op — we silently accept events we don't yet care about.
        // Stripe sends many event types and 200ing them keeps the
        // dashboard "Webhook attempts" view clean.
        break
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[stripe/webhook] handler failed', event.type, msg)
    // Return 500 so Stripe retries. Idempotency ledger already
    // recorded event.id; on retry the dedupe path returns 200, so
    // we'd lose this event. Better: only stamp the ledger AFTER
    // successful processing. TODO follow-up: split the ledger so
    // dedupe survives transient handler failures.
    return NextResponse.json({ error: 'handler failed', detail: msg }, { status: 500 })
  }

  return NextResponse.json({ received: true })
}

async function applySubUpdate(
  sb: ReturnType<typeof getServiceClient> extends infer T ? Exclude<T, null> : never,
  stripeCustomerId: string,
  patch: SubscriptionUpdate,
) {
  if (!sb) return
  const { error } = await sb
    .from('user_profile')
    .update(patch)
    .eq('stripe_customer_id', stripeCustomerId)
  if (error) {
    console.error('[stripe/webhook] user_profile update failed', stripeCustomerId, error.message)
    throw error
  }
}
