'use client'

/**
 * PendingResponsePrompt — "did you just email them?" confirmation.
 *
 * Why: previously, clicking an email link in the Outreach table
 * silently auto-flipped status from 'Not Outreached' → 'No Response'.
 * That dropped the user into a status change they never confirmed.
 *
 * Now (Dylan 2026-05-31): we wait until the user returns from their
 * mail client and ask. If they say yes, flip to 'No Response' (which
 * displays as "Pending Response"). If they say not now, dismiss for
 * this row this session — they can still flip it manually any time.
 *
 * Flow:
 *   1. Email link is clicked → dispatches 'pending-response:email-click'
 *      CustomEvent with { rowId, channelName }
 *   2. This component records { rowId, channelName, clickedAt }
 *   3. visibilitychange fires when the user leaves AND returns
 *   4. On return, if all guards pass, the prompt renders
 *   5. Yes → onConfirm(rowId, 'No Response'); Not now → dismiss
 *
 * Guards (don't be annoying):
 *   • Tab must have actually been hidden (= user left to send email)
 *   • Return must happen within 3 min (else they forgot)
 *   • Row mustn't have already been advanced past 'Not Outreached'
 *     (handled by the parent — it only fires the event when status is
 *     'Not Outreached' or '')
 *   • One prompt per row per session (dismissedRows ref)
 */

import { useEffect, useRef, useState } from 'react'

const RETURN_WINDOW_MS = 3 * 60 * 1000 // 3 min — beyond this they forgot
const MIN_AWAY_MS = 1500               // <1.5s = misclick, not a real send

export type PendingResponseEventDetail = {
  rowId: string
  channelName: string
}

interface PendingResponsePromptProps {
  /** Called when the user clicks "Yes" — parent flips the row status. */
  onConfirm: (rowId: string) => void
}

interface Pending {
  rowId: string
  channelName: string
  clickedAt: number
  /** Set when the tab goes hidden after the click. Cleared on return. */
  hiddenAt: number | null
}

export function PendingResponsePrompt({ onConfirm }: PendingResponsePromptProps) {
  const [visible, setVisible] = useState<Pending | null>(null)
  const pendingRef = useRef<Pending | null>(null)
  const dismissedRows = useRef<Set<string>>(new Set())

  // Listen for email-click events fired from the cell renderers + the
  // lead detail modal. Each event records the click; visibilitychange
  // decides when (and whether) to surface the prompt.
  useEffect(() => {
    function onEmailClick(ev: Event) {
      const detail = (ev as CustomEvent<PendingResponseEventDetail>).detail
      if (!detail?.rowId) return
      // Skip rows the user already said "not now" to this session.
      if (dismissedRows.current.has(detail.rowId)) return
      pendingRef.current = {
        rowId: detail.rowId,
        channelName: detail.channelName || 'this creator',
        clickedAt: Date.now(),
        hiddenAt: null,
      }
    }
    function onVisibility() {
      const p = pendingRef.current
      if (!p) return
      if (document.visibilityState === 'hidden') {
        // User left the tab — stamp when so we can enforce MIN_AWAY_MS
        // on return.
        p.hiddenAt = Date.now()
        return
      }
      // Visible again. Decide whether to surface.
      if (!p.hiddenAt) return            // never left; do nothing
      const now = Date.now()
      const awayMs = now - p.hiddenAt
      const ageMs = now - p.clickedAt
      pendingRef.current = null          // consume — one prompt per click
      if (awayMs < MIN_AWAY_MS) return   // misclick / popup blocker
      if (ageMs > RETURN_WINDOW_MS) return // they forgot
      setVisible(p)
    }
    window.addEventListener('pending-response:email-click', onEmailClick)
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      window.removeEventListener('pending-response:email-click', onEmailClick)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [])

  // Auto-dismiss after 30s of inactivity so a stale prompt doesn't
  // sit forever blocking the corner.
  useEffect(() => {
    if (!visible) return
    const t = setTimeout(() => setVisible(null), 30_000)
    return () => clearTimeout(t)
  }, [visible])

  if (!visible) return null

  const dismiss = () => {
    if (visible) dismissedRows.current.add(visible.rowId)
    setVisible(null)
  }
  const confirm = () => {
    if (!visible) return
    onConfirm(visible.rowId)
    setVisible(null)
  }

  return (
    <div
      role="alertdialog"
      aria-label="Confirm outreach status update"
      className="fixed bottom-6 right-6 z-[9999] max-w-sm rounded-lg border border-yellow-500/40 bg-yellow-50 dark:bg-yellow-950/80 dark:border-yellow-500/30 shadow-lg p-4 animate-in fade-in slide-in-from-bottom-2 duration-200"
    >
      <div className="flex items-start gap-3">
        <span className="shrink-0 mt-0.5 inline-flex items-center justify-center w-6 h-6 rounded-full bg-yellow-200 dark:bg-yellow-800/60 text-yellow-800 dark:text-yellow-300">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M22 2 11 13" />
            <path d="m22 2-7 20-4-9-9-4z" />
          </svg>
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-medium text-yellow-900 dark:text-yellow-100 leading-snug">
            Did you email <span className="font-semibold">{visible.channelName}</span>?
          </p>
          <p className="text-[11.5px] text-yellow-800/80 dark:text-yellow-200/75 mt-0.5 leading-snug">
            Mark this row as <span className="font-medium">Pending Response</span> so you know to follow up.
          </p>
          <div className="mt-3 flex items-center gap-2">
            <button
              type="button"
              onClick={confirm}
              className="text-[11.5px] font-semibold px-3 py-1.5 rounded-md bg-yellow-500 text-yellow-950 hover:bg-yellow-400 transition-colors"
            >
              Yes, mark Pending
            </button>
            <button
              type="button"
              onClick={dismiss}
              className="text-[11.5px] font-medium px-3 py-1.5 rounded-md text-yellow-900/80 dark:text-yellow-200/75 hover:bg-yellow-200/60 dark:hover:bg-yellow-800/30 transition-colors"
            >
              Not now
            </button>
          </div>
        </div>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Dismiss"
          className="shrink-0 text-yellow-800/60 dark:text-yellow-300/60 hover:text-yellow-900 dark:hover:text-yellow-100 transition-colors -mr-1 -mt-1 p-1"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  )
}

/** Helper for callers — dispatch the event when the email link is clicked. */
export function emitEmailClick(detail: PendingResponseEventDetail) {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent('pending-response:email-click', { detail }))
}
