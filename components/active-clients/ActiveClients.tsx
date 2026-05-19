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

import { useMemo, useState } from 'react'
import type { OutreachEntry, ClientActivityEvent } from '@/lib/types'
import { ActiveClientCard } from './ActiveClientCard'
import { ActiveClientDetailModal } from './ActiveClientDetailModal'
import { LifecycleFilterBar, type LifecycleFilter } from './LifecycleFilterBar'
import { updateActiveClientFields, type ActiveClientPatch } from '@/lib/storage'
import {
  Briefcase, Wallet, FileText, TrendingUp, CalendarClock,
  Search, ArrowUpDown,
} from 'lucide-react'

interface ActiveClientsProps {
  /** All outreach entries — we filter to status='Successful' here. */
  entries: OutreachEntry[]
  /** Called after a successful patch so the parent can update its in-memory
   *  outreach state without an extra round-trip. */
  onPatch: (id: string, patch: ActiveClientPatch) => void
}

type SortBy = 'recent' | 'budget' | 'end' | 'channel'

const SORT_OPTIONS: { id: SortBy; label: string }[] = [
  { id: 'recent',  label: 'Most recent'  },
  { id: 'budget',  label: 'Budget (high → low)' },
  { id: 'end',     label: 'End date (soonest)'  },
  { id: 'channel', label: 'Channel A–Z'  },
]

export function ActiveClients({ entries, onPatch }: ActiveClientsProps) {
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
      setSaveError({ id, message: result.error ?? 'Save failed.' })
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

      {/* Search + sort toolbar */}
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
          onClose={() => setSelectedId(null)}
        />
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
