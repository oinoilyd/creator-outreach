'use client'

/**
 * PromoteFromOutreachModal — picker for promoting an existing outreach
 * entry into an active-client engagement.
 *
 * Use case: Dylan has someone in his Outreach log who said yes to a
 * deal but he hadn't marked it Successful yet. Instead of switching
 * tabs to find the row and update the status, this modal lets him
 * pick from his outreach list right inside Active Clients.
 *
 * Behavior:
 *   • Shows all outreach entries with status !== 'Successful'
 *   • Search bar filters by channel name / email
 *   • Click a row → calls onPromote(entryId) which:
 *       - Sets status='Successful' via the parent's updateOutreachEntry
 *       - Dispatches goto-active-client event so the engagement card
 *         auto-opens once the row appears in the Active Clients view
 *   • Single-select — one promotion per click, modal closes after
 *
 * Sister flow to the "Add to Active Clients" CTA already in
 * LeadDetailModal, just initiated from the other direction.
 */

import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { motion } from 'motion/react'
import type { OutreachEntry } from '@/lib/types'
import { useFocusTrap } from '@/lib/hooks/useFocusTrap'
import { X as XIcon, Search, ArrowRight, Briefcase, Inbox } from 'lucide-react'

interface PromoteFromOutreachModalProps {
  /** All outreach entries — modal filters to non-Successful internally. */
  outreachEntries: OutreachEntry[]
  /** Called when user picks an entry. Should set status='Successful'
   *  and trigger the existing goto-active-client navigation flow. */
  onPromote: (entryId: string) => void
  onClose: () => void
}

export function PromoteFromOutreachModal({
  outreachEntries,
  onPromote,
  onClose,
}: PromoteFromOutreachModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null)
  const titleId = useId()
  useFocusTrap(dialogRef, true)

  const [query, setQuery] = useState('')

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [])

  // Hide Successful entries (those are already active clients) +
  // sort by most-recently-added so the newest outreaches surface
  // first. The user is likely promoting someone they JUST talked to.
  const eligible = useMemo(() => {
    const filtered = outreachEntries.filter(e => e.status !== 'Successful')
    const q = query.trim().toLowerCase()
    const matched = q
      ? filtered.filter(e =>
          (e.channelName || '').toLowerCase().includes(q)
          || (e.email || '').toLowerCase().includes(q)
          || (e.notes || '').toLowerCase().includes(q),
        )
      : filtered
    return matched.sort((a, b) => (b.addedAt ?? 0) - (a.addedAt ?? 0))
  }, [outreachEntries, query])

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
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
      />
      <motion.div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        initial={{ opacity: 0, scale: 0.96, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ type: 'spring', bounce: 0.18, duration: 0.4 }}
        className="relative bg-card border border-border rounded-2xl shadow-2xl shadow-black/40 w-full max-w-lg max-h-[80vh] flex flex-col focus:outline-none"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 pt-5 pb-3 border-b border-border flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 id={titleId} className="text-[16px] font-semibold text-foreground inline-flex items-center gap-2">
              <Inbox className="w-4 h-4 text-blue-500" aria-hidden />
              From outreach log
            </h2>
            <p className="text-[12.5px] text-muted-foreground/85 mt-0.5">
              Pick someone you&apos;ve already reached out to — clicking
              promotes them to an active client and opens their engagement.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 w-7 h-7 inline-flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors"
            aria-label="Close"
          >
            <XIcon className="w-4 h-4" />
          </button>
        </div>

        {/* Search bar */}
        <div className="px-5 pt-3">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/60" aria-hidden />
            <input
              type="search"
              autoFocus
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search by channel, email, or notes…"
              className="w-full bg-background border border-border rounded-md pl-8 pr-3 py-1.5 text-[13px] focus:outline-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-500/50"
            />
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto px-5 py-3">
          {eligible.length === 0 ? (
            <div className="text-center py-10">
              <Briefcase className="w-7 h-7 mx-auto text-muted-foreground/40 mb-2" aria-hidden />
              <p className="text-[13.5px] text-foreground/85 font-medium">
                {outreachEntries.filter(e => e.status !== 'Successful').length === 0
                  ? 'No outreach entries to promote'
                  : 'No matches'}
              </p>
              <p className="text-[11.5px] text-muted-foreground/75 mt-1">
                {outreachEntries.filter(e => e.status !== 'Successful').length === 0
                  ? 'Run a campaign first, then come back here once they say yes.'
                  : 'Try a different search.'}
              </p>
            </div>
          ) : (
            <ul className="space-y-1.5">
              {eligible.map(e => (
                <li key={e.id}>
                  <button
                    type="button"
                    onClick={() => onPromote(e.id)}
                    className="w-full group flex items-start gap-3 text-left px-3 py-2.5 rounded-lg border border-border bg-background hover:border-emerald-500/40 hover:bg-emerald-500/5 transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="font-medium text-foreground text-[13.5px] truncate">
                          {e.channelName || '(unnamed)'}
                        </span>
                        <StatusChip status={e.status} />
                      </div>
                      <div className="text-[11.5px] text-muted-foreground/80 truncate">
                        {e.email
                          ? <span className="font-mono">{e.email}</span>
                          : <span className="italic">no email on file</span>}
                        {e.dateReachedOut && (
                          <>
                            <span className="mx-1.5">·</span>
                            <span>reached out {formatDate(e.dateReachedOut)}</span>
                          </>
                        )}
                      </div>
                    </div>
                    <ArrowRight className="w-4 h-4 mt-1 text-muted-foreground/60 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 shrink-0 transition-colors" aria-hidden />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-border bg-muted/20 text-[11px] text-muted-foreground/80">
          <span className="font-semibold text-foreground/90">{eligible.length}</span>{' '}
          {eligible.length === 1 ? 'entry' : 'entries'} eligible
          {' '}
          <span className="text-muted-foreground/60">·</span>{' '}
          Already-Successful outreaches are hidden (they&apos;re already active clients)
        </div>
      </motion.div>
    </div>
  )
}

function StatusChip({ status }: { status: OutreachEntry['status'] }) {
  if (!status || status === 'Not Outreached') {
    return (
      <span className="text-[9.5px] uppercase tracking-wider px-1.5 py-0.5 rounded border bg-muted/40 text-muted-foreground border-border font-medium">
        Not outreached
      </span>
    )
  }
  const styles: Record<string, string> = {
    Open:           'bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/40',
    'No Response':  'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/40',
    Rejected:       'bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/40',
  }
  return (
    <span className={`text-[9.5px] uppercase tracking-wider px-1.5 py-0.5 rounded border font-medium ${styles[status] ?? 'bg-muted/40 text-muted-foreground border-border'}`}>
      {status}
    </span>
  )
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}
