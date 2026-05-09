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

/**
 * Chunk size for client-side batching. The Vercel function timeout
 * is ~60s on hobby tier. With concurrency=2 and ~5–8s per query,
 * 6 queries per chunk gives the server plenty of headroom and
 * progress feels live in the UI as chunks complete. Each chunk
 * is a separate POST, so the function timeout per chunk is reset.
 */
const CHUNK_SIZE = 6

export function SeedClient() {
  const [queries, setQueries] = useState<string>('travel agent\nyoga instructor\nfinancial advisor')
  const [enrich, setEnrich] = useState<boolean>(false)
  const [concurrency, setConcurrency] = useState<number>(2)
  const [maxResults, setMaxResults] = useState<number>(15)
  const [region, setRegion] = useState<string>('') // '' = global / no targeting
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

    // Chunk the query list. Each chunk = one POST = one function
    // invocation = its own 60s timeout window. This is the fix
    // for the "string did not match expected pattern" timeout.
    const chunks: string[][] = []
    for (let i = 0; i < queryList.length; i += CHUNK_SIZE) {
      chunks.push(queryList.slice(i, i + CHUNK_SIZE))
    }

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
    const seenChannels = new Set<string>()
    const t0 = Date.now()

    for (let ci = 0; ci < chunks.length; ci++) {
      setProgress({ current: ci, total: chunks.length })
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
        } else {
          // Defensive parse — server SHOULD return JSON but timeouts
          // can produce HTML error pages.
          const text = await res.text()
          let j: RunResult
          try {
            j = JSON.parse(text)
          } catch {
            agg.errors.push(`chunk ${ci + 1}/${chunks.length}: non-JSON response (${text.slice(0, 60)})`)
            continue
          }
          if (j.error) {
            agg.errors.push(`chunk ${ci + 1}/${chunks.length}: ${j.error}`)
          } else {
            agg.queriesRun += j.queriesRun ?? 0
            agg.channelsSeen += j.channelsSeen ?? 0
            agg.enrichesAttempted += j.enrichesAttempted ?? 0
            if (j.uniqueChannels) {
              // We can't perfectly de-dupe without channel IDs — best-effort
              // by aggregating the per-chunk uniques; small over-count is OK.
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
          }
        }
      } catch (e: any) {
        agg.errors.push(`chunk ${ci + 1}/${chunks.length}: ${e?.message || String(e)}`)
      }
      agg.lastChunkDone = ci + 1
      agg.elapsedMs = Date.now() - t0
      setResult({ ...agg })
      // De-dup: best effort approximation using set tracking on
      // returned data (we don't have channelIds in the response,
      // so just trust per-chunk uniques for now).
      void seenChannels
    }

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
              <div className="text-sm font-semibold text-white">Also enrich emails</div>
              <div className="text-xs text-gray-500 mt-0.5">
                Slower (~10s per channel) but resolves email + socials. Off by default — search-only is much faster for corpus building.
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
          <div className="text-xs text-gray-400 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-orange-500 animate-pulse" />
            Chunked into {Math.ceil(queryList.length / CHUNK_SIZE)}{' '}
            {Math.ceil(queryList.length / CHUNK_SIZE) === 1 ? 'request' : 'requests'} of ≤{CHUNK_SIZE} queries
            each — bypasses Vercel&apos;s 60s function timeout.
          </div>
        )}
        {progress && progress.total > 1 && (
          <div className="w-full max-w-[400px]">
            <div className="h-1.5 rounded-full bg-gray-800 overflow-hidden">
              <div
                className="h-full bg-orange-500 transition-all duration-300"
                style={{ width: `${(progress.current / progress.total) * 100}%` }}
              />
            </div>
          </div>
        )}
      </div>

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
