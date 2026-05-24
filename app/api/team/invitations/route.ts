/**
 * GET  /api/team/invitations         — list pending invites for caller's org
 * POST /api/team/invitations         — create + email a new invite
 * DELETE /api/team/invitations?id=…  — cancel a pending invite
 *
 * Body for POST: { email: string, role: 'admin' | 'member' }
 *
 * Permission rules:
 *   • Owner can invite at any role (admin/member).
 *   • Admin can invite at 'member' only.
 *   • Member cannot invite.
 *
 * Token generation: 32 bytes of crypto-random → base64url (~43 chars).
 * Token lives in the email link + DB; receiver POSTs it back to accept.
 */
import { NextRequest, NextResponse } from 'next/server'
import { randomBytes } from 'crypto'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { sendTeamInviteEmail } from '@/lib/email/team-invite'
import { canInviteAtRole, canInviteMembers } from '@/lib/team'
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

function generateToken(): string {
  return randomBytes(32).toString('base64url')
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
  if (!canInviteMembers(member.role)) {
    return NextResponse.json({ invitations: [] }) // members see empty list
  }

  const { data, error } = await sb
    .from('organization_invitations')
    .select('id, email, role, invited_by, expires_at, accepted_at, created_at')
    .eq('organization_id', member.organization_id)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('[team/invitations] list failed', error)
    return NextResponse.json({ error: 'list failed' }, { status: 500 })
  }

  return NextResponse.json({ invitations: data ?? [] })
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  let body: { email?: string; role?: string } = {}
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'invalid json body' }, { status: 400 })
  }
  const email = (body.email || '').trim().toLowerCase()
  const role = body.role === 'admin' ? 'admin' : 'member'
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: 'valid email required' }, { status: 400 })
  }

  const { sb, member: actor } = await resolveActor(user.id)
  if (!sb) return NextResponse.json({ error: 'service role not configured' }, { status: 500 })
  if (!actor) return NextResponse.json({ error: 'not in any team' }, { status: 404 })
  if (!canInviteAtRole(actor.role, role)) {
    return NextResponse.json({ error: `your role cannot invite at ${role}` }, { status: 403 })
  }

  // Block invites to existing org members (already on the team).
  const { data: existingProfile } = await sb
    .from('user_profile')
    .select('user_id')
    .eq('email', email)
    .maybeSingle()
  if (existingProfile) {
    const { data: existingMembership } = await sb
      .from('organization_members')
      .select('organization_id')
      .eq('user_id', (existingProfile as { user_id: string }).user_id)
      .maybeSingle()
    if (existingMembership) {
      const sameOrg = (existingMembership as { organization_id: string }).organization_id === actor.organization_id
      return NextResponse.json(
        { error: sameOrg ? 'This person is already on your team.' : 'This person is in another team and must leave that first.' },
        { status: 409 },
      )
    }
  }

  // Cancel any prior pending invite for the same (org, email) so the
  // new token replaces it. We don't UNIQUE-constraint at the DB level
  // because that conflicts with re-invite flows; app-level uniqueness
  // is fine for v1.
  await sb
    .from('organization_invitations')
    .delete()
    .eq('organization_id', actor.organization_id)
    .eq('email', email)
    .is('accepted_at', null)

  const token = generateToken()
  const { data: inserted, error: insertErr } = await sb
    .from('organization_invitations')
    .insert({
      organization_id: actor.organization_id,
      email,
      role,
      token,
      invited_by: user.id,
    })
    .select('id, expires_at, organization_id')
    .single()

  if (insertErr || !inserted) {
    console.error('[team/invitations] insert failed', insertErr)
    return NextResponse.json({ error: 'create failed' }, { status: 500 })
  }

  // Build accept URL. We use the request origin so this works in
  // preview deploys + localhost without env-var config.
  const origin =
    req.headers.get('origin') ||
    `${req.nextUrl.protocol}//${req.nextUrl.host}`
  const acceptUrl = `${origin}/team/accept?token=${encodeURIComponent(token)}`

  // Pull org name + inviter info for the email.
  const { data: orgRow } = await sb
    .from('organizations')
    .select('name')
    .eq('id', actor.organization_id)
    .maybeSingle()
  const { data: inviterProfile } = await sb
    .from('user_profile')
    .select('full_name, email')
    .eq('user_id', user.id)
    .maybeSingle()
  const orgName = (orgRow as { name: string } | null)?.name ?? 'Your Team'
  const inviterName = (inviterProfile as { full_name: string | null } | null)?.full_name ?? ''
  const inviterEmail = (inviterProfile as { email: string | null } | null)?.email ?? user.email ?? ''

  const emailSent = await sendTeamInviteEmail({
    to: email,
    orgName,
    inviterName,
    inviterEmail,
    role: role as 'admin' | 'member',
    acceptUrl,
    expiresAt: (inserted as { expires_at: string }).expires_at,
  })

  return NextResponse.json({
    ok: true,
    invitation: inserted,
    emailSent,
    acceptUrl, // returned so admin can copy if email fails
  })
}

export async function DELETE(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const { sb, member } = await resolveActor(user.id)
  if (!sb) return NextResponse.json({ error: 'service role not configured' }, { status: 500 })
  if (!member) return NextResponse.json({ error: 'not in any team' }, { status: 404 })
  if (!canInviteMembers(member.role)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const { error } = await sb
    .from('organization_invitations')
    .delete()
    .eq('id', id)
    .eq('organization_id', member.organization_id)
    .is('accepted_at', null)
  if (error) {
    console.error('[team/invitations] delete failed', error)
    return NextResponse.json({ error: 'delete failed' }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
