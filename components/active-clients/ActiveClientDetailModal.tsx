'use client'

/**
 * ActiveClientDetailModal — full-screen engagement workbench.
 *
 * Opens when a card is clicked in the Active Clients grid. Replaces
 * the v1 "edit inline on the card" pattern for the depth-fields:
 *
 *   • Budget, currency, timeline, scope, notes — left column
 *   • Contract upload (Storage) + URL fallback — right column
 *   • Milestone checklist — right column
 *   • Activity timeline — right column footer
 *   • Lifecycle action bar — bottom (mark active/paused/completed/churned)
 *
 * The card itself stays glance-able; everything detailed lives here.
 *
 * Every change writes through onPatch() up to the parent. The parent
 * is responsible for round-tripping to Supabase via
 * updateActiveClientFields(). We also push a synthetic
 * ClientActivityEvent for each meaningful change so the timeline
 * fills in automatically without a separate "add note" step.
 */

import { useEffect, useId, useRef, useState } from 'react'
import { motion } from 'motion/react'
import type {
  OutreachEntry, ClientLifecycle, ClientMilestone, ClientActivityEvent,
} from '@/lib/types'
import type { ActiveClientPatch } from '@/lib/storage'
import { useFocusTrap } from '@/lib/hooks/useFocusTrap'
import {
  X as XIcon, ExternalLink, Loader2, Check, AlertCircle,
  Play, Pause, CheckCircle2, XCircle,
} from 'lucide-react'
import { MilestoneList } from './MilestoneList'
import { ActivityTimeline } from './ActivityTimeline'
import { ContractUpload } from './ContractUpload'

interface ActiveClientDetailModalProps {
  entry: OutreachEntry
  saving: boolean
  saveError: string | null
  /** Combined patch — JSON column + optional activity event. The
   *  parent merges activity into the existing array and persists. */
  onPatch: (patch: ActiveClientPatch, activity?: ClientActivityEvent) => void
  onClose: () => void
}

export function ActiveClientDetailModal({
  entry, saving, saveError, onPatch, onClose,
}: ActiveClientDetailModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null)
  const titleId = useId()
  useFocusTrap(dialogRef, true)

  // Escape-to-close + scroll-lock the underlying page.
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [onClose])

  // Local drafts for the text-y fields so typing doesn't churn the
  // parent on every keystroke. We commit on blur (matches v1 card).
  const [budget, setBudget] = useState<string>(
    typeof entry.clientBudgetAmount === 'number' ? String(entry.clientBudgetAmount) : '',
  )
  const [currency, setCurrency] = useState(entry.clientBudgetCurrency || 'USD')
  const [start, setStart] = useState(entry.clientTimelineStart || '')
  const [end, setEnd] = useState(entry.clientTimelineEnd || '')
  const [scope, setScope] = useState(entry.clientScope || '')
  const [notes, setNotes] = useState(entry.clientNotes || '')

  const lifecycle: ClientLifecycle = (entry.clientLifecycle ?? 'active') as ClientLifecycle

  // Subtle "saved" flash next to the title. Same pattern as the card.
  const [savedFlash, setSavedFlash] = useState(false)
  useEffect(() => {
    if (!saving && !saveError && savedFlash) {
      const t = setTimeout(() => setSavedFlash(false), 1500)
      return () => clearTimeout(t)
    }
  }, [saving, saveError, savedFlash])

  function commitBudget() {
    const trimmed = budget.trim()
    const next = trimmed === '' ? null : Number(trimmed)
    if (next != null && Number.isNaN(next)) return
    if (next === (entry.clientBudgetAmount ?? null)) return
    onPatch(
      { clientBudgetAmount: next },
      next != null
        ? { ts: Date.now(), type: 'budget', summary: `Set budget to ${formatMoney(next, currency)}` }
        : { ts: Date.now(), type: 'budget', summary: 'Cleared budget' },
    )
    setSavedFlash(true)
  }

  function commitCurrency() {
    const v = currency.trim().toUpperCase().slice(0, 3)
    if (v === (entry.clientBudgetCurrency || 'USD')) return
    onPatch(
      { clientBudgetCurrency: v || null },
      { ts: Date.now(), type: 'budget', summary: `Currency set to ${v || 'USD'}` },
    )
    setSavedFlash(true)
  }

  function commitDate(field: 'start' | 'end') {
    const next = field === 'start' ? start : end
    const current = (field === 'start' ? entry.clientTimelineStart : entry.clientTimelineEnd) || ''
    if (next === current) return
    onPatch(
      field === 'start' ? { clientTimelineStart: next || null } : { clientTimelineEnd: next || null },
      {
        ts: Date.now(),
        type: 'timeline',
        summary: next
          ? `${field === 'start' ? 'Start' : 'End'} date set to ${next}`
          : `Cleared ${field === 'start' ? 'start' : 'end'} date`,
      },
    )
    setSavedFlash(true)
  }

  function commitScope() {
    if (scope === (entry.clientScope || '')) return
    onPatch(
      { clientScope: scope.trim() || null },
      { ts: Date.now(), type: 'scope', summary: scope.trim() ? 'Updated scope' : 'Cleared scope' },
    )
    setSavedFlash(true)
  }

  function commitNotes() {
    if (notes === (entry.clientNotes || '')) return
    onPatch(
      { clientNotes: notes.trim() || null },
      { ts: Date.now(), type: 'note', summary: notes.trim() ? 'Updated engagement notes' : 'Cleared engagement notes' },
    )
    setSavedFlash(true)
  }

  function setLifecycle(next: ClientLifecycle) {
    if (next === lifecycle) return
    onPatch(
      { clientLifecycle: next },
      { ts: Date.now(), type: 'lifecycle', summary: `Marked ${labelForLifecycle(next).toLowerCase()}` },
    )
    setSavedFlash(true)
  }

  function setMilestones(next: ClientMilestone[]) {
    onPatch(
      { clientMilestones: next },
      diffMilestoneActivity(entry.clientMilestones ?? [], next),
    )
    setSavedFlash(true)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <motion.div
        aria-hidden
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.2 }}
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
      />
      <motion.div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        initial={{ opacity: 0, scale: 0.96, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ type: 'spring', bounce: 0.18, duration: 0.4 }}
        className="relative bg-card border border-border rounded-2xl shadow-2xl shadow-black/40 w-full max-w-4xl max-h-[92vh] overflow-y-auto focus:outline-none"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 pt-5 pb-3 border-b border-border flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 id={titleId} className="text-lg font-semibold text-foreground truncate">
                {entry.channelName || '(unnamed client)'}
              </h2>
              <LifecycleChip lifecycle={lifecycle} />
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
            <div className="text-[11.5px] text-muted-foreground/75 mt-0.5">
              Engagement detail
            </div>
          </div>

          <div className="shrink-0 h-6 flex items-center gap-2">
            {saving && (
              <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                <Loader2 className="w-3 h-3 animate-spin" /> Saving…
              </span>
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
                <AlertCircle className="w-3 h-3" /> {saveError}
              </span>
            )}
            <button
              onClick={onClose}
              aria-label="Close engagement details"
              className="text-muted-foreground hover:text-foreground w-7 h-7 inline-flex items-center justify-center rounded hover:bg-muted/40 transition-colors"
            >
              <XIcon className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Body — two column */}
        <div className="grid md:grid-cols-2 gap-5 p-5">
          {/* LEFT — fields */}
          <div className="space-y-4">
            {/* Budget + currency */}
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
                  onBlur={() => commitDate('start')}
                  className="w-full bg-background border border-border rounded-md px-2.5 py-1.5 text-[13px] focus:outline-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-500/50"
                />
              </div>
              <div>
                <FieldLabel>End</FieldLabel>
                <input
                  type="date"
                  value={end}
                  onChange={e => setEnd(e.target.value)}
                  onBlur={() => commitDate('end')}
                  className="w-full bg-background border border-border rounded-md px-2.5 py-1.5 text-[13px] focus:outline-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-500/50"
                />
              </div>
            </div>

            {/* Scope */}
            <div>
              <FieldLabel>Scope</FieldLabel>
              <textarea
                rows={4}
                value={scope}
                onChange={e => setScope(e.target.value)}
                onBlur={commitScope}
                placeholder="What's being delivered…"
                className="w-full bg-background border border-border rounded-md px-2.5 py-1.5 text-[13px] resize-y focus:outline-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-500/50"
              />
            </div>

            {/* Notes */}
            <div>
              <FieldLabel>Engagement notes</FieldLabel>
              <textarea
                rows={3}
                value={notes}
                onChange={e => setNotes(e.target.value)}
                onBlur={commitNotes}
                placeholder="Anything client-specific worth remembering…"
                className="w-full bg-background border border-border rounded-md px-2.5 py-1.5 text-[13px] resize-y focus:outline-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-500/50"
              />
            </div>
          </div>

          {/* RIGHT — contract + milestones + activity */}
          <div className="space-y-5">
            <ContractUpload
              entryId={entry.id}
              contractPath={entry.clientContractPath}
              contractName={entry.clientContractName}
              contractSize={entry.clientContractSize}
              contractUploadedAt={entry.clientContractUploadedAt}
              contractUrl={entry.clientContractUrl}
              onPatch={onPatch}
            />

            <MilestoneList
              milestones={entry.clientMilestones ?? []}
              onChange={setMilestones}
            />

            <ActivityTimeline events={entry.clientActivity ?? []} />
          </div>
        </div>

        {/* Lifecycle action bar */}
        <div className="px-5 py-4 border-t border-border bg-muted/30">
          <div className="text-[10.5px] uppercase tracking-wider font-semibold text-muted-foreground mb-2">
            Set lifecycle
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <LifecycleAction
              icon={<Play className="w-3.5 h-3.5" />}
              label="Active"
              accent="green"
              isActive={lifecycle === 'active'}
              onClick={() => setLifecycle('active')}
            />
            <LifecycleAction
              icon={<Pause className="w-3.5 h-3.5" />}
              label="Paused"
              accent="amber"
              isActive={lifecycle === 'paused'}
              onClick={() => setLifecycle('paused')}
            />
            <LifecycleAction
              icon={<CheckCircle2 className="w-3.5 h-3.5" />}
              label="Completed"
              accent="blue"
              isActive={lifecycle === 'completed'}
              onClick={() => setLifecycle('completed')}
            />
            <LifecycleAction
              icon={<XCircle className="w-3.5 h-3.5" />}
              label="Churned"
              accent="rose"
              isActive={lifecycle === 'churned'}
              onClick={() => setLifecycle('churned')}
            />
          </div>
        </div>
      </motion.div>
    </div>
  )
}

// ── Sub-components ──────────────────────────────────────────────────

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <label className="block text-[10px] uppercase tracking-wider font-semibold text-muted-foreground/80 mb-1">
      {children}
    </label>
  )
}

function LifecycleChip({ lifecycle }: { lifecycle: ClientLifecycle }) {
  const styles: Record<ClientLifecycle, string> = {
    active:    'bg-green-500/15 text-green-700 dark:text-green-300 border-green-500/40',
    paused:    'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/40',
    completed: 'bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/40',
    churned:   'bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/40',
  }
  return (
    <span className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded border ${styles[lifecycle]}`}>
      {labelForLifecycle(lifecycle)}
    </span>
  )
}

function LifecycleAction({
  icon, label, accent, isActive, onClick,
}: {
  icon: React.ReactNode
  label: string
  accent: 'green' | 'amber' | 'blue' | 'rose'
  isActive: boolean
  onClick: () => void
}) {
  const activeStyles: Record<'green' | 'amber' | 'blue' | 'rose', string> = {
    green: 'bg-green-500/15 border-green-500/40 text-green-700 dark:text-green-300',
    amber: 'bg-amber-500/15 border-amber-500/40 text-amber-700 dark:text-amber-300',
    blue:  'bg-blue-500/15 border-blue-500/40 text-blue-700 dark:text-blue-300',
    rose:  'bg-rose-500/15 border-rose-500/40 text-rose-700 dark:text-rose-300',
  }
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border text-[12.5px] font-medium transition-colors',
        isActive
          ? activeStyles[accent]
          : 'bg-background border-border text-muted-foreground hover:text-foreground hover:bg-muted/60',
      ].join(' ')}
    >
      {icon}
      {label}
    </button>
  )
}

// ── Helpers ─────────────────────────────────────────────────────────

function labelForLifecycle(l: ClientLifecycle): string {
  return l.charAt(0).toUpperCase() + l.slice(1)
}

function formatMoney(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: (currency || 'USD').toUpperCase(),
      maximumFractionDigits: 0,
    }).format(amount)
  } catch {
    return `${(currency || 'USD').toUpperCase()} ${amount.toLocaleString('en-US', { maximumFractionDigits: 0 })}`
  }
}

/**
 * Diff two milestone arrays to produce a single activity summary.
 * Keeps the timeline readable instead of one entry per keystroke
 * (rename) — we report the net effect: added X, completed Y, removed Z.
 */
function diffMilestoneActivity(
  prev: ClientMilestone[],
  next: ClientMilestone[],
): ClientActivityEvent | undefined {
  const prevById = new Map(prev.map(m => [m.id, m]))
  const nextById = new Map(next.map(m => [m.id, m]))

  let added = 0, removed = 0, completed = 0, uncompleted = 0
  for (const m of next) {
    const before = prevById.get(m.id)
    if (!before) { added += 1; continue }
    if (!!before.completedAt !== !!m.completedAt) {
      if (m.completedAt) completed += 1
      else uncompleted += 1
    }
  }
  for (const m of prev) if (!nextById.has(m.id)) removed += 1

  const parts: string[] = []
  if (added)       parts.push(`added ${added}`)
  if (completed)   parts.push(`completed ${completed}`)
  if (uncompleted) parts.push(`reopened ${uncompleted}`)
  if (removed)     parts.push(`removed ${removed}`)
  if (parts.length === 0) return undefined

  return {
    ts: Date.now(),
    type: 'milestone',
    summary: `Milestones: ${parts.join(', ')}`,
  }
}
