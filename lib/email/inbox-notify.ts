/**
 * Inbox email notifications (direct messages + opt-in broadcasts).
 *
 * Sent so the member checks their IN-APP inbox — replies belong in the
 * app so they stay threaded in the admin triage queue. Sent from a
 * no-reply address, but with Reply-To pointed at a human-monitored
 * mailbox as a safety net: if someone replies by email out of habit it
 * still reaches a person instead of bouncing into a black hole. Same
 * Resend pattern as the team-invite + contact notifiers. Fails soft.
 */

const FROM_ADDRESS = 'Creator Outreach <noreply@creatoroutreach.net>'
// Stray email replies land here (a monitored inbox), so a habitual
// "reply by email" isn't lost. Override via INBOX_REPLY_TO when a
// support@ alias is set up (e.g. INBOX_REPLY_TO=support@creatoroutreach.net).
const REPLY_TO = process.env.INBOX_REPLY_TO || 'dmeehanj@gmail.com'

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export interface InboxNotifyParams {
  to: string
  subject: string
  /** First slice of the message body, shown as a preview. */
  preview: string
  /** Absolute URL back to the app (the inbox lives in the top bar). */
  appUrl: string
}

export async function sendInboxMessageEmail(params: InboxNotifyParams): Promise<boolean> {
  const resendKey = process.env.RESEND_API_KEY
  if (!resendKey) {
    console.warn('[inbox-notify] RESEND_API_KEY not configured — in-app message sent, email skipped')
    return false
  }

  const { to, subject, preview, appUrl } = params
  const safeSubject = escapeHtml(subject || 'New message')
  const safePreview = escapeHtml(preview.slice(0, 280))

  const html = `
    <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#111">
      <h2 style="margin:0 0 12px;font-size:18px">${safeSubject}</h2>
      <p style="margin:0 0 16px;color:#6b7280;font-size:13px">You have a new message in your Creator Outreach inbox.</p>
      <div style="white-space:pre-wrap;background:#f7f7f8;border:1px solid #e5e7eb;border-radius:8px;padding:14px;line-height:1.55;color:#111;margin-bottom:24px">${safePreview}</div>
      <p style="margin:0 0 24px">
        <a href="${appUrl}" style="display:inline-block;background:#2563eb;color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:600">
          Open your inbox
        </a>
      </p>
      <p style="margin:0;color:#6b7280;font-size:12.5px;line-height:1.5">
        <strong>Please reply inside the app</strong> so it stays in your conversation thread — open the inbox in the top bar. (Replying to this email reaches us too, but in-app keeps everything together.)
      </p>
    </div>
  `

  try {
    const resp = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: FROM_ADDRESS,
        to: [to],
        reply_to: REPLY_TO,
        subject: `${safeSubject} — Creator Outreach`,
        html,
      }),
    })
    if (!resp.ok) {
      const detail = await resp.text().catch(() => '')
      console.error('[inbox-notify] Resend rejected', resp.status, detail)
      return false
    }
    return true
  } catch (err) {
    console.error('[inbox-notify] send failed', err)
    return false
  }
}

/**
 * Email every user that a new broadcast/announcement landed in their
 * inbox. Opt-in per broadcast (admin checks "Email everyone") because
 * mass mail is a domain-reputation risk. Uses Resend's batch endpoint
 * (max 100 per call) and chunks beyond that. Fire-and-forget; returns
 * how many were accepted.
 */
export async function sendBroadcastEmails(params: {
  recipients: string[]
  subject: string
  preview: string
  appUrl: string
  /** When the broadcast accepts replies, the email invites an in-app reply. */
  allowReplies?: boolean
}): Promise<number> {
  const resendKey = process.env.RESEND_API_KEY
  if (!resendKey || params.recipients.length === 0) return 0

  const safeSubject = escapeHtml(params.subject || 'New announcement')
  const safePreview = escapeHtml(params.preview.slice(0, 280))
  const html = `
    <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#111">
      <p style="margin:0 0 8px;color:#6b7280;font-size:12px;text-transform:uppercase;letter-spacing:.04em">Announcement</p>
      <h2 style="margin:0 0 12px;font-size:18px">${safeSubject}</h2>
      <div style="white-space:pre-wrap;background:#f7f7f8;border:1px solid #e5e7eb;border-radius:8px;padding:14px;line-height:1.55;color:#111;margin-bottom:24px">${safePreview}</div>
      <p style="margin:0 0 24px">
        <a href="${params.appUrl}" style="display:inline-block;background:#2563eb;color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:600">
          Open Creator Outreach
        </a>
      </p>
      ${params.allowReplies
        ? `<p style="margin:0 0 12px;color:#6b7280;font-size:12.5px;line-height:1.5"><strong>Have a question?</strong> Reply inside the app — open the inbox in the top bar and it starts a private thread with us.</p>`
        : ''}
      <p style="margin:0;color:#9ca3af;font-size:12px;line-height:1.5">
        You're receiving this because you have a Creator Outreach account.
      </p>
    </div>
  `

  let sent = 0
  for (let i = 0; i < params.recipients.length; i += 100) {
    const chunk = params.recipients.slice(i, i + 100)
    const batch = chunk.map(to => ({
      from: FROM_ADDRESS,
      to: [to],
      reply_to: REPLY_TO,
      subject: `${safeSubject} — Creator Outreach`,
      html,
    }))
    try {
      const resp = await fetch('https://api.resend.com/emails/batch', {
        method: 'POST',
        headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(batch),
      })
      if (resp.ok) sent += chunk.length
      else console.error('[broadcast-email] batch rejected', resp.status, await resp.text().catch(() => ''))
    } catch (err) {
      console.error('[broadcast-email] send failed', err)
    }
  }
  return sent
}
