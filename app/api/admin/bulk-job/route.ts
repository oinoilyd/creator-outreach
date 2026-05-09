/**
 * POST /api/admin/bulk-job — kick off a server-side bulk-seed or
 * bulk-enrich run. Returns the jobId. The actual work happens in
 * /api/admin/bulk-job/tick (called repeatedly by QStash).
 *
 * Body shape:
 *   { type: 'seed', config: SeedJobConfig, label: string }
 *   { type: 'enrich', config: EnrichJobConfig, label: string }
 *
 * Returns:
 *   201 { ok: true, jobId, job }
 *   409 { error: 'job-already-running', currentJob }
 *   400 { error: 'invalid-payload' }
 *   403 { error: 'unauthorized' }
 *   503 { error: 'qstash-not-configured' } — bulk jobs require QStash
 *
 * Why QStash is required: the whole point of this rewrite is that
 * processing happens server-side and survives the user navigating
 * away or backgrounding the tab. QStash is the chaining mechanism.
 * Without it we'd be back to client-loops.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isAdminUser } from '@/lib/admin'
import {
  createBulkJob,
  readCurrentBulkJob,
  type SeedJobConfig,
  type EnrichJobConfig,
} from '@/lib/bulk-job-store'
import { isQStashConfigured, publishJob } from '@/lib/qstash'

export const maxDuration = 30

type StartBody =
  | { type: 'seed'; config: SeedJobConfig; label: string }
  | { type: 'enrich'; config: EnrichJobConfig; label: string }

/**
 * GET /api/admin/bulk-job — return the current/most-recent job.
 * Used by BulkJobProvider on every page load to rehydrate the bar
 * from server state (so the loop survives reload, not just SPA nav).
 *
 * Returns:
 *   { ok: true, job: BulkJob | null }
 *   403 unauthorized
 */
export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!isAdminUser(user)) {
    // For non-admins, return null silently — the bar simply doesn't
    // appear. Avoids leaking that there's a system to gate.
    return NextResponse.json({ ok: true, job: null })
  }
  const job = await readCurrentBulkJob()
  return NextResponse.json({ ok: true, job })
}

export async function POST(req: NextRequest) {
  // Auth — admin only.
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!isAdminUser(user)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 403 })
  }

  // QStash gate — without it we can't chain ticks.
  if (!isQStashConfigured()) {
    return NextResponse.json(
      {
        error: 'qstash-not-configured',
        hint:
          'Set QSTASH_TOKEN + QSTASH_CURRENT_SIGNING_KEY in Vercel envs. Background bulk jobs use QStash to chain function calls so processing continues when the browser tab is backgrounded.',
      },
      { status: 503 },
    )
  }
  // Internal-bulk-secret gate — required so the tick worker can
  // self-call /api/admin/bulk-seed and /api/admin/bulk-enrich without
  // an admin cookie. Generate a strong random string (e.g.
  // `openssl rand -hex 32`) and set INTERNAL_BULK_SECRET in Vercel.
  if (!process.env.INTERNAL_BULK_SECRET) {
    return NextResponse.json(
      {
        error: 'internal-secret-not-configured',
        hint:
          'Set INTERNAL_BULK_SECRET to a strong random string in Vercel envs. The QStash worker uses it to authenticate self-calls to bulk-seed/bulk-enrich. Suggested: openssl rand -hex 32.',
      },
      { status: 503 },
    )
  }

  let body: StartBody
  try {
    body = (await req.json()) as StartBody
  } catch {
    return NextResponse.json({ error: 'invalid-json' }, { status: 400 })
  }

  if (!body || (body.type !== 'seed' && body.type !== 'enrich')) {
    return NextResponse.json({ error: 'invalid-type' }, { status: 400 })
  }
  if (!body.label || typeof body.label !== 'string') {
    return NextResponse.json({ error: 'missing-label' }, { status: 400 })
  }
  if (!body.config || typeof body.config !== 'object') {
    return NextResponse.json({ error: 'missing-config' }, { status: 400 })
  }

  // Compute initial total. For seed: queries.length. For enrich: 1
  // placeholder (the first tick will fetch the real totalMatching
  // and update it).
  let total = 1
  if (body.type === 'seed') {
    const c = body.config as SeedJobConfig
    if (!Array.isArray(c.queries) || c.queries.length === 0) {
      return NextResponse.json({ error: 'no-queries' }, { status: 400 })
    }
    total = Math.min(c.queries.length, 200) // hard cap to keep budgets reasonable
  }

  // Refuse if a job is already running (single-slot system).
  const currentJob = await readCurrentBulkJob()
  if (currentJob && currentJob.status === 'running') {
    return NextResponse.json(
      { error: 'job-already-running', currentJob },
      { status: 409 },
    )
  }

  const job = await createBulkJob({
    type: body.type,
    label: body.label,
    config: body.config,
    total,
  })
  if (!job) {
    return NextResponse.json({ error: 'create-failed' }, { status: 500 })
  }

  // Build the absolute tick URL. Vercel sets host header; fall back
  // to NEXT_PUBLIC_SITE_URL for local dev.
  const host = req.headers.get('host')
  const baseUrl =
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/+$/, '') ||
    (host ? `https://${host}` : '')
  if (!baseUrl) {
    return NextResponse.json({ error: 'no-base-url' }, { status: 500 })
  }
  const tickUrl = `${baseUrl}/api/admin/bulk-job/tick`

  // Mark the job as running, then publish the first QStash message.
  // Delay 0 means "as soon as you can" — usually <2s in practice.
  await import('@/lib/bulk-job-store').then(m =>
    m.updateBulkJob(job.id, { status: 'running' }),
  )
  const messageId = await publishJob(tickUrl, { jobId: job.id })
  if (!messageId) {
    // QStash publish failed — mark the job failed so the client
    // doesn't poll forever.
    await import('@/lib/bulk-job-store').then(m =>
      m.finalizeBulkJob(job.id, 'failed', {
        errors: ['failed to schedule first tick — qstash publish error'],
      }),
    )
    return NextResponse.json(
      { error: 'qstash-publish-failed' },
      { status: 502 },
    )
  }

  return NextResponse.json({ ok: true, jobId: job.id, job }, { status: 201 })
}
