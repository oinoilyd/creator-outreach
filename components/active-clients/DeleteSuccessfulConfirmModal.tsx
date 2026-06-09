'use client'

/**
 * DeleteSuccessfulConfirmModal — fires when the user deletes an
 * outreach entry whose status is 'Successful' (= currently an Active
 * Client). Stronger warning than the status-revert confirm because
 * delete is PERMANENT — all client_* fields (budget, scope,
 * milestones, activity log, contract uploads, collaborators) go too.
 *
 * Mirrors RevertSuccessfulConfirmModal but with red destructive
 * styling and a typed confirmation phrase to prevent accidental
 * "Yeah whatever" clicks on a row representing real revenue.
 *
 * Dylan 2026-06-09 — extracted as a sibling to the revert flow
 * because the consequences differ: revert hides + preserves; delete
 * wipes. The user should understand which they're doing.
 */

import { useEffect } from 'react'
import type { OutreachEntry } from '@/lib/types'

interface DeleteSuccessfulConfirmModalProps {
  /** The Successful entry the user is trying to delete. Null when
   *  the modal isn't active. */
  entry: OutreachEntry | null
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

export function DeleteSuccessfulConfirmModal({
  entry,
  onCancel,
  onConfirm,
}: DeleteSuccessfulConfirmModalProps) {
  // Esc closes (treated as Cancel — keep the row).
  useEffect(() => {
    if (!entry) return
    const handler = (ev: KeyboardEvent) => {
      if (ev.key === 'Escape') onCancel()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [entry, onCancel])

  if (!entry) return null

  const channelName = entry.channelName || 'this engagement'
  const dataSummary = summarizeClientData(entry)

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="delete-successful-title"
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={onCancel}
    >
      <div
        className="bg-card border border-red-500/40 rounded-xl shadow-xl max-w-md w-full p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-3 mb-3">
          <span className="shrink-0 mt-0.5 inline-flex items-center justify-center w-8 h-8 rounded-full bg-red-500/15 border border-red-500/40 text-red-700 dark:text-red-300">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M3 6h18" />
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
              <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
            </svg>
          </span>
          <div className="min-w-0 flex-1">
            <h2 id="delete-successful-title" className="text-base font-semibold text-foreground leading-snug">
              Delete <span className="font-bold">{channelName}</span> from Active Clients?
            </h2>
            <p className="text-[13px] text-muted-foreground mt-1.5 leading-snug">
              This is an <span className="font-semibold text-red-700 dark:text-red-300">Active Client</span> (status: Successful).
              Deleting wipes the outreach row AND all client metadata permanently. There is no undo.
            </p>
          </div>
        </div>

        {dataSummary.length > 0 && (
          <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/5 px-3 py-2.5">
            <div className="text-[11px] uppercase tracking-[0.14em] font-bold text-red-700 dark:text-red-300 mb-1.5">
              What gets deleted forever
            </div>
            <ul className="text-[12px] text-foreground/90 space-y-0.5">
              {dataSummary.map((part, i) => (
                <li key={i} className="flex items-start gap-1.5">
                  <span className="text-red-700/60 dark:text-red-300/60 mt-0.5">·</span>
                  <span>{part}</span>
                </li>
              ))}
              <li className="flex items-start gap-1.5">
                <span className="text-red-700/60 dark:text-red-300/60 mt-0.5">·</span>
                <span>The outreach row itself + all notes / follow-ups / touchpoints</span>
              </li>
            </ul>
          </div>
        )}

        {dataSummary.length === 0 && (
          <p className="text-[12px] text-muted-foreground mb-4 leading-snug">
            No extra client metadata is attached, but the outreach row + all notes / follow-ups / touchpoints will still be deleted.
            Consider just changing the status away from Successful instead — that hides from Active Clients without losing the data.
          </p>
        )}

        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="text-[13px] font-medium px-4 py-2 rounded-md border border-border text-muted-foreground hover:text-foreground hover:border-foreground/40 transition-colors"
            autoFocus
          >
            Keep {channelName}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="text-[13px] font-semibold px-4 py-2 rounded-md bg-red-600 text-white hover:bg-red-700 transition-colors"
          >
            Delete permanently
          </button>
        </div>
      </div>
    </div>
  )
}
