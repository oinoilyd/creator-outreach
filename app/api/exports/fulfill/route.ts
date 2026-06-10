/**
 * POST /api/exports/fulfill — called by the client after Stripe Checkout
 * redirects back with ?export_fulfilled=1&session_id=<sid>.
 *
 * Job: verify the session was actually paid, then grant the user one
 * paid_export_credit. Idempotent with the webhook — whichever fires
 * first wins; the other no-ops because of the paid_exports PK constraint.
 *
 * Why both this AND a webhook?
 *   • Webhook is the authoritative path (Stripe will retry on failure,
 *     guaranteed delivery within minutes).
 *   • Redirect-fulfill makes the UX snappy — user pays, lands back in
 *     the app, gets their export within ~1s instead of waiting for the
 *     webhook to arrive.
 *
 * Race:
 *   • Webhook fires first → paid_exports row exists → this endpoint
 *     sees the conflict, returns { ok: true, already: true }.
 *   • This endpoint fires first → paid_exports inserted, credit
 *     granted → webhook hits the same PK conflict and no-ops.
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

  let body: { session_id?: string } = {}
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'invalid json body' }, { status: 400 })
  }
  const sessionId = (body.session_id || '').trim()
  if (!sessionId || !sessionId.startsWith('cs_')) {
    return NextResponse.json({ error: 'session_id required (cs_…)' }, { status: 400 })
  }

  if (!process.env.STRIPE_SECRET_KEY) {
    return NextResponse.json({ error: 'Stripe not configured' }, { status: 503 })
  }

  const sb = getServiceClient()
  if (!sb) {
    return NextResponse.json({ error: 'service role not configured' }, { status: 500 })
  }

  const stripe = getStripe()
  let session
  try {
    session = await stripe.checkout.sessions.retrieve(sessionId)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.warn('[exports/fulfill] session retrieve failed', sessionId, msg)
    return NextResponse.json({ error: 'session lookup failed' }, { status: 400 })
  }

  // Triple-verify: paid, owned by this user, tagged as an export charge.
  // Anyone could POST an arbitrary session_id, so we never trust the
  // client's word that the session belongs to them — we re-check
  // metadata.supabase_user_id from Stripe.
  if (session.payment_status !== 'paid') {
    return NextResponse.json({ error: 'session not paid', payment_status: session.payment_status }, { status: 402 })
  }
  if (session.metadata?.supabase_user_id !== user.id) {
    console.warn('[exports/fulfill] session ownership mismatch', {
      sessionUser: session.metadata?.supabase_user_id,
      authUser: user.id,
    })
    return NextResponse.json({ error: 'session not owned by user' }, { status: 403 })
  }
  if (session.metadata?.kind !== 'export') {
    return NextResponse.json({ error: 'session is not an export charge' }, { status: 400 })
  }

  // Atomic idempotent grant (migration 0040) — same RPC the webhook
  // uses. Inserts the paid_exports marker + increments the credit in
  // one transaction; returns false when already fulfilled. Replaces
  // the prior read-modify-write that could lose a credit on a missing
  // profile row. Audit 2026-06-10.
  const amountCents = session.amount_total ?? 0
  const { data: granted, error: rpcErr } = await sb.rpc('grant_export_credit', {
    p_user_id: user.id,
    p_session_id: session.id,
    p_amount_cents: amountCents,
    p_fulfilled_via: 'redirect',
  })
  if (rpcErr) {
    console.error('[exports/fulfill] grant_export_credit failed', sessionId, rpcErr.message)
    return NextResponse.json({ error: 'fulfill failed' }, { status: 500 })
  }
  if (granted === false) {
    // Already fulfilled (likely by the webhook). No double-grant.
    return NextResponse.json({ ok: true, already: true })
  }
  return NextResponse.json({ ok: true, already: false })
}
