'use client'

import { useEffect, useState } from 'react'

import { useBulkJob } from '@/components/BulkJobProvider'

type Mode = 'no-email' | 'stale' | 'bounced' | 'all'

const MODE_LABEL: Record<Mode, string> = {
  'no-email': 'Channels missing an email',
  stale: 'Emails older than 90 days',
  bounced: 'Emails marked bad / bounced',
  all: 'Everything (force refresh all channels)',
}

const MODE_DESCRIPTION: Record<Mode, string> = {
  'no-email': 'The most useful default — chases an email for every channel that came in search-only. Skips channels we already have an email for.',
  stale: 'Re-fetches channels whose email is older than 90 days. Useful for refreshing data on creators that may have changed addresses.',
  bounced: 'Re-fetches channels you flagged as bad via the trash-icon button on the outreach board. Recovery path for invalidated emails.',
  all: 'Force-refresh every channel in the cache. Slow + expensive — only use when something fundamental has changed in the enrichment pipeline.',
}

/**
 * EnrichClient now hands the run loop to BulkJobProvider — same
 * pattern as SeedClient. The form keeps its preview/count logic
 * (calls /api/admin/bulk-enrich with dryRun=true to know how many
 * channels match), but the long-running enrich loop lives in the
 * provider so it survives navigation.
 */
export function EnrichClient() {
  const { activeJob, startEnrichJob, cancelActiveJob } = useBulkJob()

  const [mode, setMode] = useState<Mode>('no-email')
  // Bumped 2026-05-20: batchSize 4→10, concurrency 2→4. Last
  // measured tick chunk runtime stayed under ~50s with these
  // values — within Vercel's 60s function timeout, ~2.5x throughput
  // vs the prior defaults. Per Dylan after 3500-channel job only
  // got through 350 overnight.
  const [batchSize, setBatchSize] = useState<number>(10)
  const [concurrency, setConcurrency] = useState<number>(4)
  // Limit dropdown — lets the operator carve a 3000-channel queue
  // into manageable chunks. 0 = no cap (enrich everything matching).
  const [limit, setLimit] = useState<number>(0)
  const [matchingCount, setMatchingCount] = useState<number | null>(null)
  const [previewLoading, setPreviewLoading] = useState<boolean>(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const enrichJob = activeJob && activeJob.type === 'enrich' ? activeJob : null
  const otherJobRunning =
    activeJob && activeJob.type !== 'enrich' && activeJob.status === 'running'
  const isRunning = enrichJob?.status === 'running'

  // Re-fetch the matching count whenever the mode changes (so the
  // operator sees how many channels they're about to enrich
  // BEFORE clicking Run).
  useEffect(() => {
    let cancelled = false
    async function fetchCount() {
      setPreviewLoading(true)
      try {
        const res = await fetch('/api/admin/bulk-enrich', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ mode, dryRun: true, limit: 1 }),
        })
        if (!res.ok) {
          if (!cancelled) setMatchingCount(null)
          return
        }
        const j = await res.json()
        if (!cancelled) setMatchingCount(j.totalMatching ?? null)
      } catch {
        if (!cancelled) setMatchingCount(null)
      } finally {
        if (!cancelled) setPreviewLoading(false)
      }
    }
    void fetchCount()
    return () => {
      cancelled = true
    }
  }, [mode])

  async function run() {
    setSubmitError(null)
    if (matchingCount === null || matchingCount === 0) return
    if (otherJobRunning) {
      setSubmitError('Bulk seed is already running. Cancel or wait for it to finish.')
      return
    }
    if (isRunning) {
      setSubmitError('A bulk enrich job is already in progress.')
      return
    }
    // Effective channels to process this run = min(user limit, matching).
    // limit === 0 means "no cap" → process everything matching.
    const effective = limit > 0 ? Math.min(limit, matchingCount) : matchingCount
    if (
      !confirm(
        `Enrich ${effective.toLocaleString()} channels in mode "${MODE_LABEL[mode]}"?\n\n` +
        `Runs in the background on the server — keeps going even if you close this tab.\n\n` +
        `This calls the live email pipeline (~10s per channel) and writes results to the cache.` +
        (limit > 0 ? `\n\nLimit set to ${limit} — leftover channels (${(matchingCount - effective).toLocaleString()}) will be queued for a future run.` : ''),
      )
    )
      return
    const label = limit > 0
      ? `${MODE_LABEL[mode]} · ${effective.toLocaleString()} of ${matchingCount.toLocaleString()} channels`
      : `${MODE_LABEL[mode]} · ~${matchingCount.toLocaleString()} channels`
    const id = await startEnrichJob(
      { mode, batchSize, concurrency, limit: limit > 0 ? limit : null },
      label,
    )
    if (!id) {
      // The bar will now show the existing/conflicting job (if any).
      // Surface a short hint so the user knows to look at it.
      setSubmitError(
        'Another bulk job is currently running — see the floating bar in the bottom-left. Cancel it there if you want to start a fresh enrich.',
      )
    }
  }

  return (
    <div className="space-y-6">
      {/* BACKGROUND JOB BANNER */}
      {enrichJob && (
        <BackgroundJobBanner
          done={enrichJob.done}
          total={enrichJob.total}
          elapsedMs={enrichJob.elapsedMs}
          label={enrichJob.label}
          status={enrichJob.status}
          errors={enrichJob.errors.length}
          cancelRequested={enrichJob.cancelRequested}
          onCancel={async () => {
            // Two-step confirm — the user has been waiting ~hours on
            // this; an accidental click shouldn't throw it all away.
            // The cancel only takes effect on the next tick (≤ ~1s),
            // so partial progress is preserved.
            if (!confirm(
              `Stop bulk enrichment? Progress so far (${enrichJob.done.toLocaleString()} / ${enrichJob.total.toLocaleString()}) is saved — you can resume later by running again with the same mode.`,
            )) return
            await cancelActiveJob()
          }}
        />
      )}
      {otherJobRunning && (
        <div className="rounded-xl border border-yellow-500/30 bg-yellow-500/10 px-5 py-3 text-sm text-yellow-200">
          Bulk seed is currently running in the background — this form is paused until that job
          finishes (or you cancel it from the bar in the bottom-left).
        </div>
      )}

      {/* MODE PICKER */}
      <section className="rounded-xl border border-border bg-card/40 p-5">
        <label className="block">
          <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground/80 font-bold mb-2">
            What to enrich
          </div>
          <select
            value={mode}
            onChange={e => setMode(e.target.value as Mode)}
            disabled={isRunning}
            className="w-full px-3 py-2.5 rounded-md bg-background border border-border text-sm font-medium text-foreground focus:outline-none focus:border-orange-500/50"
          >
            {(Object.keys(MODE_LABEL) as Mode[]).map(m => (
              <option key={m} value={m}>
                {MODE_LABEL[m]}
              </option>
            ))}
          </select>
          <div className="text-xs text-muted-foreground/80 mt-2 leading-relaxed">
            {MODE_DESCRIPTION[mode]}
          </div>
        </label>
      </section>

      {/* OPTIONS */}
      <section className="rounded-xl border border-border bg-card/40 p-5">
        <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground/80 font-bold mb-3">
          Run options
        </div>
        <div className="grid grid-cols-3 gap-4">
          <label className="block">
            <div className="text-sm font-semibold text-foreground mb-1.5">Batch size</div>
            <input
              type="number"
              min={1}
              max={50}
              value={batchSize}
              onChange={e => setBatchSize(parseInt(e.target.value, 10) || 10)}
              disabled={isRunning}
              className="w-full px-3 py-2 rounded-md bg-background border border-border text-sm font-mono text-foreground focus:outline-none focus:border-border"
            />
            <div className="text-xs text-muted-foreground/80 mt-1">Channels per server call (1–50). Smaller = safer for Vercel timeout.</div>
          </label>
          <label className="block">
            <div className="text-sm font-semibold text-foreground mb-1.5">Concurrency</div>
            <input
              type="number"
              min={1}
              max={4}
              value={concurrency}
              onChange={e => setConcurrency(parseInt(e.target.value, 10) || 4)}
              disabled={isRunning}
              className="w-full px-3 py-2 rounded-md bg-background border border-border text-sm font-mono text-foreground focus:outline-none focus:border-border"
            />
            <div className="text-xs text-muted-foreground/80 mt-1">Parallel /api/enrich workers per call (1–4)</div>
          </label>
          <label className="block">
            <div className="text-sm font-semibold text-foreground mb-1.5">Limit this run</div>
            <select
              value={limit}
              onChange={e => setLimit(parseInt(e.target.value, 10) || 0)}
              disabled={isRunning}
              className="w-full px-3 py-2 rounded-md bg-background border border-border text-sm font-mono text-foreground focus:outline-none focus:border-border"
            >
              <option value={0}>All matching</option>
              <option value={100}>100 channels</option>
              <option value={200}>200 channels</option>
              <option value={500}>500 channels</option>
              <option value={1000}>1,000 channels</option>
            </select>
            <div className="text-xs text-muted-foreground/80 mt-1">Cap how many channels this single run processes. Leftover channels stay queued for the next run.</div>
          </label>
        </div>
      </section>

      {/* PREVIEW + RUN */}
      <section className="rounded-xl border border-border bg-card/40 p-5">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground/80 font-bold mb-1">
              Preview
            </div>
            {previewLoading ? (
              <div className="text-sm text-muted-foreground">Counting…</div>
            ) : matchingCount === null ? (
              <div className="text-sm text-red-400">Couldn&apos;t fetch count</div>
            ) : matchingCount === 0 ? (
              <div className="text-sm text-muted-foreground">
                Nothing matches that filter — pick another mode or run a bulk-seed first to populate the cache.
              </div>
            ) : (
              <div className="text-lg font-semibold text-foreground">
                <span className="text-orange-400 tabular-nums">
                  {(limit > 0 ? Math.min(limit, matchingCount) : matchingCount).toLocaleString()}
                </span>{' '}
                <span className="text-muted-foreground text-sm font-normal">
                  {limit > 0 && limit < matchingCount
                    ? <>of {matchingCount.toLocaleString()} this run · </>
                    : <>channels match · </>}
                  ETA{' '}
                  <span className="tabular-nums">
                    ~{Math.ceil(((limit > 0 ? Math.min(limit, matchingCount) : matchingCount) * 10) / 60 / Math.max(1, concurrency))} min
                  </span>
                  {' '}(at {concurrency}× concurrency, ~10s per channel)
                </span>
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={run}
            disabled={isRunning || otherJobRunning || matchingCount === null || matchingCount === 0}
            className="px-5 py-2.5 rounded-md text-sm font-semibold bg-orange-600 hover:bg-orange-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isRunning
              ? `Running · ${enrichJob?.done ?? 0} / ${enrichJob?.total ?? 0}…`
              : matchingCount
              ? `Enrich ${(limit > 0 ? Math.min(limit, matchingCount) : matchingCount).toLocaleString()} in background`
              : 'Enrich'}
          </button>
        </div>
        {submitError && (
          <div className="mt-3 text-xs text-red-400 font-mono">
            {submitError}
          </div>
        )}
      </section>

      {/* INFO PANEL */}
      <section className="rounded-xl border border-border/60 bg-card/20 p-4 text-[12px] text-muted-foreground leading-relaxed">
        <p>
          <span className="text-foreground font-semibold">Background mode:</span>{' '}
          The enrich loop is processed server-side via QStash. The browser just
          polls for progress — close the tab, switch to a different app, walk
          away. The job keeps running.
        </p>
        <p className="mt-2">
          Only one bulk job at a time — bulk seed and bulk enrich share the same slot.
        </p>
      </section>
    </div>
  )
}

function BackgroundJobBanner({
  done,
  total,
  elapsedMs,
  label,
  status,
  errors,
  cancelRequested,
  onCancel,
}: {
  done: number
  total: number
  elapsedMs: number
  label: string
  status: 'running' | 'done' | 'cancelled' | 'failed'
  errors: number
  cancelRequested: boolean
  onCancel: () => Promise<void> | void
}) {
  const pct = total === 0 ? 0 : Math.min(100, (done / total) * 100)
  const accent =
    status === 'running'
      ? 'bg-orange-500'
      : status === 'done'
      ? 'bg-emerald-500'
      : status === 'cancelled'
      ? 'bg-gray-500'
      : 'bg-red-500'
  const seconds = Math.round(elapsedMs / 100) / 10
  const cancelling = status === 'running' && cancelRequested

  return (
    <section className="rounded-xl border border-border bg-card/40 p-5">
      <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.18em] text-muted-foreground/80 font-bold mb-2">
        <span>Background job · {cancelling ? 'cancelling…' : status}</span>
        <span className="font-mono normal-case tracking-normal text-muted-foreground">
          {done} / {total} · {seconds}s{errors > 0 && ` · ${errors} errors`}
        </span>
      </div>
      <div className="flex items-center justify-between gap-3 mb-3">
        <div className="text-sm text-foreground truncate flex-1" title={label}>
          {label}
        </div>
        {status === 'running' && (
          <button
            type="button"
            onClick={onCancel}
            disabled={cancelRequested}
            className="shrink-0 px-3 py-1.5 rounded-md text-[12px] font-semibold border border-red-500/40 text-red-300 hover:bg-red-500/10 hover:border-red-500/70 disabled:opacity-60 disabled:cursor-wait transition-colors"
            aria-label="Stop bulk enrichment"
          >
            {cancelRequested ? 'Cancelling…' : 'Stop'}
          </button>
        )}
      </div>
      <div className="h-2 rounded-full bg-muted overflow-hidden">
        <div
          className={`h-full ${accent} transition-all duration-500`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </section>
  )
}
