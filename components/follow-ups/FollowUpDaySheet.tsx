'use client'

import React from 'react'
import type { OutreachEntry, UserProfile } from '@/lib/types'
import { parseLocalDate, formatDueDate } from '@/lib/dates'
import { FollowUpDayRow } from '@/components/follow-ups/FollowUpDayRow'

/**
 * Expanded "details for this day" panel that drops below the month
 * calendar grid when the user clicks a day with follow-ups.
 *
 * 2026-07-10 (Dylan): the per-lead markup that used to live here (four
 * stacked status/due/stage pills + meta lines + notes preview) was
 * replaced by the shared FollowUpDayRow — the same clean single-line
 * row the week view uses, with the quick actions (email / IG /
 * LinkedIn / open detail) kept as a compact cluster. Month and week
 * day lists are now identical by construction.
 */
export function FollowUpDaySheet({
  dateIso,
  entries,
  overdueEntries = [],
  onClose,
  onOpenEntry,
  profile,
  nextScheduledIso,
  onJumpToDate,
}: {
  dateIso: string
  entries: OutreachEntry[]
  /** Overdue follow-ups (past dates, still in flight). Only passed
   *  when this sheet represents TODAY — surfaced as a section above
   *  today's regular follow-ups so missed deadlines stop vanishing
   *  from view. Dylan 2026-06-08. */
  overdueEntries?: OutreachEntry[]
  onClose: () => void
  onOpenEntry: (id: string) => void
  profile: UserProfile | null
  /** Quiet-day pointer (2026-07-10): nearest scheduled follow-up AFTER
   *  this day. When the day is empty, the sheet names it and a click
   *  fires onJumpToDate so the calendar navigates there. */
  nextScheduledIso?: string | null
  onJumpToDate?: (iso: string) => void
}) {
  const dateLabel = (() => {
    const d = parseLocalDate(dateIso)
    if (!d) return dateIso
    return d.toLocaleDateString(undefined, {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    })
  })()

  return (
    <section className="rounded-xl border border-purple-500/30 bg-purple-500/5 p-4">
      <header className="flex items-center justify-between gap-2 mb-3">
        <h3 className="text-sm font-semibold text-foreground">
          {dateLabel}
          <span className="ml-2 text-muted-foreground font-normal">
            · {entries.length} follow-up{entries.length === 1 ? '' : 's'}
          </span>
        </h3>
        <button
          type="button"
          onClick={onClose}
          className="text-muted-foreground hover:text-foreground text-lg leading-none px-1"
          aria-label="Close day"
        >
          ×
        </button>
      </header>

      {/* OVERDUE section — only renders when this sheet was opened
          for TODAY and there are past-due in-flight follow-ups.
          Subtle amber tint differentiates from today's purple sheet
          but stays understated. Empty state hidden when no overdue. */}
      {overdueEntries.length > 0 && (
        <div className="mb-4 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-[11px] uppercase tracking-[0.14em] font-bold text-amber-700 dark:text-amber-300">
              ⚠ Overdue
            </span>
            <span className="text-[11px] text-muted-foreground">
              {overdueEntries.length} follow-up{overdueEntries.length === 1 ? '' : 's'} missed and still pending
            </span>
          </div>
          <ul className="space-y-2">
            {overdueEntries.map(e => (
              <FollowUpDayRow key={e.id} entry={e} profile={profile} onOpenEntry={onOpenEntry} />
            ))}
          </ul>
        </div>
      )}

      {entries.length === 0 ? (
        <div className="text-xs text-muted-foreground italic">
          {overdueEntries.length > 0
            ? 'No follow-ups scheduled for today (overdue items above need attention).'
            : 'No follow-ups scheduled for this day.'}
          {nextScheduledIso && onJumpToDate && (
            <button
              type="button"
              onClick={() => onJumpToDate(nextScheduledIso)}
              className="not-italic ml-2 text-purple-700 dark:text-purple-300 hover:underline underline-offset-2"
            >
              Next follow-up: {formatDueDate(nextScheduledIso)} →
            </button>
          )}
        </div>
      ) : (
        <ul className="space-y-2">
          {entries.map(e => (
            <FollowUpDayRow key={e.id} entry={e} profile={profile} onOpenEntry={onOpenEntry} />
          ))}
        </ul>
      )}
    </section>
  )
}
