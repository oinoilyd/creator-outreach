'use client'

import { useEffect, useRef } from 'react'
// Cadence lives in one place. It used to be duplicated here and drifted
// out of sync (first follow-up stayed 3 days while lib/outreach moved to
// 5), so both popovers showed a stale interval. Import the canonical one.
// nextFollowUpIso applies the business-day rule for the first follow-up;
// followUpStageLabel names the stage so the popovers say WHICH follow-up
// they're scheduling/logging.
import { nextFollowUpDays, nextFollowUpIso, followUpStageLabel } from '@/lib/outreach'

function isoDaysFromNow(days: number): string {
  const d = new Date(); d.setDate(d.getDate() + days)
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}

// Cadence-aware date picker popover. Used in two places: the
// Follow-up Date cell on the outreach grid, and the date pill on a
// Follow-ups row.
//
// Renders absolutely-positioned content. Caller controls open state
// and triggers it via an `open` flag — caller is also responsible for
// click-outside / dismiss handling, since that's display-context-dependent.
export function CadencePopover({
  currentDate,
  touchpoints,
  onPick,
  onClose,
  onLogFollowUp,
  align = 'left',
}: {
  currentDate: string
  touchpoints: number
  onPick: (iso: string) => void
  onClose: () => void
  /** When provided, the popover leads with a "Log follow-up sent"
   *  action — logging + rescheduling live in ONE control (the due
   *  pill), instead of two competing row buttons. 2026-07-07. */
  onLogFollowUp?: () => void
  align?: 'left' | 'right'
}) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    function onClick(ev: MouseEvent) {
      if (ref.current && !ref.current.contains(ev.target as Node)) onClose()
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [onClose])

  // Cadence interval keyed on the CURRENT touch count — same convention
  // as the auto path (after touch N, wait nextFollowUpDays(N)). The old
  // `touchpoints + 1` here made a lead awaiting its first follow-up show
  // +7d while the auto path scheduled 5 business days.
  const cadenceDays = nextFollowUpDays(touchpoints)
  const cadenceIso = nextFollowUpIso(touchpoints)
  const stage = followUpStageLabel(touchpoints)
  const setRel = (d: number) => onPick(isoDaysFromNow(d))

  return (
    <div
      ref={ref}
      className={`absolute ${align === 'right' ? 'right-0' : 'left-0'} top-full mt-1 z-30 w-64 rounded-lg border border-border bg-card shadow-2xl shadow-black/40 p-3 text-xs normal-case font-normal`}
    >
      {/* Log-first: the common case is "I just sent it" — one click
          records the touch and auto-schedules the next on the cadence.
          Rescheduling (the less common case) lives below the divider.
          Both verbs in ONE control (the due pill) instead of two
          competing row buttons. */}
      {onLogFollowUp && (
        <>
          <button
            onClick={onLogFollowUp}
            title="Records the send — touch count goes up, next follow-up auto-schedules on your cadence."
            className="w-full px-3 py-2 text-[11px] font-semibold text-white bg-purple-600 hover:bg-purple-500 border border-purple-500 rounded-md shadow-sm transition-colors flex items-center justify-between"
          >
            <span>✓ Log follow-up sent</span>
            <span className="text-[10px] font-normal text-purple-200/90">{stage} → touch {touchpoints + 1}</span>
          </button>
          <div className="flex items-center gap-2 my-2.5">
            <div className="flex-1 h-px bg-border" />
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground/70">or reschedule</span>
            <div className="flex-1 h-px bg-border" />
          </div>
        </>
      )}
      <button
        onClick={() => onPick(cadenceIso)}
        title={`Schedules the ${stage.toLowerCase()} on the smart cadence (business days for the first follow-up, calendar after)`}
        className="w-full mb-2 px-3 py-1.5 text-[11px] font-medium text-purple-100 bg-purple-600/40 hover:bg-purple-600/60 border border-purple-500/50 rounded-md transition-colors flex items-center justify-between"
      >
        <span>Use cadence</span>
        <span className="text-[10px] text-purple-300/80">+{cadenceDays}d · {stage}</span>
      </button>

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
            onClick={() => setRel(p.days)}
            className="px-2 py-1 text-[11px] text-foreground/80 bg-muted/60 hover:bg-muted hover:text-foreground border border-border hover:border-border/80 rounded transition-colors"
          >
            {p.label}
          </button>
        ))}
      </div>

      <div className="border-t border-border pt-2">
        <label className="block text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Pick a specific date</label>
        <input
          type="date"
          value={currentDate || ''}
          onChange={ev => onPick(ev.target.value)}
          className="w-full bg-muted border border-border rounded px-2 py-1 text-[11px] text-foreground focus:outline-none focus:border-purple-500"
        />
      </div>

      {currentDate && (
        <button
          onClick={() => onPick('')}
          className="w-full mt-2 px-3 py-1 text-[11px] text-muted-foreground hover:text-red-300 border border-border hover:border-red-500/50 rounded transition-colors"
        >
          Clear date
        </button>
      )}
    </div>
  )
}

