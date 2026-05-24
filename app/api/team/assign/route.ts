/**
 * POST /api/team/assign — reassign one or more outreach rows to a
 * different team member.
 *
 * Body: { entryIds: string[], assigneeUserId: string }
 *
 * Authorization:
 *   • Caller must be Owner/Admin of an org.
 *   • Target rows must belong to caller's org.
 *   • assigneeUserId must be a member of caller's org.
 *
 * Use case: Admin distributes leads to staff. Members can also
 * self-assign (e.g., "I'll take this one") if assigneeUserId === their
 * own id — but only on rows they can already see (RLS handles that).
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { canAssignToOthers } from '@/lib/team'
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

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  let body: { entryIds?: string[]; assigneeUserId?: string } = {}
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'invalid json body' }, { status: 400 })
  }
  const entryIds = Array.isArray(body.entryIds) ? body.entryIds.slice(0, 500) : []
  const assigneeUserId = (body.assigneeUserId || '').trim()
  if (entryIds.length === 0 || !assigneeUserId) {
    return NextResponse.json({ error: 'entryIds + assigneeUserId required' }, { status: 400 })
  }

  const sb = getServiceClient()
  if (!sb) return NextResponse.json({ error: 'service role not configured' }, { status: 500 })

  // Caller membership.
  const { data: actor } = await sb
    .from('organization_members')
    .select('organization_id, role')
    .eq('user_id', user.id)
    .maybeSingle()
  if (!actor) {
    return NextResponse.json({ error: 'not in any team' }, { status: 404 })
  }
  const role = (actor as { role: OrganizationRole }).role
  const orgId = (actor as { organization_id: string }).organization_id

  // Members can only self-assign. Admin/Owner can assign to anyone in
  // the org.
  if (!canAssignToOthers(role)) {
    if (assigneeUserId !== user.id) {
      return NextResponse.json({ error: 'forbidden — members can only self-assign' }, { status: 403 })
    }
  }

  // Verify the assignee is in the same org. Closes the "assign to a
  // user_id outside the org" loophole that bypasses RLS visibility.
  const { data: assigneeMember } = await sb
    .from('organization_members')
    .select('user_id')
    .eq('organization_id', orgId)
    .eq('user_id', assigneeUserId)
    .maybeSingle()
  if (!assigneeMember) {
    return NextResponse.json({ error: 'assignee is not in your team' }, { status: 400 })
  }

  // Update only rows that belong to this org. RLS would block writes
  // outside the org anyway, but the WHERE clause makes the failure
  // explicit (no silent zero-row updates).
  const { data: updated, error: updateErr } = await sb
    .from('outreach_entries')
    .update({ assigned_to_user_id: assigneeUserId })
    .in('id', entryIds)
    .eq('organization_id', orgId)
    .select('id')

  if (updateErr) {
    console.error('[team/assign] update failed', updateErr)
    return NextResponse.json({ error: 'update failed' }, { status: 500 })
  }

  return NextResponse.json({ ok: true, assigned: updated?.length ?? 0 })
}
