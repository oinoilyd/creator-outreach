/**
 * analyticsMetrics — pure computation behind OutreachAnalytics.
 *
 * Everything here is side-effect-free and depends only on the
 * OutreachEntry shape. Lives in its own module so the visual layer
 * (OutreachAnalytics.tsx) stays small enough to review at a glance.
 *
 * No React, no DOM, no Supabase. Easy to unit-test if we ever wire
 * up vitest for shared business logic.
 */

import type { OutreachEntry, ClientLifecycle } from '@/lib/types'
import { resolveCollaboratorShare } from '@/lib/types'

// ── Time range helpers ──────────────────────────────────────────────

/** Named time ranges surfaced in the analytics header dropdown. */
export type TimeRangeId = 'last7' | 'last30' | 'last90' | 'ytd' | 'all' | 'custom'

export interface TimeRange {
  id: TimeRangeId
  /** Inclusive start, ms epoch. null = unbounded (all time). */
  fromMs: number | null
  /** Inclusive end, ms epoch. null = now. */
  toMs: number | null
  /** Human-readable label for chips ("Last 30 days"). */
  label: string
}

/** Resolve a named range into a concrete {from, to} window. */
export function resolveTimeRange(id: TimeRangeId, custom?: { fromMs: number; toMs: number }): TimeRange {
  const now = Date.now()
  const DAY = 24 * 60 * 60 * 1000
  switch (id) {
    case 'last7':   return { id, fromMs: now - 7 * DAY,  toMs: now, label: 'Last 7 days' }
    case 'last30':  return { id, fromMs: now - 30 * DAY, toMs: now, label: 'Last 30 days' }
    case 'last90':  return { id, fromMs: now - 90 * DAY, toMs: now, label: 'Last 90 days' }
    case 'ytd': {
      const start = new Date(); start.setMonth(0, 1); start.setHours(0, 0, 0, 0)
      return { id, fromMs: start.getTime(), toMs: now, label: 'Year to date' }
    }
    case 'all':     return { id, fromMs: null, toMs: null, label: 'All time' }
    case 'custom': {
      if (!custom) return { id: 'all', fromMs: null, toMs: null, label: 'All time' }
      return {
        id, fromMs: custom.fromMs, toMs: custom.toMs,
        label: `${new Date(custom.fromMs).toLocaleDateString()} → ${new Date(custom.toMs).toLocaleDateString()}`,
      }
    }
  }
}

/**
 * Compute the *previous* window of the same length, immediately
 * preceding the current range. Used for period-over-period delta
 * calculations on metric cards. Returns null for unbounded ranges.
 */
export function previousTimeRange(range: TimeRange): TimeRange | null {
  if (range.fromMs == null || range.toMs == null) return null
  const span = range.toMs - range.fromMs
  return {
    id: 'custom',
    fromMs: range.fromMs - span,
    toMs: range.fromMs,
    label: 'Previous period',
  }
}

/**
 * Filter entries that fall inside the given range by addedAt. Used as
 * the input filter to computeMetrics for the time-range UI. Range
 * with both bounds null returns the input unchanged.
 *
 * Deliberate trade-off: we filter by addedAt (when the lead was first
 * added) rather than "any activity in window." That keeps the mental
 * model simple — "leads added in this period and their downstream
 * outcomes." Users who want a strictly current-state view pick
 * "All time."
 */
export function filterByTimeRange(entries: OutreachEntry[], range: TimeRange): OutreachEntry[] {
  if (range.fromMs == null && range.toMs == null) return entries
  const from = range.fromMs ?? 0
  const to   = range.toMs   ?? Number.POSITIVE_INFINITY
  return entries.filter(e => {
    const t = typeof e.addedAt === 'number' ? e.addedAt : 0
    return t >= from && t <= to
  })
}

/** One row of the velocity time-series chart. */
export interface BucketPoint {
  /** ISO date for the bucket start (yyyy-MM-dd). */
  date: string
  /** Display label (e.g. "May 14" or "Wk 3"). */
  label: string
  added: number
  reachedOut: number
  responded: number
  won: number
}

/**
 * Bucket entries into day or week buckets across the given range,
 * counting added / reachedOut / responded / won per bucket.
 *
 * Used by the line/area velocity chart. For >60-day ranges we
 * switch to weekly buckets to keep the chart readable.
 */
export function bucketedSeries(entries: OutreachEntry[], range: TimeRange): BucketPoint[] {
  const now = Date.now()
  const DAY = 24 * 60 * 60 * 1000
  const from = range.fromMs ?? Math.min(...entries.map(e => e.addedAt || now), now)
  const to   = range.toMs   ?? now
  const span = to - from
  if (span <= 0) return []

  const bucketByWeek = span > 60 * DAY
  const bucketMs = bucketByWeek ? 7 * DAY : DAY

  // Pre-compute bucket count to avoid drift from variable-month math.
  const bucketCount = Math.max(1, Math.ceil(span / bucketMs) + 1)
  const buckets: BucketPoint[] = []
  for (let i = 0; i < bucketCount; i++) {
    const startMs = from + i * bucketMs
    if (startMs > to) break
    const d = new Date(startMs)
    buckets.push({
      date: d.toISOString().slice(0, 10),
      label: bucketByWeek
        ? `${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
        : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      added: 0,
      reachedOut: 0,
      responded: 0,
      won: 0,
    })
  }
  if (buckets.length === 0) return []

  function indexFor(ts: number): number {
    if (ts < from || ts > to) return -1
    const i = Math.floor((ts - from) / bucketMs)
    return Math.min(buckets.length - 1, Math.max(0, i))
  }

  for (const e of entries) {
    const i = indexFor(e.addedAt || 0)
    if (i >= 0) buckets[i].added += 1

    if (e.dateReachedOut) {
      const t = new Date(e.dateReachedOut).getTime()
      if (isFinite(t)) {
        const j = indexFor(t)
        if (j >= 0) buckets[j].reachedOut += 1
      }
    }
    if (e.responseDate) {
      const t = new Date(e.responseDate).getTime()
      if (isFinite(t)) {
        const j = indexFor(t)
        if (j >= 0) {
          if (e.status === 'Successful' || e.status === 'Rejected') buckets[j].responded += 1
          if (e.status === 'Successful') buckets[j].won += 1
        }
      }
    }
  }
  return buckets
}

/** Compute percent change current vs previous. Returns null if either base is 0. */
export function deltaPct(current: number, previous: number): number | null {
  if (!Number.isFinite(current) || !Number.isFinite(previous)) return null
  if (previous === 0) {
    if (current === 0) return 0
    return null  // can't compute a meaningful pct from a zero base
  }
  return Math.round(((current - previous) / previous) * 100)
}

// ── Calendar activity (heatmap data) ────────────────────────────────

export interface DayActivity {
  /** ISO yyyy-MM-dd */
  date: string
  /** Combined activity score for the day: added + reached + responded + won. */
  count: number
  /** Day of week (0 = Sunday, 6 = Saturday) for grid layout. */
  dayOfWeek: number
  added: number
  reachedOut: number
  responded: number
  won: number
}

/**
 * Build a per-day activity series spanning roughly the last `days`
 * calendar days (default 365). Each cell counts the various event
 * types that happened on that day. Used by the calendar-heatmap
 * widget — same pattern as GitHub's contribution grid.
 */
export function dailyActivity(entries: OutreachEntry[], days = 365): DayActivity[] {
  const DAY = 24 * 60 * 60 * 1000
  const now = new Date(); now.setHours(0, 0, 0, 0)
  const start = new Date(now.getTime() - (days - 1) * DAY)

  // Pre-fill the grid with zero cells so the heatmap stays a clean
  // rectangle even with sparse data.
  const cells: DayActivity[] = []
  const byKey = new Map<string, DayActivity>()
  for (let i = 0; i < days; i++) {
    const d = new Date(start.getTime() + i * DAY)
    const key = d.toISOString().slice(0, 10)
    const cell: DayActivity = {
      date: key,
      count: 0,
      dayOfWeek: d.getDay(),
      added: 0,
      reachedOut: 0,
      responded: 0,
      won: 0,
    }
    cells.push(cell)
    byKey.set(key, cell)
  }

  function bumpAt(ts: number | null | undefined, field: keyof Pick<DayActivity, 'added' | 'reachedOut' | 'responded' | 'won'>): void {
    if (!ts) return
    const d = new Date(ts); if (isNaN(d.getTime())) return
    d.setHours(0, 0, 0, 0)
    const key = d.toISOString().slice(0, 10)
    const cell = byKey.get(key)
    if (!cell) return  // outside the window
    cell[field] += 1
    cell.count = cell.added + cell.reachedOut + cell.responded + cell.won
  }

  for (const e of entries) {
    bumpAt(e.addedAt, 'added')
    if (e.dateReachedOut) bumpAt(new Date(e.dateReachedOut).getTime(), 'reachedOut')
    if (e.responseDate) {
      const t = new Date(e.responseDate).getTime()
      if (e.status === 'Successful' || e.status === 'Rejected') bumpAt(t, 'responded')
      if (e.status === 'Successful') bumpAt(t, 'won')
    }
  }

  return cells
}

/**
 * Reduce a BucketPoint[] to a small numeric trend for sparkline use.
 * Picks the most-recent N buckets so a 365-day range still gets a
 * readable sparkline (we don't render 365 ticks on a 60-pixel chart).
 */
export function sparklineSeries(buckets: BucketPoint[], pick: keyof Pick<BucketPoint, 'added' | 'reachedOut' | 'responded' | 'won'>, max = 24): number[] {
  if (buckets.length === 0) return []
  const slice = buckets.slice(-max)
  return slice.map(b => b[pick])
}

export function isReachedOut(e: OutreachEntry): boolean {
  return e.status !== 'Not Outreached' && e.status !== ''
}

export function pct(num: number, den: number): number {
  if (!den) return 0
  return Math.round((num / den) * 100)
}

export function parseMoney(input: string | number | null | undefined): number {
  if (input == null) return 0
  const s = typeof input === 'number' ? String(input) : input
  const n = parseFloat(s.replace(/[^0-9.\-]/g, ''))
  return isFinite(n) ? n : 0
}

export interface ComputedMetrics {
  // Outreach core
  total: number
  reachedOut: number
  responseReceived: number
  successful: number
  rejected: number
  open: number
  noResponse: number
  notOutreached: number
  responseRate: number
  winRate: number
  pipelineValue: number
  stale: number
  favoritedCount: number
  contractsSentCount: number
  meetingsScheduledCount: number
  avgRespondDays: number | null
  avgTouchpointsToWin: number | null

  // Velocity
  addedLast7: number
  reachedLast7: number
  wonLast30: number

  // Active client
  activeNow: number
  totalBooked: number
  totalCollaboratorShare: number
  personalRevenue: number
  withBudgetCount: number
  avgDeal: number
  completedCount: number
  totalCompletedValue: number
  avgDurationDays: number | null
  durationCount: number
  lifecycle: { active: number; paused: number; completed: number; churned: number }
  avgRating: number | null
  ratedCount: number
  repeat: { definitely: number; likely: number; maybe: number; no: number }
  repeatCount: number

  // Cross-references
  byMedium: Record<'Email' | 'LinkedIn' | 'Other', { reached: number; won: number }>
  winsWithContract: number
  winsWithMeeting: number
  winsFavorited: number
}

export function computeMetrics(entries: OutreachEntry[]): ComputedMetrics {
  const total = entries.length

  // ── Status partition ──────────────────────────────────────────────
  const reachedOut    = entries.filter(isReachedOut).length
  const successful    = entries.filter(e => e.status === 'Successful').length
  const rejected      = entries.filter(e => e.status === 'Rejected').length
  const open          = entries.filter(e => e.status === 'Open').length
  const noResponse    = entries.filter(e => e.status === 'No Response').length
  const notOutreached = entries.filter(e => e.status === 'Not Outreached' || e.status === '').length
  const responseReceived = successful + rejected

  const responseRate = reachedOut > 0 ? Math.round((responseReceived / reachedOut) * 100) : 0
  const winRate = responseReceived > 0 ? Math.round((successful / responseReceived) * 100) : 0

  // Pipeline $ — sum dealValue for non-rejected.
  const pipelineValue = entries
    .filter(e => e.status !== 'Rejected')
    .reduce((sum, e) => sum + parseMoney(e.dealValue), 0)

  // Stale follow-ups (Open with past followUpDate).
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const todayMs = today.getTime()
  const stale = entries.filter(e => {
    if (!e.followUpDate || e.status !== 'Open') return false
    const t = new Date(e.followUpDate).getTime()
    return isFinite(t) && t < todayMs
  }).length

  // Side metrics
  const favoritedCount         = entries.filter(e => e.favorite).length
  const contractsSentCount     = entries.filter(e => e.contractSent).length
  const meetingsScheduledCount = entries.filter(e => !!e.meetingScheduled).length

  // Avg time from reached out → response (in days).
  const respondPairs = entries
    .map(e => {
      if (!e.dateReachedOut || !e.responseDate) return null
      const a = new Date(e.dateReachedOut).getTime()
      const b = new Date(e.responseDate).getTime()
      if (!isFinite(a) || !isFinite(b) || b < a) return null
      return (b - a) / (24 * 60 * 60 * 1000)
    })
    .filter((n): n is number => n != null)
  const avgRespondDays = respondPairs.length > 0
    ? Math.round(respondPairs.reduce((s, n) => s + n, 0) / respondPairs.length)
    : null

  // Avg touchpoints to win — average touchpoints across Successful entries.
  const winTouchpoints = entries
    .filter(e => e.status === 'Successful')
    .map(e => {
      const n = Number(e.touchpoints)
      return Number.isFinite(n) ? n : null
    })
    .filter((n): n is number => n != null && n > 0)
  const avgTouchpointsToWin = winTouchpoints.length > 0
    ? Math.round((winTouchpoints.reduce((s, n) => s + n, 0) / winTouchpoints.length) * 10) / 10
    : null

  // Velocity windows
  const SEVEN_D_AGO = Date.now() - 7 * 24 * 60 * 60 * 1000
  const THIRTY_D_AGO = Date.now() - 30 * 24 * 60 * 60 * 1000
  const addedLast7 = entries.filter(e => e.addedAt > SEVEN_D_AGO).length
  const reachedLast7 = entries.filter(e => {
    if (!e.dateReachedOut) return false
    const t = new Date(e.dateReachedOut).getTime()
    return isFinite(t) && t > SEVEN_D_AGO
  }).length
  // Won-last-30 uses responseDate as a proxy for "became Successful"
  // since we don't store an explicit status-change timestamp.
  const wonLast30 = entries.filter(e => {
    if (e.status !== 'Successful' || !e.responseDate) return false
    const t = new Date(e.responseDate).getTime()
    return isFinite(t) && t > THIRTY_D_AGO
  }).length

  // ── Active-client side ───────────────────────────────────────────
  const activeClients = entries.filter(e => e.status === 'Successful')
  const activeNow = activeClients.filter(e =>
    (e.clientLifecycle ?? 'active') === 'active',
  ).length

  // Lifecycle distribution
  const lifecycle = { active: 0, paused: 0, completed: 0, churned: 0 } as Record<ClientLifecycle, number>
  activeClients.forEach(e => {
    const lc = (e.clientLifecycle ?? 'active') as ClientLifecycle
    lifecycle[lc] = (lifecycle[lc] ?? 0) + 1
  })

  // Budget aggregates
  const withBudget = activeClients.filter(e => typeof e.clientBudgetAmount === 'number' && e.clientBudgetAmount! > 0)
  const totalBooked = withBudget.reduce((sum, e) => sum + (e.clientBudgetAmount || 0), 0)
  const avgDeal = withBudget.length > 0 ? totalBooked / withBudget.length : 0

  // Collaborator splits — sum per-engagement after resolving $/% to dollars.
  let totalCollaboratorShare = 0
  for (const e of activeClients) {
    const team = e.clientCollaborators ?? []
    for (const c of team) {
      totalCollaboratorShare += resolveCollaboratorShare(c, e.clientBudgetAmount)
    }
  }
  const personalRevenue = Math.max(0, totalBooked - totalCollaboratorShare)

  // Completed quality
  const completed = activeClients.filter(e => (e.clientLifecycle ?? '') === 'completed')
  const completedCount = completed.length
  const totalCompletedValue = completed.reduce((sum, e) => sum + (e.clientFinalValue || 0), 0)

  const rated = completed
    .map(e => e.clientRating)
    .filter((n): n is number => typeof n === 'number' && n > 0)
  const avgRating = rated.length > 0
    ? Math.round((rated.reduce((s, n) => s + n, 0) / rated.length) * 10) / 10
    : null

  const repeat = { definitely: 0, likely: 0, maybe: 0, no: 0 }
  for (const e of completed) {
    if (e.clientRepeatLikelihood) repeat[e.clientRepeatLikelihood] += 1
  }
  const repeatCount = repeat.definitely + repeat.likely + repeat.maybe + repeat.no

  // Engagement duration
  const dated = activeClients.filter(e => !!e.clientTimelineStart && !!e.clientTimelineEnd)
  let avgDurationDays: number | null = null
  if (dated.length > 0) {
    const totalDays = dated.reduce((sum, e) => {
      const a = new Date(e.clientTimelineStart!).getTime()
      const b = new Date(e.clientTimelineEnd!).getTime()
      return sum + Math.max(0, Math.round((b - a) / (24 * 60 * 60 * 1000)))
    }, 0)
    avgDurationDays = Math.round(totalDays / dated.length)
  }

  // ── Cross-references ─────────────────────────────────────────────
  const byMedium: ComputedMetrics['byMedium'] = {
    Email:    { reached: 0, won: 0 },
    LinkedIn: { reached: 0, won: 0 },
    Other:    { reached: 0, won: 0 },
  }
  for (const e of entries) {
    if (!isReachedOut(e)) continue
    const med = (e.medium === 'Email' || e.medium === 'LinkedIn') ? e.medium : 'Other'
    byMedium[med].reached += 1
    if (e.status === 'Successful') byMedium[med].won += 1
  }

  const winsWithContract = activeClients.filter(e => e.contractSent).length
  const winsWithMeeting  = activeClients.filter(e => !!e.meetingScheduled).length
  const winsFavorited    = activeClients.filter(e => e.favorite).length

  return {
    total, reachedOut, responseReceived, successful, rejected, open, noResponse, notOutreached,
    responseRate, winRate, pipelineValue, stale, favoritedCount, contractsSentCount,
    meetingsScheduledCount, avgRespondDays, avgTouchpointsToWin,
    addedLast7, reachedLast7, wonLast30,
    activeNow, totalBooked, totalCollaboratorShare, personalRevenue, withBudgetCount: withBudget.length,
    avgDeal, completedCount, totalCompletedValue, avgDurationDays, durationCount: dated.length,
    lifecycle, avgRating, ratedCount: rated.length, repeat, repeatCount,
    byMedium, winsWithContract, winsWithMeeting, winsFavorited,
  }
}
