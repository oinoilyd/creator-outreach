'use client'

import { useState } from 'react'

import { NICHE_BUCKETS } from '@/lib/format'
import { REGIONS } from '@/lib/regions'
import { useBulkJob } from '@/components/BulkJobProvider'

/**
 * Presets are now sourced from the actual NICHE_BUCKETS in
 * lib/format.ts — same 13 buckets the in-app niche shortcut uses.
 * Each bucket fans out to ~28-30 occupations; the bulk-seed
 * endpoint caps at 100 queries per run, so picking a single
 * bucket runs all its occupations in one go.
 */
const PRESETS = NICHE_BUCKETS.map(b => ({
  label: b.label,
  queries: b.occupations.slice(0, 30),
}))

/**
 * SeedClient now delegates the actual loop to BulkJobProvider —
 * the provider lives in the root layout, so the job survives
 * navigation between /admin, /, /landing, /auth/signup, etc.
 *
 * This component owns the form (queries, options, region) and
 * shows the active-job state inline. The floating BulkJobBar
 * (also in the root layout) is the persistent UI when the admin
 * navigates away.
 */
export function SeedClient() {
  const { activeJob, startSeedJob } = useBulkJob()

  const [queries, setQueries] = useState<string>('travel agent\nyoga instructor\nfinancial advisor')
  // Default ON — the whole point of bulk-seeding is to fill the
  // contacts cache with EMAILS, not just channel metadata.
  const [enrich, setEnrich] = useState<boolean>(true)
  const [concurrency, setConcurrency] = useState<number>(2)
  const [maxResults, setMaxResults] = useState<number>(10)
  const [region, setRegion] = useState<string>('') // '' = global / no targeting
  const [submitError, setSubmitError] = useState<string | null>(null)

  const queryList = queries
    .split('\n')
    .map(s => s.trim())
    .filter(Boolean)

  const seedJob = activeJob && activeJob.type === 'seed' ? activeJob : null
  const otherJobRunning =
    activeJob && activeJob.type !== 'seed' && activeJob.status === 'running'
  const isRunning = seedJob?.status === 'running'

  async function run() {
    setSubmitError(null)
    if (queryList.length === 0) return
    if (otherJobRunning) {
      setSubmitError('Bulk enrich is already running. Cancel or wait for it to finish.')
      return
    }
    if (seedJob?.status === 'running') {
      setSubmitError('A bulk seed job is already in progress.')
      return
    }
    const regionLabel = region ? REGIONS.find(r => r.code === region)?.label ?? region : 'Global'
    const label = `${queryList.length} ${queryList.length === 1 ? 'query' : 'queries'} · ${regionLabel}${enrich ? ' · with emails' : ''}`
    const id = await startSeedJob(
      { queries: queryList, enrich, concurrency, maxResults, region },
      label,
    )
    if (!id) {
      setSubmitError(
        'Could not start job — another bulk job may be running, or QStash isn\'t configured. Check the bar for details.',
      )
    }
  }

  function loadPreset(qs: string[]) {
    setQueries(qs.join('\n'))
  }

  return (
    <div className="space-y-6">
      {/* BACKGROUND JOB BANNER — mirrors the floating bar so the
          page itself reflects job state even if the admin scrolls
          past the bar in the corner. */}
      {seedJob && (
        <BackgroundJobBanner
          done={seedJob.done}
          total={seedJob.total}
          elapsedMs={seedJob.elapsedMs}
          label={seedJob.label}
          status={seedJob.status}
          errors={seedJob.errors.length}
        />
      )}
      {otherJobRunning && (
        <div className="rounded-xl border border-yellow-500/30 bg-yellow-500/10 px-5 py-3 text-sm text-yellow-200">
          Bulk enrich is currently running in the background — this form is paused until that job
          finishes (or you cancel it from the bar in the bottom-left).
        </div>
      )}

      {/* PRESETS */}
      <section className="rounded-xl border border-gray-800 bg-gray-900/40 p-5">
        <div className="text-[10px] uppercase tracking-[0.18em] text-gray-500 font-bold mb-3">
          Quick-pick presets
        </div>
        <div className="flex flex-wrap gap-2">
          {PRESETS.map(p => (
            <button
              key={p.label}
              type="button"
              onClick={() => loadPreset(p.queries)}
              disabled={isRunning}
              className="px-3 py-1.5 rounded-md text-xs font-semibold border border-gray-800 text-gray-300 hover:border-orange-500/40 hover:text-orange-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {p.label}
              <span className="ml-1.5 text-gray-500">· {p.queries.length}</span>
            </button>
          ))}
        </div>
      </section>

      {/* QUERY EDITOR */}
      <section className="rounded-xl border border-gray-800 bg-gray-900/40 p-5">
        <label className="block text-[10px] uppercase tracking-[0.18em] text-gray-500 font-bold mb-2">
          Queries · one per line
        </label>
        <textarea
          value={queries}
          onChange={e => setQueries(e.target.value)}
          rows={10}
          className="w-full px-3 py-2 rounded-md bg-gray-950 border border-gray-800 text-sm font-mono text-gray-200 placeholder:text-gray-700 focus:outline-none focus:border-gray-600"
          placeholder={'travel agent\nyoga instructor\nfinancial advisor'}
          disabled={isRunning}
        />
        <div className="text-xs text-gray-500 mt-2">
          {queryList.length} {queryList.length === 1 ? 'query' : 'queries'} ready · capped at 100
        </div>
      </section>

      {/* OPTIONS */}
      <section className="rounded-xl border border-gray-800 bg-gray-900/40 p-5">
        <div className="text-[10px] uppercase tracking-[0.18em] text-gray-500 font-bold mb-3">
          Run options
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <label className="flex items-start gap-2.5 cursor-pointer">
            <input
              type="checkbox"
              checked={enrich}
              onChange={e => setEnrich(e.target.checked)}
              className="mt-1 w-4 h-4 accent-orange-500"
              disabled={isRunning}
            />
            <div>
              <div className="text-sm font-semibold text-white">
                Resolve emails {enrich ? <span className="text-emerald-400">(on — recommended)</span> : <span className="text-yellow-400">(off — channels only, no emails)</span>}
              </div>
              <div className="text-xs text-gray-500 mt-0.5 leading-relaxed">
                When on: each search result is enriched (7 strategies, ~10s each) and emails land in the contacts cache. <br />
                When off: only channel metadata is written (channelId, name, subs, avg views). No emails — useful only for fast corpus shape scanning.
              </div>
            </div>
          </label>
          <label className="block">
            <div className="text-sm font-semibold text-white mb-1.5">Region · YouTube gl</div>
            <select
              value={region}
              onChange={e => setRegion(e.target.value)}
              disabled={isRunning}
              className="w-full px-3 py-2 rounded-md bg-gray-950 border border-gray-800 text-sm font-mono text-gray-200 focus:outline-none focus:border-gray-600"
            >
              <option value="">Global · no region targeting</option>
              {REGIONS.map(r => (
                <option key={r.code} value={r.code}>
                  {r.flag} {r.label} ({r.code})
                </option>
              ))}
            </select>
            <div className="text-xs text-gray-500 mt-1">
              Targets YouTube&apos;s region-aware search. Localizes to the country&apos;s creator pool — useful for non-US niches.
            </div>
          </label>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <label className="block">
            <div className="text-sm font-semibold text-white mb-1.5">Concurrency</div>
            <input
              type="number"
              min={1}
              max={8}
              value={concurrency}
              onChange={e => setConcurrency(parseInt(e.target.value, 10) || 3)}
              disabled={isRunning}
              className="w-full px-3 py-2 rounded-md bg-gray-950 border border-gray-800 text-sm font-mono text-gray-200 focus:outline-none focus:border-gray-600"
            />
            <div className="text-xs text-gray-500 mt-1">Parallel queries (1–8)</div>
          </label>
          <label className="block">
            <div className="text-sm font-semibold text-white mb-1.5">Max per query</div>
            <input
              type="number"
              min={5}
              max={50}
              value={maxResults}
              onChange={e => setMaxResults(parseInt(e.target.value, 10) || 30)}
              disabled={isRunning}
              className="w-full px-3 py-2 rounded-md bg-gray-950 border border-gray-800 text-sm font-mono text-gray-200 focus:outline-none focus:border-gray-600"
            />
            <div className="text-xs text-gray-500 mt-1">Channels per search (5–50)</div>
          </label>
        </div>
      </section>

      {/* RUN BUTTON */}
      <div className="flex items-center gap-3 flex-wrap">
        <button
          type="button"
          onClick={run}
          disabled={isRunning || otherJobRunning || queryList.length === 0}
          className="px-5 py-2.5 rounded-md text-sm font-semibold bg-orange-600 hover:bg-orange-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isRunning
            ? `Running · ${seedJob?.done ?? 0} / ${seedJob?.total ?? 0}…`
            : `Run ${queryList.length} ${queryList.length === 1 ? 'query' : 'queries'} in background`}
        </button>
        {isRunning && (
          <div className="text-xs text-orange-300 font-mono flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-orange-500 animate-pulse" />
            Background — keeps running if you navigate away
          </div>
        )}
        {submitError && (
          <div className="text-xs text-red-400 font-mono">
            {submitError}
          </div>
        )}
      </div>

      {/* INFO PANEL */}
      <section className="rounded-xl border border-gray-800/60 bg-gray-900/20 p-4 text-[12px] text-gray-400 leading-relaxed">
        <p>
          <span className="text-gray-200 font-semibold">How background mode works:</span>{' '}
          When you click Run, the job is handed off to a server-side queue (QStash).
          Processing continues whether you&apos;re on this page, on the landing site, on
          a different browser tab, or have closed the browser entirely. The floating
          card in the bottom-left polls the server every 2 seconds for progress.
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
