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
import type { OutreachEntry, UserProfile } from '@/lib/types'

const STALE_MS = 24 * 60 * 60 * 1000  // 24 hours

interface CachedDashboardInsight {
  /** Five insights generated together — each tied to a different
   *  facet of the user's data. Cycling through them on refresh
   *  surfaces materially different framings, not paraphrases. */
  insights: string[]
  /** Index of the currently-visible insight in the array. */
  index: number
  generatedAt: number
}

/**
 * Build the cross-tab metrics payload the dashboard endpoint uses.
 * Pulls signal from EVERY tab + sub-tab in the app so Claude can
 * produce 5 genuinely different insights — one per surface — rather
 * than 5 rewordings of the same outreach observation.
 *
 * Tabs the payload covers:
 *   • Results       — currentResultsCount, recentSearchCount
 *   • Dismissed     — dismissedCount, dismissalRatio
 *   • Outreach > Pipeline   — total / status mix / pipeline $ / by-medium
 *   • Outreach > Follow-ups — overdue + due-today + due-this-week
 *   • Outreach > Active Clients — count / lifecycle / quality / repeats / budget
 *   • Outreach > Analytics  — addedLast7 / reachedLast7 / wonLast30 / conversion
 *   • Profile / Settings    — workflow setup completeness flags
 */
function projectMetrics(input: {
  entries: OutreachEntry[]
  resultsCount: number
  dismissedCount: number
  profile: UserProfile | null
}) {
  const { entries, resultsCount, dismissedCount, profile } = input
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

  // ── Follow-up queue specifics (drives the Follow-ups sub-tab) ──
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const todayMs = today.getTime()
  const sevenDaysOut = todayMs + 7 * 24 * 60 * 60 * 1000

  const followupOverdue = entries.filter(e => {
    if (!e.followUpDate || e.status !== 'Open') return false
    const t = new Date(e.followUpDate).getTime()
    return Number.isFinite(t) && t < todayMs
  }).length

  const followupDueToday = entries.filter(e => {
    if (!e.followUpDate || e.status !== 'Open') return false
    const d = new Date(e.followUpDate)
    d.setHours(0, 0, 0, 0)
    return d.getTime() === todayMs
  }).length

  const followupDueThisWeek = entries.filter(e => {
    if (!e.followUpDate || e.status !== 'Open') return false
    const t = new Date(e.followUpDate).getTime()
    return Number.isFinite(t) && t >= todayMs && t < sevenDaysOut
  }).length

  // ── Velocity (Analytics tab signal) ──
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

  // ── Active Clients sub-tab depth ──
  const activeClients = entries.filter(e => e.status === 'Successful')
  const lifecycleActive    = activeClients.filter(e => (e.clientLifecycle ?? 'active') === 'active').length
  const lifecyclePaused    = activeClients.filter(e => e.clientLifecycle === 'paused').length
  const lifecycleCompleted = activeClients.filter(e => e.clientLifecycle === 'completed').length
  const lifecycleChurned   = activeClients.filter(e => e.clientLifecycle === 'churned').length

  const withBudget = activeClients.filter(e => typeof e.clientBudgetAmount === 'number' && e.clientBudgetAmount! > 0)
  const totalBooked = withBudget.reduce((s, e) => s + (e.clientBudgetAmount || 0), 0)
  const completedRealised = activeClients
    .filter(e => e.clientLifecycle === 'completed')
    .reduce((s, e) => s + (e.clientFinalValue || 0), 0)

  // Collaborator splits — approximate (treat percent as % of that
  // engagement's budget); good enough for a one-line narrative.
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

  // Quality / repeat — pulled from wrap-up data.
  const ratings = activeClients
    .filter(e => e.clientLifecycle === 'completed')
    .map(e => e.clientRating)
    .filter((n): n is number => typeof n === 'number' && n > 0)
  const avgRating = ratings.length > 0
    ? Math.round((ratings.reduce((s, n) => s + n, 0) / ratings.length) * 10) / 10
    : null

  let repeatDefinitely = 0, repeatLikely = 0, repeatMaybe = 0, repeatNo = 0
  for (const e of activeClients.filter(c => c.clientLifecycle === 'completed')) {
    if (e.clientRepeatLikelihood === 'definitely') repeatDefinitely += 1
    else if (e.clientRepeatLikelihood === 'likely') repeatLikely += 1
    else if (e.clientRepeatLikelihood === 'maybe')  repeatMaybe += 1
    else if (e.clientRepeatLikelihood === 'no')     repeatNo += 1
  }

  // ── By-medium (Analytics signal — drives "which channel is winning") ──
  const byMedium = {
    Email:    { reached: 0, won: 0 },
    LinkedIn: { reached: 0, won: 0 },
    Other:    { reached: 0, won: 0 },
  }
  // Track the specific "Other" channel names the user has typed so
  // we can render real names ("Twitter DM", "Instagram DM", "in
  // person") instead of the lumped "Other" placeholder.
  const otherByName = new Map<string, { reached: number; won: number }>()
  for (const e of entries) {
    if (!isReachedOut(e)) continue
    const med: 'Email' | 'LinkedIn' | 'Other' =
      (e.medium === 'Email' || e.medium === 'LinkedIn') ? e.medium : 'Other'
    byMedium[med].reached += 1
    if (e.status === 'Successful') byMedium[med].won += 1
    if (med === 'Other') {
      const rawName = (e.mediumOther || '').trim()
      // Skip empties — we only want named buckets. Lowercase for
      // deduping then re-cap for display.
      if (rawName) {
        const key = rawName.toLowerCase()
        const slot = otherByName.get(key) ?? { reached: 0, won: 0 }
        slot.reached += 1
        if (e.status === 'Successful') slot.won += 1
        otherByName.set(key, slot)
      }
    }
  }
  const topMediumOther = Array.from(otherByName.entries())
    .map(([name, stats]) => ({ name: titleCase(name), reached: stats.reached, won: stats.won }))
    .sort((a, b) => b.reached - a.reached)
    .slice(0, 3)

  // ── Sourcing tab signal (Results + Dismissed) ──
  // Dismissal ratio expressed against the total "considered" pool
  // (added + dismissed). High ratio = picky / niche may be too broad.
  const considered = total + dismissedCount
  const dismissalRatio = considered > 0
    ? Math.round((dismissedCount / considered) * 100)
    : 0

  // Entries that have email captured but were never reached out to —
  // a strong "next-action" signal for the Pipeline tab.
  const leadsWithEmailNotReached = entries.filter(e =>
    !!e.email && (e.status === 'Not Outreached' || e.status === ''),
  ).length

  // ── Workflow setup (Profile + Settings + Templates) ──
  const workflow = {
    hasPitchLine:           !!(profile?.pitchLine && profile.pitchLine.trim().length > 0),
    hasFullName:            !!(profile?.fullName && profile.fullName.trim().length > 0),
    hasPhysicalAddress:     !!(profile?.physicalAddress && profile.physicalAddress.trim().length > 0),
    gmailConnected:         !!profile?.unipileAccountId,
    customEmailTemplate:    !!profile?.emailTemplate,
    customIgTemplate:       !!profile?.igDmTemplate,
    customLinkedinTemplate: !!profile?.linkedinDmTemplate,
    mailClient:             profile?.mailClient ?? 'default',
  }

  return {
    // Outreach core
    total, reachedOut, responseReceived, successful, rejected, open, noResponse, notOutreached,
    responseRate, winRate, pipelineValue,
    leadsWithEmailNotReached,
    byMedium,
    topMediumOther,

    // Follow-ups sub-tab
    followupOverdue,
    followupDueToday,
    followupDueThisWeek,

    // Velocity / Analytics
    addedLast7, reachedLast7, wonLast30,

    // Active Clients sub-tab
    activeClientsTotal: activeClients.length,
    activeNow: lifecycleActive,
    lifecyclePaused, lifecycleCompleted, lifecycleChurned,
    totalBooked, personalRevenue, completedRealised,
    avgRating,
    repeatDefinitely, repeatLikely, repeatMaybe, repeatNo,

    // Sourcing (Results + Dismissed tabs)
    resultsCount,
    dismissedCount,
    dismissalRatio,

    // Workflow / Profile / Templates
    workflow,
  }
}

function readCache(uid: string): CachedDashboardInsight | null {
  if (typeof window === 'undefined') return null
  try {
    // Cache key has v2 suffix — v1 stored LLM-era insights, which
    // were not the rule-based detector output. Bumping the key
    // forces a refetch so users on the old cache see the new
    // detector output immediately on next page load instead of
    // waiting out the 24h TTL.
    const raw = window.localStorage.getItem(`creator-outreach.dashboard-insight-v2.${uid}`)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<CachedDashboardInsight>
    if (
      !parsed ||
      !Array.isArray(parsed.insights) ||
      parsed.insights.length === 0 ||
      typeof parsed.generatedAt !== 'number'
    ) return null
    return {
      insights: parsed.insights.filter((v): v is string => typeof v === 'string'),
      index: typeof parsed.index === 'number' && parsed.index >= 0 ? parsed.index : 0,
      generatedAt: parsed.generatedAt,
    }
  } catch {
    return null
  }
}

function writeCache(uid: string, value: CachedDashboardInsight): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(
      `creator-outreach.dashboard-insight-v2.${uid}`,
      JSON.stringify(value),
    )
  } catch { /* localStorage unavailable */ }
}

export function DashboardInsightPill({
  entries, userId, resultsCount = 0, dismissedCount = 0, profile = null,
}: {
  entries: OutreachEntry[]
  /** Used as the localStorage cache key suffix so each user's
   *  insight stays separate on shared machines. */
  userId: string
  /** Current Results-tab creator count. Drives the SOURCING facet. */
  resultsCount?: number
  /** Dismissed-tab creator count. Drives the SOURCING facet
   *  (dismissal ratio). */
  dismissedCount?: number
  /** User profile — drives the WORKFLOW SETUP facet (pitch line,
   *  Gmail connected, custom templates). */
  profile?: UserProfile | null
}) {
  // We store the whole array of 5 insights + the currently-displayed
  // index. Refresh cycles through the array locally; only after all
  // 5 have been shown does the next refresh hit the API for fresh
  // ones. That guarantees genuine variety (5 facets, asked in one
  // call so Claude makes them mutually different) and is also free
  // for refreshes 2-5.
  const [insights, setInsights] = useState<string[]>([])
  const [index, setIndex] = useState(0)
  const [generatedAt, setGeneratedAt] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [open, setOpen] = useState(false)
  const popoverRef = useRef<HTMLDivElement>(null)

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

  async function fetchFreshBatch(): Promise<void> {
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
          metrics: projectMetrics({ entries, resultsCount, dismissedCount, profile }),
          recentSearches,
          daysSinceFirstEntry,
        }),
      })
      const json = await res.json() as { insights?: string[]; generatedAt?: number; error?: string }
      if (!res.ok || !Array.isArray(json.insights) || json.insights.length === 0) {
        setError(json.error || `Failed (HTTP ${res.status})`)
        return
      }
      const fresh = json.insights.filter((s): s is string => typeof s === 'string' && s.length > 0)
      const at = json.generatedAt ?? Date.now()
      setInsights(fresh)
      setIndex(0)
      setGeneratedAt(at)
      writeCache(userId, { insights: fresh, index: 0, generatedAt: at })
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Network error')
    } finally {
      setLoading(false)
    }
  }

  /**
   * Handler for the popover refresh button. Within a fresh batch,
   * each click advances to the next of the 5 insights (instant, no
   * API call). After the last one is shown, the next click fetches
   * a brand-new batch of 5.
   */
  async function nextOrFetch(): Promise<void> {
    if (insights.length === 0) {
      await fetchFreshBatch()
      return
    }
    if (index < insights.length - 1) {
      const next = index + 1
      setIndex(next)
      writeCache(userId, {
        insights,
        index: next,
        generatedAt: generatedAt ?? Date.now(),
      })
      return
    }
    // Exhausted current batch → fetch new 5.
    await fetchFreshBatch()
  }

  // Hydrate from cache on mount; auto-fetch when stale or first run.
  useEffect(() => {
    if (entries.length === 0) {
      // Empty pipeline → no LLM call. The deterministic empty-state
      // copy already lives server-side (5 starter prompts) but we
      // mirror one here so the pill renders immediately without a
      // round-trip.
      setInsights(['Start by running a search on the Results tab to find creators in your niche.'])
      setIndex(0)
      setGeneratedAt(Date.now())
      return
    }
    const cached = readCache(userId)
    const stale = cached && Date.now() - cached.generatedAt > STALE_MS
    if (cached && !stale) {
      setInsights(cached.insights)
      setIndex(Math.min(cached.index, cached.insights.length - 1))
      setGeneratedAt(cached.generatedAt)
      return
    }
    void fetchFreshBatch()
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [userId, entries.length])

  const currentInsight = insights.length > 0 && index < insights.length ? insights[index] : ''

  // Truncate the visible pill text so it doesn't push the upgrade
  // button off-screen. The full text is in the popover.
  const pillText = (() => {
    if (loading && !currentInsight) return 'Generating…'
    if (error) return 'Insight unavailable'
    return currentInsight || 'Loading…'
  })()

  const formattedAge = generatedAt != null ? formatAge(Date.now() - generatedAt) : ''
  const refreshAdvancesLocally = insights.length > 1 && index < insights.length - 1
  // Aria-only label for the refresh button — the visible UI is
  // intentionally counter-free so the experience reads like a stream
  // of observations rather than "you are viewing item N of M."
  const refreshLabel = refreshAdvancesLocally ? 'Next insight' : 'Fetch fresh insights'

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
                {generatedAt != null ? `${formattedAge}` : 'Loading…'}
              </div>
            </div>
            <button
              type="button"
              onClick={nextOrFetch}
              disabled={loading}
              aria-label={refreshLabel}
              title={refreshLabel}
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
            ) : loading && !currentInsight ? (
              <div className="space-y-1.5">
                <div className="h-3 bg-muted/60 rounded animate-pulse w-11/12" />
                <div className="h-3 bg-muted/60 rounded animate-pulse w-8/12" />
              </div>
            ) : (
              <p className="text-[13.5px] leading-relaxed text-foreground/90">
                {currentInsight}
              </p>
            )}
          </div>

          {/* Subtle progress dots — implementation detail surfaced
              visually but without literal "1 of 5" copy. Each dot
              filled in matches the index; refresh advances one dot
              at a time. Hidden when there's only one item. */}
          {insights.length > 1 && !error && (
            <div
              className="flex items-center justify-center gap-1.5 pb-3"
              aria-hidden
            >
              {insights.map((_, i) => (
                <span
                  key={i}
                  className={[
                    'w-1.5 h-1.5 rounded-full transition-colors',
                    i === index
                      ? 'bg-purple-500'
                      : i < index
                        ? 'bg-purple-500/40'
                        : 'bg-muted-foreground/25',
                  ].join(' ')}
                />
              ))}
            </div>
          )}
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

/**
 * Lowercase a user-typed channel name into Title Case for display.
 * Handles a few common shapes: "twitter dm" -> "Twitter DM",
 * "in person" -> "In Person", "phone" -> "Phone". Words that are
 * already all-caps acronyms (DM, SMS) get preserved.
 */
function titleCase(input: string): string {
  return input
    .split(/\s+/)
    .filter(Boolean)
    .map(w => {
      // Preserve known acronyms.
      if (/^(dm|sms|fyi|ig)$/i.test(w)) return w.toUpperCase()
      return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()
    })
    .join(' ')
}
