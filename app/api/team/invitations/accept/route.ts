/**
 * POST /api/team/invitations/accept — accept a team invitation.
 *
 * Body: { token: string }
 *
 * Flow:
 *   1. User must be signed in (the page redirects to signin first if
 *      not, preserving the token in a query param).
 *   2. Look up the invite by token. Reject if missing/expired/already
 *      accepted.
 *   3. Verify email match: token.email must equal user.email (lowercased).
 *      Prevents an attacker who steals an invite link from joining as
 *      themselves under another person's invite.
 *   4. Block if user already has an org membership.
 *   5. Block if user has an active individual subscription (Dylan's
 *      "cancel first" decision). They must cancel via /pricing → portal
 *      before they can accept.
 *   6. Insert organization_members row with token's role.
 *   7. Mark invitation accepted_at + accepted_by.
 *   8. syncTeamSeatQuantity — Stripe quantity goes up by 1 if total > 5.
 *
 * All steps in a single function so partial-state failures are
 * recoverable (the membership row is the source of truth).
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { syncTeamSeatQuantity } from '@/lib/stripe/team-pricing'
import { extraSeatsQuantity } from '@/lib/team'

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
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  let body: { token?: string } = {}
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'invalid json body' }, { status: 400 })
  }
  const token = (body.token || '').trim()
  if (!token) return NextResponse.json({ error: 'token required' }, { status: 400 })

  const sb = getServiceClient()
  if (!sb) return NextResponse.json({ error: 'service role not configured' }, { status: 500 })

  // Look up the invite.
  const { data: invite, error: inviteErr } = await sb
    .from('organization_invitations')
    .select('id, organization_id, email, role, expires_at, accepted_at')
    .eq('token', token)
    .maybeSingle()
  if (inviteErr || !invite) {
    return NextResponse.json({ error: 'invite not found' }, { status: 404 })
  }
  if (invite.accepted_at) {
    return NextResponse.json({ error: 'invite already used' }, { status: 410 })
  }
  if (new Date(invite.expires_at).getTime() < Date.now()) {
    return NextResponse.json({ error: 'invite expired' }, { status: 410 })
  }

  // Email match (case-insensitive). Belt-and-suspenders: the token is
  // already secret, but binding it to the email closes the "stolen link
  // joins as wrong user" hole.
  const authEmail = (user.email ?? '').toLowerCase()
  if (authEmail !== invite.email) {
    return NextResponse.json(
      { error: `Invitation was sent to ${invite.email}. Sign in with that email to accept.` },
      { status: 403 },
    )
  }

  // Block if user already has an org membership.
  const { data: existingMembership } = await sb
    .from('organization_members')
    .select('organization_id')
    .eq('user_id', user.id)
    .maybeSingle()
  if (existingMembership) {
    return NextResponse.json(
      { error: 'You are already in a team. Leave your current team before accepting another invite.' },
      { status: 409 },
    )
  }

  // Block if user has active individual subscription. Dylan's call:
  // "ask them to cancel first" so there's no surprise double-billing.
  const { data: profileRow } = await sb
    .from('user_profile')
    .select('subscription_status')
    .eq('user_id', user.id)
    .maybeSingle()
  const indivStatus = (profileRow as { subscription_status: string | null } | null)?.subscription_status
  if (indivStatus && ['active', 'trialing', 'past_due'].includes(indivStatus)) {
    return NextResponse.json(
      {
        error: 'You have an active individual subscription. Cancel it first (Settings → Billing → Manage), then come back and click the invite link again.',
        requiresIndividualCancel: true,
      },
      { status: 409 },
    )
  }

  // Insert membership.
  const { error: memberErr } = await sb
    .from('organization_members')
    .insert({
      organization_id: invite.organization_id,
      user_id: user.id,
      role: invite.role,
      invited_at: new Date().toISOString(),
    })
  if (memberErr) {
    console.error('[team/invitations/accept] member insert failed', memberErr)
    return NextResponse.json({ error: 'membership create failed' }, { status: 500 })
  }

  // Mark invitation accepted.
  await sb
    .from('organization_invitations')
    .update({ accepted_at: new Date().toISOString(), accepted_by: user.id })
    .eq('id', invite.id)

  // Sync Stripe seat count upward.
  const { data: org } = await sb
    .from('organizations')
    .select('stripe_subscription_id')
    .eq('id', invite.organization_id)
    .maybeSingle()
  if (org && (org as { stripe_subscription_id: string | null }).stripe_subscription_id) {
    const { count } = await sb
      .from('organization_members')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', invite.organization_id)
    try {
      await syncTeamSeatQuantity(
        (org as { stripe_subscription_id: string }).stripe_subscription_id,
        extraSeatsQuantity(count ?? 0),
      )
    } catch (err) {
      // Non-fatal — membership is created, billing reconcile happens
      // on next webhook or manual sync.
      console.error('[team/invitations/accept] seat sync failed', err)
    }
  }

  return NextResponse.json({ ok: true, organization_id: invite.organization_id })
}
