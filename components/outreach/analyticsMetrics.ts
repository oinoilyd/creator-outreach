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
