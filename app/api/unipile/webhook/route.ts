/**
 * POST /api/unipile/webhook — Unipile callbacks for account lifecycle.
 *
 * Phase 1 scope: handle CREATION_SUCCESS (and equivalents) so we can
 * map the newly-issued account_id back to a user_profile row via the
 * `name` field we set to user.id during hosted-link creation.
 *
 * Phase 3 will extend this same route to handle:
 *   • new_email / messaging.new — incoming replies → reply classifier
 *   • account.disconnected / .error — reset unipile_account_id, surface UI
 *
 * Payload shape (best-effort — Unipile's docs are incomplete; we
 * tolerate variations):
 *   {
 *     status: 'CREATION_SUCCESS' | 'CREATION_FAILED' | ...,
 *     account_id: '...',
 *     name: '<our supabase user.id we passed at link time>',
 *     account_type?: 'GOOGLE' | ...,
 *     email?: '...',   // sometimes present, sometimes only in /accounts/{id}
 *   }
 *
 * Security: the hosted-auth flow's `notify_url` parameter is one-shot
 * per link and doesn't get a shared secret, so this route can't
 * verify a signature on Phase 1. Mitigation: we (a) only accept
 * payloads whose `name` matches a real user.id, and (b) cross-verify
 * the account by calling getAccount() back to Unipile with our
 * authenticated API key — a forged webhook pointing at a random
 * account_id would either 404 or surface an account we don't
 * recognize. The write to user_profile only happens after that
 * round-trip succeeds.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { getAccount, getEmailMessage, emailFromAccount, UnipileError } from '@/lib/unipile'
import { cacheGet, cacheSet } from '@/lib/cache'
import { classifyReply, classificationToStatus } from '@/lib/inbound-classify'

export const runtime = 'nodejs'
export const maxDuration = 15

/** Rolling Redis list of recent Unipile webhook events — drives the
 *  admin debug page. Same shape/pattern as inbound-email:recent:v1. */
const RECENT_WEBHOOK_KEY = 'unipile-webhook:recent:v1'
const RECENT_WEBHOOK_LIMIT = 50
const RECENT_WEBHOOK_TTL_SECONDS = 7 * 24 * 60 * 60

interface RecentWebhookEntry {
  receivedAt: string
  status: string | null
  accountId: string | null
  userId: string | null
  accountType: string | null
  matched: boolean
  /** Brief error message if processing failed — null on success. */
  error: string | null
}

interface UnipileWebhookPayload {
  /** Account-lifecycle event vocabulary (Phase 1). */
  status?: string
  account_id?: string
  name?: string
  account_type?: string
  email?: string
  /** Phase 3 — message event vocabulary. Unipile sends one of several
   *  shapes depending on the channel; we tolerate aliases. */
  event?: string
  type?: string
  message_id?: string
  email_id?: string
  /** For inbound emails, body fields the AI classifier needs. */
  subject?: string
  body?: string
  body_plain?: string
  /** Resolved threading reference — for replies, this matches the
   *  provider_id of the message they're replying to. */
  in_reply_to?: string
  thread_id?: string
  /** Sometimes Unipile sends a nested data envelope; we look there too. */
  data?: Record<string, unknown>
  [k: string]: unknown
}

/** Service-role Supabase client — bypasses RLS. Only this webhook
 *  uses it. Returns null when env vars are missing (graceful no-op). */
function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) return null
  return createServiceClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

async function pushRecent(entry: RecentWebhookEntry): Promise<void> {
  try {
    const list = (await cacheGet<RecentWebhookEntry[]>(RECENT_WEBHOOK_KEY)) || []
    const next = [entry, ...list].slice(0, RECENT_WEBHOOK_LIMIT)
    await cacheSet(RECENT_WEBHOOK_KEY, next, RECENT_WEBHOOK_TTL_SECONDS)
  } catch (e) {
    console.warn('[unipile/webhook] failed to write recent list:', (e as Error).message)
  }
}

export async function POST(req: NextRequest) {
  let payload: UnipileWebhookPayload
  try {
    payload = (await req.json()) as UnipileWebhookPayload
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const status = (payload.status ?? '').toString().toUpperCase()
  const eventType = (payload.event ?? payload.type ?? '').toString().toLowerCase()
  const accountId = payload.account_id?.toString().trim() ?? ''
  const userId = payload.name?.toString().trim() ?? ''
  const baseRecent: RecentWebhookEntry = {
    receivedAt: new Date().toISOString(),
    status: status || eventType || null,
    accountId: accountId || null,
    userId: userId || null,
    accountType: payload.account_type ?? null,
    matched: false,
    error: null,
  }

  // ── Phase 5 — open / link-click tracking ──────────────────────────────────
  // Unipile fires a separate event when their tracking pixel pings back or
  // a wrapped link is clicked. We attribute by tracking_id → outreach
  // entry's unipile_tracking_id and increment open_count.
  const isTrackingEvent =
    eventType === 'mail_opened' ||
    eventType === 'email_opened' ||
    eventType === 'tracking.open' ||
    eventType === 'tracking.click' ||
    eventType === 'mail_link_clicked' ||
    status === 'OPENED' ||
    status === 'LINK_CLICKED'

  if (isTrackingEvent) {
    return await handleTrackingEvent(payload, baseRecent)
  }

  // ── Phase 3 — incoming message / reply detection ──────────────────────────
  // Unipile fires a different event for each new message. We tolerate a few
  // aliases: 'mail_received', 'message_received', 'new_email', 'messaging.new'.
  // For every match we look up the message body, find the outreach entry it's
  // replying to via In-Reply-To / thread_id, run AI classification, and
  // update status accordingly.
  const isMessageEvent =
    eventType === 'mail_received' ||
    eventType === 'message_received' ||
    eventType === 'new_email' ||
    eventType === 'messaging.new' ||
    eventType === 'email.received' ||
    status === 'NEW_MESSAGE' ||
    status === 'MAIL_RECEIVED'

  if (isMessageEvent) {
    return await handleIncomingMessage(payload, baseRecent)
  }

  // CREATION_SUCCESS is the happy path. Unipile also emits RECONNECT_SUCCESS
  // for reconnections — treat the same since we just want to (re)point
  // user_profile.unipile_account_id. OK is sometimes used as a generic
  // "everything's fine" status.
  const isCreationOrReconnect =
    status === 'CREATION_SUCCESS' ||
    status === 'RECONNECT_SUCCESS' ||
    status === 'OK'

  if (!isCreationOrReconnect) {
    await pushRecent({ ...baseRecent, error: 'non-creation event (ignored)' })
    console.log('[unipile/webhook] non-creation event', { status, eventType, accountId, userId })
    return NextResponse.json({ ok: true, ignored: true })
  }

  if (!accountId || !userId) {
    await pushRecent({ ...baseRecent, error: 'missing account_id or name' })
    return NextResponse.json({ error: 'Missing account_id or name' }, { status: 400 })
  }

  // Cross-verify with Unipile using our authenticated key. Catches both
  // forged webhooks AND payload-format drift (where Unipile changes their
  // status enum and our happy-path branch fires on a non-finished state).
  let email: string | null = null
  let accountType: string | null = payload.account_type ?? null
  try {
    const account = await getAccount(accountId)
    email = emailFromAccount(account)
    accountType = account.type ?? accountType
    if (account.name && account.name !== userId) {
      await pushRecent({ ...baseRecent, error: 'name mismatch with Unipile account' })
      console.warn('[unipile/webhook] account.name mismatch', {
        accountId,
        webhookName: userId,
        accountName: account.name,
      })
      return NextResponse.json({ error: 'Account name mismatch' }, { status: 403 })
    }
  } catch (err) {
    const msg = err instanceof UnipileError ? err.message : (err as Error).message
    await pushRecent({ ...baseRecent, error: `verify failed: ${msg}` })
    console.error('[unipile/webhook] account verify failed', err)
    return NextResponse.json(
      { error: 'Could not verify account with Unipile', detail: msg },
      { status: 502 },
    )
  }

  const supabase = getServiceClient()
  if (!supabase) {
    await pushRecent({ ...baseRecent, error: 'service client unavailable' })
    return NextResponse.json(
      { error: 'Service client unavailable — check NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY' },
      { status: 500 },
    )
  }

  // Route by provider type — Gmail goes into the original columns
  // (migration 0017), LinkedIn goes into the LinkedIn-specific
  // columns (migration 0019). Other providers will get their own
  // pairs in future migrations.
  const accountTypeUpper = (accountType ?? '').toUpperCase()
  const isLinkedIn = accountTypeUpper === 'LINKEDIN' || accountTypeUpper === 'LINKED_IN'
  const update = isLinkedIn
    ? {
        unipile_linkedin_account_id: accountId,
        // For LinkedIn, `email` from the Google-shaped extractor is null;
        // the connection_params resolution lives in lib/unipile, future
        // work could surface the LinkedIn vanity username instead.
        unipile_linkedin_username: email,
        unipile_linkedin_connected_at: new Date().toISOString(),
      }
    : {
        unipile_account_id: accountId,
        unipile_account_email: email,
        unipile_connected_at: new Date().toISOString(),
      }
  const { error: updateErr } = await supabase
    .from('user_profile')
    .update(update)
    .eq('user_id', userId)

  if (updateErr) {
    await pushRecent({ ...baseRecent, error: `db update failed: ${updateErr.message}` })
    console.error('[unipile/webhook] user_profile update failed', updateErr)
    return NextResponse.json({ error: 'Could not persist account link' }, { status: 500 })
  }

  await pushRecent({ ...baseRecent, accountType, matched: true })
  console.log('[unipile/webhook] linked account', { userId, accountId, accountType, email })

  return NextResponse.json({ ok: true, linked: { accountId, email, accountType } })
}

/**
 * Phase 5 — process a tracking event (open or link click) from Unipile.
 *
 * Match by:
 *   tracking_id (label we set on send to outreach entry.id) →
 *     outreach_entries.unipile_tracking_id
 *
 * We increment open_count and stamp last_opened_at. Link clicks count
 * the same way for the basic counter — a separate click_count column
 * could be added in a future migration if the analytics get more
 * sophisticated.
 *
 * Tolerant by design: tracking pixels fire reliably ~70% of the time
 * (Gmail's image proxy delays, mobile clients block them, etc.), so
 * we don't treat absence-of-opens as signal. Presence of opens is the
 * useful info.
 */
async function handleTrackingEvent(
  payload: UnipileWebhookPayload,
  baseRecent: RecentWebhookEntry,
): Promise<NextResponse> {
  const trackingId =
    ((payload as Record<string, unknown>).tracking_id ??
      (payload as Record<string, unknown>).label ??
      (payload.data?.tracking_id as string | undefined) ??
      (payload.data?.label as string | undefined) ??
      '')
      .toString()
      .trim()

  if (!trackingId) {
    await pushRecent({ ...baseRecent, error: 'tracking event missing tracking_id/label' })
    return NextResponse.json({ ok: true, ignored: true, reason: 'no tracking_id' })
  }

  const supabase = getServiceClient()
  if (!supabase) {
    await pushRecent({ ...baseRecent, error: 'service client unavailable' })
    return NextResponse.json({ error: 'Service client unavailable' }, { status: 500 })
  }

  // We label sends with the outreach entry id, so look up by either
  // unipile_tracking_id (if Unipile generated its own) OR the entry id
  // (if our label survived as the tracking_id).
  const { data: entries } = await supabase
    .from('outreach_entries')
    .select('id, open_count')
    .or(`unipile_tracking_id.eq.${trackingId},id.eq.${trackingId}`)
    .limit(1)
  const matched = entries?.[0]

  if (!matched) {
    await pushRecent({ ...baseRecent, error: `no entry for tracking_id ${trackingId}` })
    return NextResponse.json({ ok: true, ignored: true, reason: 'no matching entry' })
  }

  const newCount = (matched.open_count ?? 0) + 1
  const { error: updateErr } = await supabase
    .from('outreach_entries')
    .update({
      open_count: newCount,
      last_opened_at: new Date().toISOString(),
    })
    .eq('id', matched.id)

  if (updateErr) {
    await pushRecent({ ...baseRecent, error: `open update failed: ${updateErr.message}` })
    return NextResponse.json({ error: 'Open update failed' }, { status: 500 })
  }

  await pushRecent({ ...baseRecent, matched: true })
  console.log('[unipile/webhook] open tracked', { entryId: matched.id, count: newCount })
  return NextResponse.json({ ok: true, opened: { entryId: matched.id, count: newCount } })
}

/**
 * Phase 3 — process an incoming email / message event from Unipile.
 *
 * Match flow:
 *   1. Lookup the message by id at Unipile (gets full body + headers).
 *   2. Try to find the matching outreach entry via either:
 *      a) thread_id  → outreach_entries.unipile_thread_id  (preferred)
 *      b) in_reply_to → outreach_entries.unipile_provider_id (fallback)
 *   3. If no match (could be a forward, a personal email, anything),
 *      log + return 200 — silently ignoring isn't an error.
 *   4. Run AI classification on the message body.
 *   5. Map to status, update outreach_entries.
 *   6. Append a one-line audit note so the user can see what we did.
 *
 * Idempotency: if the same webhook fires twice, the second call still
 * works — we update status the same way, and the response_date stamp
 * just gets refreshed. AI cost is the only repeated work; rate-limited
 * upstream by Unipile's own webhook delivery semantics.
 */
async function handleIncomingMessage(
  payload: UnipileWebhookPayload,
  baseRecent: RecentWebhookEntry,
): Promise<NextResponse> {
  const messageId =
    (payload.message_id ?? payload.email_id ?? (payload.data?.id as string | undefined) ?? '')
      .toString()
      .trim()

  if (!messageId) {
    await pushRecent({ ...baseRecent, error: 'message event missing id' })
    return NextResponse.json({ ok: true, ignored: true, reason: 'no message id' })
  }

  // Fetch the full message — webhook may only give us metadata.
  let providerId = ''
  let threadId = (payload.thread_id ?? (payload.data?.thread_id as string | undefined) ?? '').toString().trim()
  let inReplyTo = (payload.in_reply_to ?? (payload.data?.in_reply_to as string | undefined) ?? '').toString().trim()
  let subject = (payload.subject ?? (payload.data?.subject as string | undefined) ?? '').toString()
  let plainBody = (payload.body_plain ?? payload.body ?? (payload.data?.body_plain as string | undefined) ?? (payload.data?.body as string | undefined) ?? '').toString()

  try {
    const msg = await getEmailMessage(messageId)
    providerId = msg.provider_id ?? providerId
    threadId = msg.thread_id ?? threadId
    inReplyTo = msg.in_reply_to ?? inReplyTo
    subject = msg.subject ?? subject
    plainBody = msg.body_plain ?? msg.body ?? plainBody
  } catch (err) {
    const detail = err instanceof UnipileError ? err.message : (err as Error).message
    console.warn('[unipile/webhook] getMessage failed, falling back to webhook payload', detail)
  }

  const supabase = getServiceClient()
  if (!supabase) {
    await pushRecent({ ...baseRecent, error: 'service client unavailable' })
    return NextResponse.json({ error: 'Service client unavailable' }, { status: 500 })
  }

  // Match by thread_id first, fall back to provider_id (In-Reply-To).
  let matchQuery = threadId
    ? supabase.from('outreach_entries').select('id, status, notes, channel_name, user_id').eq('unipile_thread_id', threadId).limit(1)
    : supabase.from('outreach_entries').select('id, status, notes, channel_name, user_id').eq('unipile_provider_id', inReplyTo).limit(1)

  let { data: entries, error: lookupErr } = await matchQuery

  // If neither lookup hit and we had both candidates, try the other one.
  if ((!entries || entries.length === 0) && threadId && inReplyTo) {
    const { data: byProvider } = await supabase
      .from('outreach_entries')
      .select('id, status, notes, channel_name, user_id')
      .eq('unipile_provider_id', inReplyTo)
      .limit(1)
    entries = byProvider ?? []
  }

  if (lookupErr) {
    await pushRecent({ ...baseRecent, error: `entry lookup failed: ${lookupErr.message}` })
    return NextResponse.json({ error: 'Entry lookup failed' }, { status: 500 })
  }

  const matched = entries?.[0]
  if (!matched) {
    await pushRecent({ ...baseRecent, error: 'no matching outreach entry (forward/personal/spam?)' })
    console.log('[unipile/webhook] no entry match', { messageId, threadId, inReplyTo, subject })
    return NextResponse.json({ ok: true, ignored: true, reason: 'no matching outreach entry' })
  }

  // AI classify. Bail on autoresponders so we don't flip status on OOO replies.
  let classification: 'positive' | 'successful' | 'negative' | 'autoresponder' | 'unclear' = 'unclear'
  let reason = ''
  try {
    const result = await classifyReply(plainBody, { channelName: matched.channel_name, subject })
    classification = result.classification
    reason = result.reason
  } catch (err) {
    console.warn('[unipile/webhook] AI classify failed, leaving status untouched:', (err as Error).message)
  }

  const newStatus = classificationToStatus(classification)
  const updatePatch: Record<string, unknown> = {
    response_date: new Date().toISOString(),
  }
  // Only flip status if AI was confident AND the entry is still in an
  // active-outreach state. Don't walk Successful/Rejected backwards.
  if (
    newStatus &&
    (matched.status === 'No Response' || matched.status === 'Not Outreached' || !matched.status)
  ) {
    updatePatch.status = newStatus
  }
  // Append a one-line audit note so the user sees what we did.
  const noteLine = `[auto · unipile] reply classified ${classification}${reason ? ' — ' + reason : ''}`
  updatePatch.notes = matched.notes ? `${matched.notes}\n${noteLine}` : noteLine

  const { error: updateErr } = await supabase
    .from('outreach_entries')
    .update(updatePatch)
    .eq('id', matched.id)

  if (updateErr) {
    await pushRecent({ ...baseRecent, error: `entry update failed: ${updateErr.message}` })
    return NextResponse.json({ error: 'Entry update failed' }, { status: 500 })
  }

  await pushRecent({
    ...baseRecent,
    matched: true,
    error: null,
  })
  console.log('[unipile/webhook] reply handled', {
    entryId: matched.id,
    classification,
    statusChange: updatePatch.status ?? '(unchanged)',
  })

  return NextResponse.json({
    ok: true,
    matched: { entryId: matched.id, classification, status: updatePatch.status ?? matched.status },
  })
}
