/**
 * Server-side bulk-job state store, backed by Redis.
 *
 * The bulk-seed / bulk-enrich loops used to run client-side: the
 * browser fired POSTs in a `while (offset < total)` loop. That broke
 * when the user backgrounded the tab — Chrome/Safari aggressively
 * throttle (or pause) inactive tabs, so no progress was made until
 * the tab regained focus. The whole point of "background" was lost.
 *
 * New architecture (2026-05-09):
 *   1. Client POSTs /api/admin/bulk-job → server creates a job row
 *      in Redis, schedules first tick via QStash, returns jobId.
 *   2. QStash POSTs /api/admin/bulk-job/tick repeatedly. Each tick
 *      processes one chunk + schedules the next tick (if work
 *      remains). All processing happens server-side.
 *   3. Client polls /api/admin/bulk-job/[id] every ~2s for status.
 *
 * State storage: single Redis key per job, JSON-encoded. 24h TTL —
 * jobs are ephemeral, no long-term persistence needed.
 *
 * Concurrency: only ONE active job at a time across the whole
 * system (mirrors the old client-side guard). The "current" pointer
 * lives at a fixed key so the start endpoint can refuse new jobs
 * while one is running.
 */

import { cacheGet, cacheSet, cacheDel } from './cache'

export type BulkJobType = 'seed' | 'enrich'
export type BulkJobStatus = 'pending' | 'running' | 'done' | 'cancelled' | 'failed'

export type SeedJobConfig = {
  queries: string[]
  enrich: boolean
  concurrency: number
  maxResults: number
  region: string
}

export type EnrichJobConfig = {
  mode: 'no-email' | 'stale' | 'bounced' | 'all'
  batchSize: number
  concurrency: number
  /** Optional user-supplied cap on how many channels to enrich in
   *  this run. NULL/undefined = enrich everything matching the mode.
   *  Set by the "Limit" dropdown on the enrich page so the operator
   *  can do 100/200/500 at a time instead of all 3000+. The tick
   *  handler treats this as the effective total when set. */
  limit?: number | null
}

export type BulkJob = {
  id: string
  type: BulkJobType
  /** Human-friendly label shown in the bar. */
  label: string
  /** Snapshot of the user-provided config. */
  config: SeedJobConfig | EnrichJobConfig
  /** Total work units (queries for seed, channels for enrich). */
  total: number
  /** Completed work units. */
  done: number
  /** Errors collected so far (cap 20). */
  errors: string[]
  /** Lifecycle status. */
  status: BulkJobStatus
  /** ISO timestamp when the job was created. */
  startedAt: string
  /** ISO timestamp of the most recent tick (heartbeat). */
  lastTickAt: string
  /** ISO timestamp when the job hit a terminal state. */
  endedAt: string | null
  /** Set true by /cancel; the next tick checks this and stops. */
  cancelRequested: boolean
  /** For seed: chunk index pointer. For enrich: row offset pointer. */
  cursor: number
}

/** Redis key for a specific job. */
function jobKey(id: string): string {
  return `bulk-job:v1:${id}`
}

/** Redis key for the "currently running" pointer. */
const CURRENT_JOB_KEY = 'bulk-job:v1:current'

/** TTL — jobs disappear from Redis 24h after their last write. */
const JOB_TTL_SECONDS = 24 * 60 * 60

/**
 * If a "running" job hasn't been ticked in this many ms, it's
 * considered abandoned and createBulkJob will auto-finalize it as
 * failed before creating a new one. Catches the case where a tick
 * silently dies (network blip, function timeout that didn't update
 * Redis, env-var misconfig) and leaves the slot occupied forever.
 *
 * Set higher than the longest realistic tick duration (60s for the
 * inner self-call + buffer) but low enough that the user doesn't
 * have to wait long after a stuck job. 5 minutes is comfortable.
 */
const STALE_JOB_THRESHOLD_MS = 5 * 60 * 1000

/**
 * Create a new bulk job. Returns either:
 *   { job, conflict: null } — slot was free, job is created and pending
 *   { job: null, conflict } — slot is held by a still-active job
 *
 * Auto-clears stale running jobs (lastTickAt > 5min ago).
 */
export async function createBulkJob(input: {
  type: BulkJobType
  label: string
  config: SeedJobConfig | EnrichJobConfig
  total: number
}): Promise<{ job: BulkJob | null; conflict: BulkJob | null }> {
  const currentId = await cacheGet<string>(CURRENT_JOB_KEY)
  if (currentId) {
    const existing = await readBulkJob(currentId)
    if (existing && existing.status === 'running') {
      const lastTickMs = new Date(existing.lastTickAt).getTime()
      const sinceLastTick = Date.now() - lastTickMs
      if (sinceLastTick < STALE_JOB_THRESHOLD_MS) {
        // Slot is genuinely held — refuse with a conflict descriptor.
        return { job: null, conflict: existing }
      }
      // Stale running job — finalize as failed and proceed. Add a
      // breadcrumb to its errors so the operator can see why it died.
      console.warn(
        `[bulk-job-store] auto-clearing stale running job ${existing.id} (sinceLastTick=${Math.round(sinceLastTick / 1000)}s)`,
      )
      await finalizeBulkJob(existing.id, 'failed', {
        errors: [
          ...existing.errors,
          `auto-cleared: no tick activity for ${Math.round(sinceLastTick / 60000)}min`,
        ].slice(-20),
      })
    }
    // Else: existing job is done/cancelled/failed — slot is effectively
    // free. Fall through to create the new one.
  }
  const id = `${input.type}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`
  const now = new Date().toISOString()
  const job: BulkJob = {
    id,
    type: input.type,
    label: input.label,
    config: input.config,
    total: Math.max(1, input.total),
    done: 0,
    errors: [],
    status: 'pending',
    startedAt: now,
    lastTickAt: now,
    endedAt: null,
    cancelRequested: false,
    cursor: 0,
  }
  await cacheSet(jobKey(id), job, JOB_TTL_SECONDS)
  await cacheSet(CURRENT_JOB_KEY, id, JOB_TTL_SECONDS)
  return { job, conflict: null }
}

/** Read a job by id. Returns null when missing or expired. */
export async function readBulkJob(id: string): Promise<BulkJob | null> {
  if (!id) return null
  return await cacheGet<BulkJob>(jobKey(id))
}

/** Read the current/most-recent job (whatever the pointer says). */
export async function readCurrentBulkJob(): Promise<BulkJob | null> {
  const id = await cacheGet<string>(CURRENT_JOB_KEY)
  if (!id) return null
  return await readBulkJob(id)
}

/**
 * Apply a partial update to a job. Re-fetches the latest state to
 * minimize lost-update windows (Redis isn't transactional here, but
 * a single tick-at-a-time chain means we don't actually have
 * concurrent writers). Returns the updated job, or null if missing.
 */
export async function updateBulkJob(
  id: string,
  patch: Partial<Omit<BulkJob, 'id' | 'type' | 'config' | 'startedAt'>>,
): Promise<BulkJob | null> {
  const existing = await readBulkJob(id)
  if (!existing) return null
  const next: BulkJob = {
    ...existing,
    ...patch,
    lastTickAt: new Date().toISOString(),
    // Cap errors at 20 to keep the JSON payload small.
    errors: (patch.errors ?? existing.errors).slice(-20),
  }
  await cacheSet(jobKey(id), next, JOB_TTL_SECONDS)
  return next
}

/** Mark a job as cancelled by setting the flag. The tick handler
 *  checks this and transitions to terminal status itself. */
export async function requestBulkJobCancel(id: string): Promise<BulkJob | null> {
  return updateBulkJob(id, { cancelRequested: true })
}

/** Move a job into a terminal state and clear the current pointer. */
export async function finalizeBulkJob(
  id: string,
  status: 'done' | 'cancelled' | 'failed',
  patch: Partial<Pick<BulkJob, 'errors' | 'done' | 'total'>> = {},
): Promise<BulkJob | null> {
  const next = await updateBulkJob(id, {
    ...patch,
    status,
    endedAt: new Date().toISOString(),
  })
  // Clear the "current" pointer if this job was the active one. Allows
  // a new job to start as soon as this one terminates.
  const currentId = await cacheGet<string>(CURRENT_JOB_KEY)
  if (currentId === id) {
    await cacheDel(CURRENT_JOB_KEY)
  }
  return next
}
