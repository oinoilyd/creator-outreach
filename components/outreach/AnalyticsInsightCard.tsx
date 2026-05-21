'use client'

/**
 * AnalyticsInsightCard — AI-generated weekly narrative at the top of
 * the Analytics tab. Calls /api/insights/weekly with the user's
 * already-computed metrics and renders 2-3 sentences of opinionated
 * narrative.
 *
 * Caching:
 *   Result + generatedAt + rangeLabel persist in localStorage keyed
 *   per user so we don't re-pay the LLM call on every page load.
 *   Auto-stale after 7 days; user can refresh on demand. Switching
 *   the time range invalidates the cache (new prompt → new answer).
 *
 * Failure modes:
 *   • API 401 / 429 → soft error in the card with a Retry button
 *   • Network error → same
 *   • Empty metrics (no entries) → server returns a friendly empty
 *     message without hitting the model.
 */

import { useEffect, useRef, useState } from 'react'
import { Sparkles, RefreshCw, Loader2, AlertCircle } from 'lucide-react'
import type { ComputedMetrics } from './analyticsMetrics'

interface AnalyticsInsightCardProps {
  /** Current period metrics (sent to the LLM). */
  current: ComputedMetrics
  /** Previous-period metrics for delta narrative. Optional. */
  previous?: ComputedMetrics
  /** Display label for the current range ("Last 30 days"). */
  rangeLabel: string
  /** Cache key suffix so each user gets their own cached insight. */
  cacheKey: string
}

interface CachedInsight {
  insight: string
  generatedAt: number
  rangeLabel: string
}

const STALE_MS = 7 * 24 * 60 * 60 * 1000  // 7 days

/** Pick the bits of ComputedMetrics the server actually needs.
 *  Keeps the request payload small and the server's parsing tight. */
function projectForServer(m: ComputedMetrics) {
  return {
    total: m.total,
    reachedOut: m.reachedOut,
    responseReceived: m.responseReceived,
    successful: m.successful,
    responseRate: m.responseRate,
    winRate: m.winRate,
    pipelineValue: m.pipelineValue,
    addedLast7: m.addedLast7,
    reachedLast7: m.reachedLast7,
    wonLast30: m.wonLast30,
    totalBooked: m.totalBooked,
    personalRevenue: m.personalRevenue,
    totalCollaboratorShare: m.totalCollaboratorShare,
    completedCount: m.completedCount,
    activeNow: m.activeNow,
    byMedium: m.byMedium,
  }
}

function readCache(cacheKey: string): CachedInsight | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(`creator-outreach.insight.${cacheKey}`)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<CachedInsight>
    if (!parsed || typeof parsed.insight !== 'string') return null
    if (typeof parsed.generatedAt !== 'number') return null
    return {
      insight: parsed.insight,
      generatedAt: parsed.generatedAt,
      rangeLabel: parsed.rangeLabel || '',
    }
  } catch {
    return null
  }
}

function writeCache(cacheKey: string, value: CachedInsight): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(
      `creator-outreach.insight.${cacheKey}`,
      JSON.stringify(value),
    )
  } catch {
    /* localStorage may be unavailable in private windows */
  }
}

export function AnalyticsInsightCard({
  current, previous, rangeLabel, cacheKey,
}: AnalyticsInsightCardProps) {
  const [insight, setInsight] = useState<string>('')
  const [generatedAt, setGeneratedAt] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Track the last range we generated for so a range switch can
  // invalidate cache and refetch automatically.
  const lastRangeRef = useRef<string>('')

  async function generate(): Promise<void> {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/insights/weekly', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          current: projectForServer(current),
          previous: previous ? projectForServer(previous) : undefined,
          rangeLabel,
        }),
      })
      const json = await res.json() as { insight?: string; generatedAt?: number; error?: string }
      if (!res.ok || !json.insight) {
        setError(json.error || `Failed to generate insight (HTTP ${res.status}).`)
        return
      }
      setInsight(json.insight)
      setGeneratedAt(json.generatedAt ?? Date.now())
      writeCache(cacheKey, {
        insight: json.insight,
        generatedAt: json.generatedAt ?? Date.now(),
        rangeLabel,
      })
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Network error.')
    } finally {
      setLoading(false)
    }
  }

  // Hydrate from cache on mount + auto-fetch when stale / range changed.
  useEffect(() => {
    const cached = readCache(cacheKey)
    const rangeChanged = cached?.rangeLabel !== rangeLabel
    const stale = cached && Date.now() - cached.generatedAt > STALE_MS

    if (cached && !rangeChanged && !stale) {
      setInsight(cached.insight)
      setGeneratedAt(cached.generatedAt)
      lastRangeRef.current = rangeLabel
      return
    }
    // Auto-fetch on mount/range-change, but only if entries exist.
    // The server short-circuits empty metrics with a friendly message,
    // so we don't waste a roundtrip — but we also don't auto-call on
    // every render. Range becomes part of the dep below.
    lastRangeRef.current = rangeLabel
    generate()
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [cacheKey, rangeLabel])

  const hasInsight = !!insight && !loading
  const formattedAge = generatedAt != null ? formatAge(Date.now() - generatedAt) : ''

  return (
    <div className="relative bg-gradient-to-br from-purple-500/[0.07] via-card/40 to-blue-500/[0.07] border border-border rounded-2xl p-5 overflow-hidden">
      {/* Decorative gradient blur — adds depth, anti-template */}
      <div
        className="pointer-events-none absolute -top-12 -right-12 w-48 h-48 rounded-full blur-3xl opacity-30 bg-purple-500"
        aria-hidden
      />

      <div className="relative flex items-start gap-3">
        <div className="shrink-0 w-9 h-9 rounded-lg bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center text-white shadow-md shadow-purple-500/30">
          <Sparkles className="w-4 h-4" aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2 mb-1.5 flex-wrap">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-[13.5px] font-semibold text-foreground tracking-tight">
                Weekly insight
              </h3>
              <span className="text-[10.5px] text-muted-foreground/75 bg-muted/60 px-1.5 py-0.5 rounded">
                {rangeLabel}
              </span>
              {generatedAt != null && !loading && (
                <span className="text-[10.5px] text-muted-foreground/65">
                  · {formattedAge}
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={generate}
              disabled={loading}
              aria-label="Refresh insight"
              title="Regenerate insight"
              className="text-muted-foreground hover:text-foreground disabled:opacity-50 disabled:cursor-not-allowed transition-colors p-1 rounded hover:bg-muted/40"
            >
              {loading
                ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                : <RefreshCw className="w-3.5 h-3.5" />}
            </button>
          </div>

          {error ? (
            <div className="flex items-start gap-2 text-[12.5px] text-red-700 dark:text-red-400">
              <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" aria-hidden />
              <span>{error}</span>
            </div>
          ) : loading && !hasInsight ? (
            <div className="space-y-1.5">
              <div className="h-3 bg-muted/60 rounded animate-pulse w-11/12" />
              <div className="h-3 bg-muted/60 rounded animate-pulse w-10/12" />
              <div className="h-3 bg-muted/60 rounded animate-pulse w-7/12" />
            </div>
          ) : (
            <p className="text-[13.5px] leading-relaxed text-foreground/90">
              {insight || 'Loading insight…'}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

function formatAge(ms: number): string {
  const sec = Math.round(ms / 1000)
  if (sec < 60) return 'just now'
  const min = Math.round(sec / 60)
  if (min < 60) return `${min}m ago`
  const hr = Math.round(min / 60)
  if (hr < 24) return `${hr}h ago`
  const d = Math.round(hr / 24)
  if (d < 7) return `${d}d ago`
  const w = Math.round(d / 7)
  return `${w}w ago`
}
