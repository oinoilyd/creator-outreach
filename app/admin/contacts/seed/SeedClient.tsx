'use client'

import { useState } from 'react'

import { NICHE_BUCKETS } from '@/lib/format'
import { REGIONS } from '@/lib/regions'

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

type RunResult = {
  ok?: boolean
  queriesRun?: number
  channelsSeen?: number
  uniqueChannels?: number
  enrichesAttempted?: number
  errors?: string[]
  elapsedMs?: number
  error?: string
  timedOut?: boolean
  queriesRemaining?: number
}

type AggResult = {
  totalQueries: number
  queriesRun: number
  channelsSeen: number
  uniqueChannels: number
  enrichesAttempted: number
  errors: string[]
  elapsedMs: number
  /** Index of last completed chunk for resume. */
  lastChunkDone: number
  totalChunks: number
}

type QueryState = 'pending' | 'running' | 'done' | 'error'

/**
 * Chunk size for client-side batching. The Vercel function timeout
 * is ~60s on hobby tier. Each chunk = one POST = its own timeout
 * window. We pick chunk size based on whether enrichment is on:
 *   - enrich=false: ~6s per query → 6 queries per chunk fits in 60s
 *   - enrich=true:  search ~6s + enrich ~10s × maxResults=10 →
 *     much heavier. Keep chunk small (3) so the search+enrich
 *     phases both fit in the platform timeout.
 */
const CHUNK_SIZE_SEARCH_ONLY = 6
const CHUNK_SIZE_WITH_ENRICH = 3

export function SeedClient() {
  const [queries, setQueries] = useState<string>('travel agent\nyoga instructor\nfinancial advisor')
  // Default ON — the whole point of bulk-seeding is to fill the
  // contacts cache with EMAILS, not just channel metadata. Without
  // enrichment, /api/search only returns channelId + name + subs +
  // views (no email). Search-only mode is still available by
  // unchecking, but the default should be the user's actual goal.
  const [enrich, setEnrich] = useState<boolean>(true)
  const [concurrency, setConcurrency] = useState<number>(2)
  // Lower default when enriching is on — each enriched channel takes
  // ~10s, so 15 channels × 6 queries × concurrency 2 = a 90s+ chunk.
  // 10 keeps each chunk well under the 60s function timeout when
  // enrichment is included.
  const [maxResults, setMaxResults] = useState<number>(10)
  const [region, setRegion] = useState<string>('') // '' = global / no targeting
  const [queryStatus, setQueryStatus] = useState<Record<string, QueryState>>({})
  const [currentStage, setCurrentStage] = useState<string>('idle')
  const [running, setRunning] = useState<boolean>(false)
  const [result, setResult] = useState<AggResult | null>(null)
  const [progress, setProgress] = useState<{ current: number; total: number } | null>(null)

  const queryList = queries
    .split('\n')
    .map(s => s.trim())
    .filter(Boolean)

  async function run() {
    setRunning(true)
    setResult(null)
    setProgress(null)
    setQueryStatus({})
    setCurrentStage('preparing')

    // Chunk the query list. Each chunk = one POST = one function
    // invocation = its own 60s timeout window. This is the fix
    // for the "string did not match expected pattern" timeout.
    const chunks: string[][] = []
    const chunkSize = enrich ? CHUNK_SIZE_WITH_ENRICH : CHUNK_SIZE_SEARCH_ONLY
    for (let i = 0; i < queryList.length; i += chunkSize) {
      chunks.push(queryList.slice(i, i + chunkSize))
    }

    // Initial query-status map: every query is 'pending' until its
    // chunk runs.
    const initialStatus: Record<string, QueryState> = {}
    queryList.forEach(q => { initialStatus[q] = 'pending' })
    setQueryStatus(initialStatus)

    const agg: AggResult = {
      totalQueries: queryList.length,
      queriesRun: 0,
      channelsSeen: 0,
      uniqueChannels: 0,
      enrichesAttempted: 0,
      errors: [],
      elapsedMs: 0,
      lastChunkDone: 0,
      totalChunks: chunks.length,
    }
    const t0 = Date.now()

    for (let ci = 0; ci < chunks.length; ci++) {
      setProgress({ current: ci, total: chunks.length })
      setCurrentStage(enrich ? `searching + enriching · chunk ${ci + 1}/${chunks.length}` : `searching · chunk ${ci + 1}/${chunks.length}`)
      // Mark every query in this chunk as "running" — we don't get
      // per-query updates from the server (single POST per chunk),
      // but flagging them as in-flight makes the UI feel alive.
      setQueryStatus(prev => {
        const next = { ...prev }
        chunks[ci].forEach(q => { next[q] = 'running' })
        return next
      })

      try {
        const res = await fetch('/api/admin/bulk-seed', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            queries: chunks[ci],
            enrich,
            concurrency,
            maxResults,
            region,
          }),
        })
        if (!res.ok) {
          agg.errors.push(`chunk ${ci + 1}/${chunks.length}: HTTP ${res.status}`)
          setQueryStatus(prev => {
            const next = { ...prev }
            chunks[ci].forEach(q => { next[q] = 'error' })
            return next
          })
        } else {
          // Defensive parse — server SHOULD return JSON but timeouts
          // can produce HTML error pages.
          const text = await res.text()
          let j: RunResult
          try {
            j = JSON.parse(text)
          } catch {
            agg.errors.push(`chunk ${ci + 1}/${chunks.length}: non-JSON response (${text.slice(0, 60)})`)
            setQueryStatus(prev => {
              const next = { ...prev }
              chunks[ci].forEach(q => { next[q] = 'error' })
              return next
            })
            continue
          }
          if (j.error) {
            agg.errors.push(`chunk ${ci + 1}/${chunks.length}: ${j.error}`)
            setQueryStatus(prev => {
              const next = { ...prev }
              chunks[ci].forEach(q => { next[q] = 'error' })
              return next
            })
          } else {
            agg.queriesRun += j.queriesRun ?? 0
            agg.channelsSeen += j.channelsSeen ?? 0
            agg.enrichesAttempted += j.enrichesAttempted ?? 0
            if (j.uniqueChannels) {
              agg.uniqueChannels += j.uniqueChannels
            }
            if (j.errors?.length) {
              agg.errors.push(...j.errors.slice(0, 5).map(e => `chunk ${ci + 1}: ${e}`))
            }
            if (j.timedOut) {
              agg.errors.push(
                `chunk ${ci + 1} hit soft timeout — ${j.queriesRemaining ?? 0} queries skipped`,
              )
            }
            // Mark queries in this chunk done.
            setQueryStatus(prev => {
              const next = { ...prev }
              chunks[ci].forEach(q => { next[q] = 'done' })
              return next
            })
          }
        }
      } catch (e: any) {
        agg.errors.push(`chunk ${ci + 1}/${chunks.length}: ${e?.message || String(e)}`)
        setQueryStatus(prev => {
          const next = { ...prev }
          chunks[ci].forEach(q => { next[q] = 'error' })
          return next
        })
      }
      agg.lastChunkDone = ci + 1
      agg.elapsedMs = Date.now() - t0
      setResult({ ...agg })
    }

    setCurrentStage('done')
    setProgress({ current: chunks.length, total: chunks.length })
    setRunning(false)
  }

  function loadPreset(qs: string[]) {
    setQueries(qs.join('\n'))
  }

  return (
    <div className="space-y-6">
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
              className="px-3 py-1.5 rounded-md text-xs font-semibold border border-gray-800 text-gray-300 hover:border-orange-500/40 hover:text-orange-300 transition-colors"
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
          disabled={running}
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
              disabled={running}
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
              disabled={running}
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
              disabled={running}
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
              disabled={running}
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
          disabled={running || queryList.length === 0}
          className="px-5 py-2.5 rounded-md text-sm font-semibold bg-orange-600 hover:bg-orange-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {running
            ? progress
              ? `Chunk ${progress.current}/${progress.total}…`
              : 'Running…'
            : `Run ${queryList.length} ${queryList.length === 1 ? 'query' : 'queries'}`}
        </button>
        {running && (
          <div className="text-xs text-orange-300 font-mono flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-orange-500 animate-pulse" />
            {currentStage}
          </div>
        )}
      </div>

      {/* PROGRESS BAR + COUNTS */}
      {(running || result) && (
        <section className="rounded-xl border border-gray-800 bg-gray-900/40 p-5">
          <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.18em] text-gray-500 font-bold mb-2">
            <span>Live progress</span>
            <span className="font-mono normal-case tracking-normal text-gray-400">
              {Object.values(queryStatus).filter(s => s === 'done').length} / {queryList.length} done
              {Object.values(queryStatus).filter(s => s === 'error').length > 0 &&
                ` · ${Object.values(queryStatus).filter(s => s === 'error').length} error`}
            </span>
          </div>
          <div className="h-2 rounded-full bg-gray-800 overflow-hidden mb-4">
            <div
              className="h-full bg-orange-500 transition-all duration-500"
              style={{
                width: `${
                  queryList.length === 0
                    ? 0
                    : (Object.values(queryStatus).filter(s => s === 'done' || s === 'error').length / queryList.length) * 100
                }%`,
              }}
            />
          </div>

          {/* PER-QUERY CHECKLIST — shows every query in a compact grid
              with a state indicator. The checklist is the answer to
              "what is it actually doing right now?" */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-1 max-h-72 overflow-y-auto pr-1">
            {queryList.map(q => {
              const state = queryStatus[q] ?? 'pending'
              return (
                <div key={q} className="flex items-center gap-2 text-[12px] font-mono py-0.5">
                  <StateIcon state={state} />
                  <span
                    className={
                      state === 'done'
                        ? 'text-emerald-300'
                        : state === 'running'
                        ? 'text-orange-300'
                        : state === 'error'
                        ? 'text-red-400'
                        : 'text-gray-500'
                    }
                  >
                    {q}
                  </span>
                </div>
              )
            })}
          </div>

          <div className="mt-3 text-[11px] text-gray-500 leading-relaxed">
            Chunked into {Math.ceil(queryList.length / (enrich ? CHUNK_SIZE_WITH_ENRICH : CHUNK_SIZE_SEARCH_ONLY))}{' '}
            {Math.ceil(queryList.length / (enrich ? CHUNK_SIZE_WITH_ENRICH : CHUNK_SIZE_SEARCH_ONLY)) === 1 ? 'request' : 'requests'} of ≤{enrich ? CHUNK_SIZE_WITH_ENRICH : CHUNK_SIZE_SEARCH_ONLY} queries each.
            Each chunk runs server-side with concurrency={concurrency} — when a chunk finishes, all
            its queries flip from <span className="text-orange-300">running</span> to{' '}
            <span className="text-emerald-300">done</span>.
            {enrich && ' Enrichment runs after the search phase per chunk (~10s per channel).'}
          </div>
        </section>
      )}

      {/* RESULTS */}
      {result && (
        <section className="rounded-xl border border-gray-800 bg-gray-900/40 p-5">
          <div className="text-[10px] uppercase tracking-[0.18em] text-gray-500 font-bold mb-3">
            Run summary{' '}
            {result.lastChunkDone < result.totalChunks && (
              <span className="text-yellow-300 font-normal normal-case tracking-normal ml-2">
                (in progress: chunk {result.lastChunkDone}/{result.totalChunks})
              </span>
            )}
          </div>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <Stat label="Queries run" value={`${result.queriesRun} / ${result.totalQueries}`} />
            <Stat label="Channels seen" value={String(result.channelsSeen)} />
            <Stat label="Unique (approx.)" value={String(result.uniqueChannels)} accent />
            <Stat label="Enrichments" value={String(result.enrichesAttempted)} />
            <Stat label="Elapsed" value={`${Math.round(result.elapsedMs / 100) / 10}s`} />
          </div>
          {result.errors.length > 0 && (
            <div className="mt-4">
              <div className="text-[10px] uppercase tracking-[0.18em] text-yellow-300 font-bold mb-2">
                Errors · {result.errors.length}
              </div>
              <ul className="text-xs text-yellow-200/80 font-mono space-y-1 max-h-48 overflow-y-auto">
                {result.errors.map((e, i) => (
                  <li key={i}>{e}</li>
                ))}
              </ul>
            </div>
          )}
          <div className="mt-4 text-xs text-gray-500">
            Snapshots are now in <span className="font-mono text-gray-400">creator_enrichment</span>.{' '}
            <a href="/admin/contacts" className="text-orange-400 hover:underline">View contacts →</a>
          </div>
        </section>
      )}
    </div>
  )
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="rounded-lg border border-gray-800 bg-gray-950/60 px-3 py-2.5">
      <div className="text-[10px] uppercase tracking-[0.18em] text-gray-500 font-bold mb-1">{label}</div>
      <div className={`text-lg font-semibold tabular-nums ${accent ? 'text-orange-400' : 'text-white'}`}>{value}</div>
    </div>
  )
}

function StateIcon({ state }: { state: QueryState }) {
  if (state === 'done') {
    return (
      <span aria-hidden className="inline-flex items-center justify-center w-3.5 h-3.5 rounded-full bg-emerald-500/20 text-emerald-400 shrink-0">
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="5 12 10 17 19 7" />
        </svg>
      </span>
    )
  }
  if (state === 'running') {
    return (
      <span
        aria-hidden
        className="inline-flex items-center justify-center w-3.5 h-3.5 rounded-full bg-orange-500/20 text-orange-300 shrink-0"
      >
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="animate-spin">
          <line x1="12" y1="2" x2="12" y2="6" />
          <line x1="12" y1="18" x2="12" y2="22" />
          <line x1="4.93" y1="4.93" x2="7.76" y2="7.76" />
          <line x1="16.24" y1="16.24" x2="19.07" y2="19.07" />
          <line x1="2" y1="12" x2="6" y2="12" />
          <line x1="18" y1="12" x2="22" y2="12" />
          <line x1="4.93" y1="19.07" x2="7.76" y2="16.24" />
          <line x1="16.24" y1="7.76" x2="19.07" y2="4.93" />
        </svg>
      </span>
    )
  }
  if (state === 'error') {
    return (
      <span aria-hidden className="inline-flex items-center justify-center w-3.5 h-3.5 rounded-full bg-red-500/20 text-red-400 shrink-0">
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </span>
    )
  }
  return (
    <span aria-hidden className="inline-flex items-center justify-center w-3.5 h-3.5 rounded-full bg-gray-800 shrink-0">
      <span className="w-1.5 h-1.5 rounded-full bg-gray-600" />
    </span>
  )
}
