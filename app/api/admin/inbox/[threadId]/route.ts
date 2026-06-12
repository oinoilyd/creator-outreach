/**
 * Admin thread view + reply.
 *
 *   GET  → full thread + messages (admin RLS sees every thread).
 *   POST → admin posts a reply (author_is_admin = true). On a direct
 *          thread the recipient gets an email nudge.
 *
 * Admin-gated.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireUser } from '@/lib/api-auth'
import { forbidIfNotAdmin } from '@/lib/admin'
import { sendInboxMessageEmail } from '@/lib/email/inbox-notify'
import type { InboxMessage } from '@/lib/inbox'
import type { AdminThreadDetail } from '@/lib/inbox-admin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type ThreadRow = {
  id: string
  type: 'broadcast' | 'direct'
  subject: string
  allow_replies: boolean
  target_user_id: string | null
}

async function loadThread(threadId: string) {
  const supabase = await createClient()
  const { data: thread } = await supabase
    .from('inbox_threads')
    .select('id, type, subject, allow_replies, target_user_id')
    .eq('id', threadId)
    .maybeSingle()
  return { supabase, thread: (thread as ThreadRow | null) }
}

export async function GET(_req: NextRequest, ctx: { params: Promise<{ threadId: string }> }) {
  const auth = await requireUser()
  if (auth instanceof NextResponse) return auth
  const forbid = forbidIfNotAdmin(auth)
  if (forbid) return forbid
  const { threadId } = await ctx.params
  const { supabase, thread } = await loadThread(threadId)
  if (!thread) return NextResponse.json({ error: 'not found' }, { status: 404 })

  const { data: msgs } = await supabase
    .from('inbox_messages')
    .select('id, body, created_at, author_is_admin, author_user_id')
    .eq('thread_id', threadId)
    .order('created_at', { ascending: true })

  const messages: InboxMessage[] = ((msgs ?? []) as Array<{
    id: string; body: string; created_at: string; author_is_admin: boolean; author_user_id: string | null
  }>).map(m => ({
    id: m.id, body: m.body, createdAt: m.created_at, fromAdmin: m.author_is_admin, authorUserId: m.author_user_id,
  }))

  let withEmail: string | null = null
  if (thread.type === 'direct' && thread.target_user_id) {
    const { data: users } = await supabase.rpc('admin_user_summary')
    withEmail = ((users ?? []) as Array<{ user_id: string; email: string }>)
      .find(u => u.user_id === thread.target_user_id)?.email ?? null
  }

  const detail: AdminThreadDetail = {
    id: thread.id, type: thread.type, subject: thread.subject, allowReplies: thread.allow_replies, withEmail, messages,
  }
  return NextResponse.json(detail)
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ threadId: string }> }) {
  const auth = await requireUser()
  if (auth instanceof NextResponse) return auth
  const forbid = forbidIfNotAdmin(auth)
  if (forbid) return forbid
  const { threadId } = await ctx.params
  const payload = await req.json().catch(() => ({}))
  const text = (payload.body || '').toString().trim().slice(0, 10000)
  if (!text) return NextResponse.json({ error: 'Empty message.' }, { status: 400 })

  const { supabase, thread } = await loadThread(threadId)
  if (!thread) return NextResponse.json({ error: 'not found' }, { status: 404 })

  const { error } = await supabase.from('inbox_messages').insert({
    thread_id: threadId, body: text, author_user_id: null, author_is_admin: true,
  })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  if (thread.type === 'direct' && thread.target_user_id) {
    const { data: users } = await supabase.rpc('admin_user_summary')
    const email = ((users ?? []) as Array<{ user_id: string; email: string }>)
      .find(u => u.user_id === thread.target_user_id)?.email
    if (email) {
      const origin = process.env.NEXT_PUBLIC_SITE_URL || req.headers.get('origin') || ''
      void sendInboxMessageEmail({ to: email, subject: thread.subject || 'New message', preview: text, appUrl: origin || 'https://creatoroutreach.net' })
    }
  }

  return NextResponse.json({ ok: true })
}
