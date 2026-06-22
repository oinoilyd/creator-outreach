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
import { syncTeamSeatQuantity } from '@/lib/stripe/team-pricing'
import { extraSeatsQuantity } from '@/lib/team'
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

/**
 * "Is this subscription scheduled to cancel?" — defended against
 * Stripe's two-track cancellation model.
 *
 * Stripe represents pending cancellation via EITHER:
 *   • cancel_at_period_end = true       — cancels at current_period_end
 *   • cancel_at = <unix timestamp>      — cancels at that specific time
 *
 * They're mutually exclusive (setting cancel_at flips cancel_at_period_end
 * to false in Stripe's data model). The Customer Portal picks one based
 * on the flow. From our UI's perspective they're equivalent: "the user
 * has scheduled cancellation; show the warn-styled canceling state".
 *
 * Lifting this into one helper so both the webhook handler and the
 * portal-return sync make the same call.
 */
function isCanceling(sub: Stripe.Subscription): boolean {
  if (sub.cancel_at_period_end) return true
  if (sub.cancel_at != null && sub.cancel_at > 0) return true
  return false
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

  // Two-phase idempotency ledger:
  //   1. INSERT marks the event "received"
  //   2. UPDATE processed_at after the handler completes successfully
  // Dedupe only short-circuits when processed_at IS NOT NULL. This way
  // a delivery that threw mid-handler (500 → Stripe retry) will be
  // re-run, not silently swallowed. See migration 0025.
  const { error: insertErr } = await sb
    .from('stripe_events')
    .insert({ stripe_event_id: event.id, event_type: event.type })
  if (insertErr) {
    if ((insertErr as { code?: string }).code === '23505') {
      // Duplicate event.id — check whether the previous attempt
      // actually completed. If processed_at is set, we're done.
      // If still null, fall through and re-run the handler.
      const { data: existing } = await sb
        .from('stripe_events')
        .select('processed_at')
        .eq('stripe_event_id', event.id)
        .single()
      if (existing?.processed_at) {
        return NextResponse.json({ received: true, deduped: true })
      }
      // Else: existing row but never processed. Continue → handler
      // will run again, and the UPDATE at the end marks it done.
    } else {
      console.error('[stripe/webhook] event-ledger insert failed', insertErr)
      // Other error — fall through. Better to process than to drop.
    }
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session

        // Three flavors of Checkout sessions land here:
        //   • mode='payment' + metadata.kind='export'  — $50 one-off
        //     export charge (Dylan 2026-05-24)
        //   • mode='subscription' + metadata.kind='team' — Team plan
        //     creation; we provision the Organization + Owner row
        //     here on payment success (Dylan 2026-05-24)
        //   • mode='subscription' (default) — individual subscription
        // Branch on session.mode + metadata.kind to keep the flows
        // cleanly separated.
        if (session.mode === 'payment' && session.metadata?.kind === 'export') {
          await grantExportCredit(sb, session)
          break
        }

        if (session.mode === 'subscription' && session.metadata?.kind === 'team') {
          await provisionTeamFromCheckout(sb, session, stripe)
          break
        }

        // Default: individual subscription-mode handling.
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
          subscription_cancel_at_period_end: isCanceling(sub),
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
        if (sub.metadata?.kind === 'team') {
          await syncTeamSubscription(sb, sub)
        } else {
          const customerId =
            typeof sub.customer === 'string' ? sub.customer : sub.customer.id
          await applySubUpdate(sb, customerId, {
            stripe_subscription_id: sub.id,
            subscription_status: sub.status,
            subscription_current_period_end: periodEndIso(sub),
            subscription_price_id: priceIdFromSub(sub),
            subscription_cancel_at_period_end: isCanceling(sub),
          }, subscriptionMetadataUserId(sub))
        }
        break
      }

      case 'customer.subscription.updated': {
        const sub = event.data.object as Stripe.Subscription
        if (sub.metadata?.kind === 'team') {
          await syncTeamSubscription(sb, sub)
        } else {
          const customerId =
            typeof sub.customer === 'string' ? sub.customer : sub.customer.id
          await applySubUpdate(sb, customerId, {
            stripe_subscription_id: sub.id,
            subscription_status: sub.status,
            subscription_current_period_end: periodEndIso(sub),
            subscription_price_id: priceIdFromSub(sub),
            subscription_cancel_at_period_end: isCanceling(sub),
          }, subscriptionMetadataUserId(sub))
        }
        break
      }

      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription
        if (sub.metadata?.kind === 'team') {
          // Team subscription canceled — mark org's status canceled.
          // We DON'T auto-delete the org; the Owner may resubscribe.
          // Data stays in place; access is gated by subscription
          // status in middleware.
          await sb
            .from('organizations')
            .update({ subscription_status: 'canceled' })
            .eq('stripe_subscription_id', sub.id)
        } else {
          const customerId =
            typeof sub.customer === 'string' ? sub.customer : sub.customer.id
          // Don't NULL stripe_subscription_id — we still want a paper
          // trail. Just flip status to 'canceled'.
          await applySubUpdate(sb, customerId, {
            subscription_status: 'canceled',
            subscription_cancel_at_period_end: false,
          }, subscriptionMetadataUserId(sub))
        }
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
    // Return 500 so Stripe retries. processed_at remains NULL on the
    // ledger row, so the dedupe path will allow re-processing on
    // retry (instead of silently skipping). See migration 0025.
    return NextResponse.json({ error: 'handler failed', detail: msg }, { status: 500 })
  }

  // Phase 2 of the idempotency ledger: handler completed successfully,
  // stamp processed_at so subsequent retries of this event.id are
  // recognized as duplicates and short-circuited with 200.
  const { error: stampErr } = await sb
    .from('stripe_events')
    .update({ processed_at: new Date().toISOString() })
    .eq('stripe_event_id', event.id)
  if (stampErr) {
    // Not fatal — the handler did its work. Worst case: a retry
    // re-runs the (idempotent) handler. Log for visibility.
    console.warn('[stripe/webhook] failed to stamp processed_at', event.id, stampErr.message)
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

/**
 * Provision a new Organization + Owner membership when a Team-plan
 * Checkout session completes (Dylan 2026-05-24).
 *
 * Idempotent — re-running for the same subscription_id (e.g. webhook
 * retry) is a no-op: we check for an existing org with the same
 * stripe_subscription_id and skip if found.
 *
 * Migration step: copies the Owner's existing outreach_entries into
 * the new organization, setting organization_id + created_by_user_id
 * + assigned_to_user_id. This preserves all their pre-team data so
 * "Upgrade to Team" feels like a smooth transition, not a fresh start.
 */
async function provisionTeamFromCheckout(
  sb: ReturnType<typeof getServiceClient> extends infer T ? Exclude<T, null> : never,
  session: Stripe.Checkout.Session,
  stripe: Stripe,
): Promise<void> {
  const userId = sessionMetadataUserId(session)
  const teamName = (session.metadata?.team_name || '').trim() || 'My Team'
  const subId =
    typeof session.subscription === 'string'
      ? session.subscription
      : session.subscription?.id
  const customerId =
    typeof session.customer === 'string' ? session.customer : session.customer?.id

  if (!userId || !subId || !customerId) {
    console.warn('[stripe/webhook] team checkout missing required fields', {
      userId, subId, customerId,
    })
    return
  }

  // Idempotency: if an org already exists for this subscription, skip.
  // Webhook retries will land here and no-op.
  const { data: existing } = await sb
    .from('organizations')
    .select('id')
    .eq('stripe_subscription_id', subId)
    .maybeSingle()
  if (existing) {
    console.info('[stripe/webhook] team already provisioned', subId)
    return
  }

  // Refresh sub from Stripe to get current status + period_end.
  const sub = await stripe.subscriptions.retrieve(subId)

  // Generate a URL-safe slug from the team name. Append a short random
  // suffix to dodge collisions without a slow uniqueness check loop.
  const baseSlug = teamName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40) || 'team'
  const slug = `${baseSlug}-${Math.random().toString(36).slice(2, 6)}`

  // Insert the organization row.
  const { data: orgRow, error: orgErr } = await sb
    .from('organizations')
    .insert({
      name: teamName,
      slug,
      stripe_customer_id: customerId,
      stripe_subscription_id: sub.id,
      subscription_status: sub.status,
      subscription_current_period_end: periodEndIso(sub),
      seats_provisioned: 5, // base plan starts at 5 included seats
    })
    .select('id')
    .single()

  if (orgErr || !orgRow) {
    console.error('[stripe/webhook] org insert failed', { teamName, error: orgErr?.message })
    throw orgErr ?? new Error('org insert returned no row')
  }
  const orgId = orgRow.id

  // Add the buyer as Owner.
  const { error: memberErr } = await sb
    .from('organization_members')
    .insert({
      organization_id: orgId,
      user_id: userId,
      role: 'owner',
    })
  if (memberErr) {
    console.error('[stripe/webhook] owner member insert failed', { orgId, userId, error: memberErr.message })
    throw memberErr
  }

  // Migrate the owner's existing individual outreach into the org —
  // smooth transition rather than a fresh-start. Set:
  //   organization_id     = new org
  //   created_by_user_id  = owner (already backfilled to user_id but
  //                         re-set explicitly to be safe)
  //   assigned_to_user_id = owner (they're the only member)
  // Anything they had on the individual plan stays in their pipeline.
  const { error: migrateErr } = await sb
    .from('outreach_entries')
    .update({
      organization_id: orgId,
      created_by_user_id: userId,
      assigned_to_user_id: userId,
    })
    .eq('user_id', userId)
    .is('organization_id', null)
  if (migrateErr) {
    // Non-fatal — org is created, but their data didn't migrate.
    // They'll see an empty pipeline. Log loudly so we can backfill.
    console.error('[stripe/webhook] outreach migration failed', {
      orgId, userId, error: migrateErr.message,
    })
  }

  console.info('[stripe/webhook] team provisioned', { orgId, userId, teamName })
}

/**
 * Sync a Stripe Team subscription's status/period back to the
 * `organizations` row. Called from subscription.created and
 * subscription.updated when metadata.kind='team'.
 */
async function syncTeamSubscription(
  sb: ReturnType<typeof getServiceClient> extends infer T ? Exclude<T, null> : never,
  sub: Stripe.Subscription,
): Promise<void> {
  const { data: orgRow, error } = await sb
    .from('organizations')
    .update({
      subscription_status: sub.status,
      subscription_current_period_end: periodEndIso(sub),
    })
    .eq('stripe_subscription_id', sub.id)
    .select('id')
    .maybeSingle()
  if (error) {
    console.error('[stripe/webhook] team sub sync failed', { subId: sub.id, error: error.message })
    return
  }

  // Self-heal seat quantity from the CURRENT member count on every team
  // subscription event (including the monthly customer.subscription.updated
  // renewal). invite-accept syncs seats inline, but that call is best-effort
  // — if it failed (Stripe timeout/5xx) the extra seat was never billed and
  // nothing repaired it, a silent permanent revenue leak. Reconciling here
  // closes the gap within one billing cycle. syncTeamSeatQuantity is
  // idempotent (no-ops when already at target), so this converges and can't
  // loop. (Audit BILL-H1.)
  if (orgRow?.id) {
    const { count, error: countErr } = await sb
      .from('organization_members')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', orgRow.id)
    if (countErr) {
      console.error('[stripe/webhook] team seat reconcile — member count failed', { subId: sub.id, error: countErr.message })
      return
    }
    try {
      await syncTeamSeatQuantity(sub.id, extraSeatsQuantity(count ?? 0))
    } catch (e) {
      console.error('[stripe/webhook] team seat reconcile failed', { subId: sub.id, error: (e as Error).message })
    }
  }
}

/**
 * Grant the user one paid_export_credit for a $50 export Checkout
 * session.
 *
 * Idempotent with /api/exports/fulfill — both paths INSERT into
 * paid_exports keyed on stripe_session_id, so duplicate delivery from
 * either side hits the PK conflict and no-ops without re-granting the
 * credit.
 */
async function grantExportCredit(
  sb: ReturnType<typeof getServiceClient> extends infer T ? Exclude<T, null> : never,
  session: Stripe.Checkout.Session,
): Promise<void> {
  const supabaseUserId = sessionMetadataUserId(session)
  if (!supabaseUserId) {
    console.warn('[stripe/webhook] export session missing supabase_user_id', session.id)
    return
  }
  if (session.payment_status !== 'paid') {
    console.warn('[stripe/webhook] export session not paid', session.id, session.payment_status)
    return
  }
  const amountCents = session.amount_total ?? 0

  // Atomic idempotent grant (migration 0040). Replaces the prior
  // read-then-write that (a) lost the credit if the profile row was
  // missing and (b) wasn't atomic. The RPC inserts the idempotency
  // marker + increments the credit in one transaction; returns false
  // when the session was already fulfilled. A raised exception
  // (missing profile) rolls back the marker so Stripe's retry can
  // re-attempt cleanly. Audit 2026-06-10.
  const { data: granted, error: rpcErr } = await sb.rpc('grant_export_credit', {
    p_user_id: supabaseUserId,
    p_session_id: session.id,
    p_amount_cents: amountCents,
    p_fulfilled_via: 'webhook',
  })
  if (rpcErr) {
    console.error('[stripe/webhook] grant_export_credit failed', session.id, rpcErr.message)
    throw rpcErr // let the webhook 500 so Stripe retries before processed_at is stamped
  }
  if (granted === false) {
    // Already fulfilled by the redirect path or a prior delivery — no-op.
    return
  }
}
