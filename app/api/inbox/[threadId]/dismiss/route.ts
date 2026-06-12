/**
 * POST /api/inbox/[threadId]/dismiss — hide a thread from the user's
 * inbox. Sets inbox_reads.dismissed = true (RLS limits the row to the
 * caller). Doesn't delete anything; a future admin message bumps the
 * thread but it stays dismissed until they reopen it from an archive view.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireUser } from '@/lib/api-auth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(_req: NextRequest, ctx: { params: Promise<{ threadId: string }> }) {
  const auth = await requireUser()
  if (auth instanceof NextResponse) return auth
  const { threadId } = await ctx.params
  const supabase = await createClient()

  const { error } = await supabase
    .from('inbox_reads')
    .upsert(
      { thread_id: threadId, user_id: auth.id, last_read_at: new Date().toISOString(), dismissed: true },
      { onConflict: 'thread_id,user_id' },
    )
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
