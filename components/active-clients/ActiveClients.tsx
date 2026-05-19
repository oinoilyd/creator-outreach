'use client'

/**
 * Active Clients view — surfaces outreach entries marked
 * status='Successful' as engagement cards with budget, timeline,
 * scope, and contract URL.
 *
 * Layout:
 *   • Metric row across the top (count, total budget, avg deal,
 *     contracts uploaded %).
 *   • Empty state when no Successful outreach exists yet.
 *   • Card grid (2 cols on md+, 1 col mobile) — each card is an
 *     ActiveClientCard with inline-editable fields.
 *
 * Phase 1 (this version): cards are editable inline. No separate
 * detail modal. Click a field → autosaves on blur via
 * updateActiveClientFields(). Contract upload is a plain URL field
 * (link to external storage — Drive / Dropbox / Notion). Future
 * versions can add Supabase Storage upload, contract diff history,
 * client-lifecycle states (active / paused / complete / churned),
 * etc.
 */

import { useMemo, useState } from 'react'
import type { OutreachEntry } from '@/lib/types'
import { ActiveClientCard } from './ActiveClientCard'
import { updateActiveClientFields, type ActiveClientPatch } from '@/lib/storage'
import { Briefcase, Wallet, FileText, TrendingUp } from 'lucide-react'

interface ActiveClientsProps {
  /** All outreach entries — we filter to status='Successful' here. */
  entries: OutreachEntry[]
  /** Called after a successful patch so the parent can update its in-memory
   *  outreach state without an extra round-trip. */
  onPatch: (id: string, patch: ActiveClientPatch) => void
}

export function ActiveClients({ entries, onPatch }: ActiveClientsProps) {
  // Successful entries == active clients. We sort by most-recent
  // engagement start (or fall back to addedAt) so newest deals
  // surface at the top.
  const active = useMemo(() => {
    return entries
      .filter(e => e.status === 'Successful')
      .sort((a, b) => {
        const at = String(a.clientTimelineStart || a.dateReachedOut || a.addedAt || '')
        const bt = String(b.clientTimelineStart || b.dateReachedOut || b.addedAt || '')
        return bt.localeCompare(at)
      })
  }, [entries])

  const metrics = useMemo(() => {
    const total = active.length
    const withBudget = active.filter(e => typeof e.clientBudgetAmount === 'number' && (e.clientBudgetAmount ?? 0) > 0)
    const totalBudget = withBudget.reduce((s, e) => s + (e.clientBudgetAmount ?? 0), 0)
    const avgDeal = withBudget.length ? totalBudget / withBudget.length : 0
    const contractsCount = active.filter(e => !!(e.clientContractUrl || '').trim()).length
    return { total, totalBudget, avgDeal, contractsCount, withBudgetCount: withBudget.length }
  }, [active])

  // Track which card is mid-save so we can show subtle feedback.
  const [saving, setSaving] = useState<Set<string>>(new Set())
  const [saveError, setSaveError] = useState<{ id: string; message: string } | null>(null)

  async function handlePatch(id: string, patch: ActiveClientPatch) {
    setSaving(prev => {
      const next = new Set(prev)
      next.add(id)
      return next
    })
    setSaveError(null)
    const result = await updateActiveClientFields(id, patch)
    setSaving(prev => {
      const next = new Set(prev)
      next.delete(id)
      return next
    })
    if (!result.ok) {
      setSaveError({ id, message: result.error ?? 'Save failed.' })
      return
    }
    onPatch(id, patch)
  }

  if (active.length === 0) {
    return (
      <div className="border border-dashed border-border rounded-xl py-16 px-6 text-center">
        <Briefcase className="w-8 h-8 mx-auto text-muted-foreground/50 mb-3" aria-hidden />
        <p className="text-foreground/85 font-medium mb-1">No active clients yet</p>
        <p className="text-muted-foreground text-sm max-w-[42ch] mx-auto leading-relaxed">
          When you mark an outreach as <span className="font-semibold text-foreground/90">Successful</span>,
          it shows up here with editable budget, timeline, scope, and a
          contract-link field. Run a campaign first.
        </p>
      </div>
    )
  }

  return (
    <div>
      {/* Metric row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <MetricCard
          label="Active clients"
          value={metrics.total.toString()}
          icon={<Briefcase className="w-3.5 h-3.5" />}
        />
        <MetricCard
          label="Total booked"
          value={formatCurrency(metrics.totalBudget)}
          sub={metrics.withBudgetCount > 0 ? `${metrics.withBudgetCount} of ${metrics.total} priced` : 'no budgets set'}
          icon={<Wallet className="w-3.5 h-3.5" />}
        />
        <MetricCard
          label="Avg deal size"
          value={metrics.withBudgetCount > 0 ? formatCurrency(metrics.avgDeal) : '—'}
          sub={metrics.withBudgetCount > 0 ? `across ${metrics.withBudgetCount}` : null}
          icon={<TrendingUp className="w-3.5 h-3.5" />}
        />
        <MetricCard
          label="Contracts on file"
          value={`${metrics.contractsCount}/${metrics.total}`}
          sub={metrics.total > 0 ? `${Math.round((metrics.contractsCount / metrics.total) * 100)}%` : null}
          icon={<FileText className="w-3.5 h-3.5" />}
        />
      </div>

      {/* Card grid */}
      <div className="grid md:grid-cols-2 gap-4">
        {active.map(entry => (
          <ActiveClientCard
            key={entry.id}
            entry={entry}
            saving={saving.has(entry.id)}
            saveError={saveError?.id === entry.id ? saveError.message : null}
            onPatch={patch => handlePatch(entry.id, patch)}
          />
        ))}
      </div>
    </div>
  )
}

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

function formatCurrency(n: number): string {
  if (n === 0) return '$0'
  // Compact display for big numbers
  if (n >= 1_000_000) {
    return `$${(n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1)}M`
  }
  if (n >= 10_000) {
    return `$${(n / 1_000).toFixed(0)}K`
  }
  return `$${n.toLocaleString('en-US', { maximumFractionDigits: 0 })}`
}
