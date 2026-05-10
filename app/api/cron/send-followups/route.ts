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
import { buildOutreachContent, recipientIssue } from '@/lib/format'
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

function verifyCronAuth(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET
  // If no secret configured, only allow when running locally or via Vercel's
  // own cron header. Vercel cron requests include x-vercel-cron in headers.
  if (!secret) return req.headers.get('x-vercel-cron') === '1'
  const header = req.headers.get('authorization') ?? ''
  const expected = `Bearer ${secret}`
  return constantTimeMatch(header, expected)
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
}

interface CronProfileRow {
  user_id: string
  full_name: string | null
  linkedin_url: string | null
  pitch_line: string | null
  subject_template: string | null
  email: string | null
  unipile_account_id: string | null
}

export async function GET(req: NextRequest) {
  if (!verifyCronAuth(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
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
  const { data: rawCandidates, error: queryErr } = await supabase
    .from('outreach_entries')
    .select(
      'id, user_id, channel_id, channel_name, channel_url, description, email, status, notes, follow_up_date, touchpoints, unipile_thread_id, unipile_provider_id, last_auto_followup_at',
    )
    .eq('auto_followup', true)
    .eq('status', 'No Response')
    .not('unipile_thread_id', 'is', null)
    .lte('follow_up_date', todayIso)
    .or(`last_auto_followup_at.is.null,last_auto_followup_at.lt.${cooldownCutoff}`)
    .limit(GLOBAL_CAP_PER_RUN)

  if (queryErr) {
    console.error('[cron/send-followups] candidate query failed', queryErr)
    return NextResponse.json({ error: 'Candidate query failed' }, { status: 500 })
  }

  const candidates = (rawCandidates ?? []) as CronOutreachRow[]
  if (candidates.length === 0) {
    return NextResponse.json({ ok: true, processed: 0, sent: 0, skipped: 0 })
  }

  // Batch-load all the users' profiles so we can build the right
  // template per row without N+1 queries.
  const userIds = Array.from(new Set(candidates.map(c => c.user_id)))
  const { data: profileRows } = await supabase
    .from('user_profile')
    .select('user_id, full_name, linkedin_url, pitch_line, subject_template, email, unipile_account_id')
    .in('user_id', userIds)
  const profileByUser = new Map<string, CronProfileRow>()
  for (const p of (profileRows ?? []) as CronProfileRow[]) {
    profileByUser.set(p.user_id, p)
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
      userEmail: profileRow.email ?? undefined,
    }

    // Defensive recipient guard — same logic the manual send path uses.
    const issue = recipientIssue(entry.email, profileRow.email)
    if (issue !== null) {
      skipped += 1
      errors.push({ entryId: entry.id, reason: `recipient ${issue}` })
      continue
    }

    const creator: Partial<Creator> = {
      channelName: entry.channel_name,
      channelUrl: entry.channel_url,
      email: entry.email,
      description: entry.description ?? '',
      videoTitles: [],
    }
    const content = buildOutreachContent(creator as Creator, userProfile)

    // Build a follow-up subject — keep the original subject + Re: prefix
    // so Gmail threads it correctly on the recipient side.
    const followUpSubject = content.subject.startsWith('Re:')
      ? content.subject
      : `Re: ${content.subject}`

    // Follow-up body — short, present-tense, references the original.
    const followUpBody = [
      `Hey ${content.recipientFirst},`,
      ``,
      `Following up on my note from a few days ago — didn't want it to get buried.`,
      ``,
      `Still keen to chat if you've got a quick window this week.`,
      ``,
      (profileRow.full_name?.split(/\s+/)[0]) || 'me',
    ].join('\n')

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

      await supabase
        .from('outreach_entries')
        .update({
          unipile_message_id: sentResp.id ?? null,
          unipile_provider_id: sentResp.provider_id ?? entry.unipile_provider_id,
          unipile_thread_id: sentResp.thread_id ?? entry.unipile_thread_id,
          unipile_tracking_id: sentResp.tracking_id ?? null,
          unipile_sent_at: nowIso,
          last_auto_followup_at: nowIso,
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
