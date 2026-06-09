'use client'

/**
 * ExportGateModal — pre-export confirmation that shows the user what
 * they're about to spend (or that this one is free) before the file is
 * generated.
 *
 * Three display states, driven by /api/exports/entitlement:
 *   • Comp account (unlimited_exports=true)
 *       → "Export now — free, unlimited account"
 *   • Free monthly quota available
 *       → "Export now — this is your 1 free export this month"
 *   • Pre-paid credit available
 *       → "Export now — uses 1 of your N paid credits"
 *   • Requires payment
 *       → "$25 export. Pay with Stripe → " (opens Stripe Checkout)
 *
 * Loading state while entitlement is fetched. Error state if either
 * the entitlement or the export request fails.
 *
 * Why a modal instead of just routing the click? Two reasons:
 *   1. The free vs paid distinction matters financially — user MUST
 *      see what they're agreeing to before bytes flow.
 *   2. The Stripe redirect flow needs a moment of UI handoff so we can
 *      stash entries to localStorage before navigating away.
 */

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'

export interface ExportRequest {
  format: 'xlsx' | 'csv'
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  entries: any[]
}

interface EntitlementResponse {
  canExportFree: boolean
  reason:
    | 'unlimited_account'
    | 'under_threshold_free_monthly'
    | 'paid_credit_available'
    | 'requires_payment'
  outreachRowCount: number
  threshold: number
  freeQuotaResetsAt: string | null
  paidCredits: number
  paidExportPriceCents: number
}

/** localStorage key for pending export resume after Stripe redirect. */
export const PENDING_EXPORT_LS_KEY = 'pending-export-after-payment'

interface Props {
  open: boolean
  request: ExportRequest | null
  onClose: () => void
}

export function ExportGateModal({ open, request, onClose }: Props) {
  const [entitlement, setEntitlement] = useState<EntitlementResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  // Reset state when modal opens.
  useEffect(() => {
    if (!open) {
      setEntitlement(null)
      setError(null)
      return
    }
    let cancelled = false
    setLoading(true)
    setError(null)
    fetch('/api/exports/entitlement', { method: 'GET' })
      .then(r => r.json())
      .then((data: EntitlementResponse) => {
        if (cancelled) return
        setEntitlement(data)
      })
      .catch(err => {
        if (cancelled) return
        setError(err instanceof Error ? err.message : 'Could not load export status')
      })
      .finally(() => {
        if (cancelled) return
        setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [open])

  if (!open || !request) return null

  async function runExport() {
    if (!request || !entitlement) return
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch('/api/export-outreach', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entries: request.entries, format: request.format }),
      })
      if (res.status === 402) {
        // Lost a race or entitlement changed between check + consume.
        // Refresh entitlement; user has to confirm again.
        const data = await res.json().catch(() => null)
        setError(data?.reason === 'requires_payment'
          ? 'Looks like your free export was already used. Refreshing options.'
          : 'Export blocked. Please confirm again.')
        // Re-poll entitlement to show the new state.
        const next = await fetch('/api/exports/entitlement').then(r => r.json()).catch(() => null)
        if (next) setEntitlement(next)
        setSubmitting(false)
        return
      }
      if (!res.ok) {
        setError(`Export failed (${res.status}).`)
        setSubmitting(false)
        return
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = request.format === 'csv' ? 'outreach.csv' : 'outreach.xlsx'
      a.click()
      URL.revokeObjectURL(url)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Export failed.')
    } finally {
      setSubmitting(false)
    }
  }

  async function startPayment() {
    if (!request) return
    setSubmitting(true)
    setError(null)
    try {
      // Stash the request so we can resume the export after Stripe
      // redirects back. localStorage survives the redirect; sessionStorage
      // would too, but localStorage is simpler and the data clears on
      // resume.
      try {
        localStorage.setItem(PENDING_EXPORT_LS_KEY, JSON.stringify(request))
      } catch {
        // localStorage quota exceeded or denied — bail with a clear msg.
        setError('Could not save export state. Try clearing browser storage.')
        setSubmitting(false)
        return
      }
      const res = await fetch('/api/exports/checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      if (!res.ok) {
        setError('Could not start payment. Try again in a moment.')
        setSubmitting(false)
        return
      }
      const data: { url?: string } = await res.json()
      if (!data.url) {
        setError('No payment URL returned.')
        setSubmitting(false)
        return
      }
      // Redirect to Stripe Checkout. We don't onClose() — page is about
      // to unload anyway, and clearing state mid-redirect could glitch.
      window.location.href = data.url
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Payment start failed.')
      setSubmitting(false)
    }
  }

  // Body content depends on entitlement state.
  const content = (() => {
    if (loading) {
      return (
        <div className="py-6 text-center text-sm text-muted-foreground">
          Checking your export options…
        </div>
      )
    }
    if (!entitlement) {
      return (
        <div className="py-4 text-sm text-red-600">
          {error || 'Could not load export status.'}
        </div>
      )
    }
    if (entitlement.reason === 'unlimited_account') {
      return (
        <>
          <div className="mb-4 px-3 py-2 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800/40 rounded-md text-sm text-emerald-800 dark:text-emerald-200">
            <span className="font-semibold">Unlimited account</span> — exports are free for you.
          </div>
          <div className="text-sm text-muted-foreground">
            {request.entries.length} {request.entries.length === 1 ? 'entry' : 'entries'} → {request.format.toUpperCase()}
          </div>
        </>
      )
    }
    // Dylan 2026-06-08: 'under_threshold_free_monthly' branch removed
    // because the gate no longer returns it. The reason value still
    // exists in the union for legacy session continuity, but nothing
    // in the gate produces it anymore.
    if (entitlement.reason === 'paid_credit_available') {
      return (
        <>
          <div className="mb-4 px-3 py-2 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800/40 rounded-md text-sm text-emerald-800 dark:text-emerald-200">
            <div className="font-semibold mb-0.5">Paid credit available</div>
            <div className="text-xs opacity-80">
              You have {entitlement.paidCredits} pre-paid export {entitlement.paidCredits === 1 ? 'credit' : 'credits'}. This export will use one.
            </div>
          </div>
          <div className="text-sm text-muted-foreground">
            {request.entries.length} {request.entries.length === 1 ? 'entry' : 'entries'} → {request.format.toUpperCase()}
          </div>
        </>
      )
    }
    // requires_payment
    const dollars = (entitlement.paidExportPriceCents / 100).toFixed(0)
    return (
      <>
        <div className="mb-4 px-3 py-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/40 rounded-md text-sm text-amber-900 dark:text-amber-100">
          <div className="font-semibold mb-0.5">${dollars} to export</div>
          <div className="text-xs opacity-90">
            One-time charge via Stripe Checkout — saved card if you have one, no subscription change.
            You have {entitlement.outreachRowCount} outreach {entitlement.outreachRowCount === 1 ? 'entry' : 'entries'} to export.
          </div>
        </div>
        <div className="text-sm text-muted-foreground">
          {request.entries.length} {request.entries.length === 1 ? 'entry' : 'entries'} → {request.format.toUpperCase()}
        </div>
      </>
    )
  })()

  // Footer depends on entitlement state.
  const footer = (() => {
    if (!entitlement) return null
    if (entitlement.canExportFree) {
      return (
        <button
          onClick={runExport}
          disabled={submitting}
          className="px-4 py-2 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {submitting ? 'Exporting…' : 'Export now'}
        </button>
      )
    }
    return (
      <button
        onClick={startPayment}
        disabled={submitting}
        className="px-4 py-2 rounded-md bg-amber-600 hover:bg-amber-700 text-white text-sm font-medium transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {submitting ? 'Redirecting…' : `Pay $${(entitlement.paidExportPriceCents / 100).toFixed(0)} → Export`}
      </button>
    )
  })()

  // Portal to document.body so we escape any ancestor stacking context.
  if (typeof document === 'undefined') return null
  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-card border border-border rounded-xl shadow-2xl max-w-md w-[92vw] p-5"
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="export-gate-title"
      >
        <h2 id="export-gate-title" className="text-lg font-semibold text-foreground mb-3">
          Export outreach
        </h2>
        {content}
        {error && entitlement && (
          <div className="mt-3 text-xs text-red-600 dark:text-red-400">{error}</div>
        )}
        <div className="mt-5 flex items-center justify-end gap-2">
          <button
            onClick={onClose}
            disabled={submitting}
            className="px-3 py-2 rounded-md text-sm text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors disabled:opacity-60"
          >
            Cancel
          </button>
          {footer}
        </div>
      </div>
    </div>,
    document.body,
  )
}
