'use client'

/**
 * ActiveClientCard — single engagement card in the Active Clients view.
 *
 * Five editable fields (budget, timeline start/end, scope, contract URL,
 * notes). Each field saves on blur via the parent's onPatch handler.
 * Header shows the channel name + status pill + a tiny saving / error
 * indicator that fades out after a moment.
 *
 * Inline editing (not a modal) because most fields are short + the user
 * typically scans many cards at once. Tab key moves through inputs.
 */

import { useState, useEffect } from 'react'
import type { OutreachEntry } from '@/lib/types'
import type { ActiveClientPatch } from '@/lib/storage'
import { Check, Loader2, ExternalLink, AlertCircle } from 'lucide-react'

interface ActiveClientCardProps {
  entry: OutreachEntry
  saving: boolean
  saveError: string | null
  onPatch: (patch: ActiveClientPatch) => void
}

export function ActiveClientCard({ entry, saving, saveError, onPatch }: ActiveClientCardProps) {
  // Local draft state — we only push to onPatch when the user commits
  // (blur or Enter). Keeps the parent untouched on every keystroke.
  const [budget, setBudget] = useState<string>(
    typeof entry.clientBudgetAmount === 'number' ? String(entry.clientBudgetAmount) : '',
  )
  const [currency, setCurrency] = useState<string>(entry.clientBudgetCurrency || 'USD')
  const [start, setStart] = useState<string>(entry.clientTimelineStart || '')
  const [end, setEnd] = useState<string>(entry.clientTimelineEnd || '')
  const [scope, setScope] = useState<string>(entry.clientScope || '')
  const [contractUrl, setContractUrl] = useState<string>(entry.clientContractUrl || '')
  const [notes, setNotes] = useState<string>(entry.clientNotes || '')

  // Subtle "just saved" feedback — green check that fades after 1.5s.
  const [savedFlash, setSavedFlash] = useState(false)
  useEffect(() => {
    if (!saving && !saveError && savedFlash) {
      const t = setTimeout(() => setSavedFlash(false), 1500)
      return () => clearTimeout(t)
    }
  }, [saving, saveError, savedFlash])

  function commitBudget() {
    const trimmed = budget.trim()
    if (trimmed === '' && !entry.clientBudgetAmount) return // no change
    const n = trimmed === '' ? null : Number(trimmed)
    if (n != null && Number.isNaN(n)) return // ignore garbage
    onPatch({ clientBudgetAmount: n })
    setSavedFlash(true)
  }

  function commitCurrency() {
    const v = currency.trim().toUpperCase()
    if (v === (entry.clientBudgetCurrency || 'USD')) return
    onPatch({ clientBudgetCurrency: v || null })
    setSavedFlash(true)
  }

  function commitField<K extends keyof ActiveClientPatch>(
    key: K,
    next: string,
    current: string | null | undefined,
  ) {
    if (next === (current || '')) return
    onPatch({ [key]: next.trim() || null } as ActiveClientPatch)
    setSavedFlash(true)
  }

  const channel = entry.channelName || '(unnamed client)'
  const platformIcons = [
    entry.email && 'email',
    entry.linkedin && 'linkedin',
    entry.instagram && 'instagram',
  ].filter(Boolean) as string[]

  return (
    <div className="bg-card/40 border border-border rounded-xl p-5 flex flex-col gap-3">
      {/* Header — channel name + saving indicator */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="text-[15px] font-semibold text-foreground truncate">
              {channel}
            </h3>
            {entry.channelUrl && (
              <a
                href={entry.channelUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-muted-foreground/70 hover:text-foreground"
                aria-label="Open channel"
              >
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            )}
          </div>
          {platformIcons.length > 0 && (
            <div className="text-[11px] text-muted-foreground/70 mt-0.5">
              {platformIcons.join(' · ')}
            </div>
          )}
        </div>
        <div className="shrink-0 h-5 flex items-center">
          {saving && (
            <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />
          )}
          {!saving && savedFlash && !saveError && (
            <span className="inline-flex items-center gap-1 text-[11px] text-green-600 dark:text-green-400">
              <Check className="w-3 h-3" /> Saved
            </span>
          )}
          {saveError && (
            <span
              className="inline-flex items-center gap-1 text-[11px] text-red-600 dark:text-red-400"
              title={saveError}
            >
              <AlertCircle className="w-3 h-3" /> Error
            </span>
          )}
        </div>
      </div>

      {/* Budget + currency row */}
      <div className="grid grid-cols-3 gap-2">
        <div className="col-span-2">
          <FieldLabel>Budget</FieldLabel>
          <input
            type="text"
            inputMode="decimal"
            value={budget}
            onChange={e => setBudget(e.target.value.replace(/[^0-9.]/g, ''))}
            onBlur={commitBudget}
            onKeyDown={e => { if (e.key === 'Enter') (e.currentTarget as HTMLInputElement).blur() }}
            placeholder="0"
            className="w-full bg-background border border-border rounded-md px-2.5 py-1.5 text-[13px] tabular-nums focus:outline-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-500/50"
          />
        </div>
        <div>
          <FieldLabel>Currency</FieldLabel>
          <input
            type="text"
            value={currency}
            onChange={e => setCurrency(e.target.value.toUpperCase().slice(0, 3))}
            onBlur={commitCurrency}
            onKeyDown={e => { if (e.key === 'Enter') (e.currentTarget as HTMLInputElement).blur() }}
            placeholder="USD"
            className="w-full bg-background border border-border rounded-md px-2.5 py-1.5 text-[13px] font-mono uppercase focus:outline-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-500/50"
          />
        </div>
      </div>

      {/* Timeline */}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <FieldLabel>Start</FieldLabel>
          <input
            type="date"
            value={start}
            onChange={e => setStart(e.target.value)}
            onBlur={() => commitField('clientTimelineStart', start, entry.clientTimelineStart)}
            className="w-full bg-background border border-border rounded-md px-2.5 py-1.5 text-[13px] focus:outline-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-500/50"
          />
        </div>
        <div>
          <FieldLabel>End</FieldLabel>
          <input
            type="date"
            value={end}
            onChange={e => setEnd(e.target.value)}
            onBlur={() => commitField('clientTimelineEnd', end, entry.clientTimelineEnd)}
            className="w-full bg-background border border-border rounded-md px-2.5 py-1.5 text-[13px] focus:outline-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-500/50"
          />
        </div>
      </div>

      {/* Scope */}
      <div>
        <FieldLabel>Scope</FieldLabel>
        <textarea
          rows={2}
          value={scope}
          onChange={e => setScope(e.target.value)}
          onBlur={() => commitField('clientScope', scope, entry.clientScope)}
          placeholder="What's being delivered…"
          className="w-full bg-background border border-border rounded-md px-2.5 py-1.5 text-[13px] resize-y focus:outline-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-500/50"
        />
      </div>

      {/* Contract URL */}
      <div>
        <FieldLabel>Contract URL</FieldLabel>
        <div className="flex items-center gap-1.5">
          <input
            type="url"
            value={contractUrl}
            onChange={e => setContractUrl(e.target.value)}
            onBlur={() => commitField('clientContractUrl', contractUrl, entry.clientContractUrl)}
            placeholder="https://drive.google.com/…  or  https://notion.so/…"
            className="flex-1 bg-background border border-border rounded-md px-2.5 py-1.5 text-[13px] font-mono focus:outline-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-500/50"
          />
          {(entry.clientContractUrl || contractUrl) && (
            <a
              href={entry.clientContractUrl || contractUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="shrink-0 inline-flex items-center justify-center w-7 h-7 rounded-md border border-border hover:bg-muted/60 text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Open contract"
              title="Open contract in new tab"
            >
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          )}
        </div>
      </div>

      {/* Client notes (separate from outreach notes) */}
      <div>
        <FieldLabel>Engagement notes</FieldLabel>
        <textarea
          rows={2}
          value={notes}
          onChange={e => setNotes(e.target.value)}
          onBlur={() => commitField('clientNotes', notes, entry.clientNotes)}
          placeholder="Anything client-specific worth remembering…"
          className="w-full bg-background border border-border rounded-md px-2.5 py-1.5 text-[13px] resize-y focus:outline-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-500/50"
        />
      </div>
    </div>
  )
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <label className="block text-[10px] uppercase tracking-wider font-semibold text-muted-foreground/80 mb-1">
      {children}
    </label>
  )
}
