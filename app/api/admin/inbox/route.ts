/**
 * Admin inbox — list every thread + create a new one.
 *
 *   GET  → all threads (broadcast + direct) with last message, the
 *          other party's email, and a "needs reply" flag; plus the
 *          recipient list for the composer (admin_user_summary).
 *   POST → create a broadcast (NULL target) or a direct thread to one
 *          user. Seeds the first message; direct threads also email
 *          the recipient (broadcasts stay in-app — reputation).
 *
 * Admin-gated. The admin's authenticated client can write threads +
 * messages directly (RLS admin policies in migration 0042).
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireUser } from '@/lib/api-auth'
import { forbidIfNotAdmin } from '@/lib/admin'
import { sendInboxMessageEmail, sendBroadcastEmails } from '@/lib/email/inbox-notify'
import type { AdminThreadSummary, AdminRecipient } from '@/lib/inbox-admin'

const ADMIN_EMAIL = 'dmeehanj@gmail.com'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type ThreadRow = {
  id: string
  type: 'broadcast' | 'direct'
  subject: string
  allow_replies: boolean
  updated_at: string
  target_user_id: string | null
  origin_contact_id: string | null
  closed_at: string | null
}

export async function GET() {
  const auth = await requireUser()
  if (auth instanceof NextResponse) return auth
  const forbid = forbidIfNotAdmin(auth)
  if (forbid) return forbid
  const supabase = await createClient()

  const [threadsRes, usersRes] = await Promise.all([
    supabase
      .from('inbox_threads')
      .select('id, type, subject, allow_replies, updated_at, target_user_id, origin_contact_id, closed_at')
      .order('updated_at', { ascending: false })
      .limit(200),
    supabase.rpc('admin_user_summary'),
  ])

  const threads = (threadsRes.data ?? []) as ThreadRow[]
  const emailByUser = new Map<string, string>(
    ((usersRes.data ?? []) as Array<{ user_id: string; email: string }>).map(u => [u.user_id, u.email]),
  )
  const recipients: AdminRecipient[] = ((usersRes.data ?? []) as Array<{ user_id: string; email: string }>)
    .map(u => ({ userId: u.user_id, email: u.email }))
    .sort((a, b) => a.email.localeCompare(b.email))

  // Last message per thread (one query).
  const threadIds = threads.map(t => t.id)
  const lastByThread = new Map<string, { body: string; fromAdmin: boolean; createdAt: string }>()
  if (threadIds.length > 0) {
    const { data: msgs } = await supabase
      .from('inbox_messages')
      .select('thread_id, body, created_at, author_is_admin')
      .in('thread_id', threadIds)
      .order('created_at', { ascending: false })
    for (const m of (msgs ?? []) as Array<{ thread_id: string; body: string; created_at: string; author_is_admin: boolean }>) {
      if (!lastByThread.has(m.thread_id)) {
        lastByThread.set(m.thread_id, { body: m.body, fromAdmin: m.author_is_admin, createdAt: m.created_at })
      }
    }
  }

  const summaries: AdminThreadSummary[] = threads.map(t => {
    const last = lastByThread.get(t.id) ?? null
    return {
      id: t.id,
      type: t.type,
      subject: t.subject,
      allowReplies: t.allow_replies,
      updatedAt: t.updated_at,
      withEmail: t.type === 'direct' && t.target_user_id ? emailByUser.get(t.target_user_id) ?? '(unknown)' : null,
      lastMessage: last,
      needsReply: !!last && !last.fromAdmin && !t.closed_at,
      fromInquiry: t.origin_contact_id != null,
      closedAt: t.closed_at,
    }
  })

  return NextResponse.json({ threads: summaries, recipients })
}

export async function POST(req: NextRequest) {
  const auth = await requireUser()
  if (auth instanceof NextResponse) return auth
  const forbid = forbidIfNotAdmin(auth)
  if (forbid) return forbid
  const supabase = await createClient()

  const body = await req.json().catch(() => ({}))
  const kind = body.kind === 'direct' ? 'direct' : body.kind === 'broadcast' ? 'broadcast' : null
  const subject = (body.subject || '').toString().trim().slice(0, 200)
  const text = (body.body || '').toString().trim().slice(0, 10000)
  const allowReplies = body.allowReplies !== false // default true
  const emailEveryone = body.emailEveryone === true // broadcast opt-in
  const targetUserId = (body.targetUserId || '').toString() || null

  if (!kind) return NextResponse.json({ error: 'kind must be "broadcast" or "direct".' }, { status: 400 })
  if (!text) return NextResponse.json({ error: 'Message body is required.' }, { status: 400 })
  if (kind === 'direct' && !targetUserId) {
    return NextResponse.json({ error: 'Pick a recipient for a direct message.' }, { status: 400 })
  }

  const { data: thread, error: tErr } = await supabase
    .from('inbox_threads')
    .insert({
      type: kind,
      subject,
      target_user_id: kind === 'direct' ? targetUserId : null,
      // Honour the toggle for BOTH kinds now — a direct message can be
      // one-way (no member reply) too.
      allow_replies: allowReplies,
    })
    .select('id')
    .single()
  if (tErr || !thread) {
    return NextResponse.json({ error: tErr?.message ?? 'Could not create thread.' }, { status: 500 })
  }
  const threadId = (thread as { id: string }).id

  const { error: mErr } = await supabase.from('inbox_messages').insert({
    thread_id: threadId, body: text, author_user_id: null, author_is_admin: true,
  })
  if (mErr) return NextResponse.json({ error: mErr.message }, { status: 500 })

  const origin = process.env.NEXT_PUBLIC_SITE_URL || req.headers.get('origin') || ''
  const appUrl = origin || 'https://creatoroutreach.net'

  // Direct messages notify the one recipient by email.
  if (kind === 'direct' && targetUserId) {
    const { data: users } = await supabase.rpc('admin_user_summary')
    const recipient = ((users ?? []) as Array<{ user_id: string; email: string }>).find(u => u.user_id === targetUserId)
    if (recipient?.email) {
      void sendInboxMessageEmail({ to: recipient.email, subject: subject || 'New message', preview: text, appUrl })
    }
  }

  // Broadcasts email everyone ONLY when the admin opted in (mass-mail is
  // a reputation risk, so it's per-broadcast, not automatic).
  if (kind === 'broadcast' && emailEveryone) {
    const { data: users } = await supabase.rpc('admin_user_summary')
    const recipients = ((users ?? []) as Array<{ email: string }>)
      .map(u => u.email)
      .filter((e): e is string => !!e && e.toLowerCase() !== ADMIN_EMAIL)
    void sendBroadcastEmails({ recipients, subject: subject || 'New announcement', preview: text, appUrl, allowReplies })
  }

  return NextResponse.json({ ok: true, threadId })
}
