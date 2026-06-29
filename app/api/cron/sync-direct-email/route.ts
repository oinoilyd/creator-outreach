/**
 * GET /api/cron/sync-direct-email — pulls new mail for every connected
 * direct mailbox, logs it, and auto-flags replies onto outreach.
 *
 * This is the "emails tie to status" payoff. For each active account:
 *   1. Refresh the token if needed, pull changes since the saved cursor.
 *   2. Upsert every message into direct_email_log (idempotent).
 *   3. For inbound mail that matches an outreach recipient, run the
 *      existing reply classifier and update the outreach entry's status +
 *      response_date — and stop any live follow-up sequence for that
 *      contact (the "don't follow up after they replied" gate).
 *   4. Persist the new sync cursor.
 *
 * DARK until DIRECT_EMAIL_ENABLED. With the flag off — or with no
 * connected accounts — this is a no-op after the auth check. Auth + the
 * service client mirror /api/cron/send-followups exactly.
 */
import { NextRequest, NextResponse } from 'next/server'
import { timingSafeEqual } from 'node:crypto'
import { createClient as createServiceClient, type SupabaseClient } from '@supabase/supabase-js'
import { isDirectEmailEnabled } from '@/lib/email/direct/flag'
import { getFreshAccessToken } from '@/lib/email/direct/send'
import * as google from '@/lib/email/direct/google'
import * as microsoft from '@/lib/email/direct/microsoft'
import { classifyReply, classificationToStatus } from '@/lib/inbound-classify'
import type { DirectEmailAccount, NormalizedMessage } from '@/lib/email/direct/types'

export const runtime = 'nodejs'
export const maxDuration = 60

const MAX_ACCOUNTS = 200
const MAX_REPLIES_CLASSIFIED = 200 // cap AI spend per run

function constantTimeMatch(a: string, b: string): boolean {
  const ba = Buffer.from(a)
  const bb = Buffer.from(b)
  if (ba.length !== bb.length) return false
  return timingSafeEqual(ba, bb)
}

function verifyCronAuth(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false // fail closed
  return constantTimeMatch(req.headers.get('authorization') ?? '', `Bearer ${secret}`)
}

function getServiceClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) return null
  return createServiceClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

export async function GET(req: NextRequest) {
  if (!verifyCronAuth(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  // Dark-mode no-op: flag off ⇒ nothing to do.
  if (!isDirectEmailEnabled()) {
    return NextResponse.json({ ok: true, disabled: true })
  }
  const supabase = getServiceClient()
  if (!supabase) {
    return NextResponse.json({ error: 'Service client unavailable' }, { status: 500 })
  }

  const { data: accountRows, error: acctErr } = await supabase
    .from('direct_email_accounts')
    .select('*')
    .eq('status', 'active')
    .limit(MAX_ACCOUNTS)
  if (acctErr) {
    return NextResponse.json({ error: 'Account query failed', detail: acctErr.message }, { status: 500 })
  }

  const accounts = (accountRows ?? []) as DirectEmailAccount[]
  let synced = 0
  let inbound = 0
  let classified = 0
  const errors: Array<{ account: string; reason: string }> = []

  for (const account of accounts) {
    try {
      const token = await getFreshAccessToken(supabase, account)
      const cursor = account.provider === 'google' ? account.history_id : account.delta_link
      const sync =
        account.provider === 'google'
          ? await google.syncMessages(token, cursor ?? undefined)
          : await microsoft.syncMessages(token, cursor ?? undefined)

      // 1. Upsert all messages (idempotent on account_id + provider_message_id).
      if (sync.messages.length > 0) {
        const rows = sync.messages.map((m) => ({
          user_id: account.user_id,
          account_id: account.id,
          provider_message_id: m.providerMessageId,
          thread_id: m.threadId,
          direction: m.direction,
          from_email: m.fromEmail,
          from_name: m.fromName,
          to_emails: m.toEmails,
          subject: m.subject,
          snippet: m.snippet,
          sent_at: m.sentAt,
        }))
        await supabase
          .from('direct_email_log')
          .upsert(rows, { onConflict: 'account_id,provider_message_id' })
      }

      // 2. Auto-flag inbound replies onto outreach.
      for (const m of sync.messages) {
        if (m.direction !== 'inbound' || !m.fromEmail) continue
        inbound += 1
        if (classified >= MAX_REPLIES_CLASSIFIED) continue
        const did = await autoFlagReply(supabase, account, m)
        if (did) classified += 1
      }

      // 3. Persist the new cursor.
      const patch: Record<string, unknown> = { last_synced_at: new Date().toISOString(), updated_at: new Date().toISOString() }
      if (sync.historyId) patch.history_id = sync.historyId
      if (sync.deltaLink) patch.delta_link = sync.deltaLink
      await supabase.from('direct_email_accounts').update(patch).eq('id', account.id)
      synced += 1
    } catch (e) {
      errors.push({ account: account.id, reason: (e as Error).message })
      console.error('[cron/sync-direct-email] account failed', account.id, (e as Error).message)
    }
  }

  return NextResponse.json({ ok: true, accounts: accounts.length, synced, inbound, classified, errors })
}

/**
 * Match one inbound message to an outreach entry by recipient email, run
 * the reply classifier, update status + response_date, link the log row,
 * and stop any active follow-up sequence for that contact.
 * Returns true if a matching outreach entry was found + processed.
 */
async function autoFlagReply(
  supabase: SupabaseClient,
  account: DirectEmailAccount,
  m: NormalizedMessage,
): Promise<boolean> {
  const from = m.fromEmail!.trim()
  const candidates = Array.from(new Set([from, from.toLowerCase()]))

  const { data: entries } = await supabase
    .from('outreach_entries')
    .select('id, channel_name, status, notes, response_date')
    .eq('user_id', account.user_id)
    .in('email', candidates)
    .order('created_at', { ascending: false })
    .limit(1)

  const entry = (entries ?? [])[0] as
    | { id: string; channel_name: string; status: string | null; notes: string | null; response_date: string | null }
    | undefined
  if (!entry) return false

  const cls = await classifyReply(m.snippet ?? '', { channelName: entry.channel_name })
  const mappedStatus = classificationToStatus(cls.classification)

  // Link + classify the log row.
  await supabase
    .from('direct_email_log')
    .update({ outreach_entry_id: entry.id, classification: cls.classification })
    .eq('account_id', account.id)
    .eq('provider_message_id', m.providerMessageId)

  // Update the outreach entry. Always stamp response_date + a note; only
  // flip status when the classifier is confident AND we're not overriding
  // a status the user already moved past 'No Response'.
  const note = `[auto · direct] reply — ${cls.classification}: ${cls.reason}`
  const update: Record<string, unknown> = {
    response_date: m.sentAt ?? new Date().toISOString(),
    notes: entry.notes ? `${entry.notes}\n${note}` : note,
  }
  if (mappedStatus && entry.status === 'No Response') update.status = mappedStatus
  await supabase.from('outreach_entries').update(update).eq('id', entry.id)

  // Stop-condition: a reply arrived → halt any live sequence for this contact.
  await supabase
    .from('direct_email_enrollments')
    .update({ status: 'stopped', stop_reason: 'replied', updated_at: new Date().toISOString() })
    .eq('user_id', account.user_id)
    .in('contact_email', candidates)
    .eq('status', 'active')

  return true
}
