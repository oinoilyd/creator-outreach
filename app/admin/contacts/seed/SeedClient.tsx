'use client'

import { useState } from 'react'

/** Quick-pick presets — common batches the operator might want to seed. */
const PRESETS: { label: string; queries: string[] }[] = [
  {
    label: 'Fitness & Health',
    queries: [
      'fitness coach', 'personal trainer', 'online fitness coach', 'yoga instructor',
      'pilates instructor', 'CrossFit coach', 'powerlifting coach', 'strength coach',
      'nutritionist', 'wellness coach',
    ],
  },
  {
    label: 'Finance & Wealth',
    queries: [
      'financial advisor', 'financial planner', 'wealth manager', 'money coach',
      'stock trader', 'day trader', 'options trader', 'value investor',
      'crypto trader', 'crypto educator',
    ],
  },
  {
    label: 'Real Estate',
    queries: [
      'real estate agent', 'real estate broker', 'real estate investor',
      'real estate coach', 'mortgage broker', 'house flipper', 'Airbnb host',
      'real estate developer', 'commercial real estate agent',
    ],
  },
  {
    label: 'Tech & Startups',
    queries: [
      'software engineer', 'frontend developer', 'data scientist',
      'AI engineer', 'startup founder', 'SaaS founder', 'indie hacker',
      'tech YouTuber', 'product manager',
    ],
  },
  {
    label: 'Coaching',
    queries: [
      'life coach', 'business coach', 'executive coach', 'career coach',
      'sales coach', 'mindset coach', 'public speaking coach', 'productivity coach',
    ],
  },
]

type RunResult = {
  ok?: boolean
  queriesRun?: number
  channelsSeen?: number
  uniqueChannels?: number
  enrichesAttempted?: number
  errors?: string[]
  elapsedMs?: number
  error?: string
}

export function SeedClient() {
  const [queries, setQueries] = useState<string>('travel agent\nyoga instructor\nfinancial advisor')
  const [enrich, setEnrich] = useState<boolean>(false)
  const [concurrency, setConcurrency] = useState<number>(3)
  const [maxResults, setMaxResults] = useState<number>(30)
  const [running, setRunning] = useState<boolean>(false)
  const [result, setResult] = useState<RunResult | null>(null)

  const queryList = queries
    .split('\n')
    .map(s => s.trim())
    .filter(Boolean)

  async function run() {
    setRunning(true)
    setResult(null)
    try {
      const res = await fetch('/api/admin/bulk-seed', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          queries: queryList,
          enrich,
          concurrency,
          maxResults,
        }),
      })
      const j = (await res.json()) as RunResult
      setResult(j)
    } catch (e: any) {
      setResult({ error: e?.message || String(e) })
    } finally {
      setRunning(false)
    }
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
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={run}
          disabled={running || queryList.length === 0}
          className="px-5 py-2.5 rounded-md text-sm font-semibold bg-orange-600 hover:bg-orange-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {running ? 'Running…' : `Run ${queryList.length} ${queryList.length === 1 ? 'query' : 'queries'}`}
        </button>
        {running && (
          <div className="text-xs text-gray-400 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-orange-500 animate-pulse" />
            Working — search runs in parallel + writes to Postgres as it goes
          </div>
        )}
      </div>

      {/* RESULTS */}
      {result && (
        <section className="rounded-xl border border-gray-800 bg-gray-900/40 p-5">
          <div className="text-[10px] uppercase tracking-[0.18em] text-gray-500 font-bold mb-3">
            Run summary
          </div>
          {result.error ? (
            <div className="text-sm text-red-400">Error: {result.error}</div>
          ) : (
            <>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                <Stat label="Queries run" value={String(result.queriesRun ?? 0)} />
                <Stat label="Channels seen" value={String(result.channelsSeen ?? 0)} />
                <Stat label="Unique" value={String(result.uniqueChannels ?? 0)} accent />
                <Stat label="Enrichments" value={String(result.enrichesAttempted ?? 0)} />
                <Stat label="Elapsed" value={`${Math.round((result.elapsedMs ?? 0) / 100) / 10}s`} />
              </div>
              {(result.errors?.length ?? 0) > 0 && (
                <div className="mt-4">
                  <div className="text-[10px] uppercase tracking-[0.18em] text-yellow-300 font-bold mb-2">
                    Errors · first {Math.min(20, result.errors!.length)} of {result.errors!.length}
                  </div>
                  <ul className="text-xs text-yellow-200/80 font-mono space-y-1 max-h-48 overflow-y-auto">
                    {result.errors!.map((e, i) => (
                      <li key={i}>{e}</li>
                    ))}
                  </ul>
                </div>
              )}
              <div className="mt-4 text-xs text-gray-500">
                Snapshots are now in <span className="font-mono text-gray-400">creator_enrichment</span>.{' '}
                <a href="/admin/contacts" className="text-orange-400 hover:underline">View contacts →</a>
              </div>
            </>
          )}
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
