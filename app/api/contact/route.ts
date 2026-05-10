import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { rateLimit } from '@/lib/api-auth'

const ADMIN_EMAIL = 'dmeehanj@gmail.com'
const FROM_ADDRESS = 'Creator Outreach <noreply@creatoroutreach.net>'

function isEmail(s: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)
}

/**
 * Best-effort caller-IP for rate limiting. Vercel sets x-forwarded-for
 * (comma-separated chain). We take the leftmost entry as the original
 * client. Falls back to x-real-ip, then a fixed string so the limiter
 * still applies a global ceiling when the headers are stripped.
 */
function callerKey(req: Request): string {
  const xff = req.headers.get('x-forwarded-for')
  if (xff) return xff.split(',')[0].trim()
  const realIp = req.headers.get('x-real-ip')
  if (realIp) return realIp.trim()
  return 'anon'
}

export async function POST(req: Request) {
  // Public form — anyone can submit. Rate-limit by caller IP so a
  // bot can't spam contact_messages or burn the Resend free-tier
  // quota. 5 submissions per hour per IP is plenty for a real human;
  // the in-process bucket is per-Vercel-instance so a determined
  // attacker can multiply by warm-instance count, but this still
  // bounds the worst case to a small fraction of Resend's quota.
  const limited = rateLimit(callerKey(req), 'contact', 5)
  if (limited) return limited

  let body: { name?: string; email?: string; message?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const name = (body.name || '').trim().slice(0, 200)
  const email = (body.email || '').trim().slice(0, 200)
  const message = (body.message || '').trim().slice(0, 5000)

  if (!name || !email || !message) {
    return NextResponse.json({ error: 'Name, email, and message are required.' }, { status: 400 })
  }
  if (!isEmail(email)) {
    return NextResponse.json({ error: 'That email address looks invalid.' }, { status: 400 })
  }
  if (message.length < 5) {
    return NextResponse.json({ error: 'Message is too short.' }, { status: 400 })
  }

  const userAgent = req.headers.get('user-agent')?.slice(0, 500) || null

  // Persist to Supabase (the durable "inbox").
  const supabase = await createClient()
  const { error: dbErr } = await supabase
    .from('contact_messages')
    .insert({ name, email, message, user_agent: userAgent })

  if (dbErr) {
    console.error('[contact] DB insert failed:', dbErr.message)
    return NextResponse.json({ error: 'Could not save your message. Please try again.' }, { status: 500 })
  }

  // Notify Dylan via Resend. Don't fail the request if email fails — the
  // submission is already persisted, so he can still see it in the table.
  const resendKey = process.env.RESEND_API_KEY
  if (resendKey) {
    try {
      // Full HTML entity escape — covers `<>"'&` plus backticks. The
      // earlier `<>`-only filter let through quote/ampersand-based
      // injection that some email clients render as live HTML
      // attributes.
      const escapeHtml = (s: string) => s
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;')
        .replace(/`/g, '&#96;')
      const safeName = escapeHtml(name)
      const safeEmail = escapeHtml(email)
      const safeMsg = escapeHtml(message)
      const resp = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${resendKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: FROM_ADDRESS,
          to: [ADMIN_EMAIL],
          reply_to: email,
          subject: `[Creator Outreach] Contact: ${name}`,
          html: `
            <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#111">
              <h2 style="margin:0 0 16px">New contact form message</h2>
              <p style="margin:0 0 4px"><strong>From:</strong> ${safeName}</p>
              <p style="margin:0 0 16px"><strong>Email:</strong> <a href="mailto:${safeEmail}">${safeEmail}</a></p>
              <div style="white-space:pre-wrap;background:#f7f7f8;border:1px solid #e5e7eb;border-radius:8px;padding:12px;line-height:1.5">${safeMsg}</div>
              <p style="margin-top:20px;color:#6b7280;font-size:12px">Reply directly to respond — the reply-to is set to the sender.</p>
            </div>
          `,
        }),
      })
      if (!resp.ok) {
        const txt = await resp.text().catch(() => '')
        console.error('[contact] Resend non-OK:', resp.status, txt.slice(0, 300))
      }
    } catch (e) {
      console.error('[contact] Resend send failed:', (e as Error).message)
    }
  } else {
    console.warn('[contact] RESEND_API_KEY not set — message saved but no email sent.')
  }

  return NextResponse.json({ ok: true })
}
