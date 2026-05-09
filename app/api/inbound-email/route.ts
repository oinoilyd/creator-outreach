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
 * Auth: this endpoint is publicly reachable but only useful with a
 * URL someone scraped/leaked. We sanity-check the From and reject
 * obvious garbage. SendGrid offers webhook signing but it's an extra
 * setup step — defer until we see evidence of abuse.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { cacheGet, cacheSet } from '@/lib/cache'

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

  // If we found a tracking tag, find the entry and mark it responded.
  if (trackingId) {
    const sb = getServiceClient()
    if (sb) {
      try {
        const { data, error } = await sb
          .from('outreach_entries')
          .select('id, status')
          .eq('tracking_id', trackingId)
          .maybeSingle()
        if (error) {
          console.warn('[inbound-email] entry lookup failed:', error.message)
        } else if (data) {
          matched = true
          matchedEntryId = data.id
          // Update status. We deliberately don't override "Successful" /
          // "Rejected" — the user may have manually classified the reply.
          // For "Open" / "Not Outreached" / "" we set to "Open" (still
          // means "in conversation, awaiting next step") and stamp
          // response_date.
          const shouldUpdateStatus =
            data.status === 'Open' ||
            data.status === 'Not Outreached' ||
            data.status === 'No Response' ||
            data.status === '' ||
            data.status == null
          const today = new Date().toISOString().slice(0, 10)
          const patch: Record<string, unknown> = {
            response_date: today,
          }
          if (shouldUpdateStatus) {
            // Keep status as 'Open' — the user can manually flip to
            // Successful / Rejected after reading the reply. Treating
            // every reply as Successful would over-claim wins.
            patch.status = 'Open'
            patch.reached_out = true // defensive — they replied, so we
                                     // definitely reached out
          }
          const { error: updErr } = await sb
            .from('outreach_entries')
            .update(patch)
            .eq('id', data.id)
          if (updErr) {
            console.warn('[inbound-email] entry update failed:', updErr.message)
          } else {
            console.log(`[inbound-email] flipped entry ${data.id} on reply (trackingId=${trackingId})`)
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
  })

  return NextResponse.json({ ok: true, matched, matchedEntryId, trackingId })
}
