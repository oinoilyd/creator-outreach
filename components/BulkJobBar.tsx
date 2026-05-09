'use client'

/**
 * BulkJobBar — floating progress card for active bulk jobs.
 *
 * Renders only when BulkJobProvider has an active job. Sits at
 * bottom-LEFT (Sonner's Toaster owns bottom-right), persists across
 * navigation because it's a sibling of <BulkJobProvider> in the
 * root layout.
 *
 * Two visual states:
 *   - Expanded (default): full card ~320px × ~140px with label,
 *     progress bar, counts, errors, actions.
 *   - Collapsed: tiny pill ~140px × ~36px showing dot + count + arrow
 *     up to re-expand. Per Dylan's request — "let me close it when
 *     it's in the way."
 *
 * Internal links use Next.js <Link> so clicking inside the bar
 * doesn't trigger a hard reload. (The bar's content survives that
 * anyway because state lives in BulkJobProvider's module store +
 * server-side, but soft nav is faster + cheaper.)
 */

import { useState } from 'react'
import Link from 'next/link'
import { useBulkJob } from './BulkJobProvider'

function fmtElapsed(ms: number): string {
  const s = Math.floor(ms / 1000)
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  const rem = s % 60
  return `${m}m ${rem.toString().padStart(2, '0')}s`
}

function fmtEta(elapsedMs: number, done: number, total: number): string | null {
  if (done <= 0 || total <= done) return null
  const perUnit = elapsedMs / done
  const remaining = (total - done) * perUnit
  return fmtElapsed(remaining)
}

export function BulkJobBar() {
  const { activeJob, cancelActiveJob, dismissJob } = useBulkJob()
  // Collapsed UI state. Stored in component-local state — no need to
  // persist this across navigation; the user re-collapses if they
  // want it small after coming back. Fresh sessions start expanded.
  const [collapsed, setCollapsed] = useState(false)

  if (!activeJob) return null

  const pct = activeJob.total === 0 ? 0 : Math.min(100, (activeJob.done / activeJob.total) * 100)
  const eta =
    activeJob.status === 'running' ? fmtEta(activeJob.elapsedMs, activeJob.done, activeJob.total) : null

  // Status-driven accent color.
  const accent =
    activeJob.status === 'running'
      ? 'bg-orange-500'
      : activeJob.status === 'done'
      ? 'bg-emerald-500'
      : activeJob.status === 'cancelled'
      ? 'bg-gray-500'
      : 'bg-red-500'

  const statusLabel =
    activeJob.status === 'running'
      ? 'Running'
      : activeJob.status === 'done'
      ? 'Done'
      : activeJob.status === 'cancelled'
      ? 'Cancelled'
      : 'Failed'

  // ─── COLLAPSED: small pill, showing only the dot + counts +
  //     status, with a chevron to expand back.
  if (collapsed) {
    return (
      <button
        type="button"
        onClick={() => setCollapsed(false)}
        title="Expand bulk job progress"
        aria-label="Expand bulk job progress"
        className="fixed bottom-4 left-4 z-[60] flex items-center gap-2 rounded-full border border-border bg-card/95 backdrop-blur-md shadow-2xl shadow-black/40 text-foreground select-none px-3 py-1.5 hover:border-border transition-colors"
      >
        <span
          className={`w-2 h-2 rounded-full shrink-0 ${accent} ${
            activeJob.status === 'running' ? 'animate-pulse' : ''
          }`}
          aria-hidden
        />
        <span className="text-[11px] font-mono tabular-nums text-foreground/90">
          {activeJob.done.toLocaleString()} / {activeJob.total.toLocaleString()}
        </span>
        <ChevronUp />
      </button>
    )
  }

  // ─── EXPANDED: the full card
  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-4 left-4 z-[60] w-[320px] rounded-xl border border-border bg-card/95 backdrop-blur-md shadow-2xl shadow-black/40 text-foreground select-none"
    >
      {/* HEADER */}
      <div className="flex items-center justify-between gap-2 px-3.5 pt-3 pb-2">
        <div className="flex items-center gap-2 min-w-0">
          <span
            className={`w-2 h-2 rounded-full shrink-0 ${accent} ${
              activeJob.status === 'running' ? 'animate-pulse' : ''
            }`}
            aria-hidden
          />
          <span className="text-[10px] uppercase tracking-[0.18em] font-bold text-muted-foreground">
            {activeJob.type === 'seed' ? 'Bulk seed' : 'Bulk enrich'} · {statusLabel}
          </span>
        </div>
        <div className="flex items-center gap-1 -mr-1 -mt-1">
          {/* Collapse/minimize button — always available so the user
              can stash the bar without cancelling or dismissing the
              job. */}
          <button
            type="button"
            onClick={() => setCollapsed(true)}
            aria-label="Minimize"
            title="Minimize"
            className="text-muted-foreground/80 hover:text-foreground transition-colors px-1.5 leading-none"
          >
            <ChevronDown />
          </button>
          {/* Dismiss × — only for terminal jobs. While running, the
              user must Cancel first (or just minimize). */}
          {activeJob.status !== 'running' && (
            <button
              type="button"
              onClick={dismissJob}
              aria-label="Dismiss"
              title="Dismiss"
              className="text-muted-foreground/80 hover:text-foreground transition-colors px-1 leading-none text-lg"
            >
              ×
            </button>
          )}
        </div>
      </div>

      {/* LABEL */}
      <div className="px-3.5 pb-2 text-[12px] text-foreground leading-snug truncate" title={activeJob.label}>
        {activeJob.label}
      </div>

      {/* PROGRESS BAR */}
      <div className="px-3.5 pb-2">
        <div className="h-1.5 rounded-full bg-muted overflow-hidden">
          <div
            className={`h-full ${accent} transition-all duration-500`}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {/* COUNTS + ELAPSED */}
      <div className="px-3.5 pb-3 flex items-center justify-between gap-2 text-[11px] font-mono tabular-nums text-muted-foreground">
        <span>
          {activeJob.done.toLocaleString()} / {activeJob.total.toLocaleString()}
        </span>
        <span className="text-muted-foreground/80">
          {fmtElapsed(activeJob.elapsedMs)}
          {eta && <span className="text-muted-foreground/60"> · ~{eta} left</span>}
        </span>
      </div>

      {/* ERROR BADGE */}
      {activeJob.errors.length > 0 && (
        <div className="px-3.5 pb-2.5">
          <details className="group">
            <summary className="text-[10px] uppercase tracking-[0.16em] font-bold text-yellow-300/80 cursor-pointer hover:text-yellow-200">
              {activeJob.errors.length} {activeJob.errors.length === 1 ? 'error' : 'errors'} · click to expand
            </summary>
            <ul className="mt-2 text-[10px] text-yellow-200/70 font-mono space-y-0.5 max-h-32 overflow-y-auto">
              {activeJob.errors.slice(-10).map((e, i) => (
                <li key={i} className="truncate" title={e}>
                  {e}
                </li>
              ))}
            </ul>
          </details>
        </div>
      )}

      {/* ACTIONS */}
      {activeJob.status === 'running' ? (
        <div className="border-t border-border px-3.5 py-2 flex items-center justify-between">
          <Link
            href={activeJob.type === 'seed' ? '/admin/contacts/seed' : '/admin/contacts/enrich'}
            className="text-[11px] text-orange-400 hover:text-orange-300 hover:underline"
          >
            View page →
          </Link>
          <button
            type="button"
            onClick={cancelActiveJob}
            className="text-[11px] font-semibold text-muted-foreground hover:text-red-300 transition-colors"
          >
            Cancel
          </button>
        </div>
      ) : (
        <div className="border-t border-border px-3.5 py-2 flex items-center justify-between">
          <Link
            href="/admin/contacts"
            className="text-[11px] text-orange-400 hover:text-orange-300 hover:underline"
          >
            View contacts →
          </Link>
          <span className="text-[11px] text-muted-foreground/80">
            {activeJob.done.toLocaleString()} processed
          </span>
        </div>
      )}
    </div>
  )
}

// ─── Tiny inline icons (avoid pulling in a whole icon lib) ─────────

function ChevronDown() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <polyline points="6 9 12 15 18 9" />
    </svg>
  )
}

function ChevronUp() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden className="text-muted-foreground/80">
      <polyline points="18 15 12 9 6 15" />
    </svg>
  )
}
