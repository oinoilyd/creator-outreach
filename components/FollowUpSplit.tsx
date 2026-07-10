'use client'

/**
 * Mini-calendar + always-visible-agenda split view for the Follow-ups tab.
 *
 * Layout: 300px mini-month-calendar on the left, full agenda for the
 * currently-selected day on the right (always visible — no click-to-
 * expand). Mirrors Outlook's calendar sidebar mode.
 *
 * Click any day in the mini-cal to switch the agenda. Today / Tomorrow
 * quick-pick buttons under the mini-cal for the common cases. Dots on
 * the mini-cal indicate which days have follow-ups scheduled.
 */

import { useState } from 'react'
import type { OutreachEntry, UserProfile } from '@/lib/types'
import { toIso, parseLocalDate, nextScheduledIsoAfter } from './follow-up-shared'
import { formatDueDate } from '@/lib/dates'
import { FollowUpDayRow } from '@/components/follow-ups/FollowUpDayRow'

interface Props {
  entries: OutreachEntry[]
  onOpenEntry: (id: string) => void
  profile: UserProfile | null
}

export function FollowUpSplit({ entries, onOpenEntry, profile }: Props) {
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const [viewMonth, setViewMonth] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1))
  const [selIso, setSelIso] = useState(toIso(today))

  const start = new Date(viewMonth); start.setDate(viewMonth.getDate() - viewMonth.getDay())
  const lastOfMonth = new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 0)
  const end = new Date(lastOfMonth); end.setDate(lastOfMonth.getDate() + (6 - lastOfMonth.getDay()))
  const grid: Date[] = []
  for (let d = new Date(start); d.getTime() <= end.getTime(); d.setDate(d.getDate() + 1)) grid.push(new Date(d))

  const byDay = new Map<string, OutreachEntry[]>()
  for (const e of entries) {
    if (!e.followUpDate) continue
    const list = byDay.get(e.followUpDate) ?? []
    list.push(e)
    byDay.set(e.followUpDate, list)
  }

  const selDay = parseLocalDate(selIso)
  const selEntries = byDay.get(selIso) ?? []

  return (
    <div className="grid grid-cols-1 md:grid-cols-[300px_1fr] gap-5">
      <aside>
        <div className="flex items-center justify-between mb-2">
          <button
            onClick={() => setViewMonth(new Date(viewMonth.getFullYear(), viewMonth.getMonth() - 1, 1))}
            className="w-6 h-6 rounded text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors"
          >‹</button>
          <h3 className="text-sm font-semibold">{viewMonth.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</h3>
          <button
            onClick={() => setViewMonth(new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 1))}
            className="w-6 h-6 rounded text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors"
          >›</button>
        </div>
        <div className="grid grid-cols-7 gap-0.5 mb-1">
          {['S','M','T','W','T','F','S'].map((d, i) => (
            <div key={i} className="text-[9px] text-center text-muted-foreground">{d}</div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-0.5">
          {grid.map(d => {
            const dIso = toIso(d)
            const dayEntries = byDay.get(dIso) ?? []
            const inMonth = d.getMonth() === viewMonth.getMonth()
            const isToday = toIso(today) === dIso
            const isSel = selIso === dIso
            return (
              <button
                key={dIso}
                onClick={() => setSelIso(dIso)}
                className={`relative aspect-square text-[10px] flex items-center justify-center rounded-md transition-colors ${
                  isSel ? 'bg-purple-500 text-white font-bold' :
                  isToday ? 'border border-purple-500 text-purple-500 font-semibold' :
                  inMonth ? 'hover:bg-muted/60 text-foreground' :
                  'text-muted-foreground/40'
                }`}
              >
                <span>{d.getDate()}</span>
                {dayEntries.length > 0 && !isSel && (
                  <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-purple-500" />
                )}
              </button>
            )
          })}
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <button
            onClick={() => { setViewMonth(new Date(today.getFullYear(), today.getMonth(), 1)); setSelIso(toIso(today)) }}
            className="text-[11px] py-1.5 rounded border border-border hover:border-purple-500/40 transition-colors"
          >Today</button>
          <button
            onClick={() => {
              const t = new Date(today); t.setDate(today.getDate() + 1)
              setViewMonth(new Date(t.getFullYear(), t.getMonth(), 1)); setSelIso(toIso(t))
            }}
            className="text-[11px] py-1.5 rounded border border-border hover:border-purple-500/40 transition-colors"
          >Tomorrow</button>
        </div>
      </aside>

      <section>
        <header className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <h3 className="text-lg font-semibold">
            {selDay?.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}
          </h3>
          <span className="text-[11px] text-muted-foreground">{selEntries.length} follow-up{selEntries.length === 1 ? '' : 's'}</span>
        </header>
        {selEntries.length === 0 ? (
          <div className="border border-dashed border-border rounded-xl py-12 px-6 text-center text-sm text-muted-foreground italic">
            Nothing scheduled for this day.
            {(() => {
              // Quiet-day pointer (2026-07-10) — same affordance as the
              // week strip: name the nearest upcoming follow-up, click
              // jumps the mini-cal + agenda to that day.
              const nextIso = nextScheduledIsoAfter(entries, selIso)
              if (!nextIso) return null
              return (
                <button
                  type="button"
                  onClick={() => {
                    const d = parseLocalDate(nextIso)
                    if (!d) return
                    setViewMonth(new Date(d.getFullYear(), d.getMonth(), 1))
                    setSelIso(nextIso)
                  }}
                  className="not-italic ml-2 text-xs text-purple-700 dark:text-purple-300 hover:underline underline-offset-2"
                >
                  Next follow-up: {formatDueDate(nextIso)} →
                </button>
              )
            })()}
          </div>
        ) : (
          // Shared day row (2026-07-10) — same component as the week
          // strip's day panel and the month view's day sheet, so all
          // three calendars' day lists stay identical by construction
          // (and this agenda gains the quick actions it lacked).
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
