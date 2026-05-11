'use client'

import React, { useState, useEffect, useRef } from 'react'
import type { OutreachEntry } from '@/lib/types'
import {
  parseLocalDate,
  isoDaysFromNow,
  daysAgo,
  daysFromNow,
} from '@/lib/dates'
import { nextFollowUpDays } from '@/lib/outreach'

// Follow-up date cell — shows a colored urgency pill and opens a popover
// with a manual date picker plus quick cadence buttons (Tomorrow / +3d /
// +1w / +2w / +1m) and a smart "Use cadence" button that picks the right
// next-step interval based on how many touches the lead has had.
export function FollowUpDateCell({ entry, onUpdate }: {
  entry: OutreachEntry
  onUpdate: (id: string, field: keyof OutreachEntry, value: any) => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onClick(ev: MouseEvent) {
      if (ref.current && !ref.current.contains(ev.target as Node)) setOpen(false)
    }
    if (open) document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [open])

  const tps = parseInt(entry.touchpoints || '0', 10) || 0
  const cadenceDays = nextFollowUpDays(tps + 1)
  const isUnset = !entry.followUpDate
  const dateObj = parseLocalDate(entry.followUpDate)
  const todayMs = (() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d.getTime() })()
  const isOverdue = !!dateObj && (() => { const d = new Date(dateObj); d.setHours(0, 0, 0, 0); return d.getTime() < todayMs })()
  const isToday = !!dateObj && (() => { const d = new Date(dateObj); d.setHours(0, 0, 0, 0); return d.getTime() === todayMs })()

  const pillClass = isUnset
    ? 'bg-muted/50 text-muted-foreground border-border hover:border-border'
    : isOverdue
      ? 'bg-red-50 dark:bg-red-500/15 text-red-700 dark:text-red-300 border-red-200 dark:border-red-500/40 hover:border-red-300 dark:hover:border-red-400'
      : isToday
        ? 'bg-amber-50 dark:bg-yellow-500/15 text-amber-800 dark:text-yellow-300 border-amber-200 dark:border-yellow-500/40 hover:border-amber-300 dark:hover:border-yellow-400'
        : 'bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-500/30 hover:border-blue-300 dark:hover:border-blue-400'

  const label = isUnset
    ? '+ set'
    : isOverdue
      ? `${daysAgo(entry.followUpDate)} late`
      : isToday
        ? 'today'
        : `in ${daysFromNow(entry.followUpDate)}d`

  function setDate(iso: string) {
    onUpdate(entry.id, 'followUpDate', iso)
    setOpen(false)
  }

  function setRelative(days: number) {
    setDate(isoDaysFromNow(days))
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(v => !v)}
        title={isUnset ? 'No follow-up date — click to set one' : `Follow-up: ${entry.followUpDate}`}
        className={`w-full text-[10px] uppercase tracking-wider px-2 py-1 rounded border transition-colors text-center ${pillClass}`}
      >
        {label}
      </button>
      {open && (
        <div className="absolute left-0 top-full mt-1 z-30 w-64 rounded-lg border border-border bg-card shadow-2xl p-3 text-xs normal-case font-normal">
          {/* Smart "Use cadence" — top action */}
          <button
            onClick={() => setRelative(cadenceDays)}
            className="w-full mb-2 px-3 py-1.5 text-[11px] font-medium text-purple-100 bg-purple-600/40 hover:bg-purple-600/60 border border-purple-500/50 rounded-md transition-colors flex items-center justify-between"
            title="Set to today + the smart cadence step based on this lead's current touch count"
          >
            <span>Use cadence</span>
            <span className="text-[10px] text-purple-700 dark:text-purple-300/80">+{cadenceDays}d (touch {tps + 1})</span>
          </button>

          {/* Quick presets */}
          <div className="grid grid-cols-2 gap-1 mb-2">
            {[
              { label: 'Tomorrow', days: 1 },
              { label: '+3 days', days: 3 },
              { label: '+1 week', days: 7 },
              { label: '+2 weeks', days: 14 },
              { label: '+1 month', days: 30 },
            ].map(p => (
              <button
                key={p.label}
                onClick={() => setRelative(p.days)}
                className="px-2 py-1 text-[11px] text-foreground/80 bg-muted/60 hover:bg-muted hover:text-foreground border border-border hover:border-border rounded transition-colors"
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Manual date picker */}
          <div className="border-t border-border pt-2">
            <label className="block text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Pick a specific date</label>
            <input
              type="date"
              value={entry.followUpDate || ''}
              onChange={ev => onUpdate(entry.id, 'followUpDate', ev.target.value)}
              className="w-full bg-muted border border-border rounded px-2 py-1 text-[11px] text-foreground focus:outline-none focus:border-purple-500"
            />
          </div>

          {/* Clear */}
          {!isUnset && (
            <button
              onClick={() => setDate('')}
              className="w-full mt-2 px-3 py-1 text-[11px] text-muted-foreground hover:text-red-700 dark:text-red-300 border border-border hover:border-red-500/50 rounded transition-colors"
            >
              Clear date
            </button>
          )}
        </div>
      )}
    </div>
  )
}
