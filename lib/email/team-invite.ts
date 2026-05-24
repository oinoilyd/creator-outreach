/**
 * Team invitation email — sends an invite link to the recipient.
 *
 * Uses Resend (RESEND_API_KEY) — same pattern as the contact form
 * notifier. Fails soft: returns false if email send fails, so the
 * invite row still gets created and the admin can copy the link
 * manually if needed.
 */

const FROM_ADDRESS = 'Creator Outreach <invites@creatoroutreach.net>'

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export interface InviteEmailParams {
  to: string
  orgName: string
  inviterName: string
  inviterEmail: string
  role: 'admin' | 'member'
  acceptUrl: string
  expiresAt: string
}

export async function sendTeamInviteEmail(params: InviteEmailParams): Promise<boolean> {
  const resendKey = process.env.RESEND_API_KEY
  if (!resendKey) {
    console.warn('[team-invite-email] RESEND_API_KEY not configured — invite link must be shared manually')
    return false
  }

  const { to, orgName, inviterName, inviterEmail, role, acceptUrl, expiresAt } = params
  const safeOrg = escapeHtml(orgName)
  const safeInviter = escapeHtml(inviterName || inviterEmail)
  const safeRole = escapeHtml(role)
  const expiry = new Date(expiresAt).toLocaleDateString(undefined, {
    month: 'short', day: 'numeric', year: 'numeric',
  })

  const html = `
    <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#111">
      <h2 style="margin:0 0 16px">You've been invited to ${safeOrg}</h2>
      <p style="margin:0 0 16px;line-height:1.5;color:#374151">
        <strong>${safeInviter}</strong> invited you to join <strong>${safeOrg}</strong> on Creator Outreach as a <strong>${safeRole}</strong>.
      </p>
      <p style="margin:0 0 24px">
        <a href="${acceptUrl}" style="display:inline-block;background:#10b981;color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:600">
          Accept invitation
        </a>
      </p>
      <p style="margin:0 0 8px;color:#6b7280;font-size:13px;line-height:1.5">
        Or open this link: <br/>
        <span style="font-family:ui-monospace,monospace;font-size:12px;word-break:break-all;color:#374151">${acceptUrl}</span>
      </p>
      <p style="margin:24px 0 0;color:#9ca3af;font-size:12px;line-height:1.5">
        This invitation expires on ${expiry}. If you didn't expect this email, you can safely ignore it.
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
        reply_to: inviterEmail,
        subject: `${inviterName || inviterEmail} invited you to ${orgName} on Creator Outreach`,
        html,
      }),
    })
    if (!resp.ok) {
      const detail = await resp.text().catch(() => '')
      console.error('[team-invite-email] Resend rejected', resp.status, detail)
      return false
    }
    return true
  } catch (err) {
    console.error('[team-invite-email] send failed', err)
    return false
  }
}
