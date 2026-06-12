/**
 * GET /api/inbox/[threadId] — messages in a thread + mark it read.
 *
 * RLS guarantees the user can only fetch a thread that's a broadcast
 * or targets them. Opening a thread upserts an inbox_reads row with
 * last_read_at = now, clearing its unread state.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireUser } from '@/lib/api-auth'
import type { InboxThreadDetail, InboxMessage } from '@/lib/inbox'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(_req: NextRequest, ctx: { params: Promise<{ threadId: string }> }) {
  const auth = await requireUser()
  if (auth instanceof NextResponse) return auth
  const { threadId } = await ctx.params
  const supabase = await createClient()

  const { data: thread, error: tErr } = await supabase
    .from('inbox_threads')
    .select('id, type, subject, allow_replies')
    .eq('id', threadId)
    .maybeSingle()
  if (tErr || !thread) {
    return NextResponse.json({ error: 'not found' }, { status: 404 })
  }
  const t = thread as { id: string; type: 'broadcast' | 'direct'; subject: string; allow_replies: boolean }

  const { data: msgs } = await supabase
    .from('inbox_messages')
    .select('id, body, created_at, author_is_admin, author_user_id')
    .eq('thread_id', threadId)
    .order('created_at', { ascending: true })

  const messages: InboxMessage[] = ((msgs ?? []) as Array<{
    id: string; body: string; created_at: string; author_is_admin: boolean; author_user_id: string | null
  }>).map(m => ({
    id: m.id,
    body: m.body,
    createdAt: m.created_at,
    fromAdmin: m.author_is_admin,
    authorUserId: m.author_user_id,
  }))

  // Mark read — upsert the per-user read row.
  await supabase
    .from('inbox_reads')
    .upsert(
      { thread_id: threadId, user_id: auth.id, last_read_at: new Date().toISOString(), dismissed: false },
      { onConflict: 'thread_id,user_id' },
    )

  const detail: InboxThreadDetail = {
    id: t.id,
    type: t.type,
    subject: t.subject,
    allowReplies: t.allow_replies,
    messages,
  }
  return NextResponse.json(detail)
}
