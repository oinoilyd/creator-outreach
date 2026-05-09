'use client'

/**
 * BulkJobProvider — admin-only background job runner.
 *
 * Mounted in the ROOT layout so the active job survives navigation
 * between /admin, /, /landing, /auth/signup, etc — anywhere the
 * admin goes within the same browser tab the loop keeps running.
 *
 * ARCHITECTURE NOTE (rewritten 2026-05-09):
 *
 * The first version of this file held the active job in a React
 * useState inside the provider. That broke navigation persistence:
 * Next.js re-renders the async root layout on every navigation
 * (because auth runs server-side per request), and React's
 * reconciliation occasionally tore down the provider's component
 * instance — taking the useState with it. The async loops in the
 * JS event loop kept running, but their setJob closures pointed at
 * a destroyed state setter and the bar disappeared.
 *
 * Fix: the canonical job state now lives at MODULE scope, outside
 * React's component lifecycle entirely. The provider is a thin
 * useSyncExternalStore subscriber that re-renders whenever the
 * module store emits. The async job loops also call into module
 * functions, never into captured React closures. Even if the
 * provider unmounts and remounts mid-job, the bar reappears with
 * up-to-date state because it just resubscribes to the same store.
 *
 * Caveats:
 *   - Tab close still kills the loop. Surviving a tab close needs
 *     a backend job queue (QStash + Redis state) — not in scope.
 *   - Page reload (F5) clears module state. We deliberately don't
 *     hydrate from sessionStorage: showing "running" on a reloaded
 *     page would lie about the loop, which is dead.
 *   - Non-admin instances render children pass-through.
 */

import { createContext, useContext, useSyncExternalStore } from 'react'
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
  /** human-friendly label for the bar, e.g. "Bulk seed · Finance · 30 queries" */
  label: string
  /** total work units (queries for seed, channels for enrich) */
  total: number
  /** completed units */
  done: number
  /** errors collected so far */
  errors: string[]
  /** terminal status; 'running' until done/cancelled/failed */
  status: 'running' | 'done' | 'cancelled' | 'failed'
  /** ms elapsed since start */
  elapsedMs: number
  /** for cancellation — set true from the bar to break the loop */
  cancelRequested: boolean
}

type BulkJobContextValue = {
  activeJob: ActiveJob | null
  startSeedJob: (config: SeedConfig, label: string) => string | null
  startEnrichJob: (config: EnrichConfig, label: string) => string | null
  cancelActiveJob: () => void
  /** clear a 'done' or 'cancelled' job from the bar */
  dismissJob: () => void
}

// ─── Module-scoped store ────────────────────────────────────────────
//
// Lives in the JS bundle, NOT in React state. Survives every kind of
// component reconciliation (provider unmount, layout re-render,
// route change). The ONLY thing that resets this is a full page
// reload, at which point the in-tab loop is dead anyway.

let activeJob: ActiveJob | null = null
const listeners = new Set<() => void>()

function emit() {
  for (const l of listeners) l()
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

function getSnapshot(): ActiveJob | null {
  return activeJob
}

// SSR snapshot — bar never renders on the server, but useSyncExternalStore
// still requires this. Returning a stable null avoids hydration churn.
function getServerSnapshot(): ActiveJob | null {
  return null
}

function setJob(updater: ActiveJob | null | ((j: ActiveJob | null) => ActiveJob | null)): void {
  const next =
    typeof updater === 'function'
      ? (updater as (j: ActiveJob | null) => ActiveJob | null)(activeJob)
      : updater
  if (next === activeJob) return // referential no-op short-circuit
  activeJob = next
  emit()
}

// ─── Elapsed ticker ────────────────────────────────────────────────
//
// One module-level interval. Started by claimSlot when a job begins,
// stopped when status flips off 'running' or job is dismissed.

let elapsedTimer: ReturnType<typeof setInterval> | null = null

function startElapsedTicker(): void {
  if (elapsedTimer != null) return
  if (typeof window === 'undefined') return // safety: don't tick on the server
  elapsedTimer = setInterval(() => {
    setJob(j => (j && j.status === 'running' ? { ...j, elapsedMs: Date.now() - j.startedAt } : j))
  }, 1000)
}

function stopElapsedTicker(): void {
  if (elapsedTimer != null) {
    clearInterval(elapsedTimer)
    elapsedTimer = null
  }
}

// ─── Slot / progress / lifecycle ───────────────────────────────────

function claimSlot(label: string, type: JobType, total: number): string | null {
  if (activeJob && activeJob.status === 'running') {
    return null // refuse — only one bulk job at a time
  }
  const id = `${type}-${Date.now().toString(36)}`
  setJob({
    id,
    type,
    label,
    total,
    done: 0,
    errors: [],
    status: 'running',
    startedAt: Date.now(),
    elapsedMs: 0,
    cancelRequested: false,
  })
  startElapsedTicker()
  return id
}

function bumpProgress(id: string, patch: Partial<ActiveJob>): void {
  setJob(j => {
    if (!j || j.id !== id) return j
    const next = { ...j, ...patch }
    return next
  })
  // If the patch flipped status off 'running', stop ticking.
  if (activeJob && activeJob.status !== 'running') {
    stopElapsedTicker()
  }
}

function cancelActiveJobImpl(): void {
  setJob(j => (j && j.status === 'running' ? { ...j, cancelRequested: true } : j))
}

function dismissJobImpl(): void {
  setJob(null)
  stopElapsedTicker()
}

// ─── Bulk-seed runner ──────────────────────────────────────────────

const CHUNK_SEARCH_ONLY = 6
const CHUNK_WITH_ENRICH = 3

function startSeedJobImpl(config: SeedConfig, label: string): string | null {
  const id = claimSlot(label, 'seed', config.queries.length)
  if (!id) return null

  // Loop runs detached from the React tree. References module
  // functions only — no captured React closures, so it survives
  // any provider remount.
  void (async () => {
    const chunkSize = config.enrich ? CHUNK_WITH_ENRICH : CHUNK_SEARCH_ONLY
    const chunks: string[][] = []
    for (let i = 0; i < config.queries.length; i += chunkSize) {
      chunks.push(config.queries.slice(i, i + chunkSize))
    }
    const errors: string[] = []
    let done = 0
    let consecutiveFailures = 0

    for (const chunk of chunks) {
      // Cancel check reads from module state — always fresh.
      if (activeJob?.cancelRequested) {
        bumpProgress(id, { status: 'cancelled' })
        return
      }
      const ctrl = new AbortController()
      const tid = setTimeout(() => ctrl.abort(), 65_000)
      try {
        const res = await fetch('/api/admin/bulk-seed', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            queries: chunk,
            enrich: config.enrich,
            concurrency: config.concurrency,
            maxResults: config.maxResults,
            region: config.region,
          }),
          signal: ctrl.signal,
        })
        clearTimeout(tid)
        if (!res.ok) {
          errors.push(`HTTP ${res.status} on ${chunk.length} queries`)
          consecutiveFailures++
        } else {
          const j = await res.json()
          if (j?.errors?.length) errors.push(...j.errors.slice(0, 3))
          consecutiveFailures = 0
        }
      } catch (e: unknown) {
        clearTimeout(tid)
        const err = e as { name?: string; message?: string }
        errors.push(`${err?.name === 'AbortError' ? 'timeout' : err?.message || String(e)}`)
        consecutiveFailures++
      }
      done += chunk.length
      bumpProgress(id, { done, errors: errors.slice(-20) })
      if (consecutiveFailures >= 3) {
        errors.push('aborting: 3 consecutive failures')
        bumpProgress(id, { status: 'failed', errors: errors.slice(-20) })
        return
      }
    }
    bumpProgress(id, { status: 'done', done: config.queries.length })
  })()

  return id
}

// ─── Bulk-enrich runner ────────────────────────────────────────────

function startEnrichJobImpl(config: EnrichConfig, label: string): string | null {
  // We don't know the total upfront — the first /api/admin/bulk-enrich
  // call comes back with totalMatching. Claim with a placeholder of 1
  // and update once we know.
  const id = claimSlot(label, 'enrich', 1)
  if (!id) return null

  void (async () => {
    const errors: string[] = []
    let processed = 0
    let total = 1
    let offset = 0
    let consecutiveFailures = 0

    async function callOnce(): Promise<
      | {
          totalMatching?: number
          processedThisCall?: number
          channelIdsRemaining?: string[]
        }
      | null
    > {
      for (let attempt = 1; attempt <= 2; attempt++) {
        const ctrl = new AbortController()
        const tid = setTimeout(() => ctrl.abort(), 65_000)
        try {
          const res = await fetch('/api/admin/bulk-enrich', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
              mode: config.mode,
              limit: config.batchSize,
              offset,
              concurrency: config.concurrency,
            }),
            signal: ctrl.signal,
          })
          clearTimeout(tid)
          const text = await res.text()
          let j:
            | {
                error?: string
                totalMatching?: number
                processedThisCall?: number
                channelIdsRemaining?: string[]
                errors?: string[]
              }
            | null = null
          try {
            j = JSON.parse(text)
          } catch {
            if (attempt === 2) {
              errors.push(`call: non-JSON (${text.slice(0, 60)})`)
              return null
            }
            await new Promise(r => setTimeout(r, 1000))
            continue
          }
          if (!res.ok || j?.error) {
            errors.push(`call: ${j?.error || `HTTP ${res.status}`}${attempt === 1 ? ' (retry)' : ''}`)
            if (attempt === 2) return null
            await new Promise(r => setTimeout(r, 1000))
            continue
          }
          return j ?? {}
        } catch (e: unknown) {
          clearTimeout(tid)
          const err = e as { name?: string; message?: string }
          const msg = err?.name === 'AbortError' ? 'timeout' : err?.message || String(e)
          errors.push(`call: ${msg}${attempt === 1 ? ' (retry)' : ''}`)
          if (attempt === 2) return null
          await new Promise(r => setTimeout(r, 1500))
        }
      }
      return null
    }

    while (offset < total) {
      if (activeJob?.cancelRequested) {
        bumpProgress(id, { status: 'cancelled' })
        return
      }
      const j = await callOnce()
      if (!j) {
        consecutiveFailures++
        if (consecutiveFailures >= 3) {
          bumpProgress(id, {
            status: 'failed',
            errors: [...errors, 'aborting: 3 consecutive failures'].slice(-20),
          })
          return
        }
        offset += config.batchSize
        continue
      }
      consecutiveFailures = 0
      processed += j.processedThisCall ?? 0
      if (typeof j.totalMatching === 'number') total = j.totalMatching
      offset += config.batchSize
      bumpProgress(id, { total, done: processed, errors: errors.slice(-20) })
      if ((j.processedThisCall ?? 0) === 0 && (j.channelIdsRemaining?.length ?? 0) === 0) break
    }
    bumpProgress(id, { status: 'done', total, done: processed })
  })()

  return id
}

// ─── React layer ───────────────────────────────────────────────────

const BulkJobContext = createContext<BulkJobContextValue>({
  activeJob: null,
  startSeedJob: () => null,
  startEnrichJob: () => null,
  cancelActiveJob: () => {},
  dismissJob: () => {},
})

export function useBulkJob() {
  return useContext(BulkJobContext)
}

export function BulkJobProvider({ children }: { children: ReactNode }) {
  // useSyncExternalStore re-renders this provider whenever the
  // module store emits. The provider is now a pure subscriber —
  // even if it unmounts and remounts on navigation, it picks up
  // the current job from the module store immediately.
  //
  // No isAdmin gate (rewritten 2026-05-09). The previous gate caused
  // the bar to disappear when server-side auth flickered across
  // navigations. Admin enforcement happens in the API routes
  // (/api/admin/bulk-seed, /api/admin/bulk-enrich) — non-admins
  // can't trigger a job because both endpoints return 403.
  const job = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)

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
