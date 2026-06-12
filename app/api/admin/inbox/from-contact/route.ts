/**
 * Phase 4 — answer a contact-form inquiry in-app.
 *
 * Takes a contact_messages row, finds the matching account by email,
 * and spins a DIRECT thread (origin_contact_id links it back). The
 * admin's reply seeds the thread, the inquiry is marked resolved, and
 * the user gets an email nudge.
 *
 * If no account matches the inquiry email (public contact form — the
 * sender may not have signed up), responds 409 with { noAccount, email }
 * so the UI falls back to a plain mailto reply.
 *
 * Admin-gated.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireUser } from '@/lib/api-auth'
import { forbidIfNotAdmin } from '@/lib/admin'
import { sendInboxMessageEmail } from '@/lib/email/inbox-notify'
import { isEmailOptedIn } from '@/lib/email/opt-in'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const auth = await requireUser()
  if (auth instanceof NextResponse) return auth
  const forbid = forbidIfNotAdmin(auth)
  if (forbid) return forbid
  const supabase = await createClient()

  const payload = await req.json().catch(() => ({}))
  const contactId = (payload.contactId || '').toString()
  const text = (payload.body || '').toString().trim().slice(0, 10000)
  if (!contactId) return NextResponse.json({ error: 'contactId required.' }, { status: 400 })
  if (!text) return NextResponse.json({ error: 'Message body is required.' }, { status: 400 })

  // Load the inquiry.
  const { data: contact, error: cErr } = await supabase
    .from('contact_messages')
    .select('id, name, email, message')
    .eq('id', contactId)
    .maybeSingle()
  if (cErr || !contact) return NextResponse.json({ error: 'Inquiry not found.' }, { status: 404 })
  const c = contact as { id: string; name: string; email: string; message: string }

  // Map email → account.
  const { data: users } = await supabase.rpc('admin_user_summary')
  const match = ((users ?? []) as Array<{ user_id: string; email: string }>)
    .find(u => u.email?.toLowerCase() === c.email?.toLowerCase())
  if (!match) {
    return NextResponse.json(
      { error: 'No account matches this email.', noAccount: true, email: c.email },
      { status: 409 },
    )
  }

  // Spin the direct thread, linked back to the inquiry.
  const subject = `Re: your message`
  const { data: thread, error: tErr } = await supabase
    .from('inbox_threads')
    .insert({
      type: 'direct',
      subject,
      target_user_id: match.user_id,
      allow_replies: true,
      origin_contact_id: c.id,
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

  // Resolve the inquiry now that it's been answered in-app.
  await supabase.from('contact_messages').update({ resolved: true }).eq('id', c.id)

  const origin = process.env.NEXT_PUBLIC_SITE_URL || req.headers.get('origin') || ''
  if (await isEmailOptedIn(match.user_id)) {
    void sendInboxMessageEmail({ to: c.email, subject, preview: text, appUrl: origin || 'https://creatoroutreach.net' })
  }

  return NextResponse.json({ ok: true, threadId })
}
