/**
 * GET /api/cron/send-followups — Vercel cron fires this every 15 min.
 *
 * Phase 7 — auto-send follow-up emails when an outreach entry's
 * follow_up_date hits AND the user opted into auto-followup AND no
 * reply has been received yet.
 *
 * Hard rules (safety first):
 *   • Only entries with auto_followup=true are considered.
 *   • Only entries whose status is 'No Response' (sent, no reply yet)
 *     get followed up. Successful / Rejected / Open are left alone.
 *   • Skip if follow_up_date is in the future.
 *   • Skip if we already auto-followed-up in the last 24h
 *     (last_auto_followup_at guard against runaway cron retries).
 *   • Hard cap: max 50 sends per cron run across ALL users — prevents
 *     a runaway loop from spamming Gmail and burning quota.
 *   • Per-user cap: max 10 auto-sends per user per run.
 *   • Re-uses Phase 2's lib/unipile.sendEmail under the hood.
 *
 * Auth: Vercel cron requests carry an `Authorization: Bearer
 * <CRON_SECRET>` header. We compare with timing-safe equals against
 * env CRON_SECRET. Local manual hits need that header set, too.
 *
 * Idempotency: stamps last_auto_followup_at on success so a re-run
 * within 24h skips the row. Touchpoints increments to track the
 * number of follow-up attempts the recipient has seen.
 */

import { NextRequest, NextResponse } from 'next/server'
import { timingSafeEqual } from 'crypto'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { sendEmail, UnipileError } from '@/lib/unipile'
import { buildFollowUpContent, recipientIssue } from '@/lib/format'
import type { Creator, UserProfile } from '@/lib/types'

export const runtime = 'nodejs'
export const maxDuration = 60

const GLOBAL_CAP_PER_RUN = 50
const PER_USER_CAP_PER_RUN = 10
const REFRESH_FOLLOWUP_DAYS = 4 // After a successful auto-send, push the next followUpDate this far out
const COOLDOWN_HOURS = 24 // Don't auto-send twice in this window

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) return null
  return createServiceClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

function constantTimeMatch(a: string, b: string): boolean {
  const ba = Buffer.from(a)
  const bb = Buffer.from(b)
  if (ba.length !== bb.length) return false
  return timingSafeEqual(ba, bb)
}

function verifyCronAuth(req: NextRequest): { ok: boolean; reason?: string } {
  const secret = process.env.CRON_SECRET
  // 2026-05-10 security audit (H1): CRON_SECRET is REQUIRED. Previous
  // version had an x-vercel-cron fallback, but that header isn't a
  // secret — any external caller can spoof it. If CRON_SECRET is
  // missing we fail closed rather than falling through to an
  // unauthenticated path.
  if (!secret) {
    return { ok: false, reason: 'CRON_SECRET env not set — cron is disabled until configured' }
  }
  const header = req.headers.get('authorization') ?? ''
  const expected = `Bearer ${secret}`
  return { ok: constantTimeMatch(header, expected) }
}

interface CronOutreachRow {
  id: string
  user_id: string
  channel_id: string
  channel_name: string
  channel_url: string
  description: string | null
  email: string
  status: string | null
  notes: string | null
  follow_up_date: string | null
  touchpoints: string | null
  unipile_thread_id: string | null
  unipile_provider_id: string | null
  last_auto_followup_at: string | null
  followup_set_id: string | null
}

interface CronProfileRow {
  user_id: string
  full_name: string | null
  linkedin_url: string | null
  pitch_line: string | null
  subject_template: string | null
  email: string | null
  followup_config: UserProfile['followUpConfig']
  unipile_account_id: string | null
  /** 2026-05-10 audit (H-recipient): the Unipile-connected Gmail address
   *  is the actual sender — recipientIssue() must compare against this,
   *  not the Supabase auth email, otherwise sending to your connected
   *  Gmail (which differs from your signup email) wouldn't be blocked
   *  by the self-check. */
  unipile_account_email: string | null
  /** Sender's postal address — auto-appended to the CAN-SPAM footer
   *  by buildOutreachContent. Nullable; the email body falls back to
   *  a "set this in Settings" placeholder when missing. */
  physical_address: string | null
}

export async function GET(req: NextRequest) {
  const authResult = verifyCronAuth(req)
  if (!authResult.ok) {
    return NextResponse.json(
      { error: 'Unauthorized', reason: authResult.reason },
      { status: 401 },
    )
  }

  const supabase = getServiceClient()
  if (!supabase) {
    return NextResponse.json(
      { error: 'Service client unavailable — check NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY' },
      { status: 500 },
    )
  }

  const todayIso = new Date().toISOString().slice(0, 10)

  // Find candidates: auto_followup=true, status='No Response',
  // follow_up_date <= today, has Unipile thread (so we can match reply
  // backstop), wasn't already auto-followed within COOLDOWN_HOURS.
  const cooldownCutoff = new Date(Date.now() - COOLDOWN_HOURS * 3600_000).toISOString()
  const claimedAt = new Date().toISOString()

  // 2026-05-10 audit (CRITICAL #1): Atomic claim instead of read-then-loop.
  // Previous version read candidates, then sent + stamped last_auto_followup_at
  // *after* each send completed. If two cron instances overlapped (slow run
  // racing the next 15-min trigger) they'd both read the same rows and
  // both fire the send → duplicate emails to the creator. The fix: an
  // atomic UPDATE … RETURNING claims rows by stamping the cooldown column
  // BEFORE we process. Only rows the DB hands back made it through the
  // atomic write — the other instance got an empty set. If our send
  // subsequently fails, we've burned this row's cooldown for 24h, which is
  // the right call (fail closed — better to skip one send than double-fire).
  //
  // We do this in two steps because PostgREST doesn't expose
  // SELECT FOR UPDATE SKIP LOCKED directly: first SELECT the ids matching
  // our filter, then UPDATE … WHERE id = ANY($ids) AND (cooldown clause)
  // RETURNING the rows we actually claimed.
  const { data: candidateIdRows, error: idQueryErr } = await supabase
    .from('outreach_entries')
    .select('id')
    .eq('auto_followup', true)
    .eq('status', 'No Response')
    .not('unipile_thread_id', 'is', null)
    .lte('follow_up_date', todayIso)
    .or(`last_auto_followup_at.is.null,last_auto_followup_at.lt.${cooldownCutoff}`)
    .limit(GLOBAL_CAP_PER_RUN)

  if (idQueryErr) {
    console.error('[cron/send-followups] candidate id query failed', idQueryErr)
    return NextResponse.json(
      {
        error: 'Candidate query failed',
        // Surface the actual Supabase error message + code so cron probes
        // can diagnose without trawling Vercel function logs.
        detail: idQueryErr.message,
        code: idQueryErr.code ?? null,
        hint: idQueryErr.hint ?? null,
      },
      { status: 500 },
    )
  }

  const candidateIds = (candidateIdRows ?? []).map(r => r.id as string)
  if (candidateIds.length === 0) {
    return NextResponse.json({ ok: true, processed: 0, sent: 0, skipped: 0 })
  }

  // Atomic claim: stamp last_auto_followup_at NOW, but only for rows that
  // either have no prior stamp or whose stamp is older than cooldownCutoff.
  // A concurrent instance trying the same UPDATE will get a disjoint
  // result set or empty — no row is processed twice.
  const { data: claimedRaw, error: claimErr } = await supabase
    .from('outreach_entries')
    .update({ last_auto_followup_at: claimedAt })
    .in('id', candidateIds)
    .or(`last_auto_followup_at.is.null,last_auto_followup_at.lt.${cooldownCutoff}`)
    .select(
      'id, user_id, channel_id, channel_name, channel_url, description, email, status, notes, follow_up_date, touchpoints, unipile_thread_id, unipile_provider_id, last_auto_followup_at, followup_set_id',
    )

  if (claimErr) {
    console.error('[cron/send-followups] atomic claim failed', claimErr)
    return NextResponse.json({ error: 'Claim failed' }, { status: 500 })
  }

  const candidates = (claimedRaw ?? []) as CronOutreachRow[]
  if (candidates.length === 0) {
    return NextResponse.json({ ok: true, processed: 0, sent: 0, skipped: 0, note: 'all candidates claimed by parallel run' })
  }

  // Batch-load all the users' profiles so we can build the right
  // template per row without N+1 queries.
  const userIds = Array.from(new Set(candidates.map(c => c.user_id)))
  const { data: profileRows } = await supabase
    .from('user_profile')
    .select('user_id, full_name, linkedin_url, pitch_line, subject_template, followup_config, email, unipile_account_id, unipile_account_email, physical_address')
    .in('user_id', userIds)
  const profileByUser = new Map<string, CronProfileRow>()
  for (const p of (profileRows ?? []) as CronProfileRow[]) {
    profileByUser.set(p.user_id, p)
  }

  // CAN-SPAM §5(a)(4) suppression batch — anyone the user has on
  // their do-not-contact list MUST be skipped. We load every
  // (user_id, recipient_email) pair we're about to send to in one
  // query so we don't N+1 the table per follow-up.
  const recipientPairs = candidates.map(c => ({
    user_id: c.user_id,
    recipient_email: (c.email ?? '').trim().toLowerCase(),
  }))
  const suppressedSet = new Set<string>()
  if (recipientPairs.length > 0) {
    const lowercased = Array.from(new Set(recipientPairs.map(p => p.recipient_email)))
      .filter(e => e.length > 0)
    const { data: suppressionRows, error: suppressionErr } = await supabase
      .from('suppression_list')
      .select('user_id, recipient_email')
      .in('user_id', userIds)
      .in('recipient_email', lowercased)
    if (suppressionErr) {
      // Fail open — same rationale as the manual send path: a transient
      // table error shouldn't kill the entire cron run. Log so it's
      // noticeable.
      console.error('[cron/send-followups] suppression lookup failed', suppressionErr.message)
    } else {
      for (const row of suppressionRows ?? []) {
        suppressedSet.add(`${row.user_id}|${(row.recipient_email ?? '').toLowerCase()}`)
      }
    }
  }

  const perUserCounter = new Map<string, number>()
  let sent = 0
  let skipped = 0
  const errors: Array<{ entryId: string; reason: string }> = []

  for (const entry of candidates) {
    if (sent >= GLOBAL_CAP_PER_RUN) {
      skipped += 1
      errors.push({ entryId: entry.id, reason: 'global cap reached' })
      continue
    }
    const userCount = perUserCounter.get(entry.user_id) ?? 0
    if (userCount >= PER_USER_CAP_PER_RUN) {
      skipped += 1
      errors.push({ entryId: entry.id, reason: 'per-user cap reached' })
      continue
    }
    const profileRow = profileByUser.get(entry.user_id)
    if (!profileRow?.unipile_account_id) {
      skipped += 1
      errors.push({ entryId: entry.id, reason: 'no Unipile account on user' })
      continue
    }

    const userProfile: UserProfile = {
      fullName: profileRow.full_name ?? '',
      linkedinUrl: profileRow.linkedin_url ?? '',
      pitchLine: profileRow.pitch_line ?? '',
      subjectTemplate: profileRow.subject_template ?? undefined,
      followUpConfig: profileRow.followup_config ?? null,
      userEmail: profileRow.email ?? undefined,
      physicalAddress: profileRow.physical_address ?? null,
    }

    // Defensive recipient guard — same logic the manual send path uses.
    // 2026-05-10 audit (H-recipient): compare against the Unipile-connected
    // sender Gmail, not the Supabase auth email. Sending to your connected
    // Gmail from itself is the same "email yourself" bug — guard catches it.
    const senderAddress = profileRow.unipile_account_email ?? profileRow.email
    const issue = recipientIssue(entry.email, senderAddress)
    if (issue !== null) {
      skipped += 1
      errors.push({ entryId: entry.id, reason: `recipient ${issue}` })
      continue
    }

    // Suppression check — recipient unsubscribed (or bounced / complained).
    // CAN-SPAM §5(a)(4) requires us to honor opt-outs within 10
    // business days; we apply immediately. Pre-loaded above to keep
    // this loop branch O(1).
    if (suppressedSet.has(`${entry.user_id}|${(entry.email ?? '').trim().toLowerCase()}`)) {
      skipped += 1
      errors.push({ entryId: entry.id, reason: 'recipient suppressed (unsubscribed)' })
      continue
    }

    const creator: Partial<Creator> = {
      channelName: entry.channel_name,
      channelUrl: entry.channel_url,
      email: entry.email,
      description: entry.description ?? '',
      videoTitles: [],
    }

    // Build the follow-up from the lead's resolved template set at the
    // stage matching its touch count (its assigned set, else the user's
    // default). Subject threads on the original (Re: …) and the body
    // carries the CAN-SPAM footer — both handled by buildFollowUpContent.
    const touchCount = parseInt(entry.touchpoints ?? '0', 10) || 0
    const content = buildFollowUpContent(
      creator as Creator,
      userProfile,
      touchCount,
      entry.followup_set_id,
    )
    const followUpSubject = content.subject
    const followUpBody = content.body

    try {
      const sentResp = await sendEmail({
        accountId: profileRow.unipile_account_id,
        to: entry.email,
        toDisplayName: entry.channel_name,
        subject: followUpSubject,
        body: followUpBody,
        bodyType: 'text',
        // Follow-ups DO turn on open + link tracking — by this point
        // they've already received a cold email, the deliverability
        // concern is moot and we want the open signal.
        tracking: { opens: true, links: true, label: entry.id },
        // Thread the follow-up to the original send so Gmail UI shows
        // them as one conversation on the recipient side.
        replyTo: entry.unipile_provider_id ?? undefined,
      })

      const nowIso = new Date().toISOString()
      const currentTouchpoints = parseInt(entry.touchpoints ?? '0', 10) || 0
      const newTouchpoints = (currentTouchpoints + 1).toString()
      const nextFollowUp = new Date(Date.now() + REFRESH_FOLLOWUP_DAYS * 86400_000)
        .toISOString()
        .slice(0, 10)
      const auditLine = `[auto · cron] follow-up sent ${nowIso.slice(0, 16)}`
      const newNotes = entry.notes ? `${entry.notes}\n${auditLine}` : auditLine

      // 2026-05-10 audit (HIGH-provider_id): DO NOT overwrite
      // unipile_provider_id — it's the original outreach email's
      // Message-ID, used by the inbound webhook's In-Reply-To match
      // path. If a creator replies to the *original* email (not the
      // follow-up), we still need the original id to attribute the
      // reply back. unipile_thread_id is the redundancy; preserve
      // both. unipile_message_id (Unipile's internal id of the LAST
      // send) is the only thing that legitimately rotates each send.
      // last_auto_followup_at was already stamped by the atomic
      // claim — don't re-stamp here.
      await supabase
        .from('outreach_entries')
        .update({
          unipile_message_id: sentResp.id ?? null,
          // unipile_provider_id intentionally NOT updated — see comment above.
          unipile_thread_id: entry.unipile_thread_id ?? sentResp.thread_id ?? null,
          unipile_tracking_id: sentResp.tracking_id ?? null,
          unipile_sent_at: nowIso,
          touchpoints: newTouchpoints,
          follow_up_date: nextFollowUp,
          notes: newNotes,
        })
        .eq('id', entry.id)

      perUserCounter.set(entry.user_id, userCount + 1)
      sent += 1
    } catch (err) {
      const msg = err instanceof UnipileError ? err.message : (err as Error).message
      errors.push({ entryId: entry.id, reason: msg })
      console.error('[cron/send-followups] send failed', entry.id, msg)
      skipped += 1
    }
  }

  console.log('[cron/send-followups] run complete', {
    candidates: candidates.length,
    sent,
    skipped,
    errors: errors.length,
  })

  return NextResponse.json({
    ok: true,
    processed: candidates.length,
    sent,
    skipped,
    errors,
  })
}
