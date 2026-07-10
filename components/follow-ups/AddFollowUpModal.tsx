'use client'

/**
 * AddFollowUpModal — manually schedule a follow-up for any outreach
 * entry, from the Follow-ups tab.
 *
 * Why (Dylan 2026-06-10): the Follow Up Date column was removed from
 * the Outreach table (follow-ups are managed here now). This gives a
 * way to put a creator on the follow-up tracker by hand — pick an
 * entry, pick a date, done. Entries without a follow-up date sort to
 * the top since those are the usual targets.
 *
 * Pure UI over the existing onUpdate(entryId, 'followUpDate', iso)
 * handler — no new persistence path.
 */

import { useEffect, useMemo, useState } from 'react'
import type { OutreachEntry } from '@/lib/types'

interface AddFollowUpModalProps {
  entries: OutreachEntry[]
  onAdd: (entryId: string, dateIso: string) => void
  onClose: () => void
}

function isoDaysFromNow(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function AddFollowUpModal({ entries, onAdd, onClose }: AddFollowUpModalProps) {
  const [query, setQuery] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [dateIso, setDateIso] = useState<string>(isoDaysFromNow(7))

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  // Filter by name/email; entries WITHOUT a follow-up date float up
  // (they're the usual reason you'd open this). Won/rejected leads are
  // excluded (2026-07-10): the tracker never shows terminal statuses,
  // so scheduling one silently vanished — the exact "button does
  // nothing" trap this modal had. Reopen the lead from the Outreach
  // tab first if it genuinely needs another ping.
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    const matches = entries.filter(e => {
      if (e.status === 'Successful' || e.status === 'Rejected') return false
      if (!q) return true
      return (
        (e.channelName ?? '').toLowerCase().includes(q) ||
        (e.email ?? '').toLowerCase().includes(q)
      )
    })
    return matches.sort((a, b) => {
      const aHas = a.followUpDate ? 1 : 0
      const bHas = b.followUpDate ? 1 : 0
      if (aHas !== bHas) return aHas - bHas // no-date first
      return (a.channelName ?? '').localeCompare(b.channelName ?? '')
    }).slice(0, 50)
  }, [entries, query])

  function confirm() {
    if (!selectedId || !dateIso) return
    onAdd(selectedId, dateIso)
    onClose()
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Add a follow-up"
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="bg-card border border-border rounded-xl shadow-xl max-w-md w-full flex flex-col max-h-[85vh]"
        onClick={e => e.stopPropagation()}
      >
        <div className="px-5 pt-5 pb-3 border-b border-border/60">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-foreground">Add a follow-up</h2>
            <button onClick={onClose} aria-label="Close" className="text-muted-foreground hover:text-foreground text-lg leading-none w-7 h-7 inline-flex items-center justify-center rounded hover:bg-muted/40 transition-colors">✕</button>
          </div>
          <p className="text-xs text-muted-foreground mt-1">Pick a creator from your outreach and schedule when to ping them — they&apos;ll show on the tracker and calendars for that date. Won/rejected leads aren&apos;t listed.</p>
        </div>

        <div className="px-5 py-3 border-b border-border/60">
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search your outreach…"
            autoFocus
            className="w-full bg-muted border border-border rounded px-3 py-2 text-sm text-foreground focus:outline-none focus:border-purple-500"
          />
        </div>

        {/* Entry list */}
        <div className="flex-1 overflow-y-auto px-2 py-2 min-h-[120px]">
          {filtered.length === 0 ? (
            <div className="text-xs text-muted-foreground text-center py-8">
              {entries.length === 0 ? 'No outreach entries yet.' : 'No matches.'}
            </div>
          ) : (
            <ul className="space-y-0.5">
              {filtered.map(e => (
                <li key={e.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedId(e.id)}
                    className={`w-full text-left px-3 py-2 rounded-md transition-colors ${
                      selectedId === e.id
                        ? 'bg-purple-500/15 border border-purple-500/40'
                        : 'border border-transparent hover:bg-muted/50'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium text-foreground truncate">{e.channelName || '(unnamed)'}</span>
                      {e.followUpDate && (
                        <span className="text-[10px] text-amber-700 dark:text-amber-400 shrink-0">has one: {e.followUpDate}</span>
                      )}
                    </div>
                    {e.email && <div className="text-[11px] text-muted-foreground truncate">{e.email}</div>}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Date + confirm */}
        <div className="px-5 py-4 border-t border-border/60 flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <label htmlFor="fu-date" className="text-xs text-muted-foreground">Follow up on</label>
            <input
              id="fu-date"
              type="date"
              value={dateIso}
              onChange={e => setDateIso(e.target.value)}
              className="bg-muted border border-border rounded px-2 py-1.5 text-sm text-foreground focus:outline-none focus:border-purple-500"
            />
          </div>
          <div className="flex-1" />
          <button onClick={onClose} className="text-sm text-muted-foreground hover:text-foreground px-3 py-2 transition-colors">Cancel</button>
          <button
            onClick={confirm}
            disabled={!selectedId || !dateIso}
            className="text-sm font-semibold px-4 py-2 rounded-md bg-blue-600 text-white hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Add follow-up
          </button>
        </div>
      </div>
    </div>
  )
}
