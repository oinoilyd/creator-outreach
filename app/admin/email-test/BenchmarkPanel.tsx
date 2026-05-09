'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

// Default mix of occupations spanning B2B-leaning, creator-leaning, and
// skill niches so the average isn't dominated by one type. Editable
// from the UI — Dylan can swap any of these out for a different set
// to verify the methodology across whatever occupations he's curious
// about.
const DEFAULT_QUERIES = [
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
]

// Curated presets so Dylan can flip between mixes without retyping.
const QUERY_PRESETS: { id: string; label: string; queries: string[] }[] = [
  {
    id: 'default',
    label: 'Default mix',
    queries: DEFAULT_QUERIES,
  },
  {
    id: 'b2b',
    label: 'B2B-leaning',
    queries: [
      'real estate agent', 'mortgage broker', 'financial advisor',
      'business coach', 'sales trainer', 'tech founder',
      'recruiter', 'lawyer', 'accountant', 'marketing consultant',
    ],
  },
  {
    id: 'creator',
    label: 'Creator-leaning',
    queries: [
      'lifestyle vlogger', 'beauty influencer', 'gaming creator',
      'comedy creator', 'fashion influencer', 'food blogger',
      'travel vlogger', 'mom blogger', 'fitness influencer',
      'lifestyle creator',
    ],
  },
  {
    id: 'fitness',
    label: 'Fitness niche',
    queries: [
      'fitness coach', 'personal trainer', 'yoga instructor',
      'crossfit coach', 'powerlifting coach', 'nutritionist',
      'wellness coach', 'physical therapist',
    ],
  },
  {
    id: 'tech',
    label: 'Tech niche',
    queries: [
      'tech founder', 'software engineer', 'developer advocate',
      'AI founder', 'SaaS founder', 'data scientist',
      'cybersecurity expert', 'startup CEO',
    ],
  },
]

// Two buckets head-to-head: what the live site currently does for email
// pulling vs what it would do with the new methodology layered on top.
//
// "Current methodology" = exactly what production /api/enrich runs today
// (web scrape, biolink, bio pages, DDG, wayback). No admin-only fallbacks.
//
// "New methodology" = same primary pipeline + the new methodology bundle
// for empty results (recent video desc, sitemap, creator platforms,
// JSON-LD, multi-TLD, cert transparency, multi-snapshot wayback,
// AI extraction, AI vision on banner).
const BENCH_BUCKETS = [
  {
    id: 'current',
    label: 'Current methodology',
    strategy: ['web_scrape', 'biolink', 'bio_pages', 'ddg', 'wayback'],
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
  linkedin?: string
  instagram?: string
  twitter?: string
  tiktok?: string
  website?: string
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
  const [queries, setQueries] = useState<string[]>(DEFAULT_QUERIES)
  const [queriesText, setQueriesText] = useState(DEFAULT_QUERIES.join('\n'))
  const [editingQueries, setEditingQueries] = useState(false)

  const totalRuns = queries.length * BENCH_BUCKETS.length

  function applyQueriesText(raw: string) {
    const parsed = raw
      .split('\n')
      .map(s => s.trim())
      .filter(Boolean)
      .slice(0, 30) // hard cap to keep wall-clock manageable
    setQueries(parsed)
    setQueriesText(parsed.join('\n'))
  }

  function loadPreset(presetId: string) {
    const preset = QUERY_PRESETS.find(p => p.id === presetId)
    if (!preset) return
    setQueries(preset.queries)
    setQueriesText(preset.queries.join('\n'))
  }

  function blankRows(): QueryRow[] {
    return queries.map(q => ({
      query: q,
      results: Object.fromEntries(BENCH_BUCKETS.map(b => [b.id, null])) as Record<BucketId, QueryRunSlot | null>,
    }))
  }

  async function runOne(query: string, bucket: typeof BENCH_BUCKETS[number], benchmarkId: string): Promise<QueryRunSlot> {
    // Abort any single bucket-run that hangs longer than this. Without
    // a client-side timeout, a Vercel function that exceeds its server
    // timeout can leave the fetch pending forever, freezing the loop
    // on the offending occupation.
    const controller = new AbortController()
    const abortTimer = setTimeout(() => controller.abort(), 120_000) // 2 min

    try {
      const resp = await fetch('/api/admin/email-test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
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
          linkedin: r.linkedin,
          instagram: r.instagram,
          twitter: r.twitter,
          tiktok: r.tiktok,
          website: r.website,
        })),
      }
    } catch (e) {
      const err = e as Error
      const message = err.name === 'AbortError'
        ? 'timed out after 2 min'
        : err.message
      return {
        bucketId: bucket.id,
        total: 0, withEmail: 0, hitRate: 0, tookMs: 0,
        roster: [],
        error: message,
      }
    } finally {
      clearTimeout(abortTimer)
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
      for (let i = 0; i < queries.length; i++) {
        const query = queries[i]
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

  // Aggregate across queries — including per-platform success rates.
  const aggregates = BENCH_BUCKETS.map(b => {
    let totalCreators = 0
    let totalEmails = 0
    let totalLinkedIn = 0
    let totalInstagram = 0
    let totalTwitter = 0
    let totalTiktok = 0
    let totalWebsite = 0
    let runs = 0
    for (const row of rows) {
      const slot = row.results[b.id]
      if (slot && !slot.error) {
        totalCreators += slot.total
        totalEmails += slot.withEmail
        for (const r of slot.roster) {
          if (r.linkedin) totalLinkedIn += 1
          if (r.instagram) totalInstagram += 1
          if (r.twitter) totalTwitter += 1
          if (r.tiktok) totalTiktok += 1
          if (r.website) totalWebsite += 1
        }
        runs += 1
      }
    }
    const pct = (n: number) => totalCreators > 0 ? (n / totalCreators) * 100 : 0
    return {
      ...b,
      totalCreators, totalEmails, runs,
      hitRate: pct(totalEmails),
      linkedinRate: pct(totalLinkedIn),
      instagramRate: pct(totalInstagram),
      twitterRate: pct(totalTwitter),
      tiktokRate: pct(totalTiktok),
      websiteRate: pct(totalWebsite),
      totalLinkedIn, totalInstagram, totalTwitter, totalTiktok, totalWebsite,
    }
  })
  const winner = [...aggregates].sort((a, b) => b.hitRate - a.hitRate)[0]
  const margin = aggregates.length === 2 ? Math.abs(aggregates[0].hitRate - aggregates[1].hitRate) : 0

  return (
    <section className="rounded-xl border border-border bg-card p-5 mt-6">
      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">🏁 Benchmark — Current methodology vs New methodology</h2>
          <p className="text-xs text-muted-foreground mt-1 max-w-2xl">
            {queries.length} occupation queries × {BENCH_BUCKETS.length} buckets ={' '}
            <strong>{totalRuns}</strong> test runs ({CREATORS_PER_QUERY} creators each).
            Current methodology = what the live site pulls today. New methodology = same pipeline + the new fallback layer. Both buckets fire in parallel per query so the comparison is apples-to-apples.
          </p>
        </div>
        <button
          onClick={runBenchmark}
          disabled={running || queries.length === 0}
          className="px-4 py-2 rounded-lg bg-gradient-to-br from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-foreground text-sm font-semibold transition-colors shadow-sm disabled:opacity-60 disabled:cursor-wait shrink-0"
        >
          {running ? 'Running…' : 'Run benchmark'}
        </button>
      </div>

      {/* Query editor — collapsed by default, expand to swap in different occupations */}
      <div className="mb-4 rounded-lg border border-border bg-background/50">
        <button
          onClick={() => setEditingQueries(v => !v)}
          className="w-full flex items-center justify-between gap-3 px-4 py-2.5 text-left hover:bg-muted/30 transition-colors rounded-lg"
        >
          <div className="text-sm">
            <span className="font-medium">Occupations</span>
            <span className="text-muted-foreground ml-2">({queries.length})</span>
          </div>
          <div className="flex items-center gap-2 flex-1 min-w-0 ml-3">
            <div className="text-[11px] text-muted-foreground truncate">
              {queries.slice(0, 5).join(' · ')}
              {queries.length > 5 && ` · +${queries.length - 5} more`}
            </div>
          </div>
          <span className="text-muted-foreground text-xs shrink-0">{editingQueries ? '✕ close' : 'edit'}</span>
        </button>

        {editingQueries && (
          <div className="px-4 pb-4 pt-1 space-y-3">
            <div className="flex flex-wrap gap-1.5">
              {QUERY_PRESETS.map(p => (
                <button
                  key={p.id}
                  onClick={() => loadPreset(p.id)}
                  className="text-[11px] px-2.5 py-1 rounded border border-border text-muted-foreground hover:text-foreground hover:border-border/80 transition-colors"
                >
                  {p.label}
                </button>
              ))}
              <button
                onClick={() => {
                  setQueries(DEFAULT_QUERIES)
                  setQueriesText(DEFAULT_QUERIES.join('\n'))
                }}
                className="text-[11px] px-2.5 py-1 rounded border border-border text-muted-foreground hover:text-foreground hover:border-border/80 transition-colors"
              >
                ↺ Reset
              </button>
            </div>

            <textarea
              value={queriesText}
              onChange={e => setQueriesText(e.target.value)}
              onBlur={() => applyQueriesText(queriesText)}
              rows={Math.min(14, Math.max(6, queriesText.split('\n').length))}
              spellCheck={false}
              className="w-full px-3 py-2 rounded-lg bg-background border border-border focus:outline-none focus:border-purple-500 text-sm font-mono"
              placeholder="One occupation per line, e.g. fitness coach"
            />

            <div className="flex items-center justify-between text-[11px] text-muted-foreground">
              <span>One per line · max 30 · trailing whitespace ignored</span>
              <button
                onClick={() => applyQueriesText(queriesText)}
                className="px-2 py-1 rounded border border-border hover:bg-muted/50 transition-colors"
              >
                Apply
              </button>
            </div>
          </div>
        )}
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
                <div className="flex items-baseline gap-2 mb-3">
                  <div className="text-3xl font-bold tabular-nums">{a.hitRate.toFixed(1)}%</div>
                  <div className="text-xs text-muted-foreground">email · {a.totalEmails}/{a.totalCreators}</div>
                </div>
                <div className="grid grid-cols-5 gap-2 pt-3 border-t border-border">
                  <PlatformStat label="LinkedIn" rate={a.linkedinRate} count={a.totalLinkedIn} />
                  <PlatformStat label="Instagram" rate={a.instagramRate} count={a.totalInstagram} />
                  <PlatformStat label="Twitter" rate={a.twitterRate} count={a.totalTwitter} />
                  <PlatformStat label="TikTok" rate={a.tiktokRate} count={a.totalTiktok} />
                  <PlatformStat label="Website" rate={a.websiteRate} count={a.totalWebsite} />
                </div>
                <div className="text-[11px] text-muted-foreground mt-3">{a.runs}/{queries.length} queries complete</div>
              </div>
            )
          })}
          {winner && winner.runs === queries.length && margin > 0 && !running && (
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
                    <RosterColumn label={BENCH_BUCKETS[0].label} slot={slotA} accent="blue" />
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

function PlatformStat({ label, rate, count }: { label: string; rate: number; count: number }) {
  return (
    <div>
      <div className="text-[9px] uppercase tracking-wider text-muted-foreground mb-0.5">{label}</div>
      <div className="text-sm font-semibold tabular-nums">{rate.toFixed(0)}%</div>
      <div className="text-[9px] text-muted-foreground tabular-nums">{count}</div>
    </div>
  )
}

function RosterColumn({
  label, slot, accent,
}: {
  label: string
  slot: QueryRunSlot | null
  accent: 'blue' | 'fuchsia'
}) {
  const accentClasses = accent === 'blue'
    ? 'text-blue-700 dark:text-blue-300'
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
        <>
          {(() => {
            const fromPrimary = slot.roster.filter(r => r.source === 'primary').length
            const fromMethod = slot.roster.filter(r => r.source === 'new_methodology').length
            const fromAssumption = slot.roster.filter(r => r.source === 'educated_assumption').length
            const fallbackTotal = fromMethod + fromAssumption
            const liCount = slot.roster.filter(r => r.linkedin).length
            const igCount = slot.roster.filter(r => r.instagram).length
            const twCount = slot.roster.filter(r => r.twitter).length
            const ttCount = slot.roster.filter(r => r.tiktok).length
            return (
              <>
                <div className="text-[10px] text-muted-foreground mb-1 flex items-center gap-2 flex-wrap">
                  <span>primary: <span className="text-foreground tabular-nums">{fromPrimary}</span></span>
                  {fromMethod > 0 && <span className="text-fuchsia-700 dark:text-fuchsia-300">+method: {fromMethod}</span>}
                  {fromAssumption > 0 && <span className="text-purple-700 dark:text-purple-300">+assumption: {fromAssumption}</span>}
                  {fallbackTotal === 0 && slot.withEmail > 0 && <span className="text-muted-foreground/70">(fallback added 0)</span>}
                </div>
                <div className="text-[10px] text-muted-foreground mb-2 flex items-center gap-2 flex-wrap">
                  <span>LI: <span className="tabular-nums">{liCount}</span></span>
                  <span>IG: <span className="tabular-nums">{igCount}</span></span>
                  <span>TW: <span className="tabular-nums">{twCount}</span></span>
                  <span>TT: <span className="tabular-nums">{ttCount}</span></span>
                </div>
              </>
            )
          })()}
          <ul className="space-y-1">
            {slot.roster.map(r => (
              <li key={r.channelId} className="flex items-center justify-between gap-2 text-xs">
                <span className="truncate text-foreground flex items-center gap-1.5 min-w-0">
                  {r.source === 'primary' && (
                    <span className="text-[8px] uppercase px-1 py-px rounded bg-blue-100 dark:bg-blue-500/10 text-blue-700 dark:text-blue-300 shrink-0">P</span>
                  )}
                  {r.source === 'new_methodology' && (
                    <span className="text-[8px] uppercase px-1 py-px rounded bg-fuchsia-100 dark:bg-fuchsia-500/10 text-fuchsia-700 dark:text-fuchsia-300 shrink-0" title="new methodology">N</span>
                  )}
                  {r.source === 'educated_assumption' && (
                    <span className="text-[8px] uppercase px-1 py-px rounded bg-purple-100 dark:bg-purple-500/10 text-purple-700 dark:text-purple-300 shrink-0" title="educated assumption">A</span>
                  )}
                  {!r.source && (
                    <span className="text-[8px] uppercase px-1 py-px rounded bg-muted text-muted-foreground shrink-0">·</span>
                  )}
                  <span className="truncate">{r.channelName}</span>
                </span>
                {r.hasEmail
                  ? <span className="font-mono text-[10px] text-emerald-700 dark:text-emerald-400 break-all text-right shrink-0 max-w-[55%]">{r.email}</span>
                  : <span className="text-muted-foreground/60 text-[10px]">—</span>}
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  )
}
