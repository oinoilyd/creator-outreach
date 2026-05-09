/**
 * POST /api/admin/bulk-job/tick — QStash-driven worker that processes
 * one chunk of a bulk job, then schedules the next tick (if work
 * remains).
 *
 * This is what makes "background" actually mean background. The
 * client browser is no longer in the loop — it just polls for status.
 * QStash chains tick → tick → tick on the server, so progress
 * continues whether the user is on the page, on a different tab,
 * or has closed the browser entirely.
 *
 * Flow:
 *   1. Verify Upstash signature (production only)
 *   2. Read jobId from body, load job from Redis
 *   3. If terminal status or cancelRequested → finalize, exit
 *   4. Process one chunk (delegate to existing /api/admin/bulk-seed
 *      or /api/admin/bulk-enrich endpoints via internal HTTP call —
 *      avoids a code duplication / refactor risk)
 *   5. Update job state in Redis with new progress
 *   6. If work remains: publish next QStash message → /tick
 *   7. Else: finalize as 'done'
 *
 * maxDuration = 60 — same as the inner endpoints. We never hold the
 * tick open longer than one chunk.
 */

import { NextRequest, NextResponse } from 'next/server'
import { verifyQStashSignature, publishJob, isQStashConfigured } from '@/lib/qstash'
import {
  readBulkJob,
  updateBulkJob,
  finalizeBulkJob,
  type BulkJob,
  type SeedJobConfig,
  type EnrichJobConfig,
} from '@/lib/bulk-job-store'

export const maxDuration = 60

// Chunking knobs. Sized to keep each tick safely under the 60s
// Vercel function budget while making progress as fast as possible.
//
//   Search-only: each query ~6-8s. With concurrency=3 server-side,
//   12 queries fits in ~30s. Bumped from 6 → 12 (2026-05-09) to halve
//   tick count and total wall time.
//
//   With-enrich: each query expands to ~30 channels × ~10s of email
//   pipeline. Even concurrency=2 hits 60s on a SINGLE query. Keep
//   chunk small at 1 so we don't bust the budget.
const SEED_CHUNK_SEARCH_ONLY = 12
const SEED_CHUNK_WITH_ENRICH = 1

export async function POST(req: NextRequest) {
  const rawBody = await req.text()

  // Verify QStash signature — same pattern /api/instagram-fetch uses.
  // Skip in non-production for local development.
  if (process.env.NODE_ENV === 'production') {
    const sig = req.headers.get('upstash-signature')
    const url = `${req.nextUrl.origin}${req.nextUrl.pathname}`
    if (!verifyQStashSignature(rawBody, sig, url)) {
      console.warn('[bulk-job/tick] invalid QStash signature, rejecting')
      return NextResponse.json({ error: 'invalid-signature' }, { status: 401 })
    }
  }

  let payload: { jobId?: string }
  try {
    payload = JSON.parse(rawBody)
  } catch {
    return NextResponse.json({ error: 'invalid-json' }, { status: 400 })
  }
  const jobId = payload.jobId
  if (!jobId) {
    return NextResponse.json({ error: 'missing-jobId' }, { status: 400 })
  }

  const job = await readBulkJob(jobId)
  if (!job) {
    // Job vanished from Redis (TTL expired or never created). Don't
    // schedule another tick — there's nothing to tick on.
    console.warn(`[bulk-job/tick] job not found: ${jobId}`)
    return NextResponse.json({ ok: false, reason: 'job-not-found' })
  }

  // Honor cancellation immediately.
  if (job.cancelRequested) {
    console.log(`[bulk-job/tick] cancel requested for ${jobId}, finalizing`)
    await finalizeBulkJob(jobId, 'cancelled')
    return NextResponse.json({ ok: true, status: 'cancelled' })
  }

  // Already terminal? Defensive — shouldn't happen because we'd have
  // stopped scheduling, but guard against double-fire.
  if (job.status !== 'running' && job.status !== 'pending') {
    console.log(`[bulk-job/tick] job already terminal (${job.status})`)
    return NextResponse.json({ ok: true, status: job.status })
  }

  // Compute the base URL for self-calling /api/admin/bulk-seed or
  // /api/admin/bulk-enrich. Vercel host header → https. NEXT_PUBLIC_SITE_URL
  // for local dev fallback.
  const host = req.headers.get('host')
  const baseUrl =
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/+$/, '') ||
    (host ? `https://${host}` : '')
  if (!baseUrl) {
    await finalizeBulkJob(jobId, 'failed', {
      errors: [...job.errors, 'no base URL configured'].slice(-20),
    })
    return NextResponse.json({ error: 'no-base-url' }, { status: 500 })
  }

  // Process one chunk based on job type. Each branch:
  //   - calls the existing endpoint internally (which runs the actual
  //     work)
  //   - parses the response
  //   - returns { hasMore, deltaDone, deltaTotal?, errors[] }
  let result: TickResult
  try {
    if (job.type === 'seed') {
      result = await processSeedTick(job, baseUrl)
    } else {
      result = await processEnrichTick(job, baseUrl)
    }
  } catch (e) {
    const msg = (e as Error)?.message || String(e)
    console.error(`[bulk-job/tick] chunk threw: ${msg}`)
    // Treat thrown errors as one failure event, not a fatal abort —
    // the loop will retry by scheduling the next tick. Three
    // consecutive failures DOES abort (tracked in job.errors).
    result = { hasMore: true, deltaDone: 0, errors: [`tick threw: ${msg}`] }
  }

  // Apply progress.
  const newDone = job.done + result.deltaDone
  const newTotal = result.deltaTotal != null ? result.deltaTotal : job.total
  const newErrors = [...job.errors, ...result.errors].slice(-20)
  const newCursor = result.nextCursor != null ? result.nextCursor : job.cursor

  // 3-consecutive-failure abort, mirroring the old client-loop.
  // We count consecutive failures by inspecting trailing error count
  // since last progress — quick approximation.
  const consecutiveFailures = countTrailingFailures(newErrors, job.errors.length)
  if (consecutiveFailures >= 3) {
    await finalizeBulkJob(jobId, 'failed', {
      errors: [...newErrors, 'aborting: 3 consecutive tick failures'].slice(-20),
      done: newDone,
      total: newTotal,
    })
    return NextResponse.json({ ok: true, status: 'failed' })
  }

  // Done if no more work.
  if (!result.hasMore) {
    await finalizeBulkJob(jobId, 'done', {
      errors: newErrors,
      done: newDone,
      total: newTotal,
    })
    return NextResponse.json({ ok: true, status: 'done' })
  }

  // Persist progress + schedule next tick.
  await updateBulkJob(jobId, {
    done: newDone,
    total: newTotal,
    errors: newErrors,
    cursor: newCursor,
    status: 'running',
  })

  if (!isQStashConfigured()) {
    // Shouldn't happen — start endpoint refuses if QStash isn't
    // configured. But defensive in case env vars vanish mid-job.
    await finalizeBulkJob(jobId, 'failed', {
      errors: [...newErrors, 'qstash unconfigured mid-run'].slice(-20),
    })
    return NextResponse.json({ ok: false, error: 'qstash-unconfigured' })
  }

  const tickUrl = `${baseUrl}/api/admin/bulk-job/tick`
  // 2-second delay between ticks — gives the system time to settle
  // after a chunk and prevents a runaway tight loop on a misconfigured
  // chunk that processes 0 rows.
  const messageId = await publishJob(tickUrl, { jobId }, { delaySeconds: 2 })
  if (!messageId) {
    await finalizeBulkJob(jobId, 'failed', {
      errors: [...newErrors, 'failed to schedule next tick — qstash publish error'].slice(-20),
    })
    return NextResponse.json({ ok: false, error: 'qstash-publish-failed' })
  }

  return NextResponse.json({ ok: true, status: 'running', done: newDone, total: newTotal })
}

// ─── Helpers ────────────────────────────────────────────────────────

type TickResult = {
  hasMore: boolean
  deltaDone: number
  deltaTotal?: number
  nextCursor?: number
  errors: string[]
}

/**
 * Heuristic: count how many of the trailing N errors were just added
 * (by comparing the new errors length to the prior one). Used for
 * the 3-consecutive-failures abort.
 */
function countTrailingFailures(allErrors: string[], priorLen: number): number {
  // Each tick adds at most a few errors. A "failed tick" = one tick
  // that contributed any errors AND no progress. Simpler proxy:
  // count consecutive "tick threw" / "HTTP" / "timeout" in the
  // trailing entries.
  let count = 0
  for (let i = allErrors.length - 1; i >= 0; i--) {
    const e = allErrors[i]
    if (
      e.startsWith('tick threw:') ||
      e.startsWith('HTTP ') ||
      e.includes('timeout') ||
      e.includes('non-JSON')
    ) {
      count++
    } else {
      break
    }
    // Only consider the latest run of failures.
    if (i < priorLen - 5) break
  }
  return count
}

/** Headers used for the internal self-call to bulk-seed/bulk-enrich.
 *  See those routes for what the X-Internal-Bulk-Secret unlocks. */
function internalHeaders(): Record<string, string> {
  return {
    'content-type': 'application/json',
    'x-internal-bulk-secret': process.env.INTERNAL_BULK_SECRET ?? '',
  }
}

/**
 * Process one seed chunk. Cursor = chunk index (0..numChunks-1).
 */
async function processSeedTick(job: BulkJob, baseUrl: string): Promise<TickResult> {
  const config = job.config as SeedJobConfig
  const chunkSize = config.enrich ? SEED_CHUNK_WITH_ENRICH : SEED_CHUNK_SEARCH_ONLY
  const start = job.cursor * chunkSize
  if (start >= config.queries.length) {
    return { hasMore: false, deltaDone: 0, errors: [] }
  }
  const chunk = config.queries.slice(start, start + chunkSize)
  const errors: string[] = []
  try {
    const res = await fetch(`${baseUrl}/api/admin/bulk-seed`, {
      method: 'POST',
      headers: internalHeaders(),
      body: JSON.stringify({
        queries: chunk,
        enrich: config.enrich,
        concurrency: config.concurrency,
        maxResults: config.maxResults,
        region: config.region,
      }),
    })
    if (!res.ok) {
      errors.push(`HTTP ${res.status} on chunk ${job.cursor + 1}`)
    } else {
      const j = (await res.json()) as { errors?: string[] }
      if (j.errors?.length) errors.push(...j.errors.slice(0, 3))
    }
  } catch (e) {
    errors.push(`chunk ${job.cursor + 1}: ${(e as Error).message || String(e)}`)
  }
  const nextCursor = job.cursor + 1
  const totalChunks = Math.ceil(config.queries.length / chunkSize)
  const hasMore = nextCursor < totalChunks
  return {
    hasMore,
    deltaDone: chunk.length,
    nextCursor,
    errors,
  }
}

/**
 * Process one enrich tick. Cursor = row offset.
 */
async function processEnrichTick(job: BulkJob, baseUrl: string): Promise<TickResult> {
  const config = job.config as EnrichJobConfig
  const offset = job.cursor
  const errors: string[] = []
  let processedThisCall = 0
  let totalMatching: number | undefined
  let channelIdsRemainingLen = -1
  try {
    const res = await fetch(`${baseUrl}/api/admin/bulk-enrich`, {
      method: 'POST',
      headers: internalHeaders(),
      body: JSON.stringify({
        mode: config.mode,
        limit: config.batchSize,
        offset,
        concurrency: config.concurrency,
      }),
    })
    if (!res.ok) {
      errors.push(`HTTP ${res.status} on offset ${offset}`)
    } else {
      const j = (await res.json()) as {
        totalMatching?: number
        processedThisCall?: number
        channelIdsRemaining?: string[]
        errors?: string[]
      }
      processedThisCall = j.processedThisCall ?? 0
      totalMatching = j.totalMatching
      channelIdsRemainingLen = j.channelIdsRemaining?.length ?? 0
      if (j.errors?.length) errors.push(...j.errors.slice(0, 3))
    }
  } catch (e) {
    errors.push(`offset ${offset}: ${(e as Error).message || String(e)}`)
  }

  const nextOffset = offset + config.batchSize
  // Done if either: server says no remaining work, or we've moved
  // past totalMatching.
  let hasMore = true
  if (totalMatching != null && nextOffset >= totalMatching) hasMore = false
  if (channelIdsRemainingLen === 0 && processedThisCall === 0) hasMore = false

  return {
    hasMore,
    deltaDone: processedThisCall,
    deltaTotal: totalMatching,
    nextCursor: nextOffset,
    errors,
  }
}
