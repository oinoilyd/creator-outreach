/**
 * GET /api/inbox — the signed-in user's threads + unread count.
 *
 * Reads through the user's RLS-scoped client, so they only ever see
 * broadcasts + their own direct threads (enforced by migration 0042
 * policies). Unread count comes from the inbox_unread_count() RPC.
 */
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireUser } from '@/lib/api-auth'
import type { InboxThreadSummary } from '@/lib/inbox'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  const auth = await requireUser()
  if (auth instanceof NextResponse) return auth
  const supabase = await createClient()

  const [threadsRes, readsRes, unreadRes] = await Promise.all([
    supabase
      .from('inbox_threads')
      .select('id, type, subject, allow_replies, updated_at, closed_at')
      .order('updated_at', { ascending: false })
      .limit(100),
    supabase
      .from('inbox_reads')
      .select('thread_id, last_read_at, dismissed')
      .eq('user_id', auth.id),
    supabase.rpc('inbox_unread_count'),
  ])

  const threads = (threadsRes.data ?? []) as Array<{
    id: string; type: 'broadcast' | 'direct'; subject: string; allow_replies: boolean; updated_at: string; closed_at: string | null
  }>
  const reads = new Map(
    ((readsRes.data ?? []) as Array<{ thread_id: string; last_read_at: string; dismissed: boolean }>)
      .map(r => [r.thread_id, r]),
  )

  // Last message per visible thread (one query, grouped client-side).
  const threadIds = threads.map(t => t.id)
  const lastByThread = new Map<string, { body: string; createdAt: string; fromAdmin: boolean }>()
  if (threadIds.length > 0) {
    const { data: msgs } = await supabase
      .from('inbox_messages')
      .select('thread_id, body, created_at, author_is_admin, author_user_id')
      .in('thread_id', threadIds)
      .order('created_at', { ascending: false })
    for (const m of (msgs ?? []) as Array<{ thread_id: string; body: string; created_at: string; author_is_admin: boolean }>) {
      if (!lastByThread.has(m.thread_id)) {
        lastByThread.set(m.thread_id, { body: m.body, createdAt: m.created_at, fromAdmin: m.author_is_admin })
      }
    }
  }

  const summaries: InboxThreadSummary[] = threads.map(t => {
    const read = reads.get(t.id)
    const last = lastByThread.get(t.id) ?? null
    // "New since I last looked" — an admin/other message newer than
    // last_read_at. Dismissing stamps last_read_at = now, so this is
    // also "new since I dismissed it" → a dismissed thread resurfaces
    // only when the admin follows up.
    const lastReadMs = read?.last_read_at ? new Date(read.last_read_at).getTime() : 0
    const hasNewSinceRead = !!last && last.fromAdmin && new Date(last.createdAt).getTime() > lastReadMs
    return {
      id: t.id,
      type: t.type,
      subject: t.subject,
      allowReplies: t.allow_replies,
      updatedAt: t.updated_at,
      lastMessage: last,
      unread: hasNewSinceRead,
      // Hidden only while dismissed AND quiet; new activity un-hides it.
      dismissed: (read?.dismissed ?? false) && !hasNewSinceRead,
      closedAt: t.closed_at,
    }
  })

  return NextResponse.json({
    unreadCount: typeof unreadRes.data === 'number' ? unreadRes.data : 0,
    threads: summaries.filter(s => !s.dismissed),
  })
}
