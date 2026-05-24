/**
 * GET  /api/team/members        — list current org's members + roles
 * DELETE /api/team/members?id=… — remove a member (Owner/Admin only;
 *                                 Admin cannot remove Owner; nobody
 *                                 can self-remove via this endpoint)
 *
 * Returns 403 if the caller isn't authorized for the requested op.
 * Returns 404 if the caller isn't in any org.
 *
 * After a successful removal, calls syncTeamSeatQuantity so Stripe
 * billing reflects the lower seat count immediately (and the Owner
 * is credited via proration).
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { syncTeamSeatQuantity } from '@/lib/stripe/team-pricing'
import { extraSeatsQuantity, canRemoveTargetMember } from '@/lib/team'
import type { OrganizationRole } from '@/lib/team'

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

async function resolveActor(userId: string) {
  const sb = getServiceClient()
  if (!sb) return { sb: null as ReturnType<typeof getServiceClient>, member: null as { organization_id: string; role: OrganizationRole } | null }
  const { data } = await sb
    .from('organization_members')
    .select('organization_id, role')
    .eq('user_id', userId)
    .maybeSingle()
  return { sb, member: data as { organization_id: string; role: OrganizationRole } | null }
}

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { sb, member } = await resolveActor(user.id)
  if (!sb) return NextResponse.json({ error: 'service role not configured' }, { status: 500 })
  if (!member) return NextResponse.json({ error: 'not in any team' }, { status: 404 })

  // Join with auth.users via service role to get email + display name.
  // auth.users is in the auth schema, not public, so we can't SELECT
  // directly via the client RPC. Two-step query is fine.
  const { data: members, error: membersErr } = await sb
    .from('organization_members')
    .select('id, user_id, role, joined_at, invited_at, invited_by')
    .eq('organization_id', member.organization_id)
  if (membersErr) {
    console.error('[team/members] list failed', membersErr)
    return NextResponse.json({ error: 'list failed' }, { status: 500 })
  }

  // Hydrate emails via auth admin API (service role).
  const userIds = (members ?? []).map(m => m.user_id)
  const emailMap = new Map<string, string>()
  const nameMap = new Map<string, string>()
  if (userIds.length > 0) {
    const { data: profiles } = await sb
      .from('user_profile')
      .select('user_id, email, full_name')
      .in('user_id', userIds)
    for (const p of (profiles ?? []) as Array<{ user_id: string; email: string | null; full_name: string | null }>) {
      if (p.email) emailMap.set(p.user_id, p.email)
      if (p.full_name) nameMap.set(p.user_id, p.full_name)
    }
  }

  return NextResponse.json({
    organization_id: member.organization_id,
    your_role: member.role,
    members: (members ?? []).map(m => ({
      id: m.id,
      userId: m.user_id,
      email: emailMap.get(m.user_id) ?? '',
      fullName: nameMap.get(m.user_id) ?? '',
      role: m.role as OrganizationRole,
      joinedAt: m.joined_at,
      invitedAt: m.invited_at,
    })),
  })
}

export async function DELETE(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const memberIdToRemove = req.nextUrl.searchParams.get('id')
  if (!memberIdToRemove) {
    return NextResponse.json({ error: 'id query param required' }, { status: 400 })
  }

  const { sb, member: actor } = await resolveActor(user.id)
  if (!sb) return NextResponse.json({ error: 'service role not configured' }, { status: 500 })
  if (!actor) return NextResponse.json({ error: 'not in any team' }, { status: 404 })

  // Look up target member to check role + org match.
  const { data: target, error: targetErr } = await sb
    .from('organization_members')
    .select('id, user_id, role, organization_id')
    .eq('id', memberIdToRemove)
    .maybeSingle()
  if (targetErr || !target) {
    return NextResponse.json({ error: 'member not found' }, { status: 404 })
  }
  if (target.organization_id !== actor.organization_id) {
    // Don't disclose other orgs' membership IDs.
    return NextResponse.json({ error: 'member not found' }, { status: 404 })
  }
  if (target.user_id === user.id) {
    return NextResponse.json({ error: 'use /api/team/leave to remove yourself' }, { status: 400 })
  }
  if (!canRemoveTargetMember(actor.role, target.role as OrganizationRole)) {
    return NextResponse.json({ error: 'forbidden by role' }, { status: 403 })
  }

  // Reassign their outreach rows back to the Owner (so we don't orphan
  // any rows on the Member's removal). Find the Owner first.
  const { data: ownerRow } = await sb
    .from('organization_members')
    .select('user_id')
    .eq('organization_id', actor.organization_id)
    .eq('role', 'owner')
    .maybeSingle()

  if (ownerRow) {
    await sb
      .from('outreach_entries')
      .update({ assigned_to_user_id: (ownerRow as { user_id: string }).user_id })
      .eq('organization_id', actor.organization_id)
      .eq('assigned_to_user_id', target.user_id)
  }

  // Delete the membership row.
  const { error: deleteErr } = await sb
    .from('organization_members')
    .delete()
    .eq('id', memberIdToRemove)
  if (deleteErr) {
    console.error('[team/members] delete failed', deleteErr)
    return NextResponse.json({ error: 'delete failed' }, { status: 500 })
  }

  // Sync Stripe seat quantity downward.
  const { data: org } = await sb
    .from('organizations')
    .select('stripe_subscription_id')
    .eq('id', actor.organization_id)
    .maybeSingle()
  if (org && (org as { stripe_subscription_id: string | null }).stripe_subscription_id) {
    const { count } = await sb
      .from('organization_members')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', actor.organization_id)
    try {
      await syncTeamSeatQuantity(
        (org as { stripe_subscription_id: string }).stripe_subscription_id,
        extraSeatsQuantity(count ?? 0),
      )
    } catch (err) {
      // Non-fatal — Stripe will reconcile via the next webhook or a
      // manual sync. Worst case: customer is charged for one extra seat
      // for the rest of the period.
      console.error('[team/members] seat sync failed', err)
    }
  }

  return NextResponse.json({ ok: true })
}
