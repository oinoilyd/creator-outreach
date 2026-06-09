'use client'

import React, { useState, useMemo } from 'react'
import type { OutreachEntry, UserProfile } from '@/lib/types'
import { parseLocalDate } from '@/lib/dates'
import { FollowUpDaySheet } from '@/components/follow-ups/FollowUpDaySheet'

/**
 * Month-grid calendar showing every entry that has a followUpDate.
 * Click a day with follow-ups → expand a sheet below showing the
 * leads with quick-action buttons (email, IG, LinkedIn, open
 * detail). The detail modal is wired through onOpenEntry — same as
 * the list view's row-click behavior — so users get full editable
 * details without leaving the calendar context.
 *
 * Implementation: pure UI atop existing state. No new persistence.
 * Future: hook into an external calendar (Google / Outlook) via the
 * `integratable` follow-on Dylan mentioned — when wired, each cell
 * here becomes a real event in the user's external calendar.
 */
export function FollowUpCalendar({
  entries,
  onOpenEntry,
  profile,
}: {
  entries: OutreachEntry[]
  onUpdate: (id: string, field: keyof OutreachEntry, value: any) => void
  onOpenEntry: (id: string) => void
  profile: UserProfile | null
}) {
  // Anchored to the first of the displayed month. Navigation arrows
  // mutate this in 1-month steps.
  const [viewMonth, setViewMonth] = useState(() => {
    const d = new Date()
    return new Date(d.getFullYear(), d.getMonth(), 1)
  })
  const [selectedIso, setSelectedIso] = useState<string | null>(null)

  // ISO yyyy-mm-dd from a Date.
  const toIso = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

  // Bucket all entries by their followUpDate string. Skip entries
  // with no date — they don't belong on a calendar anyway.
  const byDate = useMemo(() => {
    const map = new Map<string, OutreachEntry[]>()
    for (const e of entries) {
      if (!e.followUpDate) continue
      const list = map.get(e.followUpDate) ?? []
      list.push(e)
      map.set(e.followUpDate, list)
    }
    return map
  }, [entries])

  // Build the grid: full weeks (Sunday-start) covering the view month.
  // Includes leading days from the previous month + trailing days from
  // the next month so every row has 7 cells.
  const gridDays = useMemo(() => {
    const first = new Date(viewMonth.getFullYear(), viewMonth.getMonth(), 1)
    const start = new Date(first)
    start.setDate(first.getDate() - first.getDay())
    const lastOfMonth = new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 0)
    const end = new Date(lastOfMonth)
    end.setDate(lastOfMonth.getDate() + (6 - lastOfMonth.getDay()))
    const out: Date[] = []
    for (let d = new Date(start); d.getTime() <= end.getTime(); d.setDate(d.getDate() + 1)) {
      out.push(new Date(d))
    }
    return out
  }, [viewMonth])

  const todayIsoStr = toIso(new Date())
  const monthLabel = viewMonth.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
  const totalThisMonth = entries.filter(e => {
    const d = parseLocalDate(e.followUpDate)
    return d && d.getFullYear() === viewMonth.getFullYear() && d.getMonth() === viewMonth.getMonth()
  }).length

  // Overdue: any entry whose follow-up date is in the past AND whose
  // outreach is still in flight (not Successful / Rejected). These
  // get a muted-amber pill on today's tile so missed deadlines stop
  // vanishing from view. Computed once per render — the day sheet
  // for today consumes the same list as its "Overdue" section.
  // Dylan 2026-06-08 (post-data-loss redesign).
  const overdueEntries = useMemo(() => {
    const today = new Date(); today.setHours(0, 0, 0, 0)
    return entries.filter(e => {
      if (e.status === 'Successful' || e.status === 'Rejected') return false
      const d = parseLocalDate(e.followUpDate)
      if (!d) return false
      d.setHours(0, 0, 0, 0)
      return d.getTime() < today.getTime()
    }).sort((a, b) => {
      // Oldest miss first — most overdue at the top of the list.
      const da = parseLocalDate(a.followUpDate)?.getTime() ?? 0
      const db = parseLocalDate(b.followUpDate)?.getTime() ?? 0
      return da - db
    })
  }, [entries])
  const overdueCount = overdueEntries.length

  // Bucket → tailwind color class for the dot. Mirrors the High /
  // Medium / Low convention in the list view.
  // 2026-06-08: past dates where the entry is overdue (status still
  // in flight) get a desaturated/muted variant so they read as
  // "historical guilt" rather than "active alert." The active alert
  // moves to today's tile via the overdue pill.
  function dotClass(e: OutreachEntry, dayIsoForBucket: string): string {
    if (e.status === 'No Response') return 'bg-purple-500'
    const d = parseLocalDate(e.followUpDate)
    if (!d) return 'bg-gray-500'
    const today = new Date(); today.setHours(0, 0, 0, 0)
    const dayDate = parseLocalDate(dayIsoForBucket)
    if (!dayDate) return 'bg-gray-500'
    const diffDays = Math.round((dayDate.getTime() - today.getTime()) / 86_400_000)
    if (diffDays < 0) {
      // Past + still in flight → muted (history). Closed-out entries
      // (Successful/Rejected) keep their normal color since they're
      // not actually overdue.
      const inFlight = e.status !== 'Successful' && e.status !== 'Rejected'
      return inFlight ? 'bg-red-500/30' : 'bg-red-500'
    }
    if (diffDays === 0) return 'bg-red-500'
    if (diffDays <= 7) return 'bg-yellow-500'
    return 'bg-blue-500'
  }

  return (
    <div className="space-y-4">
      {/* HEADER — month nav + count summary */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() =>
              setViewMonth(new Date(viewMonth.getFullYear(), viewMonth.getMonth() - 1, 1))
            }
            className="w-8 h-8 rounded-md border border-border text-muted-foreground hover:border-purple-500/50 hover:text-foreground transition-colors flex items-center justify-center"
            aria-label="Previous month"
          >
            ‹
          </button>
          <h2 className="text-base font-semibold text-foreground tabular-nums w-44 text-center">
            {monthLabel}
          </h2>
          <button
            type="button"
            onClick={() =>
              setViewMonth(new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 1))
            }
            className="w-8 h-8 rounded-md border border-border text-muted-foreground hover:border-purple-500/50 hover:text-foreground transition-colors flex items-center justify-center"
            aria-label="Next month"
          >
            ›
          </button>
          <button
            type="button"
            onClick={() => {
              const today = new Date()
              setViewMonth(new Date(today.getFullYear(), today.getMonth(), 1))
              setSelectedIso(toIso(today))
            }}
            className="ml-1 px-2.5 py-1 text-[11px] rounded-md border border-border text-muted-foreground hover:text-foreground hover:border-purple-500/40 transition-colors"
          >
            Today
          </button>
        </div>
        <div className="text-[11px] text-muted-foreground tabular-nums">
          {totalThisMonth} follow-up{totalThisMonth === 1 ? '' : 's'} this month
        </div>
      </div>

      {/* DAY-OF-WEEK HEADERS */}
      <div className="grid grid-cols-7 gap-1">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
          <div
            key={d}
            className="text-[10px] uppercase tracking-[0.18em] font-bold text-muted-foreground text-center py-1.5"
          >
            {d}
          </div>
        ))}
      </div>

      {/* MONTH GRID */}
      <div className="grid grid-cols-7 gap-1">
        {gridDays.map(d => {
          const iso = toIso(d)
          const dayEntries = byDate.get(iso) ?? []
          const inMonth = d.getMonth() === viewMonth.getMonth()
          const isToday = iso === todayIsoStr
          const isSelected = iso === selectedIso

          return (
            <button
              key={iso}
              type="button"
              onClick={() => setSelectedIso(prev => (prev === iso ? null : iso))}
              className={`relative min-h-[72px] rounded-md border text-left p-1.5 transition-colors flex flex-col ${
                isSelected
                  ? 'border-purple-500 bg-purple-500/10'
                  : isToday
                  ? 'border-purple-500/50 bg-purple-500/5 hover:bg-purple-500/10'
                  : inMonth
                  ? 'border-border bg-card/40 hover:bg-card/80'
                  : 'border-border/40 bg-transparent text-muted-foreground/50 hover:bg-card/20'
              }`}
              aria-label={`${d.toDateString()} — ${dayEntries.length} follow-up${dayEntries.length === 1 ? '' : 's'}`}
            >
              <span
                className={`text-[11px] font-mono tabular-nums ${
                  isToday ? 'text-purple-500 font-bold' : ''
                }`}
              >
                {d.getDate()}
              </span>
              {/* Overdue pill — only on today's tile when there are
                  past-due in-flight follow-ups. Subtle amber so it
                  doesn't compete with today's actual dot count, but
                  unmissable when present. Clicking the tile opens
                  the day sheet which shows the Overdue section
                  inline above today's follow-ups. */}
              {isToday && overdueCount > 0 && (
                <span
                  className="absolute top-1 right-1 inline-flex items-center gap-0.5 text-[9px] font-semibold tabular-nums px-1.5 py-0.5 rounded-full border border-amber-500/40 bg-amber-500/15 text-amber-700 dark:text-amber-300 leading-none"
                  title={`${overdueCount} follow-up${overdueCount === 1 ? '' : 's'} missed and still pending — click to see them.`}
                >
                  ⚠ {overdueCount}
                </span>
              )}
              {dayEntries.length > 0 && (
                <div className="mt-1 flex flex-wrap gap-1 items-start">
                  {dayEntries.slice(0, 3).map(e => (
                    <span
                      key={e.id}
                      className={`w-1.5 h-1.5 rounded-full ${dotClass(e, iso)}`}
                      aria-hidden
                    />
                  ))}
                  {dayEntries.length > 3 && (
                    <span className="text-[9px] font-bold text-muted-foreground leading-none">
                      +{dayEntries.length - 3}
                    </span>
                  )}
                </div>
              )}
            </button>
          )
        })}
      </div>

      {/* SELECTED DAY SHEET — when today is open, pass the overdue
          list so the sheet can render its "Overdue" section above
          today's regular follow-ups. */}
      {selectedIso && (
        <FollowUpDaySheet
          dateIso={selectedIso}
          entries={byDate.get(selectedIso) ?? []}
          overdueEntries={selectedIso === todayIsoStr ? overdueEntries : []}
          onClose={() => setSelectedIso(null)}
          onOpenEntry={onOpenEntry}
          profile={profile}
        />
      )}

      {/* LEGEND */}
      <div className="flex items-center gap-4 text-[10px] text-muted-foreground flex-wrap">
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-red-500" /> Overdue / today
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-yellow-500" /> Due this week
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-blue-500" /> Future
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-purple-500" /> Ghosted (No Response)
        </span>
      </div>
    </div>
  )
}
