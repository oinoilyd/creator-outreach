/**
 * POST /api/unipile/send — send an outreach email via Unipile.
 *
 * Replaces the compose-URL hack. After this lands, "Send Email" in
 * the UI calls this route, which:
 *   1. Validates the user is logged in + has a connected Unipile account.
 *   2. Re-runs the recipient guard (empty/invalid/self) server-side so
 *      a tampered client can't bypass it.
 *   3. Fires Unipile's POST /api/v1/emails with the prebuilt body.
 *   4. Persists message_id / thread_id / provider_id / sent_at /
 *      tracking_id back onto the outreach_entries row — the webhook
 *      uses these to match replies and open events back.
 *   5. Auto-flips status to 'No Response' if the entry was still
 *      'Not Outreached' (same rule as the old click-to-track path).
 *
 * Request body:
 *   {
 *     entryId: string  // outreach_entries.id we're sending for
 *     to:      string  // recipient email
 *     subject: string
 *     body:    string  // plain text — we wrap to minimal HTML server-side
 *     toDisplayName?: string
 *     enableOpenTracking?: boolean   // default false for first sends
 *     enableLinkTracking?: boolean   // default false
 *   }
 *
 * Rate-limited: 60 sends per user per hour. Generous for normal use,
 * tight enough that a stuck retry loop can't spam Gmail.
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireUser, rateLimit } from '@/lib/api-auth'
import { createClient } from '@/lib/supabase/server'
import { sendEmail, UnipileError } from '@/lib/unipile'
import { recipientIssue } from '@/lib/format'

export const runtime = 'nodejs'
export const maxDuration = 30

interface SendRequestBody {
  entryId?: string
  to?: string
  subject?: string
  body?: string
  toDisplayName?: string
  enableOpenTracking?: boolean
  enableLinkTracking?: boolean
}

/** Wrap plain text into a minimal HTML email body so most clients
 *  render it sensibly. Preserves line breaks. Does NOT add a
 *  signature, footer, or tracking pixel — those are Unipile's job. */
function plainToHtml(text: string): string {
  const escaped = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
  return `<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 14px; line-height: 1.6; color: #1a1a1a;">${escaped.replace(/\n/g, '<br>')}</div>`
}

export async function POST(req: NextRequest) {
  const auth = await requireUser()
  if (auth instanceof NextResponse) return auth
  const user = auth

  const limited = rateLimit(user.id, 'unipile-send', 60)
  if (limited) return limited

  let body: SendRequestBody
  try {
    body = (await req.json()) as SendRequestBody
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const entryId = body.entryId?.trim()
  const to = body.to?.trim() ?? ''
  const subject = body.subject?.trim() ?? ''
  const textBody = body.body ?? ''

  if (!entryId) return NextResponse.json({ error: 'entryId is required' }, { status: 400 })
  if (!subject) return NextResponse.json({ error: 'subject is required' }, { status: 400 })
  if (!textBody.trim()) return NextResponse.json({ error: 'body is required' }, { status: 400 })

  // Recipient guard — same logic the client UI runs, re-enforced server-side.
  const issue = recipientIssue(to, user.email)
  if (issue !== null) {
    return NextResponse.json(
      { error: `Refusing to send: recipient is ${issue}`, code: issue },
      { status: 400 },
    )
  }

  // Load the user's Unipile account + verify the entry belongs to them.
  const supabase = await createClient()
  const [{ data: profile }, { data: entry, error: entryErr }] = await Promise.all([
    supabase
      .from('user_profile')
      .select('unipile_account_id, unipile_account_email')
      .eq('user_id', user.id)
      .single(),
    supabase
      .from('outreach_entries')
      .select('id, status, channel_name, email')
      .eq('id', entryId)
      .eq('user_id', user.id)
      .single(),
  ])

  if (entryErr || !entry) {
    return NextResponse.json({ error: 'Outreach entry not found or not yours' }, { status: 404 })
  }
  const accountId = profile?.unipile_account_id as string | null | undefined
  if (!accountId) {
    return NextResponse.json(
      {
        error: 'No Gmail account connected',
        hint: 'Open Profile and click Connect Gmail before sending.',
      },
      { status: 412 },
    )
  }

  try {
    const sent = await sendEmail({
      accountId,
      to,
      toDisplayName: body.toDisplayName ?? entry.channel_name,
      subject,
      body: plainToHtml(textBody),
      bodyType: 'html',
      tracking: {
        opens: body.enableOpenTracking ?? false,
        links: body.enableLinkTracking ?? false,
        label: entryId,
      },
    })

    // Persist the Unipile identifiers so Phase 3 / Phase 5 can match
    // replies and opens back. Status flip to 'No Response' only on
    // the first send — re-sends from a row already in flight don't
    // walk the status backwards.
    const nextStatus =
      entry.status === 'Not Outreached' || !entry.status ? 'No Response' : entry.status
    const nowIso = new Date().toISOString()
    const { error: updateErr } = await supabase
      .from('outreach_entries')
      .update({
        unipile_message_id: sent.id ?? null,
        unipile_provider_id: sent.provider_id ?? null,
        unipile_thread_id: sent.thread_id ?? null,
        unipile_tracking_id: sent.tracking_id ?? null,
        unipile_sent_at: nowIso,
        status: nextStatus,
        reached_out: nextStatus !== 'Not Outreached',
        date_reached_out: entry.status === 'Not Outreached' || !entry.status ? nowIso : undefined,
      })
      .eq('id', entryId)
      .eq('user_id', user.id)

    if (updateErr) {
      // Email already sent — we just couldn't persist. Surface so the
      // user can manually note it, but don't pretend the send failed.
      console.error('[unipile/send] persist failed after successful send', updateErr)
      return NextResponse.json(
        {
          ok: true,
          sent: { messageId: sent.id, threadId: sent.thread_id, providerId: sent.provider_id },
          warning: `Email sent but DB update failed: ${updateErr.message}`,
        },
        { status: 200 },
      )
    }

    return NextResponse.json({
      ok: true,
      sent: {
        messageId: sent.id ?? null,
        threadId: sent.thread_id ?? null,
        providerId: sent.provider_id ?? null,
        trackingId: sent.tracking_id ?? null,
      },
    })
  } catch (err) {
    if (err instanceof UnipileError) {
      console.error('[unipile/send] Unipile error', err.status, err.message)
      return NextResponse.json(
        { error: err.message, status: err.status },
        { status: err.status === 0 ? 500 : 502 },
      )
    }
    console.error('[unipile/send] unexpected', err)
    return NextResponse.json({ error: 'Failed to send email' }, { status: 500 })
  }
}
