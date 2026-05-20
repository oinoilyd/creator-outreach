'use client'

/**
 * EngagementStatusPill — small yellow pill that surfaces on outreach
 * rows where engagement_status='pending_confirmation'. These rows
 * were auto-created from a "Likely repeat" wrap-up flow on a prior
 * completed engagement, and need the user to confirm or deny whether
 * the next engagement is actually happening.
 *
 * Click → small popover with two actions:
 *   • Confirm — clears the pending flag, the row becomes a normal
 *     outreach line in the pipeline.
 *   • Deny — sets status='Rejected' + clears the pending flag, the
 *     row moves into the Rejected lane.
 *
 * Designed for the channel-name cell of OutreachTab. Stops event
 * propagation so clicking the pill doesn't trigger the row's other
 * click handlers.
 */

import { useEffect, useRef, useState } from 'react'
import type { OutreachEntry } from '@/lib/types'
import { CheckCircle2, XCircle, Clock } from 'lucide-react'

interface EngagementStatusPillProps {
  entry: OutreachEntry
  /** Fired with the field+value the parent should persist. Matches the
   *  existing updateOutreachEntry signature so wiring is trivial. */
  onUpdate: (id: string, field: keyof OutreachEntry, value: unknown) => void
}

export function EngagementStatusPill({ entry, onUpdate }: EngagementStatusPillProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  // Click-outside to close. Mirrors the pattern used by the column
  // header menu + the favorite tooltip in OutreachTab.
  useEffect(() => {
    if (!open) return
    function onMouseDown(ev: MouseEvent) {
      if (ref.current && !ref.current.contains(ev.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onMouseDown)
    return () => document.removeEventListener('mousedown', onMouseDown)
  }, [open])

  // Only render when the entry actually needs confirmation.
  if (entry.engagementStatus !== 'pending_confirmation') return null

  function confirmEngagement(ev: React.MouseEvent) {
    ev.stopPropagation()
    onUpdate(entry.id, 'engagementStatus', null)
    setOpen(false)
  }

  function denyEngagement(ev: React.MouseEvent) {
    ev.stopPropagation()
    onUpdate(entry.id, 'engagementStatus', null)
    // Setting status='Rejected' moves the row out of the active
    // pipeline. updateOutreachEntry in the parent handles the
    // reachedOut derivation + date stamps.
    onUpdate(entry.id, 'status', 'Rejected')
    setOpen(false)
  }

  return (
    <div ref={ref} className="relative inline-block">
      <button
        type="button"
        onClick={ev => { ev.stopPropagation(); setOpen(v => !v) }}
        className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] uppercase tracking-wider font-semibold bg-amber-500/15 border border-amber-500/40 text-amber-700 dark:text-amber-300 hover:bg-amber-500/25 transition-colors"
        title="Confirm or deny next engagement"
        aria-expanded={open}
      >
        <Clock className="w-2.5 h-2.5" aria-hidden />
        Pending
      </button>

      {open && (
        <div
          role="menu"
          className="absolute z-30 left-0 mt-1 w-[220px] rounded-md border border-border bg-card shadow-lg shadow-black/30 p-2 text-[12.5px]"
          onClick={ev => ev.stopPropagation()}
        >
          <div className="px-1.5 py-1 text-[10.5px] uppercase tracking-wider font-semibold text-muted-foreground">
            Confirm next engagement?
          </div>
          <p className="px-1.5 py-1 text-[11.5px] text-muted-foreground/85 leading-snug">
            This row was auto-created from a wrap-up where you marked the engagement <em>likely to repeat</em>.
          </p>
          <button
            type="button"
            onClick={confirmEngagement}
            className="w-full text-left flex items-center gap-2 px-2 py-1.5 rounded hover:bg-green-500/10 text-foreground transition-colors"
            role="menuitem"
          >
            <CheckCircle2 className="w-3.5 h-3.5 text-green-500" aria-hidden />
            <div className="flex-1">
              <div className="font-semibold">Yes, it&apos;s happening</div>
              <div className="text-[10.5px] text-muted-foreground/85">Becomes a normal outreach row.</div>
            </div>
          </button>
          <button
            type="button"
            onClick={denyEngagement}
            className="w-full text-left flex items-center gap-2 px-2 py-1.5 rounded hover:bg-rose-500/10 text-foreground transition-colors"
            role="menuitem"
          >
            <XCircle className="w-3.5 h-3.5 text-rose-500" aria-hidden />
            <div className="flex-1">
              <div className="font-semibold">No, it didn&apos;t pan out</div>
              <div className="text-[10.5px] text-muted-foreground/85">Marks the row Rejected.</div>
            </div>
          </button>
        </div>
      )}
    </div>
  )
}
