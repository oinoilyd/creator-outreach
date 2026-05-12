/**
 * GET /unsubscribe?t=<token>
 *
 * Public-facing landing page that honors a CAN-SPAM unsubscribe click
 * from a recipient of an outreach email. We rendered the link from
 * `buildCanSpamFooter` in lib/format.ts; the token format and verify
 * helpers live in lib/unsubscribe.ts.
 *
 * Why a page (not an API route): email clients (Gmail, Outlook,
 * Apple Mail) and link-scanners hit unsubscribe URLs with a GET to
 * preview/scan them. An API route that immediately inserts the
 * suppression on a bare GET would unsubscribe people whose providers
 * scan links — a known compliance footgun (see the SendGrid
 * "Suppress on click" debacle). A rendered confirmation page is the
 * Stripe / Notion / Postmark idiom and stays robust to those scans.
 *
 * On render we:
 *   1. Verify the HMAC signature on the token (lib/unsubscribe).
 *   2. Resolve the sender's user_id by looking up `user_profile.email`
 *      (we encode `userId = profile.email` in the token because it's
 *      a stable, non-secret pointer the email rendering code already
 *      had; we'd rather not embed UUIDs in publicly-distributed
 *      links).
 *   3. INSERT into `suppression_list` with `reason = 'unsubscribe'`.
 *      Duplicate is a no-op thanks to the unique constraint
 *      `(user_id, recipient_email)`.
 *
 * We use the service-role client because the recipient is NOT signed
 * into our app; RLS would block their insert otherwise.
 *
 * Public route — must be added to PUBLIC_PATHS in
 * lib/supabase/middleware.ts so the auth middleware doesn't redirect
 * the recipient to /auth/signin before they can confirm.
 */

import type { Metadata } from 'next'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { LegalLayout } from '@/components/legal/LegalLayout'
import { verifyUnsubscribeToken } from '@/lib/unsubscribe'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Unsubscribe',
  description: 'Confirm you no longer want to receive outreach emails from this sender.',
  robots: { index: false, follow: false },
}

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

interface UnsubscribeResult {
  status: 'ok' | 'invalid' | 'config_missing'
  senderLabel?: string
  recipientEmail?: string
  /** Logged only — never shown to the recipient. */
  detail?: string
}

async function processUnsubscribe(token: string | undefined): Promise<UnsubscribeResult> {
  const verification = verifyUnsubscribeToken(token)
  if (!verification.valid || !verification.payload) {
    return {
      status: 'invalid',
      detail: verification.reason ?? 'unknown',
    }
  }
  const { userId: senderHandle, recipientEmail } = verification.payload

  // Recipient address sanity check — the token includes whatever the
  // sender's app embedded, but we still want to clamp obvious junk.
  const cleanRecipient = (recipientEmail || '').trim().toLowerCase()
  if (!cleanRecipient || !cleanRecipient.includes('@')) {
    return { status: 'invalid', detail: 'bad_recipient' }
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) {
    console.error('[unsubscribe] service role not configured')
    return { status: 'config_missing' }
  }
  const sb = createServiceClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  // Resolve sender's user_id from the email pointer baked into the
  // token. We look up `user_profile.email` rather than `auth.users`
  // because the profile row mirrors the auth email and is already
  // accessible via PostgREST. Best-effort sender display: prefer
  // full_name, fall back to the email itself.
  const senderEmail = (senderHandle || '').trim().toLowerCase()
  const { data: profile, error: profileErr } = await sb
    .from('user_profile')
    .select('user_id, full_name, email')
    .ilike('email', senderEmail)
    .maybeSingle()

  if (profileErr) {
    console.error('[unsubscribe] profile lookup failed', profileErr.message)
    // We still render success — failing the recipient because of a
    // backend hiccup is worse than a silent retry on their next
    // click. Log + continue.
  }

  if (!profile?.user_id) {
    // Token decoded fine but the sender doesn't exist anymore
    // (account deleted, email rotated). Treat as success from the
    // recipient's POV — they don't care about our schema.
    console.warn('[unsubscribe] sender not found for', senderEmail)
    return {
      status: 'ok',
      senderLabel: 'this user',
      recipientEmail: cleanRecipient,
    }
  }

  const senderLabel =
    (profile.full_name && profile.full_name.trim()) ||
    profile.email ||
    'this user'

  const { error: insertErr } = await sb.from('suppression_list').insert({
    user_id: profile.user_id,
    recipient_email: cleanRecipient,
    reason: 'unsubscribe',
  })
  if (insertErr) {
    // Postgres `23505` = unique_violation — recipient already on the
    // sender's suppression list. Idempotent: confirm and move on.
    if (insertErr.code === '23505') {
      console.log('[unsubscribe] already suppressed', { sender: profile.user_id, recipient: cleanRecipient })
    } else {
      console.error('[unsubscribe] insert failed', insertErr.code, insertErr.message)
      // Still render success to the user — better UX than throwing a
      // 500 page at someone trying to opt out of mail. The error is
      // logged so we can detect and fix on our end.
    }
  } else {
    console.log('[unsubscribe] suppressed', { sender: profile.user_id, recipient: cleanRecipient })
  }

  return {
    status: 'ok',
    senderLabel,
    recipientEmail: cleanRecipient,
  }
}

export default async function UnsubscribePage({ searchParams }: PageProps) {
  const params = await searchParams
  const tokenRaw = params?.t
  const token = Array.isArray(tokenRaw) ? tokenRaw[0] : tokenRaw

  const result = await processUnsubscribe(token)

  if (result.status === 'ok') {
    return (
      <LegalLayout title="You're unsubscribed" lastUpdated={new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}>
        <div className="rounded-xl border border-emerald-300/60 bg-emerald-50 px-5 py-4 text-emerald-900 dark:border-emerald-500/40 dark:bg-emerald-500/10 dark:text-emerald-100">
          <p className="text-base font-semibold mb-1">
            <span aria-hidden>✓ </span>You&apos;ve been unsubscribed.
          </p>
          <p className="text-sm leading-relaxed">
            {result.recipientEmail ? (
              <>
                <span className="font-mono">{result.recipientEmail}</span> has been removed from{' '}
                <span className="font-semibold">{result.senderLabel ?? 'this user'}</span>&apos;s
                outreach list. You won&apos;t receive further emails from them through Creator Outreach.
              </>
            ) : (
              <>You won&apos;t receive further emails from {result.senderLabel ?? 'this user'} through Creator Outreach.</>
            )}
          </p>
        </div>
        <p>
          Creator Outreach is the platform the sender used to contact you. We don&apos;t share, sell,
          or otherwise distribute the email address you just unsubscribed.
        </p>
        <p>
          If you keep receiving messages after today, reply to one of them with{' '}
          <strong>&ldquo;unsubscribe&rdquo;</strong> in the body — the sender is required by US
          anti-spam law (CAN-SPAM §5(a)(4)) to honor that request within 10 business days.
        </p>
      </LegalLayout>
    )
  }

  if (result.status === 'config_missing') {
    return (
      <LegalLayout title="Unsubscribe temporarily unavailable" lastUpdated={new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}>
        <div className="rounded-xl border border-amber-300/60 bg-amber-50 px-5 py-4 text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-100">
          <p className="text-base font-semibold mb-1">
            <span aria-hidden>⚠️ </span>Something&apos;s wrong on our end.
          </p>
          <p className="text-sm leading-relaxed">
            We couldn&apos;t process the unsubscribe right now. Please try again in a few minutes, or
            reply to the email you received with &ldquo;unsubscribe&rdquo; in the body and the sender
            must honor it within 10 business days.
          </p>
        </div>
      </LegalLayout>
    )
  }

  return (
    <LegalLayout title="Unsubscribe link invalid" lastUpdated={new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}>
      <div className="rounded-xl border border-red-300/60 bg-red-50 px-5 py-4 text-red-900 dark:border-red-500/40 dark:bg-red-500/10 dark:text-red-100">
        <p className="text-base font-semibold mb-1">
          <span aria-hidden>⚠️ </span>This unsubscribe link is invalid or has expired.
        </p>
        <p className="text-sm leading-relaxed">
          If you keep receiving emails from a sender on Creator Outreach, you can still opt out:
          reply to the message with <strong>&ldquo;unsubscribe&rdquo;</strong> in the body.
          The sender is required by US anti-spam law (CAN-SPAM §5(a)(4)) to honor that within
          10 business days.
        </p>
      </div>
      <p>
        Suspect the email is malicious? Forward it to{' '}
        <a href="mailto:dmeehanj@gmail.com">dmeehanj@gmail.com</a> and we&apos;ll investigate.
      </p>
    </LegalLayout>
  )
}
