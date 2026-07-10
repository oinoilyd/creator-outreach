'use client'

/**
 * Week-strip calendar variant for the Follow-ups tab.
 *
 * Shows a 7-day tall-tile strip at the top — each tile previews up to
 * 3 leads scheduled for that day. Click a tile → expanded panel below
 * with the full list for that day. The week navigator (‹ ›) lets the
 * user move forward/back through weeks.
 *
 * Trade-offs vs the month grid:
 *   • Way more info per cell (no clicking required for first 3 leads)
 *   • Only see 7 days at a time (vs 35 in the month grid)
 *   • Better when day-by-day execution is the workflow
 */

import { useState } from 'react'
import type { OutreachEntry, UserProfile } from '@/lib/types'
import { priColor, toIso, parseLocalDate, nextScheduledIsoAfter } from './follow-up-shared'
import { formatDueDate } from '@/lib/dates'
import { FollowUpDayRow } from '@/components/follow-ups/FollowUpDayRow'

interface Props {
  entries: OutreachEntry[]
  onOpenEntry: (id: string) => void
  profile: UserProfile | null
}

export function FollowUpWeekStrip({ entries, onOpenEntry, profile }: Props) {
  const [weekOffset, setWeekOffset] = useState(0)
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const sunday = new Date(today)
  sunday.setDate(today.getDate() - today.getDay() + weekOffset * 7)
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(sunday); d.setDate(sunday.getDate() + i)
    return d
  })
  const [selIso, setSelIso] = useState<string>(toIso(today))

  const selEntries = entries.filter(e => e.followUpDate === selIso)

  // Quiet-day pointer (2026-07-10): when the selected day is empty,
  // surface the nearest upcoming follow-up and let a click jump the
  // strip straight to its week + day.
  function jumpToIso(iso: string) {
    const d = parseLocalDate(iso)
    if (!d) return
    d.setHours(0, 0, 0, 0)
    const targetSunday = new Date(d); targetSunday.setDate(d.getDate() - d.getDay())
    const todaySunday = new Date(today); todaySunday.setDate(today.getDate() - today.getDay())
    setWeekOffset(Math.round((targetSunday.getTime() - todaySunday.getTime()) / (7 * 86_400_000)))
    setSelIso(iso)
  }
  const weekTotal = entries.filter(e => {
    const d = parseLocalDate(e.followUpDate)
    if (!d) return false
    return d.getTime() >= sunday.getTime() && d.getTime() < sunday.getTime() + 7 * 86_400_000
  }).length

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <button onClick={() => setWeekOffset(o => o - 1)} className="w-7 h-7 rounded-md border border-border text-muted-foreground hover:text-foreground hover:border-purple-500/40 transition-colors">‹</button>
          <span className="text-sm font-semibold tabular-nums w-44 text-center">
            {sunday.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} — {weekDays[6].toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
          </span>
          <button onClick={() => setWeekOffset(o => o + 1)} className="w-7 h-7 rounded-md border border-border text-muted-foreground hover:text-foreground hover:border-purple-500/40 transition-colors">›</button>
          {weekOffset !== 0 && (
            <button onClick={() => { setWeekOffset(0); setSelIso(toIso(today)) }} className="text-[11px] text-muted-foreground hover:text-foreground px-2 py-1 rounded border border-border">
              Back to today
            </button>
          )}
        </div>
        <span className="text-[11px] text-muted-foreground">{weekTotal} follow-up{weekTotal === 1 ? '' : 's'} this week</span>
      </div>

      <div className="grid grid-cols-7 gap-2">
        {weekDays.map(d => {
          const dIso = toIso(d)
          const dayEntries = entries.filter(e => e.followUpDate === dIso)
          const isToday = dIso === toIso(today)
          const isSel = dIso === selIso
          return (
            <button
              key={dIso}
              onClick={() => setSelIso(dIso)}
              className={`relative aspect-[3/4] rounded-xl border-2 p-3 text-left transition-all flex flex-col ${
                isSel ? 'border-purple-500 bg-purple-500/10 shadow-lg' :
                isToday ? 'border-purple-500/40 bg-purple-500/5' :
                'border-border bg-card/40 hover:border-border/80'
              }`}
            >
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                {d.toLocaleDateString(undefined, { weekday: 'short' })}
              </div>
              <div className={`text-2xl font-bold tabular-nums mt-0.5 ${isToday ? 'text-purple-500' : 'text-foreground'}`}>
                {d.getDate()}
              </div>
              {dayEntries.length > 0 && (
                <div className="mt-auto flex flex-col gap-0.5 min-w-0">
                  {dayEntries.slice(0, 3).map(e => (
                    // Per Dylan 2026-05-10: was splitting on space and
                    // taking only the first word, which produced cards
                    // reading "The" / "You" / "Andy" instead of useful
                    // names. Now show the full channel name and let
                    // CSS truncate with ellipsis at the tile's edge —
                    // gives "The Andy Show" / "Marques Brow…" / etc.
                    <div key={e.id} className="flex items-center gap-1 text-[10px] min-w-0">
                      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${priColor(e).dot}`} />
                      <span className="truncate text-foreground/80" title={e.channelName}>{e.channelName}</span>
                    </div>
                  ))}
                  {dayEntries.length > 3 && (
                    <div className="text-[9px] text-muted-foreground">+ {dayEntries.length - 3} more</div>
                  )}
                </div>
              )}
            </button>
          )
        })}
      </div>

      <section className="rounded-xl border border-purple-500/30 bg-purple-500/5 p-4">
        <h3 className="text-sm font-semibold mb-3">
          {parseLocalDate(selIso)?.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}
          <span className="ml-2 text-muted-foreground font-normal">· {selEntries.length} follow-up{selEntries.length === 1 ? '' : 's'}</span>
        </h3>
        {selEntries.length === 0 ? (
          <div className="text-xs text-muted-foreground italic">
            Nothing scheduled — quiet day.
            {(() => {
              const nextIso = nextScheduledIsoAfter(entries, selIso)
              if (!nextIso) return null
              return (
                <button
                  type="button"
                  onClick={() => jumpToIso(nextIso)}
                  className="not-italic ml-2 text-purple-700 dark:text-purple-300 hover:underline underline-offset-2"
                >
                  Next follow-up: {formatDueDate(nextIso)} →
                </button>
              )
            })()}
          </div>
        ) : (
          // Shared day row (2026-07-10) — same component the month
          // view's day sheet renders, so the two calendars' day lists
          // stay identical by construction. Adds the quick actions
          // (email / IG / LinkedIn / details) this panel used to lack.
          <ul className="space-y-2">
            {selEntries.map(e => (
              <FollowUpDayRow key={e.id} entry={e} profile={profile} onOpenEntry={onOpenEntry} />
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
