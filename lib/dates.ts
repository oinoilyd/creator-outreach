/**
 * Pure date helpers used across the outreach + follow-up flows.
 *
 * Why a dedicated module: these were inline in app/page.tsx (which
 * is a 6,200-line monolith). They have no dependencies on app state,
 * are trivially unit-testable, and are imported from multiple
 * callsites — perfect candidates for a focused module.
 *
 * All functions operate in *local time*, intentionally. The follow-up
 * cadence math should match the user's calendar day, not UTC. The
 * follow-up date column in OutreachEntry stores YYYY-MM-DD strings
 * and is consumed by the follow-up calendar / sheet — every consumer
 * agrees on local-time semantics.
 */

/** Parse a YYYY-MM-DD or ISO datetime string into a local Date.
 *  Returns null when the input is empty / unparseable so callers
 *  can decide what to do with unknown dates. */
export function parseLocalDate(s: string): Date | null {
  if (!s) return null
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (m) return new Date(parseInt(m[1]), parseInt(m[2]) - 1, parseInt(m[3]))
  const d = new Date(s)
  return isNaN(d.getTime()) ? null : d
}

/** Today's date as YYYY-MM-DD in *local* time. */
export function todayIso(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** N days from today as YYYY-MM-DD in *local* time. */
export function isoDaysFromNow(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** N *business* days from today (Sat/Sun skipped) as YYYY-MM-DD in
 *  *local* time. Used for the first follow-up, which should land 5
 *  business days out rather than a raw +5 calendar that can fall on a
 *  weekend. Counts only Mon–Fri: from a Thursday, +1 → Friday, +2 →
 *  Monday. days<=0 returns today. */
export function isoBusinessDaysFromNow(days: number): string {
  const d = new Date()
  let added = 0
  while (added < days) {
    d.setDate(d.getDate() + 1)
    const dow = d.getDay() // 0 Sun … 6 Sat
    if (dow !== 0 && dow !== 6) added++
  }
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** Whole *calendar* days between a past timestamp (ms) and today, in
 *  local time — both ends floored to local midnight so an event earlier
 *  *today* reads as 0, not 1. Plain `(Date.now() - ts) / DAY` rounds a
 *  ~15-hour-old same-day touch up to "1d ago", which is wrong. Accepts
 *  either a local-midnight date (parsed YYYY-MM-DD) or a full datetime
 *  timestamp. Negative clamps to 0. */
export function calendarDaysSince(ts: number): number {
  if (!ts) return 0
  const then = new Date(ts); then.setHours(0, 0, 0, 0)
  const today = new Date(); today.setHours(0, 0, 0, 0)
  return Math.max(0, Math.round((today.getTime() - then.getTime()) / 86_400_000))
}

/** Short human date — "Tue, Jul 14" — from a YYYY-MM-DD string (local).
 *  Used in confirmation toasts. Empty/unparseable → ''. */
export function formatDueDate(iso: string): string {
  const d = parseLocalDate(iso)
  if (!d) return ''
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

/** Human-readable "X days ago" (or "today") from a YYYY-MM-DD string.
 *  Returns "?" when the input is empty or unparseable so the UI shows
 *  a stable placeholder rather than an exception. */
export function daysAgo(iso: string): string {
  if (!iso) return '?'
  const d = parseLocalDate(iso)
  if (!d) return '?'
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const that = new Date(d)
  that.setHours(0, 0, 0, 0)
  const days = Math.round((today.getTime() - that.getTime()) / 86_400_000)
  if (days <= 0) return 'today'
  return `${days}d`
}

/** How many days from today to a YYYY-MM-DD target. Negative-clamped
 *  to 0 so a follow-up that's already overdue reads as 0 days away
 *  instead of -7. */
export function daysFromNow(iso: string): number {
  if (!iso) return 0
  const d = parseLocalDate(iso)
  if (!d) return 0
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const that = new Date(d)
  that.setHours(0, 0, 0, 0)
  return Math.max(0, Math.round((that.getTime() - today.getTime()) / 86_400_000))
}
