/**
 * GET    /api/admin/bulk-job/[id]            — read job status (poll target)
 * DELETE /api/admin/bulk-job/[id]            — HARD cancel (immediate)
 *
 * Both admin-gated. The poll endpoint is hot — the bar polls every
 * ~2s while a job runs. Returns just the JSON job state from Redis.
 *
 * 2026-05-20 — DELETE used to set cancelRequested:true and wait for
 * the next tick to finalize. With batchSize 10 × concurrency 4, a
 * single tick could be processing for 30-50s, so the user saw
 * "Cancelling…" for almost a minute after hitting Stop. Now we BOTH
 * set the flag AND immediately call finalizeBulkJob('cancelled'),
 * so the UI flips to terminal on the next poll (<1s). Any in-flight
 * tick will finish its current batch (those writes still land — no
 * way to abort an HTTP request mid-flight) but the tick guard at
 * the top of the tick handler (status !== 'running') prevents new
 * batches from starting.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isAdminUser } from '@/lib/admin'
import { readBulkJob, requestBulkJobCancel, finalizeBulkJob } from '@/lib/bulk-job-store'

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!isAdminUser(user)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 403 })
  }

  const { id } = await context.params
  const job = await readBulkJob(id)
  if (!job) {
    return NextResponse.json({ error: 'not-found' }, { status: 404 })
  }
  return NextResponse.json({ ok: true, job })
}

export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!isAdminUser(user)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 403 })
  }

  const { id } = await context.params
  // Set the soft flag first so the tick handler bails on its own
  // check (defensive — in case a tick was already past the
  // status='running' check when the finalize lands).
  const flagged = await requestBulkJobCancel(id)
  if (!flagged) {
    return NextResponse.json({ error: 'not-found' }, { status: 404 })
  }
  // Hard finalize — immediately mark the job as cancelled, set
  // endedAt, and clear the current-job pointer so a new job can
  // start right away. The next poll sees status='cancelled' and
  // stops polling.
  const job = await finalizeBulkJob(id, 'cancelled')
  return NextResponse.json({ ok: true, job: job ?? flagged })
}
