/**
 * POST /api/inbox/new — a user starts a brand-new message to the admin.
 *
 * Users can't INSERT into inbox_threads under RLS (admin-only), so this
 * runs through the service role: it creates a direct thread targeting
 * the user themselves (so they own + can continue it), seeds their first
 * message, and emails the admin. The admin sees it as a "needs reply"
 * thread in /admin/messages.
 */
import { NextRequest, NextResponse } from 'next/server'
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
        subject: `[Inbox] New message: ${subject}`,
        html: `<div style="font-family:system-ui,sans-serif;max-width:560px;padding:20px;color:#111">
          <p style="margin:0 0 4px"><strong>${esc(userEmail)}</strong> started a thread:</p>
          <p style="margin:0 0 8px;font-weight:600">${esc(subject)}</p>
          <div style="white-space:pre-wrap;background:#f7f7f8;border:1px solid #e5e7eb;border-radius:8px;padding:12px;line-height:1.5">${esc(body)}</div>
          <p style="margin-top:16px;color:#6b7280;font-size:12px">Reply from /admin → Messages.</p>
        </div>`,
      }),
    })
  } catch { /* non-fatal */ }
}

export async function POST(req: NextRequest) {
  const auth = await requireUser()
  if (auth instanceof NextResponse) return auth
  const limited = rateLimit(auth.id, 'inbox-new', 30, auth.email)
  if (limited) return limited

  const payload = await req.json().catch(() => ({}))
  const subject = (payload.subject || '').toString().trim().slice(0, 200)
  const text = (payload.body || '').toString().trim().slice(0, 5000)
  if (!text) return NextResponse.json({ error: 'Message body is required.' }, { status: 400 })

  const sb = getServiceClient()
  if (!sb) return NextResponse.json({ error: 'service unavailable' }, { status: 503 })

  const { data: thread, error: tErr } = await sb
    .from('inbox_threads')
    .insert({
      type: 'direct',
      target_user_id: auth.id,
      subject: subject || 'New message',
      allow_replies: true,
    })
    .select('id')
    .single()
  if (tErr || !thread) {
    return NextResponse.json({ error: tErr?.message ?? 'Could not start thread.' }, { status: 500 })
  }
  const threadId = (thread as { id: string }).id

  const { error: mErr } = await sb.from('inbox_messages').insert({
    thread_id: threadId, body: text, author_user_id: auth.id, author_is_admin: false,
  })
  if (mErr) return NextResponse.json({ error: mErr.message }, { status: 500 })

  void notifyAdmin(subject || 'New message', auth.email ?? 'a user', text)
  return NextResponse.json({ ok: true, threadId })
}
