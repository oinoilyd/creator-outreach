/**
 * POST /api/inbox/[threadId]/reply — user posts a reply.
 *
 *   • Direct thread targeting the user → message inserted into it.
 *   • Reply-enabled broadcast → a private direct thread is spun off
 *     (service role), linked back via origin_thread_id, and the reply
 *     lands there. Keeps the broadcast one-to-many while letting people
 *     ask questions privately.
 *
 * Either way the admin gets an email so they know to respond.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { requireUser, rateLimit } from '@/lib/api-auth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const ADMIN_EMAIL = 'dmeehanj@gmail.com'
const FROM_ADDRESS = 'Creator Outreach <noreply@creatoroutreach.net>'

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  return createServiceClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
}

async function notifyAdmin(subject: string, userEmail: string, body: string) {
  const key = process.env.RESEND_API_KEY
  if (!key) return
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  try {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: FROM_ADDRESS,
        to: [ADMIN_EMAIL],
        reply_to: userEmail,
        subject: `[Inbox reply] ${subject}`,
        html: `<div style="font-family:system-ui,sans-serif;max-width:560px;padding:20px;color:#111">
          <p style="margin:0 0 4px"><strong>${esc(userEmail)}</strong> replied:</p>
          <div style="white-space:pre-wrap;background:#f7f7f8;border:1px solid #e5e7eb;border-radius:8px;padding:12px;line-height:1.5">${esc(body)}</div>
          <p style="margin-top:16px;color:#6b7280;font-size:12px">Reply from /admin → Messages.</p>
        </div>`,
      }),
    })
  } catch { /* non-fatal */ }
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ threadId: string }> }) {
  const auth = await requireUser()
  if (auth instanceof NextResponse) return auth
  const limited = rateLimit(auth.id, 'inbox-reply', 60, auth.email)
  if (limited) return limited

  const { threadId } = await ctx.params
  const body = await req.json().catch(() => ({}))
  const text = (body.body || '').toString().trim().slice(0, 5000)
  if (!text) return NextResponse.json({ error: 'Empty message.' }, { status: 400 })

  const supabase = await createClient()
  const { data: thread } = await supabase
    .from('inbox_threads')
    .select('id, type, subject, allow_replies, target_user_id, closed_at')
    .eq('id', threadId)
    .maybeSingle()
  if (!thread) return NextResponse.json({ error: 'not found' }, { status: 404 })
  const t = thread as { id: string; type: 'broadcast' | 'direct'; subject: string; allow_replies: boolean; target_user_id: string | null; closed_at: string | null }

  // Closed ticket → no more replies; the user must start a new message.
  if (t.closed_at) {
    return NextResponse.json({ error: 'This conversation was closed. Start a new message instead.' }, { status: 409 })
  }

  // Direct thread that's mine → reply straight in (RLS allows the insert).
  if (t.type === 'direct' && t.target_user_id === auth.id) {
    // Admin can send a one-way direct message (replies turned off).
    if (!t.allow_replies) {
      return NextResponse.json({ error: 'Replies are turned off for this message.' }, { status: 403 })
    }
    const { error } = await supabase.from('inbox_messages').insert({
      thread_id: threadId, body: text, author_user_id: auth.id, author_is_admin: false,
    })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    void notifyAdmin(t.subject || 'Direct message', auth.email ?? 'a user', text)
    return NextResponse.json({ ok: true })
  }

  // Reply-enabled broadcast → spin a private direct thread (service role).
  if (t.type === 'broadcast' && t.allow_replies) {
    const sb = getServiceClient()
    if (!sb) return NextResponse.json({ error: 'service unavailable' }, { status: 503 })
    const { data: newThread, error: tErr } = await sb
      .from('inbox_threads')
      .insert({
        type: 'direct',
        target_user_id: auth.id,
        subject: t.subject ? `Re: ${t.subject}` : 'Reply to announcement',
        origin_thread_id: t.id,
        allow_replies: true,
      })
      .select('id')
      .single()
    if (tErr || !newThread) return NextResponse.json({ error: tErr?.message ?? 'could not start thread' }, { status: 500 })
    const newId = (newThread as { id: string }).id
    const { error: mErr } = await sb.from('inbox_messages').insert({
      thread_id: newId, body: text, author_user_id: auth.id, author_is_admin: false,
    })
    if (mErr) return NextResponse.json({ error: mErr.message }, { status: 500 })
    void notifyAdmin(`Re: ${t.subject || 'announcement'}`, auth.email ?? 'a user', text)
    return NextResponse.json({ ok: true, newThreadId: newId })
  }

  return NextResponse.json({ error: 'This thread doesn\'t accept replies.' }, { status: 403 })
}
