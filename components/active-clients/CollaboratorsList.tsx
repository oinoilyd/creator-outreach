'use client'

/**
 * CollaboratorsList — editable team roster for an active-client
 * engagement. Each row captures one teammate: role, name, contact
 * info, and a fixed-dollar revenue share. Lives inside the
 * ActiveClientDetailModal right column.
 *
 * Design notes:
 *   • Role is free-text — users tend to label these differently
 *     ("Editor" vs "Video Editor" vs "Lead Edit", etc.) and a
 *     dropdown felt restrictive.
 *   • Share is stored as a number (dollars). Personal Revenue =
 *     budget − sum of shares.
 *   • Each row commits on blur via onChange. Parent persists the
 *     whole array via updateActiveClientFields(clientCollaborators).
 *   • Subtotal line at the bottom shows running total of shares so
 *     the user can sanity-check against the budget.
 */

import { useState } from 'react'
import type { ClientCollaborator } from '@/lib/types'
import { Plus, Trash2, Users } from 'lucide-react'

interface CollaboratorsListProps {
  collaborators: ClientCollaborator[]
  /** Optional — current engagement budget. Used to show "X of $Y"
   *  subtotal so the user can see if shares exceed the budget. */
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
  function addRow() {
    onChange([
      ...collaborators,
      { id: newId(), role: '', name: '', email: '', phone: '', share: 0 },
    ])
  }

  function updateRow(id: string, patch: Partial<ClientCollaborator>) {
    onChange(collaborators.map(c => (c.id === id ? { ...c, ...patch } : c)))
  }

  function removeRow(id: string) {
    onChange(collaborators.filter(c => c.id !== id))
  }

  const totalShare = collaborators.reduce((s, c) => s + (c.share || 0), 0)
  const personalRevenue =
    typeof budget === 'number' && budget > 0 ? Math.max(0, budget - totalShare) : null
  const overBudget = typeof budget === 'number' && budget > 0 && totalShare > budget
  const currency = (budgetCurrency || 'USD').toUpperCase()

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Users className="w-3.5 h-3.5 text-muted-foreground" aria-hidden />
          <h4 className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">
            Team &amp; revenue share
          </h4>
          {collaborators.length > 0 && (
            <span className="text-[11px] text-muted-foreground/75 tabular-nums">
              {collaborators.length}
            </span>
          )}
        </div>
      </div>

      {collaborators.length === 0 && (
        <p className="text-[12px] text-muted-foreground/70 italic mb-2">
          No collaborators yet. Add an editor, designer, or anyone else
          who takes a cut of this engagement&apos;s budget.
        </p>
      )}

      {collaborators.length > 0 && (
        <ul className="space-y-2 mb-2">
          {collaborators.map(c => (
            <li
              key={c.id}
              className="bg-background border border-border rounded-md p-2.5 group"
            >
              {/* Top row — role + name + remove */}
              <div className="grid grid-cols-2 gap-1.5 mb-1.5">
                <input
                  type="text"
                  value={c.role}
                  onChange={e => updateRow(c.id, { role: e.target.value })}
                  placeholder="Role (e.g. Editor)"
                  className="w-full bg-transparent border-0 border-b border-border/60 px-0 py-0.5 text-[13px] font-medium focus:outline-none focus:border-purple-500/50"
                  aria-label="Role"
                />
                <div className="flex items-center gap-1.5">
                  <input
                    type="text"
                    value={c.name}
                    onChange={e => updateRow(c.id, { name: e.target.value })}
                    placeholder="Name"
                    className="flex-1 bg-transparent border-0 border-b border-border/60 px-0 py-0.5 text-[13px] focus:outline-none focus:border-purple-500/50"
                    aria-label="Name"
                  />
                  <button
                    type="button"
                    onClick={() => removeRow(c.id)}
                    className="shrink-0 opacity-0 group-hover:opacity-100 text-muted-foreground/60 hover:text-red-500 transition-opacity"
                    aria-label={`Remove ${c.name || 'collaborator'}`}
                    title="Remove"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
              {/* Contact row — email + phone */}
              <div className="grid grid-cols-2 gap-1.5 mb-1.5">
                <input
                  type="email"
                  value={c.email ?? ''}
                  onChange={e => updateRow(c.id, { email: e.target.value })}
                  placeholder="email@..."
                  className="w-full bg-transparent border-0 border-b border-border/40 px-0 py-0.5 text-[11.5px] font-mono text-muted-foreground/85 focus:outline-none focus:text-foreground focus:border-purple-500/50"
                  aria-label="Email"
                />
                <input
                  type="tel"
                  value={c.phone ?? ''}
                  onChange={e => updateRow(c.id, { phone: e.target.value })}
                  placeholder="phone (optional)"
                  className="w-full bg-transparent border-0 border-b border-border/40 px-0 py-0.5 text-[11.5px] font-mono text-muted-foreground/85 focus:outline-none focus:text-foreground focus:border-purple-500/50"
                  aria-label="Phone"
                />
              </div>
              {/* Share row */}
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground/75">
                  Share
                </span>
                <div className="relative flex-1">
                  <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[11px] font-mono text-muted-foreground/70">
                    {currency}
                  </span>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={c.share === 0 && !c.share ? '' : String(c.share || '')}
                    onChange={e => {
                      const cleaned = e.target.value.replace(/[^0-9.]/g, '')
                      const n = cleaned === '' ? 0 : Number(cleaned)
                      if (!Number.isNaN(n)) updateRow(c.id, { share: n })
                    }}
                    placeholder="0"
                    className="w-full bg-background border border-border rounded px-2 py-0.5 pl-12 text-[12.5px] tabular-nums focus:outline-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-500/50"
                    aria-label="Revenue share in dollars"
                  />
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      {/* Add button */}
      <button
        type="button"
        onClick={addRow}
        className="inline-flex items-center gap-1.5 text-[11.5px] text-muted-foreground hover:text-foreground transition-colors"
      >
        <Plus className="w-3 h-3" />
        Add collaborator
      </button>

      {/* Subtotal */}
      {collaborators.length > 0 && (
        <div className="mt-3 border-t border-border/60 pt-2 text-[11.5px] tabular-nums">
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
                <div className="flex justify-between mt-1 pt-1 border-t border-border/40">
                  <span className="text-muted-foreground font-semibold">Your take</span>
                  <span className="text-foreground font-bold">
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
    </div>
  )
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
