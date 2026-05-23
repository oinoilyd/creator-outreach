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
import type { ActiveClientPatch, WrapUpPayload } from '@/lib/storage'
import { useFocusTrap } from '@/lib/hooks/useFocusTrap'
import {
  X as XIcon, ExternalLink, Loader2, Check, AlertCircle,
  Play, Pause, CheckCircle2, XCircle, Activity,
} from 'lucide-react'
import { MilestoneList, DEFAULT_MILESTONES, newMilestoneId } from './MilestoneList'
import { ActivityLogModal } from './ActivityLogModal'
import { ContractUpload } from './ContractUpload'
import { WrapUpEngagementModal } from './WrapUpEngagementModal'
import { CollaboratorsList } from './CollaboratorsList'
import type { ClientCollaborator } from '@/lib/types'

interface ActiveClientDetailModalProps {
  entry: OutreachEntry
  saving: boolean
  saveError: string | null
  /** Combined patch — JSON column + optional activity event. The
   *  parent merges activity into the existing array and persists. */
  onPatch: (patch: ActiveClientPatch, activity?: ClientActivityEvent) => void
  /** Atomic wrap-up call — patches the engagement, snapshots context
   *  into client_notes, optionally creates a follow-on outreach row.
   *  Returns ok/error so the wrap-up modal can show inline feedback. */
  onWrapUp: (payload: WrapUpPayload) => Promise<{ ok: boolean; error?: string }>
  onClose: () => void
}

export function ActiveClientDetailModal({
  entry, saving, saveError, onPatch, onWrapUp, onClose,
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

  // Auto-seed default milestones on FIRST open for a brand-new
  // engagement. "Brand-new" = no current milestones AND no milestone
  // activity ever recorded. If the user later deletes all defaults,
  // the activity log keeps the "added 4" entry so we won't re-seed
  // on the next open. The seed itself fires onPatch → persists →
  // logs activity, so the guard is self-stabilising.
  const seededRef = useRef(false)
  useEffect(() => {
    if (seededRef.current) return
    const currentMilestones = entry.clientMilestones ?? []
    if (currentMilestones.length > 0) {
      seededRef.current = true
      return
    }
    const hasMilestoneHistory = (entry.clientActivity ?? []).some(e => e.type === 'milestone')
    if (hasMilestoneHistory) {
      seededRef.current = true
      return
    }
    // First open + no history → seed defaults.
    seededRef.current = true
    const seeded: ClientMilestone[] = DEFAULT_MILESTONES.map(m => ({ ...m, id: newMilestoneId() }))
    onPatch(
      { clientMilestones: seeded },
      { ts: Date.now(), type: 'milestone', summary: `Milestones: seeded ${seeded.length} defaults` },
    )
    // Intentionally only runs on mount per modal-open. We don't want
    // it firing again if entry props change underneath us.
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [])

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

  // Completion routes through the wrap-up modal instead of an
  // immediate lifecycle flip — capture close data (final value,
  // rating, repeat likelihood, testimonial) in one structured pass.
  const [wrapUpOpen, setWrapUpOpen] = useState(false)

  // Activity log lives in a separate modal — most of the time users
  // open the engagement modal to edit fields, not audit history. The
  // footer link opens ActivityLogModal on top of this one when they
  // actually want to inspect the change log.
  const [activityLogOpen, setActivityLogOpen] = useState(false)

  function setLifecycle(next: ClientLifecycle) {
    if (next === lifecycle) return
    // Completed → open wrap-up modal. The submit handler patches
    // lifecycle + extra fields atomically via onWrapUp.
    if (next === 'completed') {
      setWrapUpOpen(true)
      return
    }
    // Churned → confirm + flip immediately. The undo path is one
    // click but the activity log would still record the flip-flop.
    if (next === 'churned') {
      const ok = window.confirm(
        `Mark ${entry.channelName || 'this engagement'} as Churned?\n\nThe lifecycle change is logged in the activity timeline. You can switch it back to Active any time, but the timeline entry will remain.`,
      )
      if (!ok) return
    }
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
            {/* Budget + currency — stack on phones so the Currency
                input doesn't collapse to ~85px; restore 3-col at sm. */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <div className="sm:col-span-2">
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

            {/* Timeline — stack on phones (date inputs are wide). */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
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

          {/* RIGHT — featured team section, milestones, contract,
              and a collapsed activity log. Team & Revenue Share is
              the primary surface here because it drives the user's
              Personal Revenue metric and is edited most often. */}
          <div className="space-y-5">
            <CollaboratorsList
              collaborators={entry.clientCollaborators ?? []}
              budget={entry.clientBudgetAmount}
              budgetCurrency={entry.clientBudgetCurrency}
              onChange={(next: ClientCollaborator[]) => {
                onPatch(
                  { clientCollaborators: next },
                  diffCollaboratorActivity(entry.clientCollaborators ?? [], next),
                )
                setSavedFlash(true)
              }}
            />

            <MilestoneList
              milestones={entry.clientMilestones ?? []}
              onChange={setMilestones}
            />

            <ContractUpload
              entryId={entry.id}
              contractPath={entry.clientContractPath}
              contractName={entry.clientContractName}
              contractSize={entry.clientContractSize}
              contractUploadedAt={entry.clientContractUploadedAt}
              contractUrl={entry.clientContractUrl}
              onPatch={onPatch}
            />
          </div>
        </div>

        {/* Lifecycle footer — redesigned 2026-05-23 per Dylan
            ("the bottom where it's like active churned etc, that
            can be visually different/better"). Treat the current
            state as the HERO and the lifecycle buttons as actions,
            instead of 4 equal buttons with one filled.

            Top row: live pulse dot + uppercase state name in state
            color + contextual one-line description ("This engagement
            is in motion" etc) + activity log link aligned right.

            Bottom row: 4-button lifecycle ladder. The current state
            is filled with state color + soft glow; idle states get
            a hint of their accent on hover. Buttons lift on hover
            (translate-y-px) so they read as interactive cards. */}
        <div className="px-5 pt-4 pb-5 border-t border-border bg-muted/40">
          <div className="flex items-center gap-3 mb-3.5 flex-wrap">
            {/* Live pulse dot — color matches current state. Pulses
                via the same Tailwind ping animation used on the
                marketing site's "Live" badge. */}
            <span
              aria-hidden
              className={`relative inline-flex items-center justify-center w-2.5 h-2.5 rounded-full shrink-0 ${lifecycleDotBg(lifecycle)}`}
            >
              <span className={`absolute inset-0 rounded-full ${lifecycleDotBg(lifecycle)} animate-ping opacity-70`} />
            </span>
            {/* State name + description + budget-variance flag.

                The flag appears only when an engagement is Completed
                AND the captured final value undershot the contract
                budget by more than 0.5% (same threshold the wrap-up
                modal uses for its inline warning). Persisting the
                flag here means the variance stays visible whenever
                someone reopens the engagement, not just at the close
                moment. */}
            <div className="flex items-baseline gap-2.5 min-w-0 flex-1 flex-wrap">
              <span className={`text-[14px] font-bold tracking-[0.04em] uppercase whitespace-nowrap ${lifecycleTextColor(lifecycle)}`}>
                {labelForLifecycle(lifecycle)}
              </span>
              <span className="text-[12px] text-muted-foreground truncate">
                {lifecycleDescription(lifecycle)}
              </span>
              <BudgetVarianceFlag entry={entry} lifecycle={lifecycle} />
            </div>
            {/* Activity log — right-aligned, subtle but discoverable. */}
            <button
              type="button"
              onClick={() => setActivityLogOpen(true)}
              className="inline-flex items-center gap-1.5 text-[11.5px] text-muted-foreground hover:text-foreground transition-colors shrink-0"
            >
              <Activity className="w-3.5 h-3.5" aria-hidden />
              <span>Activity log</span>
              {(entry.clientActivity ?? []).length > 0 && (
                <span className="tabular-nums text-muted-foreground/65">
                  ({(entry.clientActivity ?? []).length})
                </span>
              )}
              <span aria-hidden className="text-muted-foreground/50">→</span>
            </button>
          </div>

          {/* Lifecycle ladder — 4 designed buttons. Grid layout so
              they share equal width on desktop; stacks 2×2 on
              narrow viewports for thumb-friendly tapping. */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
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

      {/* Wrap-up modal — opens on top of the detail modal when the
          user clicks the Completed lifecycle button. Captures real
          close data (final value, rating, repeat likelihood, etc.)
          and routes through onWrapUp for atomic persistence + the
          optional follow-on outreach row creation. */}
      {wrapUpOpen && (
        <WrapUpEngagementModal
          entry={entry}
          onSubmit={async payload => {
            const result = await onWrapUp(payload)
            if (result.ok) setSavedFlash(true)
            return result
          }}
          onClose={() => setWrapUpOpen(false)}
        />
      )}

      {/* Activity log — separate modal that opens on top of the
          detail modal. Strictly click-to-open so the audit history
          doesn't pull attention away from editing surfaces. */}
      {activityLogOpen && (
        <ActivityLogModal
          channelName={entry.channelName}
          events={entry.clientActivity ?? []}
          onClose={() => setActivityLogOpen(false)}
        />
      )}
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
  // Active state: filled with state color + soft glow shadow. The
  // shadow uses the matching color/30 so the button "lifts" off the
  // muted footer background, signaling "this is where you are."
  const activeFilled: Record<'green' | 'amber' | 'blue' | 'rose', string> = {
    green: 'bg-green-500 border-green-500 text-white shadow-md shadow-green-500/35 ring-1 ring-green-500/20',
    amber: 'bg-amber-500 border-amber-500 text-white shadow-md shadow-amber-500/35 ring-1 ring-amber-500/20',
    blue:  'bg-blue-500  border-blue-500  text-white shadow-md shadow-blue-500/35  ring-1 ring-blue-500/20',
    rose:  'bg-rose-500  border-rose-500  text-white shadow-md shadow-rose-500/35  ring-1 ring-rose-500/20',
  }
  // Idle state — accent-tinted hover. Buttons lift on hover
  // (translate-y-px) for an interactive-card feel.
  const idleStyles: Record<'green' | 'amber' | 'blue' | 'rose', string> = {
    green: 'bg-background border-border text-foreground/70 hover:text-green-700 dark:hover:text-green-300 hover:border-green-500/50 hover:bg-green-500/[0.06] hover:shadow-sm hover:shadow-green-500/15 hover:-translate-y-px',
    amber: 'bg-background border-border text-foreground/70 hover:text-amber-700 dark:hover:text-amber-300 hover:border-amber-500/50 hover:bg-amber-500/[0.06] hover:shadow-sm hover:shadow-amber-500/15 hover:-translate-y-px',
    blue:  'bg-background border-border text-foreground/70 hover:text-blue-700  dark:hover:text-blue-300  hover:border-blue-500/50  hover:bg-blue-500/[0.06]  hover:shadow-sm hover:shadow-blue-500/15  hover:-translate-y-px',
    rose:  'bg-background border-border text-foreground/70 hover:text-rose-700  dark:hover:text-rose-300  hover:border-rose-500/50  hover:bg-rose-500/[0.06]  hover:shadow-sm hover:shadow-rose-500/15  hover:-translate-y-px',
  }
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={isActive}
      title={label}
      className={[
        // Equal-width grid item (parent uses grid-cols-2/4). Buttons
        // are now block-level so they fill the grid cell — no more
        // "tight on mouse, generous on touch" branch since the grid
        // handles sizing. Vertical layout: icon left, label right.
        'inline-flex items-center justify-center gap-2 rounded-lg border text-[13px] font-semibold transition-all duration-150 py-2.5 px-3',
        isActive ? activeFilled[accent] : idleStyles[accent],
      ].join(' ')}
    >
      {icon}
      <span>{label}</span>
    </button>
  )
}

// ── Helpers ─────────────────────────────────────────────────────────

function labelForLifecycle(l: ClientLifecycle): string {
  return l.charAt(0).toUpperCase() + l.slice(1)
}

/**
 * BudgetVarianceFlag — small pill next to the lifecycle hero
 * description that surfaces a "closed under contract" warning on
 * completed engagements where final value < budget.
 *
 * Why: per Dylan 2026-05-23, pricing slippage on closed engagements
 * is a signal worth flagging persistently. The wrap-up modal shows
 * the variance at close time; this flag keeps it visible whenever
 * the user revisits the engagement later (so they can spot patterns,
 * e.g. "I keep closing 15% under on Instagram deals").
 *
 * Threshold matches WrapUpEngagementModal's BudgetDeltaHint — only
 * flag if >0.5% off so rounding doesn't trigger the warning.
 *
 * Renders nothing when:
 *   • Lifecycle isn't 'completed' (variance only matters for closed deals)
 *   • No contract budget set
 *   • No final value captured
 *   • Final value is on/above the contract (no shortfall to flag)
 */
function BudgetVarianceFlag({
  entry,
  lifecycle,
}: {
  entry: { clientBudgetAmount?: number | null; clientFinalValue?: number | null; clientBudgetCurrency?: string | null }
  lifecycle: ClientLifecycle
}) {
  if (lifecycle !== 'completed') return null
  const budget = entry.clientBudgetAmount
  const finalValue = entry.clientFinalValue
  if (typeof budget !== 'number' || budget <= 0) return null
  if (typeof finalValue !== 'number') return null

  const delta = finalValue - budget
  const pct = (delta / budget) * 100

  // Only flag meaningful shortfalls — sub-0.5% diffs are usually
  // rounding (e.g. $4995 vs $5000 contract).
  if (pct >= -0.5) return null

  const absDelta = Math.abs(delta)
  const absPct = Math.abs(pct)
  const currency = entry.clientBudgetCurrency || 'USD'
  let amountText: string
  try {
    amountText = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency.toUpperCase(),
      maximumFractionDigits: 0,
    }).format(absDelta)
  } catch {
    amountText = `${currency.toUpperCase()} ${absDelta.toLocaleString('en-US', { maximumFractionDigits: 0 })}`
  }

  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md border border-amber-500/45 bg-amber-500/10 text-amber-800 dark:text-amber-200 text-[11px] font-semibold leading-tight"
      title={`Closed at less than the contract budget. Final ${amountText} short (${absPct.toFixed(absPct < 10 ? 1 : 0)}%).`}
    >
      <span aria-hidden className="text-amber-600 dark:text-amber-400">⚠</span>
      <span>Under contract</span>
      <span className="text-amber-700/85 dark:text-amber-300/85 font-normal tabular-nums">
        −{amountText} ({absPct.toFixed(absPct < 10 ? 1 : 0)}%)
      </span>
    </span>
  )
}

/**
 * One-line contextual description for the current lifecycle state.
 * Shown next to the big state name at the top of the footer so the
 * user understands what the state MEANS, not just its label.
 */
function lifecycleDescription(l: ClientLifecycle): string {
  switch (l) {
    case 'active':    return 'In motion — engagement is currently progressing.'
    case 'paused':    return 'Holding pattern — no active work right now.'
    case 'completed': return 'Closed — engagement wrapped successfully.'
    case 'churned':   return 'Ended — engagement closed without completion.'
    default:          return ''
  }
}

/**
 * Tailwind background class for the pulse dot — matches the lifecycle
 * accent color. Used for the live pulse indicator at the top of the
 * footer.
 */
function lifecycleDotBg(l: ClientLifecycle): string {
  switch (l) {
    case 'active':    return 'bg-green-500'
    case 'paused':    return 'bg-amber-500'
    case 'completed': return 'bg-blue-500'
    case 'churned':   return 'bg-rose-500'
    default:          return 'bg-muted-foreground'
  }
}

/**
 * Text color for the uppercase state name in the footer hero. Matches
 * the lifecycle accent. Dark-mode variant a touch lighter so it
 * reads against the muted bg.
 */
function lifecycleTextColor(l: ClientLifecycle): string {
  switch (l) {
    case 'active':    return 'text-green-700 dark:text-green-300'
    case 'paused':    return 'text-amber-700 dark:text-amber-300'
    case 'completed': return 'text-blue-700 dark:text-blue-300'
    case 'churned':   return 'text-rose-700 dark:text-rose-300'
    default:          return 'text-foreground'
  }
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

/**
 * Diff two collaborator arrays for a single activity-log entry —
 * same pattern as diffMilestoneActivity. Reports the net effect
 * (added X, removed Y, share-changed Z) so the timeline stays
 * readable even when the user is editing multiple fields at once.
 */
function diffCollaboratorActivity(
  prev: import('@/lib/types').ClientCollaborator[],
  next: import('@/lib/types').ClientCollaborator[],
): ClientActivityEvent | undefined {
  const prevById = new Map(prev.map(c => [c.id, c]))
  const nextById = new Map(next.map(c => [c.id, c]))

  let added = 0, removed = 0, shareChanged = 0
  for (const c of next) {
    const before = prevById.get(c.id)
    if (!before) { added += 1; continue }
    if ((before.share || 0) !== (c.share || 0)) shareChanged += 1
  }
  for (const c of prev) if (!nextById.has(c.id)) removed += 1

  const parts: string[] = []
  if (added)        parts.push(`added ${added}`)
  if (removed)      parts.push(`removed ${removed}`)
  if (shareChanged) parts.push(`updated ${shareChanged} share${shareChanged === 1 ? '' : 's'}`)
  if (parts.length === 0) return undefined

  return {
    ts: Date.now(),
    type: 'note',
    summary: `Team: ${parts.join(', ')}`,
  }
}
