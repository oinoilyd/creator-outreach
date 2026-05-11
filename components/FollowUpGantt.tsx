'use client'

/**
 * Gantt-style horizontal-timeline view for the Follow-ups tab.
 *
 * Each lead is a row. A horizontal bar spans from the date the user
 * first reached out → the upcoming follow-up date. The "Sent" milestone
 * is rendered as a dashed-box at the bar's start; the "FU" milestone is
 * a solid badge at the bar's end (colored by priority bucket).
 *
 * Window: -3 to +18 days (3 weeks visible). Beyond the window the lead
 * doesn't render here — use List view for the long-tail.
 *
 * Click a lead's name to open the detail modal (same handler as the
 * other variants).
 */

import type { OutreachEntry, UserProfile } from '@/lib/types'
import {
  priColor, moneyShort, dealValueNum,
  parseLocalDate, daysFromNow,
} from './follow-up-shared'

interface Props {
  entries: OutreachEntry[]
  onOpenEntry: (id: string) => void
  profile: UserProfile | null
}

const WINDOW_DAYS = 21
const START_OFFSET = -3

export function FollowUpGantt({ entries, onOpenEntry }: Props) {
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const days = Array.from({ length: WINDOW_DAYS }, (_, i) => {
    const d = new Date(today); d.setDate(today.getDate() + START_OFFSET + i)
    return d
  })

  const sorted = entries
    .filter(e => {
      const fu = parseLocalDate(e.followUpDate)
      if (!fu) return false
      const dn = daysFromNow(e.followUpDate)
      return dn >= START_OFFSET && dn < START_OFFSET + WINDOW_DAYS
    })
    .sort((a, b) => daysFromNow(a.followUpDate) - daysFromNow(b.followUpDate))

  return (
    <div className="space-y-3">
      <div className="text-[11px] text-muted-foreground">
        3-week horizontal timeline — each row is a lead, the bar spans
        from when you reached out to the next follow-up date. Click a
        name to open the lead detail.
      </div>

      {/* Day headers */}
      <div className="grid gap-px text-center" style={{ gridTemplateColumns: `220px repeat(${WINDOW_DAYS}, minmax(0, 1fr))` }}>
        <div />
        {days.map((d, i) => {
          const isToday = d.toDateString() === today.toDateString()
          return (
            <div key={i} className={`text-[10px] py-1 ${isToday ? 'font-bold text-purple-500' : 'text-muted-foreground'}`}>
              <div>{d.toLocaleDateString(undefined, { weekday: 'narrow' })}</div>
              <div className="tabular-nums">{d.getDate()}</div>
            </div>
          )
        })}
      </div>

      {sorted.length === 0 ? (
        <div className="border border-dashed border-border rounded-xl py-12 px-6 text-center text-sm text-muted-foreground italic">
          No follow-ups in the next 3 weeks.
        </div>
      ) : (
        <div className="space-y-1">
          {sorted.map(e => {
            const fuOff = daysFromNow(e.followUpDate) - START_OFFSET
            const sentOff = e.dateReachedOut
              ? daysFromNow(e.dateReachedOut) - START_OFFSET
              : null
            const barStart = sentOff !== null && sentOff >= 0 ? sentOff : fuOff
            const barEnd = fuOff
            const p = priColor(e)
            return (
              <div
                key={e.id}
                className="grid gap-px items-center"
                style={{ gridTemplateColumns: `220px repeat(${WINDOW_DAYS}, minmax(0, 1fr))` }}
              >
                <button
                  onClick={() => onOpenEntry(e.id)}
                  className="pr-3 flex items-center gap-2 min-w-0 text-left hover:bg-muted/30 rounded px-1 transition-colors"
                >
                  <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${p.dot}`} />
                  <span className="text-xs font-medium truncate">{e.channelName}</span>
                  {dealValueNum(e) > 0 && <span className="text-[10px] font-mono text-emerald-700 dark:text-emerald-400 ml-auto shrink-0">{moneyShort(e.dealValue)}</span>}
                </button>
                {days.map((_, i) => {
                  const inBar = i >= barStart && i <= barEnd && barEnd >= 0
                  const isFu = i === barEnd && barEnd >= 0
                  const isSent = i === sentOff && sentOff !== null
                  return (
                    <div key={i} className="relative h-6 border-r border-border/30 last:border-r-0">
                      {inBar && !isSent && !isFu && (
                        <div className={`absolute inset-y-1.5 left-0 right-0 ${p.dot} opacity-25`} />
                      )}
                      {isSent && (
                        <div className="absolute inset-y-1 left-0.5 right-0.5 rounded-sm border border-dashed border-muted-foreground/60 flex items-center justify-center">
                          <span className="text-[8px] text-muted-foreground">Sent</span>
                        </div>
                      )}
                      {isFu && (
                        <div className={`absolute inset-y-0.5 left-0.5 right-0.5 rounded ${p.dot} flex items-center justify-center`}>
                          <span className="text-[9px] font-bold text-white">FU</span>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )
          })}
        </div>
      )}

      {/* Legend */}
      <div className="flex items-center gap-4 text-[10px] text-muted-foreground flex-wrap pt-3 border-t border-border/40">
        <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-red-500" /> Overdue/today</span>
        <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-amber-500" /> Due this week</span>
        <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-blue-500" /> Future</span>
        <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-purple-500" /> Ghosted — no reply in 30+ days</span>
      </div>
    </div>
  )
}
