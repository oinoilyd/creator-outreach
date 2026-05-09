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

const POLL_INTERVAL_MS = 2000

let pollTimer: ReturnType<typeof setInterval> | null = null
let elapsedTimer: ReturnType<typeof setInterval> | null = null

function startPolling(jobId: string) {
  if (pollTimer != null) return
  if (typeof window === 'undefined') return
  pollTimer = setInterval(() => {
    void pollOnce(jobId)
  }, POLL_INTERVAL_MS)
  // Also start a 1s elapsed-time ticker so the bar's clock advances
  // smoothly between server polls.
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

async function pollOnce(jobId: string): Promise<void> {
  try {
    const res = await fetch(`/api/admin/bulk-job/${jobId}`, { cache: 'no-store' })
    if (!res.ok) {
      // 404 = job vanished from Redis (TTL or fresh deploy with no
      // state). Stop polling but keep showing the last-known state
      // so the user can dismiss it.
      if (res.status === 404) {
        setJob(j => (j ? { ...j, status: 'failed', errors: [...j.errors, 'job not found on server'].slice(-20) } : j))
        stopPolling()
      }
      return
    }
    const j = (await res.json()) as { job?: ServerJob }
    if (!j.job) return
    const next = toActiveJob(j.job)
    setJob(next)
    if (next.status !== 'running') {
      stopPolling()
    }
  } catch {
    // Network blip — try again on next interval. Don't kill polling.
  }
}

// ─── Context API ───────────────────────────────────────────────────

async function startSeedJobImpl(config: SeedConfig, label: string): Promise<string | null> {
  if (activeJob && activeJob.status === 'running') return null
  try {
    const res = await fetch('/api/admin/bulk-job', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ type: 'seed', config, label }),
    })
    if (!res.ok) {
      const j = await res.json().catch(() => ({}))
      console.warn('[bulk-job] start failed:', j)
      // Surface the failure briefly via a synthetic 'failed' job so
      // the user gets feedback (e.g. qstash-not-configured).
      setJob({
        id: `local-${Date.now().toString(36)}`,
        type: 'seed',
        label,
        total: config.queries.length,
        done: 0,
        errors: [
          j?.hint || j?.error || `start failed (${res.status})`,
        ],
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
    if (j.job.id) startPolling(j.job.id)
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
    if (j.job.id) startPolling(j.job.id)
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
