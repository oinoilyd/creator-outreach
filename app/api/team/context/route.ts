/**
 * GET /api/team/context — current user's team membership state.
 *
 * Used by the client to decide what to show in the hamburger menu:
 *   • mode='individual' → "Upgrade to Team" CTA
 *   • mode='team' + role='owner'/'admin' → "Invite team member" CTA
 *   • mode='team' + role='member' → no CTA (members can't invite)
 *
 * Auth required. Falls back to individual mode on any DB error so a
 * misconfigured deploy doesn't break the app.
 */
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getTeamContextForUser } from '@/lib/team-context'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ mode: 'individual', organization: null, role: null })
  }

  const ctx = await getTeamContextForUser(user.id)
  return NextResponse.json(ctx)
}
