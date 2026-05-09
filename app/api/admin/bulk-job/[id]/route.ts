/**
 * GET    /api/admin/bulk-job/[id]            — read job status (poll target)
 * DELETE /api/admin/bulk-job/[id]            — request cancel
 *
 * Both admin-gated. The poll endpoint is hot — the bar polls every
 * ~2s while a job runs. Returns just the JSON job state from Redis.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isAdminUser } from '@/lib/admin'
import { readBulkJob, requestBulkJobCancel } from '@/lib/bulk-job-store'

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
  const job = await requestBulkJobCancel(id)
  if (!job) {
    return NextResponse.json({ error: 'not-found' }, { status: 404 })
  }
  return NextResponse.json({ ok: true, job })
}
