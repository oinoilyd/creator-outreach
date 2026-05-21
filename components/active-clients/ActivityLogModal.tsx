'use client'

/**
 * ActivityLogModal — separate modal that surfaces an engagement's
 * append-only activity timeline. Opens on top of
 * ActiveClientDetailModal when the user clicks the "Activity log"
 * link in its footer.
 *
 * Why a separate modal?
 *   The timeline is audit history — useful occasionally, but if it's
 *   inline in the main modal it pulls attention away from the edit
 *   surfaces (Team, Milestones, Contract). Hiding it behind a single
 *   click drops it from the default attention surface without burying
 *   it; users who want it can still get to it in one tap.
 *
 * Stack note:
 *   This is a nested modal — the parent ActiveClientDetailModal stays
 *   mounted underneath. We rely on the focus-trap installed there to
 *   keep tab/keyboard nav sane. Escape closes THIS modal first because
 *   we mount our handler on top of the parent's; the runtime calls
 *   the most-recently-added listener last, so the topmost modal wins.
 */

import { useEffect, useId, useRef } from 'react'
import { motion } from 'motion/react'
import type { ClientActivityEvent } from '@/lib/types'
import { useFocusTrap } from '@/lib/hooks/useFocusTrap'
import { X as XIcon } from 'lucide-react'
import { ActivityTimeline } from './ActivityTimeline'

interface ActivityLogModalProps {
  channelName: string
  events: ClientActivityEvent[]
  onClose: () => void
}

export function ActivityLogModal({
  channelName, events, onClose,
}: ActivityLogModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null)
  const titleId = useId()
  useFocusTrap(dialogRef, true)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        // Stop propagation so the parent ActiveClientDetailModal's
        // Escape handler doesn't fire too and close both at once.
        e.stopPropagation()
        onClose()
      }
    }
    // Capture phase + topmost listener — runs before the parent
    // modal's bubble-phase listener catches the same key.
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4"
      onClick={onClose}
    >
      <motion.div
        aria-hidden
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.15 }}
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
      />
      <motion.div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        initial={{ opacity: 0, scale: 0.97, y: 6 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ type: 'spring', bounce: 0.18, duration: 0.35 }}
        className="relative bg-card border border-border rounded-2xl shadow-2xl shadow-black/40 w-full max-w-md max-h-[80vh] overflow-hidden focus:outline-none flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 pt-4 pb-3 border-b border-border flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <h2 id={titleId} className="text-base font-semibold text-foreground truncate">
              Activity log
            </h2>
            <div className="text-[11.5px] text-muted-foreground/75 mt-0.5 truncate">
              {channelName || '(unnamed engagement)'}
              {events.length > 0 && (
                <>
                  <span className="text-muted-foreground/40 mx-1.5">·</span>
                  <span className="tabular-nums">{events.length} event{events.length === 1 ? '' : 's'}</span>
                </>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close activity log"
            className="shrink-0 text-muted-foreground hover:text-foreground w-7 h-7 inline-flex items-center justify-center rounded hover:bg-muted/40 transition-colors"
          >
            <XIcon className="w-4 h-4" />
          </button>
        </div>

        {/* Body — scrollable timeline */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {events.length === 0 ? (
            <div className="text-center py-10">
              <p className="text-[13px] text-muted-foreground/75 italic">
                No activity recorded yet. State changes show up here as you
                edit budget, timeline, milestones, contract, and lifecycle.
              </p>
            </div>
          ) : (
            <ActivityTimeline events={events} />
          )}
        </div>
      </motion.div>
    </div>
  )
}
