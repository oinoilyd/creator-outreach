/**
 * POST /api/inbound-email — SendGrid Inbound Parse webhook.
 *
 * Receives every email forwarded into inbound.creatoroutreach.net,
 * matches it against an outreach entry via the [CO-#{id}] tag we
 * inject into outbound subjects (see lib/format.ts), and updates
 * the entry's status to reflect a reply.
 *
 * Two flows it serves:
 *   1. Gmail forwarding-address VERIFICATION email — when the user
 *      sets up forwarding to inbound@inbound.creatoroutreach.net,
 *      Gmail sends a verification code here. We store it in Redis
 *      so the user can grab it from /admin/inbound-debug.
 *   2. Real outreach replies — match by [CO-#{id}] tag in subject,
 *      update outreach_entries.status + response_date.
 *
 * SendGrid Inbound Parse "Send Raw" mode posts a multipart/form-data
 * body with these fields:
 *   - from           e.g. '"Sender Name" <sender@example.com>'
 *   - to             e.g. 'inbound@inbound.creatoroutreach.net'
 *   - subject        e.g. 'Re: loved your content [CO-#abc12345]'
 *   - text           plain-text body
 *   - html           HTML body
 *   - email          the full RFC822 raw email
 *   - headers        full headers section
 *   - dkim, SPF      auth result strings
 *
 * Auth: SendGrid Inbound Parse supports HTTP Basic Auth on the
 * webhook URL (no signature verification — Inbound Parse never had
 * that feature). We verify Authorization: Basic when the
 * SENDGRID_INBOUND_BASIC_AUTH env var is configured; without it,
 * the route logs a warning and accepts the request (so production
 * doesn't break the moment this code ships — see ENABLE STEPS below).
 *
 * ── ENABLE STEPS (one-time, ~3 min) ────────────────────────────────
 *   1. Pick a shared secret. e.g. `openssl rand -base64 24` →
 *      something like `inbound:s3cret-r4ndom-string`. Format is
 *      USERNAME:PASSWORD; the colon is the separator.
 *   2. Set SENDGRID_INBOUND_BASIC_AUTH=<that string> as a Vercel
 *      env var (Production scope). Redeploy.
 *   3. In the SendGrid dashboard → Settings → Inbound Parse →
 *      edit the existing webhook entry → change the destination
 *      URL from `https://inbound.creatoroutreach.net/api/inbound-email`
 *      to `https://USER:PASS@inbound.creatoroutreach.net/api/inbound-email`
 *      (paste the same USER:PASS from step 1 between https:// and
 *      the host). Save.
 *   4. Send yourself a test email to inbound@inbound.creatoroutreach.net.
 *      It should still appear in /admin/inbound-debug. If you see
 *      "[inbound-email] basic-auth REJECTED" in the Vercel logs,
 *      the URL or env var is mismatched — re-paste them.
 *
 * Once the env var is set, every unauthenticated POST to this route
 * returns 401 — closes the spoof-replies attack surface.
 * ─────────────────────────────────────────────────────────────────
 */

import { NextRequest, NextResponse } from 'next/server'
import { timingSafeEqual } from 'crypto'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { cacheGet, cacheSet } from '@/lib/cache'
import { classifyReply, classificationToStatus, type ReplyClassification } from '@/lib/inbound-classify'

export const maxDuration = 30

/** Redis key for the rolling list of recent inbound emails (used by
 *  the /admin/inbound-debug page). Stored as JSON array, capped at 50. */
const RECENT_INBOUND_KEY = 'inbound-email:recent:v1'
const RECENT_INBOUND_LIMIT = 50
const RECENT_INBOUND_TTL_SECONDS = 7 * 24 * 60 * 60 // 7 days

type RecentInboundEntry = {
  receivedAt: string // ISO
  from: string
  to: string
  subject: string
  textSnippet: string
  trackingId: string | null
  matched: boolean
  matchedEntryId: string | null
  /** AI-classified verdict for matched replies. Null when no match
   *  or no classification ran (autoresponder probe / fallback). */
  classification: ReplyClassification | null
}

/** Service-role Supabase client. Bypasses RLS — only this webhook
 *  uses it. Returns null when env vars are missing (graceful no-op). */
function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) return null
  return createServiceClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

/** Pull the [CO-#abc12345] tag out of a subject line. The tag survives
 *  Re: prefixes, Fwd: prefixes, and arbitrary subject editing as long
 *  as the bracket+hash stay intact. */
function extractTrackingId(subject: string): string | null {
  if (!subject) return null
  const m = subject.match(/\[CO-#([a-z0-9]+)\]/i)
  return m ? m[1].toLowerCase() : null
}

/**
 * Verify HTTP Basic Auth against the configured shared secret. Returns
 * true when:
 *   - SENDGRID_INBOUND_BASIC_AUTH is unset AND we're in local dev
 *     (NODE_ENV=development) — accept so inbound can be exercised without
 *     the secret. In any DEPLOYED environment an unset secret fails
 *     CLOSED (returns false), so the endpoint can't be forged.
 *   - the Authorization: Basic header decodes to the expected
 *     "user:pass" string (constant-time compared)
 *
 * Returns false when the env var IS set but the request's
 * Authorization header is missing or wrong — caller responds 401.
 */
function verifyInboundAuth(req: NextRequest): boolean {
  const expected = process.env.SENDGRID_INBOUND_BASIC_AUTH
  if (!expected) {
    // Fail CLOSED in any deployed environment. An unauthenticated inbound
    // endpoint lets anyone POST forged reply events and corrupt CRM state
    // (flip outreach rows to "Interested", etc.). Accept-without-auth ONLY
    // in local dev (NODE_ENV=development) so inbound can be tested without
    // the secret; on Vercel (prod + preview → NODE_ENV=production) reject
    // until SENDGRID_INBOUND_BASIC_AUTH is configured. (Audit SEC-C2.)
    if (process.env.NODE_ENV === 'development') {
      console.warn('[inbound-email] SENDGRID_INBOUND_BASIC_AUTH not set — accepting without auth (local dev only).')
      return true
    }
    console.error(
      '[inbound-email] SENDGRID_INBOUND_BASIC_AUTH not set in a deployed environment — REJECTING request. ' +
      'Set it in Vercel env to enable inbound email.',
    )
    return false
  }
  const header = req.headers.get('authorization') || ''
  const match = /^Basic\s+(.+)$/i.exec(header.trim())
  if (!match) return false
  let decoded: string
  try {
    decoded = Buffer.from(match[1], 'base64').toString('utf8')
  } catch {
    return false
  }
  // Length-pre-check + timingSafeEqual avoids leaking the secret
  // length via response time.
  if (decoded.length !== expected.length) return false
  return timingSafeEqual(Buffer.from(decoded), Buffer.from(expected))
}

/** Push a record into the rolling Redis list of recent inbound emails. */
async function pushRecentInbound(entry: RecentInboundEntry): Promise<void> {
  try {
    const list = (await cacheGet<RecentInboundEntry[]>(RECENT_INBOUND_KEY)) || []
    const next = [entry, ...list].slice(0, RECENT_INBOUND_LIMIT)
    await cacheSet(RECENT_INBOUND_KEY, next, RECENT_INBOUND_TTL_SECONDS)
  } catch (e) {
    console.warn('[inbound-email] failed to write recent list:', (e as Error).message)
  }
}

export async function POST(req: NextRequest) {
  // Auth gate (see verifyInboundAuth + the route header comment for
  // setup). When SENDGRID_INBOUND_BASIC_AUTH isn't set we log + accept
  // — letting prod keep working until the operator updates the
  // SendGrid dashboard URL with the basic-auth user/pass.
  if (!verifyInboundAuth(req)) {
    console.warn('[inbound-email] basic-auth REJECTED — request denied')
    // 401 with no body — don't tell unauth scanners anything about
    // what we expect.
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  // SendGrid posts multipart/form-data. Use req.formData() to parse.
  let form: FormData
  try {
    form = await req.formData()
  } catch (e) {
    console.warn('[inbound-email] failed to parse form data:', (e as Error).message)
    return NextResponse.json({ error: 'invalid-form-data' }, { status: 400 })
  }

  // Pull the fields we care about. SendGrid always populates these,
  // even with "Send Raw" on (raw goes into `email`, parsed fields stay
  // in their own form keys).
  const from = String(form.get('from') || '').trim()
  const to = String(form.get('to') || '').trim()
  const subject = String(form.get('subject') || '').trim()
  const text = String(form.get('text') || '').trim()

  // Cheap sanity check — at minimum we need a from address. SendGrid
  // never delivers webhook calls without one; this catches probes.
  if (!from) {
    return NextResponse.json({ error: 'missing-from' }, { status: 400 })
  }

  const trackingId = extractTrackingId(subject)
  console.log(
    `[inbound-email] from=${from.slice(0, 80)} subject=${subject.slice(0, 80)} trackingId=${trackingId ?? 'none'}`,
  )

  let matched = false
  let matchedEntryId: string | null = null
  let classification: ReplyClassification | null = null

  // If we found a tracking tag, find the entry, classify the reply,
  // and update status/response_date based on what the AI says.
  if (trackingId) {
    const sb = getServiceClient()
    if (sb) {
      try {
        // Pull the fields we need to:
        //   1. classify (channel_name + subject context)
        //   2. decide whether to overwrite status (current status)
        //   3. append classification reasoning (existing notes)
        const { data, error } = await sb
          .from('outreach_entries')
          .select('id, status, channel_name, notes')
          .eq('tracking_id', trackingId)
          .maybeSingle()
        if (error) {
          console.warn('[inbound-email] entry lookup failed:', error.message)
        } else if (data) {
          matched = true
          matchedEntryId = data.id

          // ── Classify the reply ────────────────────────────────
          // AI call against Claude Haiku — see lib/inbound-classify.ts
          // for the prompt + cost notes. Failure mode is graceful:
          // returns 'unclear', webhook still stamps response_date.
          const cls = await classifyReply(text, {
            channelName: data.channel_name as string | null ?? undefined,
            subject,
          })
          classification = cls.classification
          const targetStatus = classificationToStatus(cls.classification)

          // Build the patch carefully:
          //
          // - response_date: stamp on REAL replies. Skip for
          //   autoresponders so OOO emails don't make a creator
          //   look responsive in your stats.
          //
          // - reached_out: defensive flip — a reply proves the
          //   user sent something, even if outside our tracked
          //   compose flow.
          //
          // - status: only auto-flip when the entry is still in a
          //   pre-classification state. If the user has manually
          //   set Open / Successful / Rejected / a custom status,
          //   the AI should NOT overwrite. The user is in the
          //   loop and their judgement wins.
          //
          // - notes: append a single audit line so the user can
          //   see what the AI decided + why. Useful when the auto-
          //   classification disagrees with the user's intuition
          //   on review.
          const today = new Date().toISOString().slice(0, 10)
          const patch: Record<string, unknown> = {
            reached_out: true,
          }
          if (cls.classification !== 'autoresponder') {
            patch.response_date = today
          }
          // Only auto-overwrite an "open / unset" status. Anything
          // the user has already manually classified stays as-is.
          const currentStatus = (data.status as string | null | undefined) ?? ''
          const isUnset =
            currentStatus === '' ||
            currentStatus === 'No Response' ||
            currentStatus === 'Not Outreached'
          if (targetStatus && isUnset) {
            patch.status = targetStatus
          }

          // Append a one-line audit trail to notes so the user can
          // see what the AI decided + why. Newline-separated so
          // multiple replies per entry build up a thread.
          const stamp = new Date().toISOString().slice(0, 16).replace('T', ' ')
          const noteLine = `[${stamp} · auto-classified ${cls.classification.toUpperCase()}] ${cls.reason}`
          const existing = (data.notes as string | null | undefined) ?? ''
          patch.notes = existing
            ? `${existing}\n${noteLine}`
            : noteLine

          const { error: updErr } = await sb
            .from('outreach_entries')
            .update(patch)
            .eq('id', data.id)
          if (updErr) {
            console.warn('[inbound-email] entry update failed:', updErr.message)
          } else {
            console.log(
              `[inbound-email] entry ${data.id} reply=${cls.classification} ` +
              `status=${patch.status ?? '(unchanged)'} response_date=${patch.response_date ?? '(skipped)'}`,
            )
          }
        }
      } catch (e) {
        console.warn('[inbound-email] db error:', (e as Error).message)
      }
    } else {
      console.warn('[inbound-email] service client unavailable; skipping db update')
    }
  }

  // Always push to the recent-inbound list so the admin debug page can
  // see EVERYTHING that came in (Gmail verification codes, replies,
  // bounces, autoresponders, etc.) — useful for debugging the chain.
  await pushRecentInbound({
    receivedAt: new Date().toISOString(),
    from,
    to,
    subject,
    textSnippet: text.slice(0, 500),
    trackingId,
    matched,
    matchedEntryId,
    classification,
  })

  return NextResponse.json({ ok: true, matched, matchedEntryId, trackingId, classification })
}
