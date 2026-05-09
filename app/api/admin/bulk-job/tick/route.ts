/**
 * POST /api/admin/bulk-job/tick — process one chunk of a bulk job.
 *
 * Two auth paths (rewritten 2026-05-09):
 *   1. Browser admin cookie — fired by BulkJobProvider's polling loop
 *      when it detects state.lastTickAt is stale. This is the PRIMARY
 *      driver: it works out of the box with no env-var setup.
 *   2. QStash signature — fired by the chained QStash messages (if
 *      QStash is configured). This is the BONUS driver: lets work
 *      continue even when the browser is fully closed.
 *
 * Both paths process one chunk and return. The browser keeps polling
 * and re-firing /tick as needed; the QStash chain (when configured)
 * also self-schedules. A simple "lastTickAt < 2s ago" guard prevents
 * the two from double-processing the same chunk if they happen to
 * race.
 *
 * Why this is robust:
 *   - Without QStash + INTERNAL_BULK_SECRET set: browser polling
 *     drives ticks. Works as long as the user has ANY tab open in
 *     the app (the bar is in the root layout, so every page has it).
 *   - With QStash + INTERNAL_BULK_SECRET: also continues with the
 *     browser closed.
 *
 * maxDuration = 60 — one chunk per request, never longer.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isAdminUser } from '@/lib/admin'
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
//   Search-only: ~6-8s per query at concurrency=3 → 18 queries ≈ 42s.
//   Bumped 12 → 18 (2026-05-09) now that the inter-tick gap is gone:
//   bigger chunks amortize tick overhead better.
//   With-enrich: each query expands to ~30 channels × ~10s pipeline.
//   Even concurrency=2 hits 60s on a SINGLE query, so chunk = 1.
const SEED_CHUNK_SEARCH_ONLY = 18
const SEED_CHUNK_WITH_ENRICH = 1

// Race guard: if a tick was processed within the last N ms, the
// incoming tick request bails (assumes another driver is actively
// processing). Tightened from 1500 → 600ms (2026-05-09) to reduce
// the gap between back-to-back ticks. Browser polls every 1s and
// fires a tick if state is stale by >800ms; with this guard at
// 600ms, the only races that get rejected are genuine same-instant
// duplicates (e.g. browser + QStash chain colliding on the same
// completion).
const TICK_DEDUP_MS = 600

export async function POST(req: NextRequest) {
  const rawBody = await req.text()

  // ── Auth ──────────────────────────────────────────────────────
  // Accept either QStash signature OR admin cookie. Cookie is the
  // common case (browser-driven polling); QStash is the bonus path.
  let authedVia: 'qstash' | 'cookie' | null = null

  const sig = req.headers.get('upstash-signature')
  if (sig && process.env.NODE_ENV === 'production') {
    const url = `${req.nextUrl.origin}${req.nextUrl.pathname}`
    if (verifyQStashSignature(rawBody, sig, url)) {
      authedVia = 'qstash'
    }
  } else if (sig) {
    // Dev mode: accept signed requests without strict verification so
    // local QStash testing works.
    authedVia = 'qstash'
  }

  if (!authedVia) {
    // Try cookie auth.
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (isAdminUser(user)) {
      authedVia = 'cookie'
    }
  }

  if (!authedVia) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  // ── Body ──────────────────────────────────────────────────────
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
    return NextResponse.json({ ok: false, reason: 'job-not-found' })
  }

  // Honor cancellation immediately.
  if (job.cancelRequested) {
    const cancelled = await finalizeBulkJob(jobId, 'cancelled')
    return NextResponse.json({ ok: true, status: 'cancelled', job: cancelled })
  }

  // Skip if job is already terminal.
  if (job.status !== 'running' && job.status !== 'pending') {
    return NextResponse.json({ ok: true, status: job.status })
  }

  // Race guard: if a tick was just processed, bail. The other driver
  // (browser or QStash) is handling things — no need to double up.
  const lastTickMs = new Date(job.lastTickAt).getTime()
  if (Date.now() - lastTickMs < TICK_DEDUP_MS) {
    return NextResponse.json({ ok: true, skipped: 'recent-tick', status: job.status })
  }

  // Mark the tick start IMMEDIATELY so other drivers see it as
  // recently-ticked and skip. Functions as a soft lock.
  await updateBulkJob(jobId, {})

  // ── Compute base URL for self-call ────────────────────────────
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

  // Build headers for the inner self-call. The inner endpoints
  // (bulk-seed, bulk-enrich) accept either admin cookies OR the
  // X-Internal-Bulk-Secret header. Forward whatever we have.
  const cookieHeader = req.headers.get('cookie') || ''
  const selfCallHeaders: Record<string, string> = { 'content-type': 'application/json' }
  if (cookieHeader) selfCallHeaders.cookie = cookieHeader
  if (process.env.INTERNAL_BULK_SECRET) {
    selfCallHeaders['x-internal-bulk-secret'] = process.env.INTERNAL_BULK_SECRET
  }

  // ── Process one chunk ─────────────────────────────────────────
  let result: TickResult
  try {
    if (job.type === 'seed') {
      result = await processSeedTick(job, baseUrl, selfCallHeaders)
    } else {
      result = await processEnrichTick(job, baseUrl, selfCallHeaders)
    }
  } catch (e) {
    const msg = (e as Error)?.message || String(e)
    console.error(`[bulk-job/tick] chunk threw: ${msg}`)
    result = { hasMore: true, deltaDone: 0, errors: [`tick threw: ${msg}`] }
  }

  // Apply progress.
  const newDone = job.done + result.deltaDone
  const newTotal = result.deltaTotal != null ? result.deltaTotal : job.total
  const newErrors = [...job.errors, ...result.errors].slice(-20)
  const newCursor = result.nextCursor != null ? result.nextCursor : job.cursor

  // 3-consecutive-failure abort.
  const consecutiveFailures = countTrailingFailures(newErrors, job.errors.length)
  if (consecutiveFailures >= 3) {
    const failed = await finalizeBulkJob(jobId, 'failed', {
      errors: [...newErrors, 'aborting: 3 consecutive tick failures'].slice(-20),
      done: newDone,
      total: newTotal,
    })
    return NextResponse.json({ ok: true, status: 'failed', job: failed })
  }

  // Done if no more work.
  if (!result.hasMore) {
    const done = await finalizeBulkJob(jobId, 'done', {
      errors: newErrors,
      done: newDone,
      total: newTotal,
    })
    return NextResponse.json({ ok: true, status: 'done', job: done })
  }

  // Persist progress.
  await updateBulkJob(jobId, {
    done: newDone,
    total: newTotal,
    errors: newErrors,
    cursor: newCursor,
    status: 'running',
  })

  // Schedule next tick via QStash IF this tick was driven by QStash
  // (continues the chain) AND QStash is configured. Browser-driven
  // ticks rely on the next poll to fire the next tick.
  //
  // delaySeconds = 0 (tightened from 2 → 0 on 2026-05-09): no need
  // to throttle ourselves; the per-tick race guard already prevents
  // double-processing. Want chunks back-to-back for max throughput.
  if (authedVia === 'qstash' && isQStashConfigured()) {
    const tickUrl = `${baseUrl}/api/admin/bulk-job/tick`
    const messageId = await publishJob(tickUrl, { jobId }, { delaySeconds: 0 })
    if (!messageId) {
      console.warn(`[bulk-job/tick] qstash publish failed for ${jobId}; relying on browser polling`)
    }
  }

  // Re-read the job so the response reflects the freshest persisted
  // state (the browser uses this to update the bar without waiting
  // for the next poll cycle).
  const finalJob = await readBulkJob(jobId)
  return NextResponse.json({
    ok: true,
    status: 'running',
    done: newDone,
    total: newTotal,
    authedVia,
    job: finalJob,
  })
}

// ─── Helpers ────────────────────────────────────────────────────────

type TickResult = {
  hasMore: boolean
  deltaDone: number
  deltaTotal?: number
  nextCursor?: number
  errors: string[]
}

function countTrailingFailures(allErrors: string[], priorLen: number): number {
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
    if (i < priorLen - 5) break
  }
  return count
}

async function processSeedTick(
  job: BulkJob,
  baseUrl: string,
  headers: Record<string, string>,
): Promise<TickResult> {
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
      headers,
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

async function processEnrichTick(
  job: BulkJob,
  baseUrl: string,
  headers: Record<string, string>,
): Promise<TickResult> {
  const config = job.config as EnrichJobConfig
  const offset = job.cursor
  const errors: string[] = []
  let processedThisCall = 0
  let totalMatching: number | undefined
  let channelIdsRemainingLen = -1
  try {
    const res = await fetch(`${baseUrl}/api/admin/bulk-enrich`, {
      method: 'POST',
      headers,
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
