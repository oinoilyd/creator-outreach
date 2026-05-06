'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

// Predefined queries spanning niches that have very different email-yield
// patterns. Mix of B2B-leaning (real estate, lawyers — high baseline)
// and creator-leaning (vloggers, gaming — lower baseline) so the buckets
// get tested against a representative cross-section.
const BENCH_QUERIES = [
  'real estate agent',
  'fitness coach',
  'tech founder',
  'youtube podcaster',
  'lifestyle vlogger',
] as const

// Each bucket = a different combination of toggles. Each test in a bucket
// uses the same query so the comparison is apples-to-apples.
const BENCH_BUCKETS: { id: string; label: string; strategy: string[]; description: string }[] = [
  {
    id: 'baseline',
    label: 'Baseline (production)',
    strategy: ['web_scrape', 'biolink', 'bio_pages', 'ddg', 'wayback'],
    description: 'Current /api/enrich behavior',
  },
  {
    id: 'plus_assumption',
    label: '+ Educated assumption',
    strategy: ['web_scrape', 'biolink', 'bio_pages', 'ddg', 'wayback', 'domain_guess'],
    description: 'Adds evidence-only pattern matching for empty results',
  },
  {
    id: 'plus_methodology',
    label: '+ New methodology',
    strategy: ['web_scrape', 'biolink', 'bio_pages', 'ddg', 'wayback', 'new_methodology'],
    description: 'Adds video desc + sitemap + creator platforms + AI fallback',
  },
  {
    id: 'all_on',
    label: 'All on',
    strategy: ['web_scrape', 'biolink', 'bio_pages', 'ddg', 'wayback', 'domain_guess', 'new_methodology'],
    description: 'Both fallbacks layered',
  },
]

// 10 creators per query × 5 queries = 50 enrichments per bucket. The
// /api/admin/email-test endpoint enriches all in parallel internally,
// so each bucket-run takes ~30-60s.
const CREATORS_PER_QUERY = 10

interface RunOutcome {
  query: string
  bucketId: string
  total: number
  withEmail: number
  fromPrimary: number
  fromMethodology: number
  fromAssumption: number
  hitRate: number
  tookMs: number
  error?: string
}

interface BucketAgg {
  id: string
  label: string
  description: string
  runs: number
  totalCreators: number
  totalWithEmail: number
  totalFromPrimary: number
  totalFromMethodology: number
  totalFromAssumption: number
  hitRate: number
}

export function BenchmarkPanel() {
  const router = useRouter()
  const [running, setRunning] = useState(false)
  const [results, setResults] = useState<RunOutcome[]>([])
  const [progress, setProgress] = useState<{ done: number; total: number; current: string } | null>(null)
  const [error, setError] = useState<string | null>(null)

  const totalRuns = BENCH_QUERIES.length * BENCH_BUCKETS.length

  function aggregate(rs: RunOutcome[]): BucketAgg[] {
    const byBucket = new Map<string, BucketAgg>()
    for (const b of BENCH_BUCKETS) {
      byBucket.set(b.id, {
        id: b.id,
        label: b.label,
        description: b.description,
        runs: 0,
        totalCreators: 0,
        totalWithEmail: 0,
        totalFromPrimary: 0,
        totalFromMethodology: 0,
        totalFromAssumption: 0,
        hitRate: 0,
      })
    }
    for (const r of rs) {
      const acc = byBucket.get(r.bucketId)
      if (!acc || r.error) continue
      acc.runs += 1
      acc.totalCreators += r.total
      acc.totalWithEmail += r.withEmail
      acc.totalFromPrimary += r.fromPrimary
      acc.totalFromMethodology += r.fromMethodology
      acc.totalFromAssumption += r.fromAssumption
    }
    const out = [...byBucket.values()]
    for (const a of out) {
      a.hitRate = a.totalCreators > 0 ? (a.totalWithEmail / a.totalCreators) * 100 : 0
    }
    return out.sort((a, b) => b.hitRate - a.hitRate)
  }

  async function runBenchmark() {
    if (running) return
    setRunning(true)
    setResults([])
    setError(null)
    const benchmarkId = `bench-${Date.now()}`
    const collected: RunOutcome[] = []

    let completed = 0
    try {
      for (const query of BENCH_QUERIES) {
        for (const bucket of BENCH_BUCKETS) {
          setProgress({
            done: completed,
            total: totalRuns,
            current: `${query} → ${bucket.label}`,
          })
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
              collected.push({
                query,
                bucketId: bucket.id,
                total: 0, withEmail: 0,
                fromPrimary: 0, fromMethodology: 0, fromAssumption: 0,
                hitRate: 0, tookMs: 0,
                error: data.error || `status ${resp.status}`,
              })
            } else {
              collected.push({
                query,
                bucketId: bucket.id,
                total: data.total ?? 0,
                withEmail: data.withEmail ?? 0,
                fromPrimary: data.fromPrimary ?? 0,
                fromMethodology: data.fromMethodology ?? 0,
                fromAssumption: data.fromAssumption ?? 0,
                hitRate: data.hitRate ?? 0,
                tookMs: data.tookMs ?? 0,
              })
            }
          } catch (e) {
            collected.push({
              query,
              bucketId: bucket.id,
              total: 0, withEmail: 0,
              fromPrimary: 0, fromMethodology: 0, fromAssumption: 0,
              hitRate: 0, tookMs: 0,
              error: (e as Error).message,
            })
          }
          completed += 1
          setResults([...collected])
          // small jitter so we don't hammer DDG too fast across iterations
          await new Promise(r => setTimeout(r, 800))
        }
      }
      router.refresh()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setRunning(false)
      setProgress(null)
    }
  }

  const agg = aggregate(results)
  const winner = agg[0]
  const hasResults = results.length > 0

  return (
    <section className="rounded-xl border border-border bg-card p-5 mt-6">
      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          <h2 className="text-lg font-semibold tracking-tight flex items-center gap-2">
            🏁 Benchmark
          </h2>
          <p className="text-xs text-muted-foreground mt-1 max-w-2xl">
            Runs {BENCH_QUERIES.length} queries × {BENCH_BUCKETS.length} strategy buckets ={' '}
            <strong>{totalRuns}</strong> separate test runs ({CREATORS_PER_QUERY} creators each ={' '}
            <strong>{CREATORS_PER_QUERY * BENCH_QUERIES.length}</strong> creators per bucket).
            Same queries hit every bucket so the comparison is apples-to-apples.
            Expect ~10-15 min wall-clock — don't close the tab.
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

      {hasResults && (
        <>
          <div className="mb-3">
            <h3 className="text-sm font-semibold mb-2">Bucket leaderboard</h3>
            <div className="rounded-lg border border-border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-muted-foreground text-xs uppercase tracking-wider">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium">Bucket</th>
                    <th className="px-3 py-2 text-right font-medium">Runs</th>
                    <th className="px-3 py-2 text-right font-medium">Creators</th>
                    <th className="px-3 py-2 text-right font-medium">w/ Email</th>
                    <th className="px-3 py-2 text-right font-medium">From primary</th>
                    <th className="px-3 py-2 text-right font-medium">+ method</th>
                    <th className="px-3 py-2 text-right font-medium">+ assumption</th>
                    <th className="px-3 py-2 text-right font-medium">Hit rate</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {agg.map((b, i) => (
                    <tr
                      key={b.id}
                      className={i === 0 && b.runs > 0
                        ? 'bg-gradient-to-r from-emerald-50/60 to-emerald-50/30 dark:from-emerald-500/10 dark:to-emerald-500/5'
                        : ''}
                    >
                      <td className="px-3 py-2.5">
                        <div className="font-medium flex items-center gap-1.5">
                          {i === 0 && b.runs > 0 && <span className="text-emerald-700 dark:text-emerald-300">★</span>}
                          {b.label}
                        </div>
                        <div className="text-[10px] text-muted-foreground">{b.description}</div>
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-muted-foreground">{b.runs}/{BENCH_QUERIES.length}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums">{b.totalCreators}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums">{b.totalWithEmail}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-muted-foreground">{b.totalFromPrimary}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-fuchsia-700 dark:text-fuchsia-300">+{b.totalFromMethodology}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-purple-700 dark:text-purple-300">+{b.totalFromAssumption}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums font-bold">{b.hitRate.toFixed(1)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {winner && winner.runs === BENCH_QUERIES.length && !running && (
              <div className="text-xs text-muted-foreground mt-2">
                Winner: <strong className="text-emerald-700 dark:text-emerald-300">{winner.label}</strong> at {winner.hitRate.toFixed(1)}% hit rate
                {agg[1] && (
                  <> — beats <strong>{agg[1].label}</strong> by {(winner.hitRate - agg[1].hitRate).toFixed(1)} points</>
                )}
              </div>
            )}
          </div>

          <details className="mt-4">
            <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground transition-colors">
              Per-query breakdown ({results.length} runs)
            </summary>
            <div className="mt-3 rounded-lg border border-border overflow-hidden">
              <table className="w-full text-xs">
                <thead className="bg-muted/50 text-muted-foreground text-[10px] uppercase tracking-wider">
                  <tr>
                    <th className="px-3 py-1.5 text-left font-medium">Query</th>
                    <th className="px-3 py-1.5 text-left font-medium">Bucket</th>
                    <th className="px-3 py-1.5 text-right font-medium">Total</th>
                    <th className="px-3 py-1.5 text-right font-medium">w/ Email</th>
                    <th className="px-3 py-1.5 text-right font-medium">Hit rate</th>
                    <th className="px-3 py-1.5 text-right font-medium">Took</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {results.map((r, i) => {
                    const bucket = BENCH_BUCKETS.find(b => b.id === r.bucketId)
                    return (
                      <tr key={i} className={r.error ? 'bg-red-50/40 dark:bg-red-500/5' : ''}>
                        <td className="px-3 py-1.5">{r.query}</td>
                        <td className="px-3 py-1.5 text-muted-foreground">{bucket?.label ?? r.bucketId}</td>
                        <td className="px-3 py-1.5 text-right tabular-nums">{r.total}</td>
                        <td className="px-3 py-1.5 text-right tabular-nums">{r.withEmail}</td>
                        <td className="px-3 py-1.5 text-right tabular-nums">{r.error ? '—' : `${r.hitRate.toFixed(1)}%`}</td>
                        <td className="px-3 py-1.5 text-right tabular-nums text-muted-foreground">{r.error ?? `${(r.tookMs / 1000).toFixed(1)}s`}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </details>
        </>
      )}
    </section>
  )
}
