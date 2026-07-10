/**
 * Shared helpers used by every follow-up calendar variant (Week strip,
 * Gantt, Mini-cal + agenda). Centralized so the priority-color logic,
 * date-state pill wording, and ghosted-threshold all stay in lock-step
 * with the List view's bucketOf().
 */

import type { OutreachEntry } from '@/lib/types'
import { parseLocalDate, daysAgo, daysFromNow, calendarDaysSince } from '@/lib/dates'

export const GHOSTED_THRESHOLD_DAYS = 30
export const DAY_MS = 86_400_000

export type PriTone = {
  /** Solid color used for dots, bar fills, etc. */
  dot: string
  /** Subtle tinted background + border for card backgrounds. */
  tint: string
  /** Text color for accent labels. */
  text: string
}

export function priColor(e: OutreachEntry): PriTone {
  const ghosted = isTrulyGhosted(e)
  if (ghosted) return {
    dot: 'bg-purple-500',
    tint: 'bg-purple-500/10 border-purple-500/30',
    text: 'text-purple-700 dark:text-purple-300',
  }
  const diff = daysFromNow(e.followUpDate)
  if (diff <= 0) return {
    dot: 'bg-red-500',
    tint: 'bg-red-500/10 border-red-500/40',
    text: 'text-red-700 dark:text-red-300',
  }
  if (diff <= 7) return {
    dot: 'bg-amber-500',
    tint: 'bg-amber-500/10 border-amber-500/40',
    text: 'text-amber-700 dark:text-yellow-300',
  }
  return {
    dot: 'bg-blue-500',
    tint: 'bg-blue-500/10 border-blue-500/30',
    text: 'text-blue-700 dark:text-blue-300',
  }
}

export function isTrulyGhosted(e: OutreachEntry): boolean {
  if (e.status !== 'No Response') return false
  const reached = parseLocalDate(e.dateReachedOut)
  if (!reached) return true
  const today = new Date(); today.setHours(0, 0, 0, 0)
  reached.setHours(0, 0, 0, 0)
  const days = Math.round((today.getTime() - reached.getTime()) / DAY_MS)
  return days >= GHOSTED_THRESHOLD_DAYS
}

// Due-state label for calendar day rows. Same vocabulary as the list
// view's due pill in FollowUpRow ("Due in Xd" / "Due today" / "Overdue
// by Xd") — the old "+4d" shorthand read as cryptic out of context
// (Dylan 2026-07-10), and one wording app-wide beats two.
export function fmtFollow(e: OutreachEntry): string {
  if (isTrulyGhosted(e)) return 'Ghosted'
  if (!e.followUpDate) return 'No date'
  const d = daysFromNow(e.followUpDate)
  if (d < 0) return `Overdue by ${Math.abs(d)}d`
  if (d === 0) return 'Due today'
  return `Due in ${d}d`
}

export function moneyShort(val: string | number | undefined): string {
  const n = typeof val === 'number' ? val : parseFloat(String(val || '').replace(/[^0-9.]/g, ''))
  if (!n) return ''
  if (n >= 10000) return `$${(n / 1000).toFixed(0)}k`
  return `$${n.toLocaleString()}`
}

export function dealValueNum(e: OutreachEntry): number {
  return parseFloat(String(e.dealValue || '').replace(/[^0-9.]/g, '')) || 0
}

export function toIso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function lastTouchedDaysAgo(e: OutreachEntry): { days: number; isFollowUp: boolean; label: string } | null {
  const reachedTs = e.dateReachedOut ? parseLocalDate(e.dateReachedOut)?.getTime() ?? 0 : 0
  const autoTs = e.lastAutoFollowupAt ?? 0
  const lastTs = Math.max(reachedTs, autoTs)
  if (!lastTs) return null
  // Whole calendar days floored to local midnight — a touch earlier
  // *today* reads "today", not "1d ago" (a raw Date.now() diff rounds a
  // ~15-hour-old same-day touch up to 1). tps<=1 is only the initial
  // outreach (no follow-up sent yet) → "Reached", not "Last followed up".
  const days = calendarDaysSince(lastTs)
  const tps = parseInt(e.touchpoints || '0', 10) || 0
  const isFollowUp = tps >= 2
  const when = days === 0 ? 'today' : `${days}d ago`
  const label = isFollowUp ? `Last followed up ${when}` : `Reached ${when}`
  return { days, isFollowUp, label }
}

export { daysAgo, daysFromNow, parseLocalDate }
