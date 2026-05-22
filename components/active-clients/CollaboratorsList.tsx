'use client'

/**
 * CollaboratorsList — editable team roster for an active-client
 * engagement. Each row captures one teammate: role, name, contact
 * info, and a revenue share (either a fixed dollar amount OR a
 * percentage of the engagement budget — togglable per row).
 *
 * Lives inside the ActiveClientDetailModal as a featured section.
 *
 * Perf note:
 *   v1 committed every keystroke up to the parent, which round-tripped
 *   to Supabase and re-rendered the entire 4000-line page tree on each
 *   character. Typing felt laggy by ~3-4 characters in. v2 lifts each
 *   row into its own component with LOCAL state; the parent only sees
 *   updates on blur (or Enter). Same UX (auto-save), zero per-keystroke
 *   re-renders.
 *
 * Share semantics:
 *   • shareType='dollar'  → value is a fixed dollar amount
 *   • shareType='percent' → value is a % of the engagement budget
 *   resolveCollaboratorShare (lib/types.ts) does the conversion so
 *   the metric cards stay accurate regardless of which is chosen.
 */

import { useEffect, useRef, useState } from 'react'
import type { ClientCollaborator } from '@/lib/types'
import { resolveCollaboratorShare } from '@/lib/types'
import { Plus, Trash2, Users } from 'lucide-react'
import { AddCollaboratorModal } from './AddCollaboratorModal'

interface CollaboratorsListProps {
  collaborators: ClientCollaborator[]
  /** Optional — current engagement budget. Used to (a) resolve %
   *  shares to dollars for the subtotal, and (b) show "X of $Y". */
  budget?: number | null
  budgetCurrency?: string | null
  onChange: (next: ClientCollaborator[]) => void
}

function newId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    try { return (crypto as Crypto).randomUUID() } catch { /* fall through */ }
  }
  return `c_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}

export function CollaboratorsList({
  collaborators,
  budget,
  budgetCurrency,
  onChange,
}: CollaboratorsListProps) {
  // + Add no longer spawns an inline empty row. It opens a focused
  // modal where the user fills in role/name/email/share, and only on
  // submit does the row join the list. The section stays in its
  // clean/generic state until someone is actually on the team.
  const [addModalOpen, setAddModalOpen] = useState(false)

  function commitRow(id: string, patch: Partial<ClientCollaborator>) {
    onChange(collaborators.map(c => (c.id === id ? { ...c, ...patch } : c)))
  }

  function removeRow(id: string) {
    onChange(collaborators.filter(c => c.id !== id))
  }

  function handleAddSubmit(next: Omit<ClientCollaborator, 'id'>) {
    onChange([...collaborators, { ...next, id: newId() }])
  }

  const currency = (budgetCurrency || 'USD').toUpperCase()

  // Resolve share for every row (% → dollars when applicable) so the
  // subtotal reads the user's actual take, not the literal numbers.
  const resolvedShares = collaborators.map(c => resolveCollaboratorShare(c, budget))
  const totalShare = resolvedShares.reduce((s, n) => s + n, 0)

  const personalRevenue =
    typeof budget === 'number' && budget > 0 ? Math.max(0, budget - totalShare) : null
  const overBudget = typeof budget === 'number' && budget > 0 && totalShare > budget

  return (
    <div className="bg-muted/30 border border-border/80 rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-purple-500" aria-hidden />
          <h3 className="text-[13px] font-semibold text-foreground">
            Team &amp; revenue share
          </h3>
          {collaborators.length > 0 && (
            <span className="text-[11px] text-muted-foreground/75 tabular-nums bg-background/60 px-1.5 py-0.5 rounded">
              {collaborators.length}
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={() => setAddModalOpen(true)}
          className="inline-flex items-center gap-1 text-[11.5px] font-medium text-purple-700 dark:text-purple-300 hover:text-purple-900 dark:hover:text-purple-100 bg-purple-500/10 hover:bg-purple-500/20 px-2 py-1 rounded-md transition-colors"
        >
          <Plus className="w-3 h-3" />
          Add
        </button>
      </div>

      {collaborators.length === 0 && (
        <p className="text-[12px] text-muted-foreground/70 italic mb-3">
          Add an editor, designer, or anyone else who takes a cut of this
          engagement&apos;s budget. Splits show up in your Personal Revenue
          metric.
        </p>
      )}

      {collaborators.length > 0 && (
        <ul className="space-y-2 mb-3">
          {collaborators.map((c, i) => (
            <CollaboratorRow
              key={c.id}
              row={c}
              currency={currency}
              budget={budget}
              resolvedShare={resolvedShares[i]}
              onCommit={patch => commitRow(c.id, patch)}
              onRemove={() => removeRow(c.id)}
            />
          ))}
        </ul>
      )}

      {/* Subtotal */}
      {collaborators.length > 0 && (
        <div className="border-t border-border/60 pt-2.5 text-[11.5px] tabular-nums">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Total share</span>
            <span className={overBudget ? 'text-red-600 dark:text-red-400 font-semibold' : 'text-foreground font-semibold'}>
              {formatMoney(totalShare, currency)}
            </span>
          </div>
          {typeof budget === 'number' && budget > 0 && (
            <>
              <div className="flex justify-between text-muted-foreground/75 mt-0.5">
                <span>of budget</span>
                <span>{formatMoney(budget, currency)}</span>
              </div>
              {personalRevenue != null && (
                <div className="flex justify-between mt-1.5 pt-1.5 border-t border-border/40">
                  <span className="text-foreground font-semibold">Your take</span>
                  <span className="text-foreground font-bold text-[13px]">
                    {formatMoney(personalRevenue, currency)}
                  </span>
                </div>
              )}
              {overBudget && (
                <p className="mt-1 text-[11px] text-red-600 dark:text-red-400">
                  Shares exceed the budget by {formatMoney(totalShare - budget, currency)}.
                </p>
              )}
            </>
          )}
        </div>
      )}

      {/* Add modal — nested on top of ActiveClientDetailModal. Only
          mounted when open so it doesn't run effects in the background. */}
      {addModalOpen && (
        <AddCollaboratorModal
          budget={budget}
          budgetCurrency={budgetCurrency}
          onSubmit={handleAddSubmit}
          onClose={() => setAddModalOpen(false)}
        />
      )}
    </div>
  )
}

// ── Per-row component ─────────────────────────────────────────────────
// Holds the in-progress input state locally so the parent (and the
// 4000-line page tree above it) doesn't re-render on every keystroke.
// Commits on blur, Enter, or unmount.

interface CollaboratorRowProps {
  row: ClientCollaborator
  currency: string
  budget?: number | null
  /** Pre-computed dollar value of this row's share — passed in from
   *  the parent so we only resolve once per render cycle. */
  resolvedShare: number
  onCommit: (patch: Partial<ClientCollaborator>) => void
  onRemove: () => void
}

function CollaboratorRow({
  row, currency, budget, resolvedShare, onCommit, onRemove,
}: CollaboratorRowProps) {
  // Local drafts for the text-y fields. Initialised from props and
  // re-synced when the props change (e.g. parent re-fetched the row).
  const [role, setRole] = useState(row.role)
  const [name, setName] = useState(row.name)
  const [email, setEmail] = useState(row.email ?? '')
  const [phone, setPhone] = useState(row.phone ?? '')
  const [shareStr, setShareStr] = useState(formatShareForInput(row.share))
  const shareType: 'dollar' | 'percent' = row.shareType ?? 'dollar'

  // Re-sync local state if the underlying row changes underneath us
  // (e.g. a different user's update, or a parent reset). Only update
  // when the value actually differs to avoid clobbering in-progress
  // typing during a parent re-render.
  useEffect(() => { if (row.role !== role) setRole(row.role) /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [row.role])
  useEffect(() => { if (row.name !== name) setName(row.name) /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [row.name])
  useEffect(() => { if ((row.email ?? '') !== email) setEmail(row.email ?? '') /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [row.email])
  useEffect(() => { if ((row.phone ?? '') !== phone) setPhone(row.phone ?? '') /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [row.phone])
  useEffect(() => {
    const next = formatShareForInput(row.share)
    if (next !== shareStr) setShareStr(next)
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [row.share])

  // Refs hold the latest draft values so the unmount cleanup can
  // commit any pending edits without depending on stale closure state.
  const latest = useRef({ role, name, email, phone, shareStr })
  latest.current = { role, name, email, phone, shareStr }

  // Commit any in-progress edits on unmount (modal close, row removal,
  // tab switch). Without this the user can type then close and lose
  // the last 1-2 characters they typed.
  useEffect(() => {
    return () => {
      const patch: Partial<ClientCollaborator> = {}
      const { role: r, name: n, email: e, phone: p, shareStr: s } = latest.current
      if (r !== row.role) patch.role = r
      if (n !== row.name) patch.name = n
      if (e !== (row.email ?? '')) patch.email = e
      if (p !== (row.phone ?? '')) patch.phone = p
      const parsed = parseShare(s)
      if (parsed !== row.share) patch.share = parsed
      if (Object.keys(patch).length > 0) onCommit(patch)
    }
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [])

  function commitRole() { if (role !== row.role) onCommit({ role }) }
  function commitName() { if (name !== row.name) onCommit({ name }) }
  function commitEmail() { if (email !== (row.email ?? '')) onCommit({ email }) }
  function commitPhone() { if (phone !== (row.phone ?? '')) onCommit({ phone }) }
  function commitShare() {
    const parsed = parseShare(shareStr)
    if (parsed !== row.share) onCommit({ share: parsed })
  }

  function toggleShareType() {
    // Toggle alone is a parent commit (no local state for type)
    onCommit({ shareType: shareType === 'dollar' ? 'percent' : 'dollar' })
  }

  const showResolvedHint =
    shareType === 'percent' && typeof budget === 'number' && budget > 0 && row.share > 0

  return (
    <li className="bg-background border border-border rounded-md p-2.5 group">
      {/* Top row — role + name + remove */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 mb-1.5">
        <input
          type="text"
          value={role}
          onChange={e => setRole(e.target.value)}
          onBlur={commitRole}
          onKeyDown={e => { if (e.key === 'Enter') (e.currentTarget as HTMLInputElement).blur() }}
          placeholder="Role (e.g. Editor)"
          className="w-full bg-transparent border-0 border-b border-border/60 px-0 py-0.5 text-[13px] font-medium focus:outline-none focus:border-purple-500/50"
          aria-label="Role"
        />
        <div className="flex items-center gap-1.5">
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            onBlur={commitName}
            onKeyDown={e => { if (e.key === 'Enter') (e.currentTarget as HTMLInputElement).blur() }}
            placeholder="Name"
            className="flex-1 bg-transparent border-0 border-b border-border/60 px-0 py-0.5 text-[13px] focus:outline-none focus:border-purple-500/50"
            aria-label="Name"
          />
          <button
            type="button"
            onClick={onRemove}
            className="shrink-0 opacity-0 group-hover:opacity-100 text-muted-foreground/60 hover:text-red-500 transition-opacity"
            aria-label={`Remove ${row.name || 'collaborator'}`}
            title="Remove"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
      {/* Contact row — email + phone */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 mb-1.5">
        <input
          type="email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          onBlur={commitEmail}
          onKeyDown={e => { if (e.key === 'Enter') (e.currentTarget as HTMLInputElement).blur() }}
          placeholder="email@..."
          className="w-full bg-transparent border-0 border-b border-border/40 px-0 py-0.5 text-[11.5px] font-mono text-muted-foreground/85 focus:outline-none focus:text-foreground focus:border-purple-500/50"
          aria-label="Email"
        />
        <input
          type="tel"
          value={phone}
          onChange={e => setPhone(e.target.value)}
          onBlur={commitPhone}
          onKeyDown={e => { if (e.key === 'Enter') (e.currentTarget as HTMLInputElement).blur() }}
          placeholder="phone (optional)"
          className="w-full bg-transparent border-0 border-b border-border/40 px-0 py-0.5 text-[11.5px] font-mono text-muted-foreground/85 focus:outline-none focus:text-foreground focus:border-purple-500/50"
          aria-label="Phone"
        />
      </div>
      {/* Share row — $/% toggle + value + resolved hint */}
      <div className="flex items-center gap-1.5">
        <span className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground/75">
          Share
        </span>
        {/* Type toggle — segmented control feel */}
        <div
          className="inline-flex bg-muted rounded overflow-hidden text-[10.5px] font-semibold"
          role="group"
          aria-label="Share type"
        >
          <button
            type="button"
            onClick={() => { if (shareType !== 'dollar') toggleShareType() }}
            aria-pressed={shareType === 'dollar'}
            className={[
              'px-1.5 py-0.5 transition-colors',
              shareType === 'dollar'
                ? 'bg-purple-500 text-white'
                : 'text-muted-foreground hover:text-foreground',
            ].join(' ')}
            title="Fixed dollar amount"
          >
            $
          </button>
          <button
            type="button"
            onClick={() => { if (shareType !== 'percent') toggleShareType() }}
            aria-pressed={shareType === 'percent'}
            className={[
              'px-1.5 py-0.5 transition-colors',
              shareType === 'percent'
                ? 'bg-purple-500 text-white'
                : 'text-muted-foreground hover:text-foreground',
            ].join(' ')}
            title="Percentage of budget"
          >
            %
          </button>
        </div>
        <div className="relative flex-1">
          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[11px] font-mono text-muted-foreground/70 pointer-events-none">
            {shareType === 'dollar' ? currency : '%'}
          </span>
          <input
            type="text"
            inputMode="decimal"
            value={shareStr}
            onChange={e => setShareStr(e.target.value.replace(/[^0-9.]/g, ''))}
            onBlur={commitShare}
            onKeyDown={e => { if (e.key === 'Enter') (e.currentTarget as HTMLInputElement).blur() }}
            placeholder="0"
            className="w-full bg-background border border-border rounded px-2 py-0.5 pl-12 text-[12.5px] tabular-nums focus:outline-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-500/50"
            aria-label={shareType === 'dollar' ? 'Revenue share in dollars' : 'Revenue share as percent of budget'}
          />
        </div>
        {showResolvedHint && (
          <span className="shrink-0 text-[10.5px] tabular-nums text-muted-foreground/75 whitespace-nowrap">
            ≈ {formatMoney(resolvedShare, currency)}
          </span>
        )}
      </div>
    </li>
  )
}

// ── Helpers ──────────────────────────────────────────────────────────

function formatShareForInput(n: number): string {
  if (!n) return ''
  return String(n)
}

function parseShare(s: string): number {
  const cleaned = s.replace(/[^0-9.]/g, '')
  if (cleaned === '') return 0
  const n = Number(cleaned)
  return Number.isNaN(n) ? 0 : n
}

function formatMoney(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency || 'USD',
      maximumFractionDigits: 0,
    }).format(amount)
  } catch {
    return `$${amount.toLocaleString('en-US', { maximumFractionDigits: 0 })}`
  }
}
