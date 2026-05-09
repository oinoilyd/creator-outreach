'use client'

/**
 * BulkJobBar — floating progress card for active bulk jobs.
 *
 * Renders only when BulkJobProvider has an active job. Sits at
 * bottom-LEFT (Sonner's Toaster owns bottom-right), persists across
 * navigation because it's a sibling of <BulkJobProvider> in the
 * root layout.
 *
 * Compact: 320px wide × ~100px tall while running, smaller when
 * terminal. Click-through dismissable when done.
 *
 * Internal links use Next.js <Link> (NOT plain <a>) so clicking
 * "View page →" or "View contacts →" does a soft route change —
 * preserving the JS context that's running the loop. A plain <a>
 * here would trigger a full page reload, killing the IIFE
 * mid-job.
 */

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
  if (!activeJob) return null

  const pct = activeJob.total === 0 ? 0 : Math.min(100, (activeJob.done / activeJob.total) * 100)
  const eta =
    activeJob.status === 'running' ? fmtEta(activeJob.elapsedMs, activeJob.done, activeJob.total) : null

  // Status-driven accent color. Subtle — we don't want this card
  // shouting at the admin while they browse the landing page.
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

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-4 left-4 z-[60] w-[320px] rounded-xl border border-gray-800 bg-gray-950/95 backdrop-blur-md shadow-2xl shadow-black/40 text-gray-100 select-none"
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
          <span className="text-[10px] uppercase tracking-[0.18em] font-bold text-gray-400">
            {activeJob.type === 'seed' ? 'Bulk seed' : 'Bulk enrich'} · {statusLabel}
          </span>
        </div>
        {activeJob.status !== 'running' && (
          <button
            type="button"
            onClick={dismissJob}
            aria-label="Dismiss"
            className="text-gray-500 hover:text-gray-200 transition-colors -mr-1 -mt-1 px-1 leading-none text-lg"
          >
            ×
          </button>
        )}
      </div>

      {/* LABEL */}
      <div className="px-3.5 pb-2 text-[12px] text-gray-200 leading-snug truncate" title={activeJob.label}>
        {activeJob.label}
      </div>

      {/* PROGRESS BAR */}
      <div className="px-3.5 pb-2">
        <div className="h-1.5 rounded-full bg-gray-800 overflow-hidden">
          <div
            className={`h-full ${accent} transition-all duration-500`}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {/* COUNTS + ELAPSED */}
      <div className="px-3.5 pb-3 flex items-center justify-between gap-2 text-[11px] font-mono tabular-nums text-gray-400">
        <span>
          {activeJob.done.toLocaleString()} / {activeJob.total.toLocaleString()}
        </span>
        <span className="text-gray-500">
          {fmtElapsed(activeJob.elapsedMs)}
          {eta && <span className="text-gray-600"> · ~{eta} left</span>}
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

      {/* ACTIONS — Link (not <a>) so navigation stays soft and the
          loop in the JS event loop keeps running. */}
      {activeJob.status === 'running' ? (
        <div className="border-t border-gray-800 px-3.5 py-2 flex items-center justify-between">
          <Link
            href={activeJob.type === 'seed' ? '/admin/contacts/seed' : '/admin/contacts/enrich'}
            className="text-[11px] text-orange-400 hover:text-orange-300 hover:underline"
          >
            View page →
          </Link>
          <button
            type="button"
            onClick={cancelActiveJob}
            className="text-[11px] font-semibold text-gray-400 hover:text-red-300 transition-colors"
          >
            Cancel
          </button>
        </div>
      ) : (
        <div className="border-t border-gray-800 px-3.5 py-2 flex items-center justify-between">
          <Link
            href="/admin/contacts"
            className="text-[11px] text-orange-400 hover:text-orange-300 hover:underline"
          >
            View contacts →
          </Link>
          <span className="text-[11px] text-gray-500">
            {activeJob.done.toLocaleString()} processed
          </span>
        </div>
      )}
    </div>
  )
}
