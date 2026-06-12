/**
 * POST /api/admin/inbox/[threadId]/close — close or reopen a ticket.
 *
 * Body: { closed: boolean }. Closing stamps closed_at = now (the user
 * then can't reply and must start a new message); reopening clears it.
 * Admin-gated; the admin's authenticated client can UPDATE inbox_threads
 * via the admin RLS policy.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireUser } from '@/lib/api-auth'
import { forbidIfNotAdmin } from '@/lib/admin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest, ctx: { params: Promise<{ threadId: string }> }) {
  const auth = await requireUser()
  if (auth instanceof NextResponse) return auth
  const forbid = forbidIfNotAdmin(auth)
  if (forbid) return forbid

  const { threadId } = await ctx.params
  const payload = await req.json().catch(() => ({}))
  const closed = payload.closed !== false // default: close

  const supabase = await createClient()
  const { error } = await supabase
    .from('inbox_threads')
    .update({ closed_at: closed ? new Date().toISOString() : null })
    .eq('id', threadId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, closed })
}
