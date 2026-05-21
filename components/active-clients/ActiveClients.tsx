'use client'

/**
 * Active Clients view — surfaces outreach entries marked
 * status='Successful' as engagement cards.
 *
 * v2 (2026-05-19 "big build"):
 *   • Lifecycle states (Active/Paused/Completed/Churned) via filter pills
 *   • Sort dropdown (by recency, budget, end date, channel name)
 *   • Search bar (filters channel name + scope)
 *   • Deeper metric row: total clients, total booked, avg deal, contracts,
 *     avg duration, lifecycle counts
 *   • Click card → ActiveClientDetailModal (full engagement workbench)
 *   • Activity timeline auto-fills as fields change
 *
 * The card grid is glance-only — editing is centralized in the
 * detail modal. The v1 inline-editing pattern got noisy at >5 cards.
 */

import React, { useMemo, useState } from 'react'
import type { OutreachEntry, ClientActivityEvent } from '@/lib/types'
import { ActiveClientCard } from './ActiveClientCard'
import { ActiveClientDetailModal } from './ActiveClientDetailModal'
import { LifecycleFilterBar, type LifecycleFilter } from './LifecycleFilterBar'
import { ManualAddActiveClientModal, type ManualActiveClientInput } from './ManualAddActiveClientModal'
import { PromoteFromOutreachModal } from './PromoteFromOutreachModal'
import {
  updateActiveClientFields, wrapUpEngagement,
  createManualActiveClient,
  type ActiveClientPatch, type WrapUpPayload,
} from '@/lib/storage'
import {
  Briefcase, Wallet, FileText, TrendingUp, CalendarClock,
  Search, ArrowUpDown, Plus, ChevronDown, Inbox, Pencil,
} from 'lucide-react'

interface ActiveClientsProps {
  /** All outreach entries — we filter to status='Successful' here. */
  entries: OutreachEntry[]
  /** Called after a successful patch so the parent can update its in-memory
   *  outreach state without an extra round-trip. */
  onPatch: (id: string, patch: ActiveClientPatch) => void
  /** Called after wrap-up creates a follow-on outreach row so the
   *  parent can refresh its in-memory outreach list. The id is the
   *  newly-created row's id. */
  onFollowOnCreated?: (newEntryId: string) => void
  /** Optional — id of an engagement to auto-open on mount or whenever
   *  the value changes. Used by the "Add to Active Clients" CTA in
   *  LeadDetailModal to jump straight to the engagement card without
   *  the user having to scan the grid. */
  initialSelectedId?: string | null
  /** Called once the auto-open has been consumed so the parent can
   *  clear its preselect state (prevents re-opening on every render). */
  onInitialSelectedConsumed?: () => void
}

type SortBy = 'recent' | 'budget' | 'end' | 'channel'

const SORT_OPTIONS: { id: SortBy; label: string }[] = [
  { id: 'recent',  label: 'Most recent'  },
  { id: 'budget',  label: 'Budget (high → low)' },
  { id: 'end',     label: 'End date (soonest)'  },
  { id: 'channel', label: 'Channel A–Z'  },
]

export function ActiveClients({ entries, onPatch, onFollowOnCreated, initialSelectedId, onInitialSelectedConsumed }: ActiveClientsProps) {
  // All Successful outreaches are "active clients" at the data level.
  // Lifecycle scopes them further inside this surface.
  const successful = useMemo(
    () => entries.filter(e => e.status === 'Successful'),
    [entries],
  )

  // Lifecycle counts feed the filter pills.
  const lifecycleCounts: Record<LifecycleFilter, number> = useMemo(() => {
    const counts: Record<LifecycleFilter, number> = {
      all: successful.length, active: 0, paused: 0, completed: 0, churned: 0,
    }
    for (const e of successful) {
      const lc = (e.clientLifecycle ?? 'active')
      if (lc === 'active' || lc === 'paused' || lc === 'completed' || lc === 'churned') {
        counts[lc] += 1
      }
    }
    return counts
  }, [successful])

  const [filter, setFilter] = useState<LifecycleFilter>('all')
  const [query, setQuery] = useState('')
  const [sortBy, setSortBy] = useState<SortBy>('recent')

  // Filter + search + sort pipeline. Memoized so the card grid only
  // re-renders when one of its inputs actually changes.
  const visible = useMemo(() => {
    let list = successful
    if (filter !== 'all') {
      list = list.filter(e => (e.clientLifecycle ?? 'active') === filter)
    }
    if (query.trim()) {
      const q = query.trim().toLowerCase()
      list = list.filter(e =>
        (e.channelName || '').toLowerCase().includes(q)
        || (e.clientScope || '').toLowerCase().includes(q),
      )
    }
    return [...list].sort((a, b) => sortFn(sortBy, a, b))
  }, [successful, filter, query, sortBy])

  // Aggregate metrics for the top row. Scoped to current filter so
  // the numbers reflect what the user is looking at.
  const metrics = useMemo(() => calcMetrics(visible), [visible])

  // Track saving / errors per entry id so the modal can show inline
  // feedback while the user edits.
  const [saving, setSaving] = useState<Set<string>>(new Set())
  const [saveError, setSaveError] = useState<{ id: string; message: string } | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  // Auto-open the engagement card when the parent passes an
  // initialSelectedId — fires when the user clicks "Add to Active
  // Clients" from a lead detail modal so they land directly on the
  // engagement they just created. The parent must reset its preselect
  // state via onInitialSelectedConsumed so the modal doesn't keep
  // re-opening on every re-render.
  React.useEffect(() => {
    if (!initialSelectedId) return
    // Only auto-open if this entry actually exists in our Successful
    // list. If the entry just transitioned to Successful, it should
    // be in `entries` already (the parent updated state before
    // dispatching the event).
    const exists = entries.some(e => e.id === initialSelectedId && e.status === 'Successful')
    if (exists) {
      setSelectedId(initialSelectedId)
      onInitialSelectedConsumed?.()
    }
  }, [initialSelectedId, entries, onInitialSelectedConsumed])
  // When ANY patch returns the SCHEMA_MISSING sentinel we surface a
  // sticky banner above the whole view. The schema cache is global
  // (one Supabase project = one cache) so once we detect the issue
  // it applies to every save — no point flashing the inline error
  // and pretending it's a one-off.
  const [schemaMissing, setSchemaMissing] = useState(false)
  // Manual-add modal — fires the createManualActiveClient helper
  // which inserts an outreach_entries row with status='Successful'.
  // Parent (app/page.tsx) refreshes the outreach list via the
  // onFollowOnCreated callback (reused — same shape: "a new row
  // exists, please refetch").
  const [manualAddOpen, setManualAddOpen] = useState(false)
  // "From outreach log" picker — opens a list of non-Successful
  // outreach entries the user can promote in one click. Reuses the
  // existing goto-active-client event flow so the engagement card
  // auto-opens after promotion.
  const [promoteFromOutreachOpen, setPromoteFromOutreachOpen] = useState(false)

  const selectedEntry = useMemo(
    () => (selectedId ? successful.find(e => e.id === selectedId) ?? null : null),
    [selectedId, successful],
  )

  async function handlePatch(
    id: string,
    patch: ActiveClientPatch,
    activity?: ClientActivityEvent,
  ) {
    // Merge a new activity event into the existing array. We read
    // from `successful` (the live entries prop) so concurrent edits
    // don't clobber each other's events.
    let mergedPatch: ActiveClientPatch = { ...patch }
    if (activity) {
      const target = successful.find(e => e.id === id)
      const existing = target?.clientActivity ?? []
      mergedPatch.clientActivity = [...existing, activity]
    }

    setSaving(prev => {
      const next = new Set(prev)
      next.add(id)
      return next
    })
    setSaveError(null)
    const result = await updateActiveClientFields(id, mergedPatch)
    setSaving(prev => {
      const next = new Set(prev)
      next.delete(id)
      return next
    })
    if (!result.ok) {
      // Sentinel from lib/storage.ts when Postgres / PostgREST reports
      // a missing column or stale schema cache → migration 0029 needs
      // to be run. Latch it so the banner stays visible until the
      // user refreshes after running the migration.
      if (result.error === 'SCHEMA_MISSING') {
        setSchemaMissing(true)
        setSaveError({
          id,
          message: 'Migration 0029 needs to run in Supabase before active-client edits can save.',
        })
      } else {
        setSaveError({ id, message: result.error ?? 'Save failed.' })
      }
      return
    }
    onPatch(id, mergedPatch)
  }

  // Empty-state at the top level — no Successful outreaches at all.
  if (successful.length === 0) {
    return (
      <div className="border border-dashed border-border rounded-xl py-16 px-6 text-center">
        <Briefcase className="w-8 h-8 mx-auto text-muted-foreground/50 mb-3" aria-hidden />
        <p className="text-foreground/85 font-medium mb-1">No active clients yet</p>
        <p className="text-muted-foreground text-sm max-w-[42ch] mx-auto leading-relaxed">
          When you mark an outreach as <span className="font-semibold text-foreground/90">Successful</span>,
          it shows up here with editable budget, timeline, scope, contract upload,
          milestone checklist, and an activity log. Run a campaign first.
        </p>
      </div>
    )
  }

  return (
    <div>
      {/* Migration banner — only shows when a save reports the schema
          isn't ready. Sticky until refresh because the schema cache is
          a global Supabase setting; clearing locally without a refresh
          would mask the issue. */}
      {schemaMissing && (
        <div className="mb-5 rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 flex items-start gap-3">
          <div className="shrink-0 w-5 h-5 rounded-full bg-amber-500/30 text-amber-700 dark:text-amber-300 inline-flex items-center justify-center font-bold text-[12px]" aria-hidden>
            !
          </div>
          <div className="flex-1 min-w-0 text-[13px] leading-snug">
            <div className="font-semibold text-foreground mb-0.5">
              Migration 0029 needs to run in Supabase
            </div>
            <p className="text-foreground/80">
              The new lifecycle, milestones, activity log, and contract-upload
              features all depend on schema added in <code className="text-[12px] font-mono">0029_active_clients_expansion.sql</code>. Until
              it&apos;s applied, edits in this view return a schema-cache error.
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <a
                href="https://supabase.com/dashboard/project/qsvsiypwecngqrzgvnxv/sql/new"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-[12.5px] font-semibold text-amber-700 dark:text-amber-300 hover:underline underline-offset-2"
              >
                Open Supabase SQL editor <span aria-hidden>↗</span>
              </a>
              <span className="text-[11.5px] text-muted-foreground">
                Paste the file from <code className="font-mono">supabase/migrations/0029_active_clients_expansion.sql</code>, run, then refresh this page.
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setSchemaMissing(false)}
            className="shrink-0 w-7 h-7 inline-flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors"
            aria-label="Dismiss banner"
            title="Hide until next failed save"
          >
            ×
          </button>
        </div>
      )}

      {/* Metric row */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 mb-5">
        <MetricCard
          label="Clients shown"
          value={metrics.total.toString()}
          sub={filter === 'all' ? null : `of ${successful.length} total`}
          icon={<Briefcase className="w-3.5 h-3.5" />}
        />
        <MetricCard
          label="Total booked"
          value={formatCurrencyCompact(metrics.totalBudget)}
          sub={metrics.withBudgetCount > 0 ? `${metrics.withBudgetCount} priced` : 'no budgets set'}
          icon={<Wallet className="w-3.5 h-3.5" />}
        />
        <MetricCard
          label="Avg deal"
          value={metrics.withBudgetCount > 0 ? formatCurrencyCompact(metrics.avgDeal) : '—'}
          sub={metrics.withBudgetCount > 0 ? `across ${metrics.withBudgetCount}` : null}
          icon={<TrendingUp className="w-3.5 h-3.5" />}
        />
        <MetricCard
          label="Avg duration"
          value={metrics.avgDurationDays != null ? `${metrics.avgDurationDays}d` : '—'}
          sub={metrics.durationCount > 0 ? `${metrics.durationCount} dated` : 'no timelines set'}
          icon={<CalendarClock className="w-3.5 h-3.5" />}
        />
        <MetricCard
          label="Contracts"
          value={`${metrics.contractsCount}/${metrics.total}`}
          sub={metrics.total > 0 ? `${Math.round((metrics.contractsCount / metrics.total) * 100)}%` : null}
          icon={<FileText className="w-3.5 h-3.5" />}
        />
      </div>

      {/* Lifecycle filter pills */}
      <LifecycleFilterBar
        active={filter}
        onChange={setFilter}
        counts={lifecycleCounts}
      />

      {/* Search + sort toolbar + manual-add */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/60" aria-hidden />
          <input
            type="search"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search by channel or scope…"
            className="w-full bg-background border border-border rounded-md pl-8 pr-3 py-1.5 text-[13px] focus:outline-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-500/50"
            aria-label="Search engagements"
          />
        </div>
        <label className="inline-flex items-center gap-1.5 text-[11.5px] text-muted-foreground">
          <ArrowUpDown className="w-3.5 h-3.5" aria-hidden />
          <span>Sort</span>
          <select
            value={sortBy}
            onChange={e => setSortBy(e.target.value as SortBy)}
            className="bg-background border border-border rounded-md px-2 py-1 text-[12.5px] text-foreground focus:outline-none focus:ring-2 focus:ring-purple-500/30"
            aria-label="Sort engagements"
          >
            {SORT_OPTIONS.map(opt => (
              <option key={opt.id} value={opt.id}>{opt.label}</option>
            ))}
          </select>
        </label>
        <AddActiveClientButton
          onAddManually={() => setManualAddOpen(true)}
          onAddFromOutreach={() => setPromoteFromOutreachOpen(true)}
        />
      </div>

      {/* Card grid (or filtered empty state) */}
      {visible.length === 0 ? (
        <div className="border border-dashed border-border rounded-xl py-12 px-6 text-center">
          <Search className="w-7 h-7 mx-auto text-muted-foreground/40 mb-2" aria-hidden />
          <p className="text-foreground/85 font-medium mb-0.5">No matches</p>
          <p className="text-muted-foreground text-sm max-w-[42ch] mx-auto">
            Try a different lifecycle filter or clear the search.
          </p>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-3">
          {visible.map(entry => (
            <ActiveClientCard
              key={entry.id}
              entry={entry}
              onOpen={() => setSelectedId(entry.id)}
            />
          ))}
        </div>
      )}

      {/* Detail modal */}
      {selectedEntry && (
        <ActiveClientDetailModal
          entry={selectedEntry}
          saving={saving.has(selectedEntry.id)}
          saveError={saveError?.id === selectedEntry.id ? saveError.message : null}
          onPatch={(patch, activity) => handlePatch(selectedEntry.id, patch, activity)}
          onWrapUp={async (payload: WrapUpPayload) => {
            // Atomic wrap-up — patches engagement + creates follow-on
            // for Definitely/Likely. The local optimistic merge runs
            // through handlePatch so the activity timeline + lifecycle
            // pill stay in sync with whatever wrapUpEngagement just
            // persisted.
            setSaving(prev => {
              const next = new Set(prev)
              next.add(selectedEntry.id)
              return next
            })
            setSaveError(null)
            const result = await wrapUpEngagement(selectedEntry, payload)
            setSaving(prev => {
              const next = new Set(prev)
              next.delete(selectedEntry.id)
              return next
            })
            if (!result.ok) {
              if (result.error === 'SCHEMA_MISSING') {
                setSchemaMissing(true)
                return { ok: false, error: 'Migration 0030 needs to run in Supabase before wrap-up can save.' }
              }
              setSaveError({ id: selectedEntry.id, message: result.error ?? 'Wrap-up failed.' })
              return result
            }
            // Optimistically merge the patch we know was just applied
            // (lifecycle + final value + rating + repeat + testimonial
            // + activity) into the parent's in-memory entry. The new
            // notes block was composed server-side so we conservatively
            // refresh from the next load — for now just mirror the
            // structured fields.
            const composedActivity = [
              ...(selectedEntry.clientActivity ?? []),
              { ts: Date.now(),     type: 'lifecycle' as const, summary: 'Marked completed' },
              { ts: Date.now() + 1, type: 'lifecycle' as const, summary: `Engagement completed: rating ${payload.rating} / 5, repeat ${payload.repeatLikelihood}` },
            ]
            onPatch(selectedEntry.id, {
              clientLifecycle: 'completed',
              clientFinalValue: payload.finalValue,
              clientCompletionDate: payload.completionDate,
              clientRating: payload.rating,
              clientRepeatLikelihood: payload.repeatLikelihood,
              clientTestimonial: payload.testimonial ?? null,
              clientTestimonialPublic: !!payload.testimonialPublic,
              clientActivity: composedActivity,
            })
            // Notify the parent if a follow-on row was created so it
            // can refresh its outreach list (the new row needs to
            // appear in the Outreach pipeline + Active Clients view).
            if (result.newEntryId && onFollowOnCreated) {
              onFollowOnCreated(result.newEntryId)
            }
            return { ok: true }
          }}
          onClose={() => setSelectedId(null)}
        />
      )}

      {/* Manual-add modal — direct entry of an off-platform client. */}
      {manualAddOpen && (
        <ManualAddActiveClientModal
          onSubmit={async (input: ManualActiveClientInput) => {
            const result = await createManualActiveClient(input)
            if (!result.ok) {
              if (result.error === 'SCHEMA_MISSING') {
                setSchemaMissing(true)
                return { ok: false, error: 'Migration 0030 needs to run before manual-add can save.' }
              }
              return result
            }
            // Re-fetch outreach so the new row is visible in pipeline
            // AND in this view. Reuse the existing follow-on hook —
            // same shape ("new row exists, parent should refresh").
            if (result.newEntryId && onFollowOnCreated) {
              onFollowOnCreated(result.newEntryId)
            }
            return { ok: true }
          }}
          onClose={() => setManualAddOpen(false)}
        />
      )}

      {/* "From outreach log" picker — promote an existing outreach
          entry to Successful + auto-open the engagement card. */}
      {promoteFromOutreachOpen && (
        <PromoteFromOutreachModal
          outreachEntries={entries}
          onPromote={entryId => {
            // Reuse the goto-active-client event flow from
            // LeadDetailModal's "Add to Active Clients" CTA. The parent
            // listens, sets status='Successful' via updateOutreachEntry,
            // switches to Active Clients sub-tab, and pre-opens the
            // engagement detail modal.
            window.dispatchEvent(new CustomEvent('promote-outreach-to-active', {
              detail: { entryId },
            }))
            setPromoteFromOutreachOpen(false)
          }}
          onClose={() => setPromoteFromOutreachOpen(false)}
        />
      )}
    </div>
  )
}

/**
 * Split-button trigger for the two "add active client" flows.
 * Primary action is "Add manually" (most common); a small chevron
 * opens a dropdown with "From outreach log" as the second option.
 */
function AddActiveClientButton({
  onAddManually,
  onAddFromOutreach,
}: {
  onAddManually: () => void
  onAddFromOutreach: () => void
}) {
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = React.useRef<HTMLDivElement>(null)

  // Click-outside to close — mirrors the pattern used by the
  // pending-confirmation pill + column header menu.
  React.useEffect(() => {
    if (!menuOpen) return
    function onMouseDown(ev: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(ev.target as Node)) {
        setMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', onMouseDown)
    return () => document.removeEventListener('mousedown', onMouseDown)
  }, [menuOpen])

  return (
    <div ref={menuRef} className="relative inline-flex">
      <button
        type="button"
        onClick={() => setMenuOpen(v => !v)}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-gradient-to-br from-emerald-600 to-green-600 hover:from-emerald-500 hover:to-green-500 text-white text-[12.5px] font-semibold shadow-sm shadow-emerald-500/20 transition-all"
        aria-haspopup="menu"
        aria-expanded={menuOpen}
      >
        <Plus className="w-3.5 h-3.5" />
        New active client
        <ChevronDown className={`w-3 h-3 transition-transform ${menuOpen ? 'rotate-180' : ''}`} aria-hidden />
      </button>
      {menuOpen && (
        <div
          role="menu"
          className="absolute right-0 top-full mt-1 z-30 w-[260px] rounded-md border border-border bg-card shadow-lg shadow-black/30 p-1.5 text-[13px]"
        >
          <button
            type="button"
            role="menuitem"
            onClick={() => { setMenuOpen(false); onAddManually() }}
            className="w-full text-left flex items-start gap-2.5 px-2.5 py-2 rounded hover:bg-muted/60 text-foreground transition-colors"
          >
            <Pencil className="w-3.5 h-3.5 mt-0.5 text-muted-foreground/80 shrink-0" aria-hidden />
            <div className="flex-1">
              <div className="font-semibold">Add manually</div>
              <div className="text-[11px] text-muted-foreground/85">
                Enter a client from scratch — name, budget, scope.
              </div>
            </div>
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => { setMenuOpen(false); onAddFromOutreach() }}
            className="w-full text-left flex items-start gap-2.5 px-2.5 py-2 rounded hover:bg-muted/60 text-foreground transition-colors"
          >
            <Inbox className="w-3.5 h-3.5 mt-0.5 text-blue-500/80 shrink-0" aria-hidden />
            <div className="flex-1">
              <div className="font-semibold">From outreach log</div>
              <div className="text-[11px] text-muted-foreground/85">
                Promote someone you&apos;ve already reached out to.
              </div>
            </div>
          </button>
        </div>
      )}
    </div>
  )
}

// ── Metric card ─────────────────────────────────────────────────────

interface MetricCardProps {
  label: string
  value: string
  sub?: string | null
  icon: React.ReactNode
}

function MetricCard({ label, value, sub, icon }: MetricCardProps) {
  return (
    <div className="bg-card/60 border border-border rounded-lg px-3 py-2.5">
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground/80 font-semibold mb-1">
        <span className="text-muted-foreground/70">{icon}</span>
        {label}
      </div>
      <div className="text-xl font-semibold tabular-nums text-foreground">{value}</div>
      {sub && <div className="text-[11px] text-muted-foreground/75 mt-0.5">{sub}</div>}
    </div>
  )
}

// ── Sort + metric helpers ───────────────────────────────────────────

function sortFn(by: SortBy, a: OutreachEntry, b: OutreachEntry): number {
  switch (by) {
    case 'budget': {
      const av = a.clientBudgetAmount ?? -1
      const bv = b.clientBudgetAmount ?? -1
      return bv - av
    }
    case 'end': {
      const av = a.clientTimelineEnd || ''
      const bv = b.clientTimelineEnd || ''
      // Empty end dates sink to the bottom.
      if (!av && bv) return 1
      if (av && !bv) return -1
      return av.localeCompare(bv)
    }
    case 'channel':
      return (a.channelName || '').localeCompare(b.channelName || '')
    case 'recent':
    default: {
      const at = String(a.clientTimelineStart || a.dateReachedOut || a.addedAt || '')
      const bt = String(b.clientTimelineStart || b.dateReachedOut || b.addedAt || '')
      return bt.localeCompare(at)
    }
  }
}

interface Metrics {
  total: number
  totalBudget: number
  withBudgetCount: number
  avgDeal: number
  contractsCount: number
  avgDurationDays: number | null
  durationCount: number
}

function calcMetrics(list: OutreachEntry[]): Metrics {
  const total = list.length
  const withBudget = list.filter(e => typeof e.clientBudgetAmount === 'number' && (e.clientBudgetAmount ?? 0) > 0)
  const totalBudget = withBudget.reduce((s, e) => s + (e.clientBudgetAmount ?? 0), 0)
  const avgDeal = withBudget.length ? totalBudget / withBudget.length : 0
  const contractsCount = list.filter(e =>
    !!e.clientContractPath || !!(e.clientContractUrl || '').trim(),
  ).length

  // Duration: only for engagements with BOTH a start and end set.
  const datedEngagements = list.filter(e => e.clientTimelineStart && e.clientTimelineEnd)
  let avgDurationDays: number | null = null
  if (datedEngagements.length > 0) {
    const totalDays = datedEngagements.reduce((sum, e) => {
      const start = new Date(e.clientTimelineStart!)
      const end = new Date(e.clientTimelineEnd!)
      const ms = end.getTime() - start.getTime()
      return sum + Math.max(0, Math.round(ms / (24 * 60 * 60 * 1000)))
    }, 0)
    avgDurationDays = Math.round(totalDays / datedEngagements.length)
  }

  return {
    total,
    totalBudget,
    withBudgetCount: withBudget.length,
    avgDeal,
    contractsCount,
    avgDurationDays,
    durationCount: datedEngagements.length,
  }
}

function formatCurrencyCompact(n: number): string {
  if (n === 0) return '$0'
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1)}M`
  if (n >= 10_000)    return `$${(n / 1_000).toFixed(0)}K`
  return `$${n.toLocaleString('en-US', { maximumFractionDigits: 0 })}`
}
