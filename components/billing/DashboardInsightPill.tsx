'use client'

/**
 * DashboardInsightPill — small sparkle + one-line insight in the
 * top header. Distinct from the larger AnalyticsInsightCard on the
 * Analytics tab; this one is always visible (when entries exist) and
 * gives a punchy "what's actionable right now" heads-up.
 *
 * Click the pill → popover with the full sentence + refresh button
 * + dismiss.
 *
 * Visibility:
 *   • Desktop (md+): pill with sparkle icon + truncated text
 *   • Mobile (< md): hidden entirely. The header is tight on phones
 *     and the analytics insight already lives on the Analytics tab.
 *
 * Caching:
 *   localStorage, keyed per user. Stale after 24h; user can refresh
 *   via the button in the popover.
 */

import { useEffect, useRef, useState } from 'react'
import { Sparkles, RefreshCw, Loader2, AlertCircle, X as XIcon } from 'lucide-react'
import type { OutreachEntry } from '@/lib/types'

const STALE_MS = 24 * 60 * 60 * 1000  // 24 hours

interface CachedDashboardInsight {
  insight: string
  generatedAt: number
  /** Monotonic refresh counter persisted so successive manual
   *  refreshes rotate through different prompt facets server-side
   *  rather than re-asking with the same context (which produces
   *  paraphrased duplicates). */
  refreshIndex?: number
}

/** Reduce an OutreachEntry[] to the smallest payload the dashboard
 *  endpoint needs. Keeps the request body tiny. */
function projectMetrics(entries: OutreachEntry[]) {
  const isReachedOut = (e: OutreachEntry) => e.status !== 'Not Outreached' && e.status !== ''
  const total = entries.length
  const reachedOut = entries.filter(isReachedOut).length
  const successful = entries.filter(e => e.status === 'Successful').length
  const rejected = entries.filter(e => e.status === 'Rejected').length
  const open = entries.filter(e => e.status === 'Open').length
  const noResponse = entries.filter(e => e.status === 'No Response').length
  const notOutreached = entries.filter(e => e.status === 'Not Outreached' || e.status === '').length
  const responseReceived = successful + rejected
  const responseRate = reachedOut > 0 ? Math.round((responseReceived / reachedOut) * 100) : 0
  const winRate = responseReceived > 0 ? Math.round((successful / responseReceived) * 100) : 0

  const pipelineValue = entries
    .filter(e => e.status !== 'Rejected')
    .reduce((sum, e) => {
      const n = parseFloat(String(e.dealValue || '').replace(/[^0-9.\-]/g, ''))
      return sum + (Number.isFinite(n) ? n : 0)
    }, 0)

  const today = new Date(); today.setHours(0, 0, 0, 0)
  const stale = entries.filter(e => {
    if (!e.followUpDate || e.status !== 'Open') return false
    const t = new Date(e.followUpDate).getTime()
    return Number.isFinite(t) && t < today.getTime()
  }).length

  const SEVEN_D_AGO = Date.now() - 7 * 24 * 60 * 60 * 1000
  const THIRTY_D_AGO = Date.now() - 30 * 24 * 60 * 60 * 1000
  const addedLast7 = entries.filter(e => e.addedAt > SEVEN_D_AGO).length
  const reachedLast7 = entries.filter(e => {
    if (!e.dateReachedOut) return false
    const t = new Date(e.dateReachedOut).getTime()
    return Number.isFinite(t) && t > SEVEN_D_AGO
  }).length
  const wonLast30 = entries.filter(e => {
    if (e.status !== 'Successful' || !e.responseDate) return false
    const t = new Date(e.responseDate).getTime()
    return Number.isFinite(t) && t > THIRTY_D_AGO
  }).length

  const activeClients = entries.filter(e => e.status === 'Successful')
  const activeNow = activeClients.filter(e => (e.clientLifecycle ?? 'active') === 'active').length
  const withBudget = activeClients.filter(e => typeof e.clientBudgetAmount === 'number' && e.clientBudgetAmount! > 0)
  const totalBooked = withBudget.reduce((s, e) => s + (e.clientBudgetAmount || 0), 0)

  // Mimic the analytics resolveCollaboratorShare — but we don't need
  // exact dollar precision for a one-line insight, so we treat any
  // collaborator shares as dollar amounts (the common case) and
  // subtract them.
  let totalCollabShare = 0
  for (const e of activeClients) {
    const team = e.clientCollaborators ?? []
    for (const c of team) {
      if (c.shareType === 'percent') {
        totalCollabShare += ((e.clientBudgetAmount || 0) * (c.share || 0)) / 100
      } else {
        totalCollabShare += c.share || 0
      }
    }
  }
  const personalRevenue = Math.max(0, totalBooked - totalCollabShare)

  const byMedium = {
    Email:    { reached: 0, won: 0 },
    LinkedIn: { reached: 0, won: 0 },
    Other:    { reached: 0, won: 0 },
  }
  for (const e of entries) {
    if (!isReachedOut(e)) continue
    const med: 'Email' | 'LinkedIn' | 'Other' =
      (e.medium === 'Email' || e.medium === 'LinkedIn') ? e.medium : 'Other'
    byMedium[med].reached += 1
    if (e.status === 'Successful') byMedium[med].won += 1
  }

  return {
    total, reachedOut, responseReceived, successful, rejected, open, noResponse, notOutreached,
    responseRate, winRate, pipelineValue, stale,
    addedLast7, reachedLast7, wonLast30,
    activeNow, totalBooked, personalRevenue,
    byMedium,
  }
}

function readCache(uid: string): CachedDashboardInsight | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(`creator-outreach.dashboard-insight.${uid}`)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<CachedDashboardInsight>
    if (!parsed || typeof parsed.insight !== 'string' || typeof parsed.generatedAt !== 'number') {
      return null
    }
    return {
      insight: parsed.insight,
      generatedAt: parsed.generatedAt,
      refreshIndex: typeof parsed.refreshIndex === 'number' ? parsed.refreshIndex : 0,
    }
  } catch {
    return null
  }
}

function writeCache(uid: string, value: CachedDashboardInsight): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(
      `creator-outreach.dashboard-insight.${uid}`,
      JSON.stringify(value),
    )
  } catch { /* localStorage unavailable */ }
}

export function DashboardInsightPill({
  entries, userId,
}: {
  entries: OutreachEntry[]
  /** Used as the localStorage cache key suffix so each user's
   *  insight stays separate on shared machines. */
  userId: string
}) {
  const [insight, setInsight] = useState<string>('')
  const [generatedAt, setGeneratedAt] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [open, setOpen] = useState(false)
  const popoverRef = useRef<HTMLDivElement>(null)
  // Server-side facet rotation needs to know which refresh we're on.
  // Ref instead of state because we don't need a re-render when it
  // bumps — only the next API call cares.
  const refreshIndexRef = useRef<number>(0)
  // Holds the last-rendered insight so the refresh path can pass it
  // back to the server as "don't repeat this." Mirrors what's in
  // state/cache but synchronously accessible inside async fetches.
  const lastInsightRef = useRef<string>('')

  // Click-outside / Escape close behavior for the popover.
  useEffect(() => {
    if (!open) return
    function onClick(ev: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(ev.target as Node)) {
        setOpen(false)
      }
    }
    function onKey(ev: KeyboardEvent) {
      if (ev.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const earliestEntryMs = (() => {
    if (entries.length === 0) return null
    let min = Infinity
    for (const e of entries) { if (e.addedAt && e.addedAt < min) min = e.addedAt }
    return Number.isFinite(min) ? min : null
  })()
  const daysSinceFirstEntry = earliestEntryMs != null
    ? Math.floor((Date.now() - earliestEntryMs) / (24 * 60 * 60 * 1000))
    : null

  async function generate(): Promise<void> {
    setLoading(true)
    setError(null)
    try {
      // Pull recent searches captured by the search runner. Optional —
      // empty array is fine. Cap at 5 most recent.
      let recentSearches: string[] = []
      try {
        const raw = window.localStorage.getItem('creator-outreach.recentSearches')
        if (raw) {
          const parsed = JSON.parse(raw)
          if (Array.isArray(parsed)) {
            recentSearches = parsed.filter((v): v is string => typeof v === 'string').slice(0, 5)
          }
        }
      } catch { /* ignore */ }

      const res = await fetch('/api/insights/dashboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          metrics: projectMetrics(entries),
          recentSearches,
          daysSinceFirstEntry,
          // Server uses these to (a) tell Claude what NOT to repeat
          // and (b) rotate which facet to lean into across refreshes.
          previousInsight: lastInsightRef.current || undefined,
          refreshIndex: refreshIndexRef.current,
        }),
      })
      const json = await res.json() as { insight?: string; generatedAt?: number; error?: string }
      if (!res.ok || !json.insight) {
        setError(json.error || `Failed (HTTP ${res.status})`)
        return
      }
      setInsight(json.insight)
      setGeneratedAt(json.generatedAt ?? Date.now())
      lastInsightRef.current = json.insight
      // Bump rotation for the NEXT refresh so we don't land on the
      // same facet twice in a row.
      const nextIndex = refreshIndexRef.current + 1
      refreshIndexRef.current = nextIndex
      writeCache(userId, {
        insight: json.insight,
        generatedAt: json.generatedAt ?? Date.now(),
        refreshIndex: nextIndex,
      })
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Network error')
    } finally {
      setLoading(false)
    }
  }

  // Hydrate from cache on mount; auto-fetch when stale or first run.
  useEffect(() => {
    if (entries.length === 0) {
      // No data → use a deterministic empty-state, no LLM call.
      setInsight('Start by running a search on the Results tab to find creators in your niche.')
      setGeneratedAt(Date.now())
      lastInsightRef.current = ''
      refreshIndexRef.current = 0
      return
    }
    const cached = readCache(userId)
    const stale = cached && Date.now() - cached.generatedAt > STALE_MS
    if (cached && !stale) {
      setInsight(cached.insight)
      setGeneratedAt(cached.generatedAt)
      // Persist rotation + last-insight across page reloads so the
      // server keeps cycling facets even after a hard refresh.
      lastInsightRef.current = cached.insight
      refreshIndexRef.current = cached.refreshIndex ?? 0
      return
    }
    void generate()
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [userId, entries.length])

  // Truncate the visible pill text so it doesn't push the upgrade
  // button off-screen. The full text is in the popover.
  const pillText = (() => {
    if (loading && !insight) return 'Generating…'
    if (error) return 'Insight unavailable'
    return insight || 'Loading…'
  })()

  const formattedAge = generatedAt != null ? formatAge(Date.now() - generatedAt) : ''

  return (
    <div ref={popoverRef} className="relative hidden md:block">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        aria-label="Open insight"
        aria-expanded={open}
        className={[
          'inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-[12px] font-medium transition-colors max-w-[260px] overflow-hidden',
          open
            ? 'border-purple-500/40 bg-purple-500/10 text-purple-700 dark:text-purple-300'
            : 'border-border bg-card text-muted-foreground hover:text-foreground hover:border-border/80',
        ].join(' ')}
      >
        <Sparkles className="w-3.5 h-3.5 shrink-0 text-purple-500" aria-hidden />
        <span className="truncate whitespace-nowrap">{pillText}</span>
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 bg-card border border-border rounded-xl shadow-2xl shadow-black/30 z-40 overflow-hidden">
          {/* Header */}
          <div className="px-4 pt-3.5 pb-2.5 border-b border-border flex items-start gap-2">
            <div className="shrink-0 w-7 h-7 rounded-md bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center text-white shadow-sm shadow-purple-500/30">
              <Sparkles className="w-3.5 h-3.5" aria-hidden />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[12.5px] font-semibold text-foreground">Heads-up</div>
              <div className="text-[10.5px] text-muted-foreground/75">
                {generatedAt != null ? `Updated ${formattedAge}` : 'Loading…'}
              </div>
            </div>
            <button
              type="button"
              onClick={generate}
              disabled={loading}
              aria-label="Refresh"
              title="Regenerate"
              className="text-muted-foreground hover:text-foreground disabled:opacity-50 disabled:cursor-not-allowed transition-colors p-1 rounded hover:bg-muted/40"
            >
              {loading
                ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                : <RefreshCw className="w-3.5 h-3.5" />}
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close"
              className="text-muted-foreground hover:text-foreground p-1 rounded hover:bg-muted/40 transition-colors"
            >
              <XIcon className="w-3.5 h-3.5" />
            </button>
          </div>
          {/* Body */}
          <div className="px-4 py-3.5">
            {error ? (
              <div className="flex items-start gap-2 text-[12.5px] text-red-700 dark:text-red-400">
                <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" aria-hidden />
                <span>{error}</span>
              </div>
            ) : loading && !insight ? (
              <div className="space-y-1.5">
                <div className="h-3 bg-muted/60 rounded animate-pulse w-11/12" />
                <div className="h-3 bg-muted/60 rounded animate-pulse w-8/12" />
              </div>
            ) : (
              <p className="text-[13px] leading-relaxed text-foreground/90">
                {insight}
              </p>
            )}
          </div>
        </div>
      )}
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
  return `${Math.round(d / 7)}w ago`
}
