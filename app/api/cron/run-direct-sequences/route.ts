/**
 * GET /api/cron/run-direct-sequences — the follow-up engine for the
 * direct-email path.
 *
 * Walks enrollments whose next step is due and, for each, re-checks the
 * stop-conditions BEFORE sending (the cardinal rule — never follow up
 * after a reply), then either sends the next email step via the single
 * sendEmail() choke-point or schedules the next wait.
 *
 * Stepping model (one action per due tick):
 *   • 'wait'  → schedule next_run_at = now + days, advance past it.
 *   • 'email' → send it, advance; if the following step is a wait,
 *               consume it to set the delay; else run again next tick.
 *   • past the last step → status 'completed'.
 *
 * DARK until DIRECT_EMAIL_ENABLED. Flag off ⇒ no-op after auth. Caps
 * bound the blast radius. Auth + service client mirror send-followups.
 */
import { NextRequest, NextResponse } from 'next/server'
import { timingSafeEqual } from 'node:crypto'
import { createClient as createServiceClient, type SupabaseClient } from '@supabase/supabase-js'
import { isDirectEmailEnabled } from '@/lib/email/direct/flag'
import { sendEmail } from '@/lib/email/direct/send'
import type { DirectEmailEnrollment, DirectEmailSequence, SequenceStep } from '@/lib/email/direct/types'

export const runtime = 'nodejs'
export const maxDuration = 60

const DUE_LIMIT = 100
const GLOBAL_CAP_PER_RUN = 50
const PER_USER_CAP_PER_RUN = 10

function constantTimeMatch(a: string, b: string): boolean {
  const ba = Buffer.from(a)
  const bb = Buffer.from(b)
  if (ba.length !== bb.length) return false
  return timingSafeEqual(ba, bb)
}
function verifyCronAuth(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  return constantTimeMatch(req.headers.get('authorization') ?? '', `Bearer ${secret}`)
}
function getServiceClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) return null
  return createServiceClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } })
}

export async function GET(req: NextRequest) {
  if (!verifyCronAuth(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!isDirectEmailEnabled()) return NextResponse.json({ ok: true, disabled: true })
  const supabase = getServiceClient()
  if (!supabase) return NextResponse.json({ error: 'Service client unavailable' }, { status: 500 })

  const nowIso = new Date().toISOString()

  // Due = active AND (next_run_at null [ready to start] OR next_run_at <= now).
  const { data: dueRows, error: dueErr } = await supabase
    .from('direct_email_enrollments')
    .select('*')
    .eq('status', 'active')
    .or(`next_run_at.is.null,next_run_at.lte.${nowIso}`)
    .order('next_run_at', { ascending: true, nullsFirst: true })
    .limit(DUE_LIMIT)
  if (dueErr) return NextResponse.json({ error: 'Due query failed', detail: dueErr.message }, { status: 500 })

  const due = (dueRows ?? []) as DirectEmailEnrollment[]
  if (due.length === 0) return NextResponse.json({ ok: true, processed: 0, sent: 0 })

  // Preload the sequences + one active account per user (the sender).
  const seqIds = Array.from(new Set(due.map((e) => e.sequence_id)))
  const userIds = Array.from(new Set(due.map((e) => e.user_id)))
  const { data: seqRows } = await supabase.from('direct_email_sequences').select('*').in('id', seqIds)
  const seqById = new Map<string, DirectEmailSequence>()
  for (const s of (seqRows ?? []) as DirectEmailSequence[]) seqById.set(s.id, s)

  const { data: acctRows } = await supabase
    .from('direct_email_accounts')
    .select('id, user_id, status')
    .in('user_id', userIds)
    .eq('status', 'active')
  const accountByUser = new Map<string, string>()
  for (const a of (acctRows ?? []) as Array<{ id: string; user_id: string }>) {
    if (!accountByUser.has(a.user_id)) accountByUser.set(a.user_id, a.id)
  }

  const perUser = new Map<string, number>()
  let sent = 0
  let stopped = 0
  let completed = 0
  const errors: Array<{ enrollment: string; reason: string }> = []

  for (const enr of due) {
    if (sent >= GLOBAL_CAP_PER_RUN) break
    if ((perUser.get(enr.user_id) ?? 0) >= PER_USER_CAP_PER_RUN) continue

    try {
      // ── Stop-condition gate (before any send) ──
      const contacts = Array.from(new Set([enr.contact_email, enr.contact_email.toLowerCase()]))
      const since = enr.last_step_at ?? enr.created_at
      const { data: replies } = await supabase
        .from('direct_email_log')
        .select('id')
        .eq('user_id', enr.user_id)
        .eq('direction', 'inbound')
        .in('from_email', contacts)
        .gt('created_at', since)
        .limit(1)
      if (replies && replies.length > 0) {
        await supabase
          .from('direct_email_enrollments')
          .update({ status: 'stopped', stop_reason: 'replied', updated_at: nowIso })
          .eq('id', enr.id)
        stopped += 1
        continue
      }

      const seq = seqById.get(enr.sequence_id)
      const steps = (seq?.steps ?? []) as SequenceStep[]
      if (!seq || !seq.is_active || enr.current_step >= steps.length) {
        await supabase
          .from('direct_email_enrollments')
          .update({ status: 'completed', next_run_at: null, updated_at: nowIso })
          .eq('id', enr.id)
        completed += 1
        continue
      }

      const step = steps[enr.current_step]

      if (step.type === 'wait') {
        const next = new Date(Date.now() + step.days * 86_400_000).toISOString()
        const nextStep = enr.current_step + 1
        await supabase
          .from('direct_email_enrollments')
          .update({
            current_step: nextStep,
            next_run_at: nextStep >= steps.length ? null : next,
            status: nextStep >= steps.length ? 'completed' : 'active',
            updated_at: nowIso,
          })
          .eq('id', enr.id)
        if (nextStep >= steps.length) completed += 1
        continue
      }

      // step.type === 'email'
      const accountId = accountByUser.get(enr.user_id)
      if (!accountId) {
        // No connected mailbox to send from — leave active, retry later.
        errors.push({ enrollment: enr.id, reason: 'no active account' })
        continue
      }

      await sendEmail(supabase, accountId, {
        to: enr.contact_email,
        subject: step.subject,
        body: step.body,
        bodyType: 'text',
        outreachEntryId: enr.outreach_entry_id ?? undefined,
      })
      sent += 1
      perUser.set(enr.user_id, (perUser.get(enr.user_id) ?? 0) + 1)

      // Advance; consume a following wait to set the delay.
      let nextStep = enr.current_step + 1
      let nextRun: string | null = nowIso // default: process the next step soon
      if (nextStep < steps.length && steps[nextStep].type === 'wait') {
        const w = steps[nextStep] as Extract<SequenceStep, { type: 'wait' }>
        nextRun = new Date(Date.now() + w.days * 86_400_000).toISOString()
        nextStep += 1
      }
      const done = nextStep >= steps.length
      await supabase
        .from('direct_email_enrollments')
        .update({
          current_step: nextStep,
          last_step_at: nowIso,
          next_run_at: done ? null : nextRun,
          status: done ? 'completed' : 'active',
          updated_at: nowIso,
        })
        .eq('id', enr.id)
      if (done) completed += 1
    } catch (e) {
      errors.push({ enrollment: enr.id, reason: (e as Error).message })
      console.error('[cron/run-direct-sequences] enrollment failed', enr.id, (e as Error).message)
    }
  }

  return NextResponse.json({ ok: true, processed: due.length, sent, stopped, completed, errors })
}
