'use client'

/**
 * ActiveClientCard — summary card for one engagement in the Active
 * Clients grid. Glance-able, not editable. Click anywhere to open
 * the detail modal where the actual editing happens.
 *
 * Shows:
 *   • Channel name + lifecycle pill
 *   • Budget + currency
 *   • Timeline (start → end) with duration
 *   • Scope (truncated)
 *   • Milestone progress bar + counts
 *   • Contract indicator (uploaded / linked / —)
 *
 * Designed for fast scanning across many engagements. The v1 used
 * inline fields per card which got noisy at >5 clients.
 */

import type { OutreachEntry, ClientLifecycle } from '@/lib/types'
import {
  ExternalLink, Calendar, CircleDollarSign, FileText, Paperclip,
  ListChecks,
} from 'lucide-react'

interface ActiveClientCardProps {
  entry: OutreachEntry
  onOpen: () => void
}

export function ActiveClientCard({ entry, onOpen }: ActiveClientCardProps) {
  const channel = entry.channelName || '(unnamed client)'
  const lifecycle: ClientLifecycle = (entry.clientLifecycle ?? 'active') as ClientLifecycle
  const milestones = entry.clientMilestones ?? []
  const milestonesDone = milestones.filter(m => !!m.completedAt).length

  const hasContract = !!entry.clientContractPath || !!(entry.clientContractUrl || '').trim()
  const contractLabel = entry.clientContractPath
    ? entry.clientContractName || 'Contract uploaded'
    : (entry.clientContractUrl || '').trim()
      ? 'External contract link'
      : 'No contract'

  return (
    <button
      type="button"
      onClick={onOpen}
      className="group text-left bg-card/40 border border-border rounded-xl p-4 hover:border-foreground/30 hover:bg-card/60 transition-colors focus:outline-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-500/40"
      aria-label={`Open ${channel} engagement details`}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <h3 className="text-[14.5px] font-semibold text-foreground truncate">
              {channel}
            </h3>
            {entry.channelUrl && (
              <a
                href={entry.channelUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={e => e.stopPropagation()}
                className="text-muted-foreground/60 hover:text-foreground shrink-0"
                aria-label="Open channel"
                title="Open channel in new tab"
              >
                <ExternalLink className="w-3 h-3" />
              </a>
            )}
          </div>
          {entry.clientScope && (
            <p className="text-[11.5px] text-muted-foreground/80 line-clamp-1 mt-0.5">
              {entry.clientScope}
            </p>
          )}
        </div>
        <LifecycleChip lifecycle={lifecycle} />
      </div>

      {/* Stat row */}
      <div className="grid grid-cols-3 gap-2 mb-3">
        <Stat
          icon={<CircleDollarSign className="w-3 h-3" />}
          value={formatBudget(entry.clientBudgetAmount, entry.clientBudgetCurrency)}
        />
        <Stat
          icon={<Calendar className="w-3 h-3" />}
          value={formatTimeline(entry.clientTimelineStart, entry.clientTimelineEnd)}
        />
        <Stat
          icon={<ListChecks className="w-3 h-3" />}
          value={milestones.length > 0 ? `${milestonesDone}/${milestones.length}` : '—'}
        />
      </div>

      {/* Milestone progress bar — only when there are milestones */}
      {milestones.length > 0 && (
        <div className="h-1 bg-muted rounded-full mb-3 overflow-hidden">
          <div
            className={[
              'h-full transition-[width]',
              milestonesDone === milestones.length ? 'bg-green-500/80' : 'bg-foreground/40',
            ].join(' ')}
            style={{ width: `${(milestonesDone / milestones.length) * 100}%` }}
            aria-hidden
          />
        </div>
      )}

      {/* Under-budget flag — only renders for completed engagements
          where the captured final value undershot the contract budget
          by >0.5% (same threshold as WrapUpEngagementModal +
          ActiveClientDetailModal hero). Surfaces pricing slippage in
          the Completed tab list view, so the user can scan and spot
          patterns without clicking into each card.

          Sits ABOVE the contract row so it's the first non-header
          thing the eye lands on after the milestone bar. */}
      <UnderBudgetCardFlag entry={entry} lifecycle={lifecycle} />

      {/* Contract indicator */}
      <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground/75">
        {hasContract ? (
          <>
            <Paperclip className="w-3 h-3 text-rose-500/70" aria-hidden />
            <span className="truncate">{contractLabel}</span>
          </>
        ) : (
          <>
            <FileText className="w-3 h-3 text-muted-foreground/40" aria-hidden />
            <span className="italic text-muted-foreground/55">No contract attached</span>
          </>
        )}
        <span className="ml-auto text-[10.5px] text-muted-foreground/50 opacity-0 group-hover:opacity-100 transition-opacity">
          Open →
        </span>
      </div>
    </button>
  )
}

/**
 * UnderBudgetCardFlag — compact pill flag on the Active Client card.
 * Mirrors the detail-modal hero's flag so the Completed tab list
 * view surfaces under-contract closes without requiring the user to
 * click into each card. Same >0.5% threshold + currency formatter.
 */
function UnderBudgetCardFlag({
  entry,
  lifecycle,
}: {
  entry: OutreachEntry
  lifecycle: ClientLifecycle
}) {
  if (lifecycle !== 'completed') return null
  const budget = entry.clientBudgetAmount
  const finalValue = entry.clientFinalValue
  if (typeof budget !== 'number' || budget <= 0) return null
  if (typeof finalValue !== 'number') return null

  const delta = finalValue - budget
  const pct = (delta / budget) * 100
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
    <div
      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded border border-amber-500/40 bg-amber-500/10 text-amber-800 dark:text-amber-200 text-[10.5px] font-semibold leading-tight mb-2.5"
      title={`Closed below the contract budget — ${amountText} short (${absPct.toFixed(absPct < 10 ? 1 : 0)}%).`}
    >
      <span aria-hidden className="text-amber-600 dark:text-amber-400">⚠</span>
      <span>Under contract</span>
      <span className="text-amber-700/80 dark:text-amber-300/80 font-normal tabular-nums">
        −{amountText} ({absPct.toFixed(absPct < 10 ? 1 : 0)}%)
      </span>
    </div>
  )
}

// ── Inline ────────────────────────────────────────────────────────────

function LifecycleChip({ lifecycle }: { lifecycle: ClientLifecycle }) {
  const styles: Record<ClientLifecycle, string> = {
    active:    'bg-green-500/12 text-green-700 dark:text-green-300 border-green-500/30',
    paused:    'bg-amber-500/12 text-amber-700 dark:text-amber-300 border-amber-500/30',
    completed: 'bg-blue-500/12 text-blue-700 dark:text-blue-300 border-blue-500/30',
    churned:   'bg-rose-500/12 text-rose-700 dark:text-rose-300 border-rose-500/30',
  }
  return (
    <span className={`shrink-0 text-[9.5px] uppercase tracking-wider px-1.5 py-0.5 rounded border font-medium ${styles[lifecycle]}`}>
      {lifecycle}
    </span>
  )
}

function Stat({ icon, value }: { icon: React.ReactNode; value: string }) {
  return (
    <div className="flex items-center gap-1 min-w-0 text-[12px] text-muted-foreground/85">
      <span className="text-muted-foreground/55 shrink-0">{icon}</span>
      <span className="truncate tabular-nums">{value}</span>
    </div>
  )
}

// ── Formatters ────────────────────────────────────────────────────────

function formatBudget(amount: number | null | undefined, currency: string | null | undefined): string {
  if (!amount || amount <= 0) return '—'
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: (currency || 'USD').toUpperCase(),
      maximumFractionDigits: 0,
      notation: amount >= 100_000 ? 'compact' : 'standard',
    }).format(amount)
  } catch {
    return `${(currency || 'USD').toUpperCase()} ${amount.toLocaleString('en-US')}`
  }
}

function formatTimeline(start: string | null | undefined, end: string | null | undefined): string {
  if (!start && !end) return '—'
  if (start && !end) return `${shortDate(start)} →`
  if (!start && end) return `→ ${shortDate(end)}`
  return `${shortDate(start!)}–${shortDate(end!)}`
}

function shortDate(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}
