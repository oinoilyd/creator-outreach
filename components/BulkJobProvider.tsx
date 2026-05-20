'use client'

/**
 * BulkJobProvider — TRUE background bulk-job runner.
 *
 * ARCHITECTURE (rewritten 2026-05-09 for real background processing):
 *
 * The previous version ran the loop client-side (a JS while-loop in
 * the browser tab). That worked for the bar UI persistence, but the
 * actual processing died whenever the browser throttled the tab —
 * which Chrome and Safari do AGGRESSIVELY for inactive tabs. Users
 * saw the bar but no progress while looking at another tab.
 *
 * New architecture: server-side processing via QStash chains.
 *   1. Click Run → POST /api/admin/bulk-job (server creates job in
 *      Redis, fires first QStash tick).
 *   2. QStash invokes /api/admin/bulk-job/tick repeatedly. Each tick
 *      processes one chunk + schedules the next.
 *   3. The browser just POLLS /api/admin/bulk-job/[id] every 2s for
 *      progress updates and feeds the bar.
 *
 * Net effect:
 *   - Loop continues whether the user is on the page, on a different
 *     tab, on a different app, or has closed the browser entirely.
 *   - Bar still persists across navigation (module-scoped store).
 *   - Polling stops when the job hits a terminal status.
 *   - On page reload, the bar re-hydrates from server state via a
 *     GET to /api/admin/bulk-job on mount.
 *
 * Caveats:
 *   - Requires QStash env vars (QSTASH_TOKEN + QSTASH_CURRENT_SIGNING_KEY).
 *     Without them, start endpoint returns 503 with a clear error.
 *   - Page reload mid-job is fine; the bar reappears within ~2s as
 *     the hydration GET completes.
 */

import { createContext, useContext, useEffect, useSyncExternalStore } from 'react'
import type { ReactNode } from 'react'

export type JobType = 'seed' | 'enrich'

export type SeedConfig = {
  queries: string[]
  enrich: boolean
  concurrency: number
  maxResults: number
  region: string
}

export type EnrichConfig = {
  mode: 'no-email' | 'stale' | 'bounced' | 'all'
  batchSize: number
  concurrency: number
  /** Optional user cap — enrich at most this many channels. */
  limit?: number | null
}

export type ActiveJob = {
  id: string
  type: JobType
  startedAt: number
  label: string
  total: number
  done: number
  errors: string[]
  status: 'running' | 'done' | 'cancelled' | 'failed'
  elapsedMs: number
  cancelRequested: boolean
}

type BulkJobContextValue = {
  activeJob: ActiveJob | null
  startSeedJob: (config: SeedConfig, label: string) => Promise<string | null>
  startEnrichJob: (config: EnrichConfig, label: string) => Promise<string | null>
  cancelActiveJob: () => Promise<void>
  dismissJob: () => void
}

// ─── Module store ──────────────────────────────────────────────────

let activeJob: ActiveJob | null = null
const listeners = new Set<() => void>()

function emit() {
  for (const l of listeners) l()
}
function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}
function getSnapshot(): ActiveJob | null {
  return activeJob
}
function getServerSnapshot(): ActiveJob | null {
  return null
}
function setJob(updater: ActiveJob | null | ((j: ActiveJob | null) => ActiveJob | null)) {
  const next =
    typeof updater === 'function'
      ? (updater as (j: ActiveJob | null) => ActiveJob | null)(activeJob)
      : updater
  if (next === activeJob) return
  activeJob = next
  emit()
}

// ─── Server job → client ActiveJob conversion ──────────────────────

type ServerJob = {
  id: string
  type: JobType
  label: string
  status: 'pending' | 'running' | 'done' | 'cancelled' | 'failed'
  total: number
  done: number
  errors: string[]
  startedAt: string // ISO
  /** ISO timestamp of the most recent tick. Used by the browser-side
   *  poller to decide whether to fire a tick. */
  lastTickAt: string
  cancelRequested: boolean
}

function toActiveJob(server: ServerJob): ActiveJob {
  const startedAt = new Date(server.startedAt).getTime()
  // Map 'pending' → 'running' for UI purposes (the bar shows the
  // pending state as "starting…" via its zero-progress state).
  const status: ActiveJob['status'] =
    server.status === 'pending' ? 'running' : server.status
  return {
    id: server.id,
    type: server.type,
    label: server.label,
    status,
    total: server.total,
    done: server.done,
    errors: server.errors,
    startedAt,
    elapsedMs: Date.now() - startedAt,
    cancelRequested: server.cancelRequested,
  }
}

// ─── Polling ───────────────────────────────────────────────────────

// Poll cadence (tightened 2026-05-09 from 2s → 1s):
// The bar refreshes from server state every POLL_INTERVAL_MS, and
// fires a new tick when state hasn't been ticked in >TICK_STALE_MS.
// Smaller numbers = faster perceived progress at the cost of more
// HTTP traffic. 1s + 800ms keeps Redis QPS modest while making the
// bar feel responsive — chunk completion shows up almost immediately.
const POLL_INTERVAL_MS = 1000

let pollTimer: ReturnType<typeof setInterval> | null = null
let elapsedTimer: ReturnType<typeof setInterval> | null = null

function startPolling(jobId: string) {
  if (pollTimer != null) return
  if (typeof window === 'undefined') return
  // Fire the first poll IMMEDIATELY (instead of waiting POLL_INTERVAL_MS).
  // pollOnce also kicks off the first tick if needed, so this gets the
  // job moving right away.
  void pollOnce(jobId)
  pollTimer = setInterval(() => {
    void pollOnce(jobId)
  }, POLL_INTERVAL_MS)
  // 1s elapsed-time ticker so the bar's clock advances smoothly
  // between server polls.
  if (elapsedTimer == null) {
    elapsedTimer = setInterval(() => {
      setJob(j => (j && j.status === 'running' ? { ...j, elapsedMs: Date.now() - j.startedAt } : j))
    }, 1000)
  }
}

function stopPolling() {
  if (pollTimer != null) {
    clearInterval(pollTimer)
    pollTimer = null
  }
  if (elapsedTimer != null) {
    clearInterval(elapsedTimer)
    elapsedTimer = null
  }
}

/**
 * How stale lastTickAt has to be before we kick off a new tick.
 * 800ms means as soon as a previous tick has finished and ~0.8s have
 * passed (the natural poll cadence), we kick off the next one. This
 * eliminates the 2s "dead air" gap between ticks that used to make
 * long jobs feel laggy. The server-side race guard (TICK_DEDUP_MS,
 * now 600ms) prevents double-processing if a poll-driven tick races
 * with a QStash-driven one.
 */
const TICK_STALE_MS = 800

async function pollOnce(jobId: string): Promise<void> {
  try {
    const res = await fetch(`/api/admin/bulk-job/${jobId}`, { cache: 'no-store' })
    if (!res.ok) {
      if (res.status === 404) {
        setJob(j => (j ? { ...j, status: 'failed', errors: [...j.errors, 'job not found on server'].slice(-20) } : j))
        stopPolling()
      }
      return
    }
    const j = (await res.json()) as { job?: ServerJob & { lastTickAt?: string } }
    if (!j.job) return
    const next = toActiveJob(j.job)
    setJob(next)
    if (next.status !== 'running') {
      stopPolling()
      return
    }
    // Browser-driven tick fire — if the server hasn't been ticked
    // recently, kick off a tick. Fire-and-forget: the browser doesn't
    // wait for the response, so a 30s tick doesn't block the next
    // poll. Vercel processes the tick to completion regardless.
    //
    // Auth: the cookie travels automatically on same-origin fetches,
    // so the tick endpoint authenticates as the admin. No env vars
    // needed for this path to work.
    if (j.job.lastTickAt) {
      const lastTickMs = new Date(j.job.lastTickAt).getTime()
      if (Date.now() - lastTickMs > TICK_STALE_MS) {
        // Fire the tick, await its response, and use the returned
        // job state to update the store IMMEDIATELY (rather than
        // waiting for the next poll). Cuts up to 1s of perceived
        // lag per chunk transition.
        ;(async () => {
          try {
            const tickRes = await fetch('/api/admin/bulk-job/tick', {
              method: 'POST',
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify({ jobId }),
            })
            if (!tickRes.ok) return
            const tj = (await tickRes.json()) as { job?: ServerJob & { lastTickAt?: string } }
            if (tj.job) {
              const updated = toActiveJob(tj.job)
              setJob(updated)
              if (updated.status !== 'running') stopPolling()
            }
          } catch {
            // Tick failures surface via the next poll's job.errors.
          }
        })()
      }
    }
  } catch {
    // Network blip — try again on next interval. Don't kill polling.
  }
}

// ─── Context API ───────────────────────────────────────────────────

/** Fire the first tick after job creation so work starts immediately
 *  (without waiting for the first poll cycle to detect staleness). */
function fireFirstTick(jobId: string) {
  void fetch('/api/admin/bulk-job/tick', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jobId }),
  }).catch(() => {
    // Failures here surface via the polling loop's job.errors view.
  })
}

async function startSeedJobImpl(config: SeedConfig, label: string): Promise<string | null> {
  if (activeJob && activeJob.status === 'running') return null
  try {
    const res = await fetch('/api/admin/bulk-job', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ type: 'seed', config, label }),
    })
    // On 409 (job-already-running), hydrate the bar with the EXISTING
    // job so the user sees what's running and can cancel it. Don't
    // show a synthetic error — the actual job state is more useful.
    if (res.status === 409) {
      const j = await res.json().catch(() => ({}))
      if (j?.currentJob) {
        const existing = toActiveJob(j.currentJob as ServerJob)
        setJob(existing)
        if (existing.status === 'running') startPolling(existing.id)
      }
      return null
    }
    if (!res.ok) {
      const j = await res.json().catch(() => ({}))
      console.warn('[bulk-job] start failed:', j)
      setJob({
        id: `local-${Date.now().toString(36)}`,
        type: 'seed',
        label,
        total: config.queries.length,
        done: 0,
        errors: [j?.hint || j?.error || `start failed (${res.status})`],
        status: 'failed',
        startedAt: Date.now(),
        elapsedMs: 0,
        cancelRequested: false,
      })
      return null
    }
    const j = (await res.json()) as { jobId?: string; job?: ServerJob }
    if (!j.job) return null
    setJob(toActiveJob(j.job))
    if (j.job.id) {
      startPolling(j.job.id)
      // Kick the first chunk immediately — don't wait for staleness.
      fireFirstTick(j.job.id)
    }
    return j.jobId ?? null
  } catch (e) {
    console.warn('[bulk-job] start threw:', e)
    return null
  }
}

async function startEnrichJobImpl(config: EnrichConfig, label: string): Promise<string | null> {
  if (activeJob && activeJob.status === 'running') return null
  try {
    const res = await fetch('/api/admin/bulk-job', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ type: 'enrich', config, label }),
    })
    // On 409, hydrate the bar with the existing job so the user can
    // see + cancel it (instead of showing a synthetic error).
    if (res.status === 409) {
      const j = await res.json().catch(() => ({}))
      if (j?.currentJob) {
        const existing = toActiveJob(j.currentJob as ServerJob)
        setJob(existing)
        if (existing.status === 'running') startPolling(existing.id)
      }
      return null
    }
    if (!res.ok) {
      const j = await res.json().catch(() => ({}))
      console.warn('[bulk-job] start failed:', j)
      setJob({
        id: `local-${Date.now().toString(36)}`,
        type: 'enrich',
        label,
        total: 1,
        done: 0,
        errors: [j?.hint || j?.error || `start failed (${res.status})`],
        status: 'failed',
        startedAt: Date.now(),
        elapsedMs: 0,
        cancelRequested: false,
      })
      return null
    }
    const j = (await res.json()) as { jobId?: string; job?: ServerJob }
    if (!j.job) return null
    setJob(toActiveJob(j.job))
    if (j.job.id) {
      startPolling(j.job.id)
      // Kick the first chunk immediately.
      fireFirstTick(j.job.id)
    }
    return j.jobId ?? null
  } catch (e) {
    console.warn('[bulk-job] start threw:', e)
    return null
  }
}

async function cancelActiveJobImpl(): Promise<void> {
  const job = activeJob
  if (!job || job.status !== 'running') return
  // Optimistically set the local flag — the next poll will overwrite
  // this with the server-confirmed terminal state.
  setJob(j => (j ? { ...j, cancelRequested: true } : j))
  try {
    await fetch(`/api/admin/bulk-job/${job.id}`, { method: 'DELETE' })
  } catch {
    // Cancellation request failed to land — the next tick on the
    // server might still process. Best-effort.
  }
}

function dismissJobImpl(): void {
  setJob(null)
  stopPolling()
}

// ─── React layer ───────────────────────────────────────────────────

const BulkJobContext = createContext<BulkJobContextValue>({
  activeJob: null,
  startSeedJob: async () => null,
  startEnrichJob: async () => null,
  cancelActiveJob: async () => {},
  dismissJob: () => {},
})

export function useBulkJob() {
  return useContext(BulkJobContext)
}

export function BulkJobProvider({ children }: { children: ReactNode }) {
  const job = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)

  // Hydrate from server on first mount. If a job is running on the
  // backend (e.g. user reloaded the page mid-job, or opened a fresh
  // tab while a job is going), we pick it up and resume polling. The
  // GET endpoint returns null silently for non-admins so it's safe
  // to call universally.
  useEffect(() => {
    let cancelled = false
    if (activeJob) return // already hydrated
    void (async () => {
      try {
        const res = await fetch('/api/admin/bulk-job', { cache: 'no-store' })
        if (!res.ok) return
        const j = (await res.json()) as { job?: ServerJob | null }
        if (cancelled || !j.job) return
        const next = toActiveJob(j.job)
        setJob(next)
        if (next.status === 'running') {
          startPolling(j.job.id)
        }
      } catch {
        // Ignore — non-admin users hit this and it 404s or returns
        // null, neither of which warrants a console error.
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <BulkJobContext.Provider
      value={{
        activeJob: job,
        startSeedJob: startSeedJobImpl,
        startEnrichJob: startEnrichJobImpl,
        cancelActiveJob: cancelActiveJobImpl,
        dismissJob: dismissJobImpl,
      }}
    >
      {children}
    </BulkJobContext.Provider>
  )
}
