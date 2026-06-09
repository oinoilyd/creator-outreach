'use client'

/**
 * RevertSuccessfulConfirmModal — fires when the user changes an
 * outreach's status FROM 'Successful' to anything else (Open, Pending
 * Response, Rejected, Not Outreached).
 *
 * Why (Dylan 2026-06-08): Active Clients is defined as
 * `entries.filter(e => e.status === 'Successful')`. Flipping the
 * status away silently removes the row from the Active Clients view
 * while leaving every client_* field (budget, lifecycle, milestones,
 * activity, contract) preserved in the DB. Users were doing this by
 * accident and losing visibility on real engagements without realizing.
 *
 * Design choices:
 *   • Confirm-only modal — no "clear all client data" button. Most
 *     reverts are accidental or temporary; data preservation is the
 *     safe default. If the user truly wants to wipe a client, they
 *     can do it from the Active Client detail panel directly.
 *   • Surfaces what data is attached so the user understands what
 *     "preserved but hidden" means concretely (e.g., "$5,000 budget,
 *     3 milestones, 2 activity log entries").
 *   • Cancel is the destructive-prevention action — defaults to
 *     "Keep as Successful" so accidental click-outs don't change
 *     the status.
 */

import { useEffect } from 'react'
import type { OutreachEntry } from '@/lib/types'
import { statusLabel } from '@/lib/outreach-status'

export interface PendingRevert {
  entry: OutreachEntry
  newStatus: NonNullable<OutreachEntry['status']>
}

interface RevertSuccessfulConfirmModalProps {
  pending: PendingRevert | null
  onCancel: () => void
  onConfirm: () => void
}

function summarizeClientData(e: OutreachEntry): string[] {
  const parts: string[] = []
  if (e.dealValue) parts.push(`${e.dealValue} deal value`)
  if (e.clientBudgetAmount) {
    const currency = e.clientBudgetCurrency || 'USD'
    parts.push(`${currency} ${e.clientBudgetAmount.toLocaleString()} budget`)
  }
  if (e.clientScope) parts.push('scope notes')
  if (e.clientLifecycle) parts.push(`lifecycle: ${e.clientLifecycle}`)
  if (e.clientMilestones && e.clientMilestones.length > 0) {
    parts.push(`${e.clientMilestones.length} milestone${e.clientMilestones.length === 1 ? '' : 's'}`)
  }
  if (e.clientActivity && e.clientActivity.length > 0) {
    parts.push(`${e.clientActivity.length} activity entr${e.clientActivity.length === 1 ? 'y' : 'ies'}`)
  }
  if (e.clientContractUrl || e.clientContractPath) parts.push('uploaded contract')
  if (e.clientCollaborators && e.clientCollaborators.length > 0) {
    parts.push(`${e.clientCollaborators.length} collaborator${e.clientCollaborators.length === 1 ? '' : 's'}`)
  }
  return parts
}

export function RevertSuccessfulConfirmModal({
  pending,
  onCancel,
  onConfirm,
}: RevertSuccessfulConfirmModalProps) {
  // Esc closes (treated as Cancel — keep as Successful).
  useEffect(() => {
    if (!pending) return
    const handler = (ev: KeyboardEvent) => {
      if (ev.key === 'Escape') onCancel()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [pending, onCancel])

  if (!pending) return null

  const { entry, newStatus } = pending
  const dataSummary = summarizeClientData(entry)
  const newLabel = statusLabel(newStatus)
  const channelName = entry.channelName || 'this engagement'

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="revert-successful-title"
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={onCancel}
    >
      <div
        className="bg-card border border-border rounded-xl shadow-xl max-w-md w-full p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-3 mb-3">
          <span className="shrink-0 mt-0.5 inline-flex items-center justify-center w-8 h-8 rounded-full bg-amber-500/15 border border-amber-500/40 text-amber-700 dark:text-amber-300">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
          </span>
          <div className="min-w-0 flex-1">
            <h2 id="revert-successful-title" className="text-base font-semibold text-foreground leading-snug">
              Remove <span className="font-bold">{channelName}</span> from Active Clients?
            </h2>
            <p className="text-[13px] text-muted-foreground mt-1.5 leading-snug">
              Changing status from <strong>Successful</strong> to <strong>{newLabel}</strong> will
              hide this engagement from the Active Clients tab.
            </p>
          </div>
        </div>

        {dataSummary.length > 0 && (
          <div className="mb-4 rounded-lg border border-border bg-muted/30 px-3 py-2.5">
            <div className="text-[11px] uppercase tracking-[0.14em] font-bold text-muted-foreground mb-1.5">
              What stays (preserved in the DB)
            </div>
            <ul className="text-[12px] text-foreground/90 space-y-0.5">
              {dataSummary.map((part, i) => (
                <li key={i} className="flex items-start gap-1.5">
                  <span className="text-muted-foreground mt-0.5">·</span>
                  <span>{part}</span>
                </li>
              ))}
            </ul>
            <p className="text-[11px] text-muted-foreground mt-2 leading-snug">
              Switch back to Successful any time to restore them to Active Clients with this data intact.
            </p>
          </div>
        )}

        {dataSummary.length === 0 && (
          <p className="text-[12px] text-muted-foreground mb-4 leading-snug">
            No client-specific data is attached to this engagement, so nothing else changes.
            You can restore them to Active Clients by switching back to Successful.
          </p>
        )}

        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="text-[13px] font-medium px-4 py-2 rounded-md border border-border text-muted-foreground hover:text-foreground hover:border-foreground/40 transition-colors"
            autoFocus
          >
            Keep as Successful
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="text-[13px] font-semibold px-4 py-2 rounded-md bg-amber-500 text-amber-950 hover:bg-amber-400 transition-colors"
          >
            Change to {newLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
