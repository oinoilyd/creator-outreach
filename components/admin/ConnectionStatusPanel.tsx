'use client'

import { useCallback, useEffect, useState } from 'react'

/**
 * ConnectionStatusPanel — live health-check grid for the admin page.
 *
 * Calls /api/admin/connection-status (admin-only) on mount + every
 * 60 seconds. Each integration shows up as a row with status pill,
 * latency, last-checked timestamp, and a fragility tag explaining
 * how breakable the integration is and what kind of failure to
 * expect.
 *
 * The fragility column is the panel's whole point (Dylan 2026-05-23):
 * when Dylan sees something flip red, the fragility tag tells him
 * what *kind* of break it is so he can notify me with the right
 * context (e.g. "IG scrape went red, looks like HTML-shape change"
 * vs "Meta Graph went red, looks like token rotation").
 */

type Status = 'ok' | 'degraded' | 'down' | 'not_configured' | 'unknown'
type Fragility = 'low' | 'medium' | 'high'

interface CheckResult {
  name: string
  id: string
  category: 'data' | 'auth' | 'ai' | 'comms' | 'queue' | 'cache' | 'db'
  status: Status
  latencyMs: number | null
  detail: string
  fragility: Fragility
  fragilityReason: string
  checkedAt: string
}

interface ApiResponse {
  checks: CheckResult[]
  generatedAt: string
}

const POLL_INTERVAL_MS = 60_000

const STATUS_STYLES: Record<Status, { bg: string; text: string; border: string; label: string }> = {
  ok: {
    bg: 'bg-emerald-500/10',
    text: 'text-emerald-700 dark:text-emerald-300',
    border: 'border-emerald-500/40',
    label: 'OK',
  },
  degraded: {
    bg: 'bg-amber-500/10',
    text: 'text-amber-700 dark:text-amber-300',
    border: 'border-amber-500/40',
    label: 'Degraded',
  },
  down: {
    bg: 'bg-rose-500/10',
    text: 'text-rose-700 dark:text-rose-300',
    border: 'border-rose-500/45',
    label: 'Down',
  },
  not_configured: {
    bg: 'bg-muted',
    text: 'text-muted-foreground',
    border: 'border-border',
    label: 'Not configured',
  },
  unknown: {
    bg: 'bg-muted',
    text: 'text-muted-foreground',
    border: 'border-border',
    label: 'Unknown',
  },
}

const FRAGILITY_STYLES: Record<Fragility, { text: string; label: string }> = {
  low: { text: 'text-emerald-600 dark:text-emerald-400', label: 'Low fragility' },
  medium: { text: 'text-amber-600 dark:text-amber-400', label: 'Med fragility' },
  high: { text: 'text-rose-600 dark:text-rose-400', label: 'High fragility' },
}

const CATEGORY_LABEL: Record<CheckResult['category'], string> = {
  data: 'Data',
  auth: 'Auth',
  ai: 'AI',
  comms: 'Comms',
  queue: 'Queue',
  cache: 'Cache',
  db: 'DB',
}

function formatLatency(ms: number | null): string {
  if (ms == null) return '—'
  if (ms < 1000) return `${ms}ms`
  return `${(ms / 1000).toFixed(2)}s`
}

function timeAgo(iso: string): string {
  const then = new Date(iso).getTime()
  const now = Date.now()
  const sec = Math.max(0, Math.round((now - then) / 1000))
  if (sec < 60) return `${sec}s ago`
  const min = Math.round(sec / 60)
  if (min < 60) return `${min}m ago`
  const hr = Math.round(min / 60)
  return `${hr}h ago`
}

export function ConnectionStatusPanel() {
  const [data, setData] = useState<ApiResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  // Tracks the local "tick" so timeAgo() re-renders every 10s without
  // requiring a fresh API fetch.
  const [, setTick] = useState(0)

  const refresh = useCallback(async () => {
    setError(null)
    try {
      const res = await fetch('/api/admin/connection-status', { cache: 'no-store' })
      if (!res.ok) {
        const text = await res.text().catch(() => '')
        throw new Error(`HTTP ${res.status}${text ? `: ${text}` : ''}`)
      }
      const json = (await res.json()) as ApiResponse
      setData(json)
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      setError(msg)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
    const interval = setInterval(refresh, POLL_INTERVAL_MS)
    return () => clearInterval(interval)
  }, [refresh])

  // 10s ticker for relative timestamps (timeAgo).
  useEffect(() => {
    const t = setInterval(() => setTick(n => n + 1), 10_000)
    return () => clearInterval(t)
  }, [])

  // Summary counters for the header strip.
  const summary = data
    ? data.checks.reduce(
        (acc, c) => {
          acc[c.status]++
          return acc
        },
        { ok: 0, degraded: 0, down: 0, not_configured: 0, unknown: 0 } as Record<Status, number>,
      )
    : null

  const anyDown = summary && (summary.down > 0 || summary.degraded > 0)

  return (
    <section className="rounded-xl border border-border bg-card overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border flex items-center gap-3 flex-wrap">
        <h2 className="text-[14px] font-semibold text-foreground">Connection status</h2>
        {summary && (
          <div className="inline-flex items-center gap-2 text-[12px]">
            <span className={`inline-flex items-center gap-1 ${anyDown ? 'text-rose-600 dark:text-rose-300' : 'text-emerald-600 dark:text-emerald-300'}`}>
              <span className={`inline-block w-2 h-2 rounded-full ${anyDown ? 'bg-rose-500' : 'bg-emerald-500'}`} />
              {anyDown
                ? `${summary.down + summary.degraded} integration${summary.down + summary.degraded === 1 ? '' : 's'} need attention`
                : 'All integrations healthy'}
            </span>
          </div>
        )}
        <button
          type="button"
          onClick={() => {
            setLoading(true)
            void refresh()
          }}
          disabled={loading}
          className="ml-auto inline-flex items-center gap-1.5 text-[12px] text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={loading ? 'animate-spin' : ''}
          >
            <path d="M21 12a9 9 0 11-3-6.7M21 4v5h-5" />
          </svg>
          {loading ? 'Checking…' : 'Refresh now'}
        </button>
      </div>

      {/* Body */}
      <div className="divide-y divide-border">
        {error && (
          <div className="px-4 py-3 text-[13px] text-rose-700 dark:text-rose-300 bg-rose-500/10">
            Failed to fetch status: {error}
          </div>
        )}

        {!error && !data && loading && (
          <div className="px-4 py-8 text-center text-[13px] text-muted-foreground">
            Running health checks…
          </div>
        )}

        {data?.checks.map(check => (
          <CheckRow key={check.id} check={check} />
        ))}
      </div>

      {/* Footer — last full refresh time */}
      {data && (
        <div className="px-4 py-2 border-t border-border bg-muted/30 text-[11px] text-muted-foreground flex items-center gap-3 flex-wrap">
          <span>Last full check: {timeAgo(data.generatedAt)}</span>
          <span className="text-muted-foreground/50">·</span>
          <span>Re-checks every 60s automatically.</span>
        </div>
      )}
    </section>
  )
}

function CheckRow({ check }: { check: CheckResult }) {
  const status = STATUS_STYLES[check.status]
  const frag = FRAGILITY_STYLES[check.fragility]
  const isProblem = check.status === 'down' || check.status === 'degraded'

  return (
    <div className="px-4 py-3 flex items-start gap-4">
      {/* Name + category */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-medium text-foreground text-[13.5px]">{check.name}</span>
          <span className="text-[10.5px] uppercase tracking-wider font-semibold text-muted-foreground/70 px-1.5 py-0.5 rounded bg-muted">
            {CATEGORY_LABEL[check.category]}
          </span>
        </div>
        {/* Detail line — green when OK, red/amber when bad */}
        <p className={`mt-1 text-[12px] leading-snug ${isProblem ? 'text-foreground' : 'text-muted-foreground'}`}>
          {check.detail}
        </p>
        {/* Fragility hint — always visible so Dylan knows what kind
            of break to expect / report */}
        <p className={`mt-1 text-[11px] leading-snug ${frag.text}`}>
          <span className="font-semibold">{frag.label}:</span>{' '}
          <span className="text-muted-foreground">{check.fragilityReason}</span>
        </p>
      </div>

      {/* Status pill + metrics */}
      <div className="flex flex-col items-end gap-1 shrink-0">
        <span
          className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md border text-[11px] font-semibold ${status.bg} ${status.text} ${status.border}`}
        >
          <span
            className={`inline-block w-1.5 h-1.5 rounded-full ${
              check.status === 'ok' ? 'bg-emerald-500' :
              check.status === 'degraded' ? 'bg-amber-500' :
              check.status === 'down' ? 'bg-rose-500' :
              'bg-muted-foreground/40'
            }`}
          />
          {status.label}
        </span>
        <div className="text-[10.5px] text-muted-foreground tabular-nums">
          {formatLatency(check.latencyMs)} · {timeAgo(check.checkedAt)}
        </div>
      </div>
    </div>
  )
}
