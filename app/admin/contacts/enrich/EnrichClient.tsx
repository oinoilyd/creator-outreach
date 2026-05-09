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
  const { activeJob, startEnrichJob } = useBulkJob()

  const [mode, setMode] = useState<Mode>('no-email')
  // Default 4 (down from 8). With per-channel timeout 25s on the
  // server + concurrency=2, a chunk of 4 channels can complete in
  // ~50s worst-case, well under Vercel's 60s function timeout.
  const [batchSize, setBatchSize] = useState<number>(4)
  const [concurrency, setConcurrency] = useState<number>(2)
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

  function run() {
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
    if (
      !confirm(
        `Enrich ${matchingCount} channels in mode "${MODE_LABEL[mode]}"?\n\n` +
        `Runs in the background — keeps going if you navigate away (but not if you close the tab).\n\n` +
        `This calls the live email pipeline (~10s per channel) and writes results to the cache.`,
      )
    )
      return
    const label = `${MODE_LABEL[mode]} · ~${matchingCount.toLocaleString()} channels`
    const id = startEnrichJob(
      { mode, batchSize, concurrency },
      label,
    )
    if (!id) {
      setSubmitError('Could not start job — another bulk job may be running.')
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
        />
      )}
      {otherJobRunning && (
        <div className="rounded-xl border border-yellow-500/30 bg-yellow-500/10 px-5 py-3 text-sm text-yellow-200">
          Bulk seed is currently running in the background — this form is paused until that job
          finishes (or you cancel it from the bar in the bottom-left).
        </div>
      )}

      {/* MODE PICKER */}
      <section className="rounded-xl border border-gray-800 bg-gray-900/40 p-5">
        <label className="block">
          <div className="text-[10px] uppercase tracking-[0.18em] text-gray-500 font-bold mb-2">
            What to enrich
          </div>
          <select
            value={mode}
            onChange={e => setMode(e.target.value as Mode)}
            disabled={isRunning}
            className="w-full px-3 py-2.5 rounded-md bg-gray-950 border border-gray-800 text-sm font-medium text-white focus:outline-none focus:border-orange-500/50"
          >
            {(Object.keys(MODE_LABEL) as Mode[]).map(m => (
              <option key={m} value={m}>
                {MODE_LABEL[m]}
              </option>
            ))}
          </select>
          <div className="text-xs text-gray-500 mt-2 leading-relaxed">
            {MODE_DESCRIPTION[mode]}
          </div>
        </label>
      </section>

      {/* OPTIONS */}
      <section className="rounded-xl border border-gray-800 bg-gray-900/40 p-5">
        <div className="text-[10px] uppercase tracking-[0.18em] text-gray-500 font-bold mb-3">
          Run options
        </div>
        <div className="grid grid-cols-2 gap-4">
          <label className="block">
            <div className="text-sm font-semibold text-white mb-1.5">Batch size</div>
            <input
              type="number"
              min={1}
              max={50}
              value={batchSize}
              onChange={e => setBatchSize(parseInt(e.target.value, 10) || 8)}
              disabled={isRunning}
              className="w-full px-3 py-2 rounded-md bg-gray-950 border border-gray-800 text-sm font-mono text-gray-200 focus:outline-none focus:border-gray-600"
            />
            <div className="text-xs text-gray-500 mt-1">Channels per server call (1–50). Smaller = safer for Vercel timeout.</div>
          </label>
          <label className="block">
            <div className="text-sm font-semibold text-white mb-1.5">Concurrency</div>
            <input
              type="number"
              min={1}
              max={4}
              value={concurrency}
              onChange={e => setConcurrency(parseInt(e.target.value, 10) || 2)}
              disabled={isRunning}
              className="w-full px-3 py-2 rounded-md bg-gray-950 border border-gray-800 text-sm font-mono text-gray-200 focus:outline-none focus:border-gray-600"
            />
            <div className="text-xs text-gray-500 mt-1">Parallel /api/enrich workers per call (1–4)</div>
          </label>
        </div>
      </section>

      {/* PREVIEW + RUN */}
      <section className="rounded-xl border border-gray-800 bg-gray-900/40 p-5">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <div className="text-[10px] uppercase tracking-[0.18em] text-gray-500 font-bold mb-1">
              Preview
            </div>
            {previewLoading ? (
              <div className="text-sm text-gray-400">Counting…</div>
            ) : matchingCount === null ? (
              <div className="text-sm text-red-400">Couldn&apos;t fetch count</div>
            ) : matchingCount === 0 ? (
              <div className="text-sm text-gray-400">
                Nothing matches that filter — pick another mode or run a bulk-seed first to populate the cache.
              </div>
            ) : (
              <div className="text-lg font-semibold text-white">
                <span className="text-orange-400 tabular-nums">{matchingCount.toLocaleString()}</span>{' '}
                <span className="text-gray-400 text-sm font-normal">channels match · ETA{' '}
                  <span className="tabular-nums">~{Math.ceil((matchingCount * 10) / 60)} min</span>
                  {' '}(rough, ~10s per channel)
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
              ? `Enrich ${matchingCount.toLocaleString()} in background`
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
      <section className="rounded-xl border border-gray-800/60 bg-gray-900/20 p-4 text-[12px] text-gray-400 leading-relaxed">
        <p>
          <span className="text-gray-200 font-semibold">Background mode:</span>{' '}
          The enrich loop hands off to a small floating progress card in the
          bottom-left. Navigate freely between admin pages, the landing site, and
          sign-up flows — the loop keeps running. Tab close kills it.
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
}: {
  done: number
  total: number
  elapsedMs: number
  label: string
  status: 'running' | 'done' | 'cancelled' | 'failed'
  errors: number
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

  return (
    <section className="rounded-xl border border-gray-800 bg-gray-900/40 p-5">
      <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.18em] text-gray-500 font-bold mb-2">
        <span>Background job · {status}</span>
        <span className="font-mono normal-case tracking-normal text-gray-400">
          {done} / {total} · {seconds}s{errors > 0 && ` · ${errors} errors`}
        </span>
      </div>
      <div className="text-sm text-gray-200 mb-3 truncate" title={label}>
        {label}
      </div>
      <div className="h-2 rounded-full bg-gray-800 overflow-hidden">
        <div
          className={`h-full ${accent} transition-all duration-500`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </section>
  )
}
