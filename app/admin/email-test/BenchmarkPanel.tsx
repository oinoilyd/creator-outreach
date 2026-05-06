'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

// Wide spread of occupations so the average isn't dominated by one
// niche. Both buckets hit the same query so the comparison is fair.
const BENCH_QUERIES = [
  'real estate agent',
  'fitness coach',
  'tech founder',
  'youtube podcaster',
  'lifestyle vlogger',
  'business coach',
  'nutritionist',
  'language teacher',
  'crypto trader',
  'graphic designer',
  'photographer',
  'travel blogger',
] as const

// Down to two buckets — the only comparison that matters now is
// "evidence-only patterns" vs "new methodology bundle". Same primary
// pipeline under both, only the fallback differs.
const BENCH_BUCKETS = [
  {
    id: 'assumption',
    label: 'Educated assumption',
    strategy: ['web_scrape', 'biolink', 'bio_pages', 'ddg', 'wayback', 'domain_guess'],
  },
  {
    id: 'methodology',
    label: 'New methodology',
    strategy: ['web_scrape', 'biolink', 'bio_pages', 'ddg', 'wayback', 'new_methodology'],
  },
] as const

type BucketId = typeof BENCH_BUCKETS[number]['id']

const CREATORS_PER_QUERY = 10

interface RosterEntry {
  channelName: string
  channelId: string
  hasEmail: boolean
  email: string
  source: 'primary' | 'new_methodology' | 'educated_assumption' | null
}

interface QueryRunSlot {
  bucketId: BucketId
  total: number
  withEmail: number
  hitRate: number
  tookMs: number
  roster: RosterEntry[]
  error?: string
}

interface QueryRow {
  query: string
  results: Record<BucketId, QueryRunSlot | null>
}

export function BenchmarkPanel() {
  const router = useRouter()
  const [running, setRunning] = useState(false)
  const [rows, setRows] = useState<QueryRow[]>([])
  const [progress, setProgress] = useState<{ done: number; total: number; current: string } | null>(null)
  const [error, setError] = useState<string | null>(null)

  const totalRuns = BENCH_QUERIES.length * BENCH_BUCKETS.length

  function blankRows(): QueryRow[] {
    return BENCH_QUERIES.map(q => ({
      query: q,
      results: Object.fromEntries(BENCH_BUCKETS.map(b => [b.id, null])) as Record<BucketId, QueryRunSlot | null>,
    }))
  }

  async function runOne(query: string, bucket: typeof BENCH_BUCKETS[number], benchmarkId: string): Promise<QueryRunSlot> {
    try {
      const resp = await fetch('/api/admin/email-test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query,
          max: CREATORS_PER_QUERY,
          strategy: bucket.strategy,
          notes: `${benchmarkId}:${bucket.id}`,
        }),
      })
      const data = await resp.json()
      if (!resp.ok || data.error) {
        return {
          bucketId: bucket.id,
          total: 0, withEmail: 0, hitRate: 0, tookMs: 0,
          roster: [],
          error: data.error || `status ${resp.status}`,
        }
      }
      return {
        bucketId: bucket.id,
        total: data.total ?? 0,
        withEmail: data.withEmail ?? 0,
        hitRate: data.hitRate ?? 0,
        tookMs: data.tookMs ?? 0,
        roster: (data.results ?? []).map((r: RosterEntry) => ({
          channelName: r.channelName,
          channelId: r.channelId,
          hasEmail: r.hasEmail,
          email: r.email,
          source: r.source,
        })),
      }
    } catch (e) {
      return {
        bucketId: bucket.id,
        total: 0, withEmail: 0, hitRate: 0, tookMs: 0,
        roster: [],
        error: (e as Error).message,
      }
    }
  }

  async function runBenchmark() {
    if (running) return
    setRunning(true)
    setError(null)
    const initial = blankRows()
    setRows(initial)
    const benchmarkId = `bench-${Date.now()}`
    let completed = 0

    try {
      for (let i = 0; i < BENCH_QUERIES.length; i++) {
        const query = BENCH_QUERIES[i]
        setProgress({
          done: completed,
          total: totalRuns,
          current: `${query} → both buckets in parallel`,
        })

        // Run BOTH buckets in parallel for this query — fastest way to
        // get apples-to-apples per-occupation comparison.
        const [r0, r1] = await Promise.all([
          runOne(query, BENCH_BUCKETS[0], benchmarkId),
          runOne(query, BENCH_BUCKETS[1], benchmarkId),
        ])

        completed += 2
        setRows(prev => {
          const next = [...prev]
          next[i] = {
            ...next[i],
            results: {
              [BENCH_BUCKETS[0].id]: r0,
              [BENCH_BUCKETS[1].id]: r1,
            } as Record<BucketId, QueryRunSlot | null>,
          }
          return next
        })

        // small jitter between queries so DDG / YouTube don't rate-limit
        await new Promise(r => setTimeout(r, 800))
      }
      router.refresh()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setRunning(false)
      setProgress(null)
    }
  }

  // Aggregate across queries
  const aggregates = BENCH_BUCKETS.map(b => {
    let totalCreators = 0
    let totalEmails = 0
    let runs = 0
    for (const row of rows) {
      const slot = row.results[b.id]
      if (slot && !slot.error) {
        totalCreators += slot.total
        totalEmails += slot.withEmail
        runs += 1
      }
    }
    const hitRate = totalCreators > 0 ? (totalEmails / totalCreators) * 100 : 0
    return { ...b, totalCreators, totalEmails, runs, hitRate }
  })
  const winner = [...aggregates].sort((a, b) => b.hitRate - a.hitRate)[0]
  const margin = aggregates.length === 2 ? Math.abs(aggregates[0].hitRate - aggregates[1].hitRate) : 0

  return (
    <section className="rounded-xl border border-border bg-card p-5 mt-6">
      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">🏁 Benchmark — Educated assumption vs New methodology</h2>
          <p className="text-xs text-muted-foreground mt-1 max-w-2xl">
            {BENCH_QUERIES.length} occupation queries × {BENCH_BUCKETS.length} buckets ={' '}
            <strong>{totalRuns}</strong> test runs ({CREATORS_PER_QUERY} creators each).
            Each query fires both buckets in parallel — same occupation, two different fallback strategies, side-by-side roster output.
          </p>
        </div>
        <button
          onClick={runBenchmark}
          disabled={running}
          className="px-4 py-2 rounded-lg bg-gradient-to-br from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white text-sm font-semibold transition-colors shadow-sm disabled:opacity-60 disabled:cursor-wait shrink-0"
        >
          {running ? 'Running…' : 'Run benchmark'}
        </button>
      </div>

      {progress && (
        <div className="mb-4">
          <div className="flex items-center justify-between text-xs text-muted-foreground mb-1.5">
            <span>{progress.current}</span>
            <span className="tabular-nums">{progress.done}/{progress.total}</span>
          </div>
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-purple-500 to-blue-500 transition-all"
              style={{ width: `${(progress.done / progress.total) * 100}%` }}
            />
          </div>
        </div>
      )}

      {error && (
        <div className="text-xs text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900/40 rounded px-3 py-2 mb-4">
          {error}
        </div>
      )}

      {/* Aggregate scoreboard at top */}
      {rows.length > 0 && aggregates.some(a => a.runs > 0) && (
        <div className="grid grid-cols-2 gap-3 mb-6">
          {aggregates.map(a => {
            const isWinner = winner && a.id === winner.id && winner.hitRate > 0 && winner.hitRate !== aggregates[BENCH_BUCKETS.findIndex(b => b.id !== a.id)].hitRate
            return (
              <div
                key={a.id}
                className={`rounded-xl border p-4 ${
                  isWinner
                    ? 'border-emerald-300 dark:border-emerald-500/40 bg-gradient-to-br from-emerald-50 to-emerald-50/40 dark:from-emerald-500/10 dark:to-emerald-500/5'
                    : 'border-border bg-background'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="text-xs uppercase tracking-wider text-muted-foreground">{a.label}</div>
                  {isWinner && <span className="text-emerald-700 dark:text-emerald-300 text-xs">★ winner</span>}
                </div>
                <div className="flex items-baseline gap-2">
                  <div className="text-3xl font-bold tabular-nums">{a.hitRate.toFixed(1)}%</div>
                  <div className="text-xs text-muted-foreground">{a.totalEmails}/{a.totalCreators}</div>
                </div>
                <div className="text-[11px] text-muted-foreground mt-1">{a.runs}/{BENCH_QUERIES.length} queries complete</div>
              </div>
            )
          })}
          {winner && winner.runs === BENCH_QUERIES.length && margin > 0 && !running && (
            <div className="col-span-2 text-xs text-center text-muted-foreground">
              <strong className="text-emerald-700 dark:text-emerald-300">{winner.label}</strong> wins by {margin.toFixed(1)} points
            </div>
          )}
        </div>
      )}

      {/* Per-query rosters */}
      {rows.length > 0 && (
        <div className="space-y-4">
          {rows.map(row => {
            const slotA = row.results[BENCH_BUCKETS[0].id]
            const slotB = row.results[BENCH_BUCKETS[1].id]
            const anyDone = slotA || slotB
            return (
              <div key={row.query} className="rounded-lg border border-border bg-background overflow-hidden">
                <div className="flex items-center justify-between gap-3 px-4 py-2.5 bg-muted/30 border-b border-border">
                  <div className="text-sm font-semibold">{row.query}</div>
                  <div className="text-xs text-muted-foreground tabular-nums">
                    {slotA ? `${slotA.withEmail}/${slotA.total}` : '—'} <span className="text-muted-foreground/60">vs</span> {slotB ? `${slotB.withEmail}/${slotB.total}` : '—'}
                  </div>
                </div>
                {!anyDone ? (
                  <div className="px-4 py-6 text-xs text-center text-muted-foreground">
                    {running ? 'queued…' : 'not run'}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-border">
                    <RosterColumn label={BENCH_BUCKETS[0].label} slot={slotA} accent="purple" />
                    <RosterColumn label={BENCH_BUCKETS[1].label} slot={slotB} accent="fuchsia" />
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}

function RosterColumn({
  label, slot, accent,
}: {
  label: string
  slot: QueryRunSlot | null
  accent: 'purple' | 'fuchsia'
}) {
  const accentClasses = accent === 'purple'
    ? 'text-purple-700 dark:text-purple-300'
    : 'text-fuchsia-700 dark:text-fuchsia-300'

  if (!slot) {
    return (
      <div className="p-3">
        <div className={`text-[11px] uppercase tracking-wider mb-2 ${accentClasses}`}>{label}</div>
        <div className="text-xs text-muted-foreground">queued…</div>
      </div>
    )
  }
  if (slot.error) {
    return (
      <div className="p-3">
        <div className={`text-[11px] uppercase tracking-wider mb-2 ${accentClasses}`}>{label}</div>
        <div className="text-xs text-red-700 dark:text-red-400">{slot.error}</div>
      </div>
    )
  }
  return (
    <div className="p-3">
      <div className="flex items-center justify-between mb-2">
        <div className={`text-[11px] uppercase tracking-wider ${accentClasses}`}>{label}</div>
        <div className="text-[10px] text-muted-foreground tabular-nums">{slot.withEmail}/{slot.total} · {slot.hitRate.toFixed(0)}% · {(slot.tookMs / 1000).toFixed(0)}s</div>
      </div>
      {slot.roster.length === 0 ? (
        <div className="text-xs text-muted-foreground">no creators</div>
      ) : (
        <ul className="space-y-1">
          {slot.roster.map(r => (
            <li key={r.channelId} className="flex items-center justify-between gap-2 text-xs">
              <span className="truncate text-foreground">{r.channelName}</span>
              {r.hasEmail
                ? <span className="font-mono text-[10px] text-emerald-700 dark:text-emerald-400 break-all text-right shrink-0 max-w-[60%]">{r.email}</span>
                : <span className="text-muted-foreground/60 text-[10px]">—</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
