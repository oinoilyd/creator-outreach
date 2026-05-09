'use client'

import { useEffect, useState } from 'react'

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

type RunResponse = {
  ok?: boolean
  mode?: Mode
  totalMatching?: number
  processedThisCall?: number
  channelIdsProcessed?: string[]
  channelIdsRemaining?: string[]
  errors?: string[]
  elapsedMs?: number
  timedOut?: boolean
  error?: string
}

export function EnrichClient() {
  const [mode, setMode] = useState<Mode>('no-email')
  const [batchSize, setBatchSize] = useState<number>(8)
  const [concurrency, setConcurrency] = useState<number>(2)
  const [running, setRunning] = useState<boolean>(false)
  const [matchingCount, setMatchingCount] = useState<number | null>(null)
  const [previewLoading, setPreviewLoading] = useState<boolean>(false)
  const [agg, setAgg] = useState<{
    totalMatching: number
    processedTotal: number
    errors: string[]
    callsMade: number
    elapsedMs: number
  } | null>(null)

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
    if (matchingCount === null || matchingCount === 0) return
    if (
      !confirm(
        `Enrich ${matchingCount} channels in mode "${MODE_LABEL[mode]}"?\n\n` +
        `This calls the live email pipeline (~10s per channel) and writes results to the cache.`,
      )
    )
      return

    setRunning(true)
    setAgg({
      totalMatching: matchingCount,
      processedTotal: 0,
      errors: [],
      callsMade: 0,
      elapsedMs: 0,
    })

    const t0 = Date.now()
    let offset = 0
    let processed = 0
    const errors: string[] = []
    let total = matchingCount
    let calls = 0

    // Loop until totalMatching channels processed (or server says nothing left).
    while (offset < total && processed < total) {
      try {
        const res = await fetch('/api/admin/bulk-enrich', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ mode, limit: batchSize, offset, concurrency }),
        })
        const text = await res.text()
        let j: RunResponse
        try {
          j = JSON.parse(text)
        } catch {
          errors.push(`call ${calls + 1}: non-JSON response (${text.slice(0, 80)})`)
          break
        }
        if (!res.ok || j.error) {
          errors.push(`call ${calls + 1}: ${j.error || `HTTP ${res.status}`}`)
          break
        }
        processed += j.processedThisCall ?? 0
        if (j.errors?.length) {
          errors.push(...j.errors.slice(0, 5).map(e => `call ${calls + 1}: ${e}`))
        }
        // Server tells us totalMatching each call — use the latest
        // since rows can move between buckets while we run.
        if (typeof j.totalMatching === 'number') {
          total = j.totalMatching
        }
        // Advance offset by what we asked for (limit), not what
        // came back, so we keep moving forward even if some
        // channels failed.
        offset += batchSize
        calls++
        setAgg({
          totalMatching: total,
          processedTotal: processed,
          errors: [...errors],
          callsMade: calls,
          elapsedMs: Date.now() - t0,
        })

        // If server reported nothing left to do, break.
        if ((j.processedThisCall ?? 0) === 0 && (j.channelIdsRemaining?.length ?? 0) === 0) {
          break
        }
      } catch (e: any) {
        errors.push(`call ${calls + 1}: ${e?.message || String(e)}`)
        break
      }
    }

    setAgg({
      totalMatching: total,
      processedTotal: processed,
      errors,
      callsMade: calls,
      elapsedMs: Date.now() - t0,
    })
    setRunning(false)
  }

  return (
    <div className="space-y-6">
      {/* MODE PICKER */}
      <section className="rounded-xl border border-gray-800 bg-gray-900/40 p-5">
        <div className="text-[10px] uppercase tracking-[0.18em] text-gray-500 font-bold mb-3">
          What to enrich
        </div>
        <div className="space-y-2.5">
          {(Object.keys(MODE_LABEL) as Mode[]).map(m => (
            <label
              key={m}
              className={`flex items-start gap-3 rounded-lg border p-3 cursor-pointer transition-colors ${
                mode === m
                  ? 'border-orange-500/50 bg-orange-500/5'
                  : 'border-gray-800 hover:border-gray-700'
              }`}
            >
              <input
                type="radio"
                name="enrich-mode"
                value={m}
                checked={mode === m}
                onChange={() => setMode(m)}
                disabled={running}
                className="mt-1 w-4 h-4 accent-orange-500 shrink-0"
              />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-white">{MODE_LABEL[m]}</div>
                <div className="text-xs text-gray-500 mt-0.5 leading-relaxed">{MODE_DESCRIPTION[m]}</div>
              </div>
            </label>
          ))}
        </div>
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
              disabled={running}
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
              disabled={running}
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
            disabled={running || matchingCount === null || matchingCount === 0}
            className="px-5 py-2.5 rounded-md text-sm font-semibold bg-orange-600 hover:bg-orange-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {running ? 'Enriching…' : matchingCount ? `Enrich ${matchingCount.toLocaleString()} channels` : 'Enrich'}
          </button>
        </div>
      </section>

      {/* PROGRESS */}
      {agg && (
        <section className="rounded-xl border border-gray-800 bg-gray-900/40 p-5">
          <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.18em] text-gray-500 font-bold mb-2">
            <span>Live progress</span>
            <span className="font-mono normal-case tracking-normal text-gray-400">
              {agg.processedTotal} / {agg.totalMatching} processed · {agg.callsMade} calls · {Math.round(agg.elapsedMs / 100) / 10}s
            </span>
          </div>
          <div className="h-2 rounded-full bg-gray-800 overflow-hidden mb-4">
            <div
              className="h-full bg-orange-500 transition-all duration-500"
              style={{
                width: `${
                  agg.totalMatching === 0
                    ? 0
                    : Math.min(100, (agg.processedTotal / agg.totalMatching) * 100)
                }%`,
              }}
            />
          </div>
          {running && (
            <div className="text-[11px] text-orange-300 flex items-center gap-2 mb-3">
              <span className="w-2 h-2 rounded-full bg-orange-500 animate-pulse" />
              Working — each batch processes up to {batchSize} channels with concurrency={concurrency}
            </div>
          )}
          {agg.errors.length > 0 && (
            <div className="mt-3">
              <div className="text-[10px] uppercase tracking-[0.18em] text-yellow-300 font-bold mb-2">
                Errors · {agg.errors.length}
              </div>
              <ul className="text-xs text-yellow-200/80 font-mono space-y-1 max-h-48 overflow-y-auto">
                {agg.errors.map((e, i) => (
                  <li key={i}>{e}</li>
                ))}
              </ul>
            </div>
          )}
          <div className="mt-3 text-xs text-gray-500">
            Snapshots are landing in <span className="font-mono text-gray-400">creator_enrichment</span>.{' '}
            <a href="/admin/contacts" className="text-orange-400 hover:underline">View contacts →</a>
          </div>
        </section>
      )}
    </div>
  )
}
