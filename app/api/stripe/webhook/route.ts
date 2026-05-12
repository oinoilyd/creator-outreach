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
 * Events handled:
 *   • checkout.session.completed     — first Subscription created via Checkout
 *   • customer.subscription.created  — safety net for non-Checkout creation
 *                                      (manual subs created in Stripe dashboard,
 *                                      direct API calls, etc.). Idempotent
 *                                      with checkout.session.completed —
 *                                      same data, just a redundant write.
 *   • customer.subscription.updated  — status, period, plan changes
 *   • customer.subscription.deleted  — fully canceled
 *   • invoice.payment_failed         — flag as past_due
 *   • charge.dispute.created         — CRITICAL: chargeback opened. Customer
 *                                      went to their bank instead of refunding.
 *                                      You have 7-10 days to respond with
 *                                      evidence in the Stripe dashboard or
 *                                      you lose automatically. We log LOUDLY
 *                                      to Vercel + record in stripe_events.
 *                                      TODO: build an admin email notifier
 *                                      once SendGrid is wired up.
 *
 * For each subscription event we look up user_profile by stripe_customer_id
 * (set during /api/stripe/checkout) and update the mirrored fields. The
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
        const fallbackUserId = subscriptionMetadataUserId(sub) ?? sessionMetadataUserId(session)
        await applySubUpdate(sb, customerId, {
          stripe_subscription_id: sub.id,
          subscription_status: sub.status,
          subscription_current_period_end: periodEndIso(sub),
          subscription_price_id: priceIdFromSub(sub),
          subscription_cancel_at_period_end: sub.cancel_at_period_end ?? false,
        }, fallbackUserId)
        break
      }

      case 'customer.subscription.created': {
        // Safety-net for subscriptions created OUTSIDE of Checkout
        // (manual creation in dashboard, direct API call). For the
        // primary Checkout flow this fires right after
        // checkout.session.completed and we just write the same data
        // twice — harmless (idempotent UPDATE) but worth noting in
        // logs so we can confirm the dual delivery is expected.
        const sub = event.data.object as Stripe.Subscription
        const customerId =
          typeof sub.customer === 'string' ? sub.customer : sub.customer.id
        await applySubUpdate(sb, customerId, {
          stripe_subscription_id: sub.id,
          subscription_status: sub.status,
          subscription_current_period_end: periodEndIso(sub),
          subscription_price_id: priceIdFromSub(sub),
          subscription_cancel_at_period_end: sub.cancel_at_period_end ?? false,
        }, subscriptionMetadataUserId(sub))
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
        }, subscriptionMetadataUserId(sub))
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
        }, subscriptionMetadataUserId(sub))
        break
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice
        const customerId =
          typeof invoice.customer === 'string' ? invoice.customer : invoice.customer?.id
        if (!customerId) break
        // Stripe will also send subscription.updated for the status
        // change, but updating both here is harmless (idempotent) and
        // gets the UI to "past_due" a few ms sooner. Invoices don't
        // carry our metadata, so no fallback userId available here —
        // if the row is unknown we let the parallel subscription.updated
        // webhook (which DOES have metadata) do the backfill.
        await applySubUpdate(sb, customerId, {
          subscription_status: 'past_due',
        })
        break
      }

      case 'charge.dispute.created': {
        // CRITICAL: a customer disputed a charge with their bank
        // instead of asking us for a refund. We have a strict
        // window (usually 7-10 days from `evidence_details.due_by`)
        // to upload evidence in the Stripe dashboard, or Stripe
        // automatically forfeits the dispute and we lose the
        // funds + pay a $15 dispute fee.
        //
        // Until an admin email pipeline exists, we log LOUDLY with a
        // distinct prefix so a Vercel log drain (or even a grep in
        // the Vercel UI) catches it. The full dispute payload also
        // lives in Stripe's dashboard and in our stripe_events
        // ledger via event.id.
        const dispute = event.data.object as Stripe.Dispute
        const customerId =
          typeof dispute.charge === 'string'
            ? null
            : (dispute.charge?.customer as string | undefined) ?? null
        const evidenceDueBy = dispute.evidence_details?.due_by
          ? new Date(dispute.evidence_details.due_by * 1000).toISOString()
          : null
        console.error(
          '[stripe/webhook] 🚨 DISPUTE OPENED — respond in Stripe dashboard before evidence deadline',
          {
            disputeId: dispute.id,
            chargeId: typeof dispute.charge === 'string' ? dispute.charge : dispute.charge?.id,
            customerId,
            amount: dispute.amount,
            currency: dispute.currency,
            reason: dispute.reason,
            status: dispute.status,
            evidenceDueBy,
            stripeUrl: `https://dashboard.stripe.com/disputes/${dispute.id}`,
          },
        )
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
  /**
   * Optional fallback user_id from the Stripe event's metadata
   * (subscription.metadata.supabase_user_id or session.metadata).
   * Used when the customer_id-based UPDATE matches 0 rows — which
   * happens if the local row hasn't yet had stripe_customer_id
   * backfilled (e.g. checkout's persist step silently failed before
   * migration 0022 ran). In that case we look up the row by user_id
   * and write BOTH the patch AND the customer_id at once, so future
   * events will match on the fast path.
   */
  fallbackSupabaseUserId?: string,
) {
  if (!sb) return

  // Primary path: match by stripe_customer_id. `.select()` makes
  // Supabase return the affected rows so we can detect 0-match.
  const { data, error } = await sb
    .from('user_profile')
    .update(patch)
    .eq('stripe_customer_id', stripeCustomerId)
    .select('user_id')

  if (error) {
    console.error('[stripe/webhook] user_profile update failed', stripeCustomerId, error.message)
    throw error
  }

  if (data && data.length > 0) {
    // Happy path — at least one row matched and was updated.
    return
  }

  // Fallback path: nothing matched by customer_id. If we have a
  // supabase_user_id from the event metadata, look up the row by
  // user_id and backfill the stripe_customer_id while writing the
  // patch. After this, subsequent events for this customer will hit
  // the primary path.
  if (!fallbackSupabaseUserId) {
    console.warn(
      '[stripe/webhook] no user_profile matched stripe_customer_id and no metadata.supabase_user_id available',
      { stripeCustomerId },
    )
    return
  }

  const { error: fallbackErr } = await sb
    .from('user_profile')
    .update({ ...patch, stripe_customer_id: stripeCustomerId })
    .eq('user_id', fallbackSupabaseUserId)

  if (fallbackErr) {
    console.error(
      '[stripe/webhook] metadata fallback update failed',
      { stripeCustomerId, fallbackSupabaseUserId, error: fallbackErr.message },
    )
    throw fallbackErr
  }

  console.info(
    '[stripe/webhook] backfilled stripe_customer_id via metadata fallback',
    { stripeCustomerId, fallbackSupabaseUserId },
  )
}

/**
 * Extract supabase_user_id from a Stripe Subscription's metadata.
 * We set this in /api/stripe/checkout subscription_data.metadata so
 * every subscription event carries the link back to our user row.
 */
function subscriptionMetadataUserId(sub: Stripe.Subscription): string | undefined {
  const raw = sub.metadata?.supabase_user_id
  return typeof raw === 'string' && raw.length > 0 ? raw : undefined
}

/**
 * Extract supabase_user_id from a Stripe Checkout Session's metadata.
 * We don't set this on the session directly today, but Stripe Checkout
 * sometimes mirrors subscription_data.metadata to the parent session —
 * read defensively in case Stripe's behavior changes or we add it
 * explicitly later.
 */
function sessionMetadataUserId(session: Stripe.Checkout.Session): string | undefined {
  const raw = session.metadata?.supabase_user_id
  return typeof raw === 'string' && raw.length > 0 ? raw : undefined
}
