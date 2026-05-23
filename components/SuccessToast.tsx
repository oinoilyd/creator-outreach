'use client'

import { useEffect, useState } from 'react'

/**
 * SuccessToast — small, subtle pill that appears bottom-right of the
 * viewport when an outreach row flips to "Successful." Tells the user
 * the engagement was auto-created and offers a one-click jump to its
 * Active Client card.
 *
 * Design intent (2026-05-23 per Dylan: "when changed to successful
 * there should be a subtle like click here to go to active client"):
 *
 *   The confetti celebrates the action; this toast quietly answers
 *   "what happened next + where do I go." Two layered signals at the
 *   same moment, neither competing with the other.
 *
 *   Slim chip, soft entrance (fade + slight slide up), 6-second
 *   auto-dismiss, click anywhere on the chip to navigate, separate
 *   × button for explicit dismiss. Lives at z-index 99998 — just
 *   under the confetti z-index (99999) so confetti pieces pass over
 *   the chip rather than under it.
 *
 *   Navigation: dispatches the same `goto-active-client` CustomEvent
 *   the LeadDetailModal's "Add to Active Clients" CTA uses, so the
 *   page's existing handler routes the user to Outreach → Active
 *   Clients and preselects the engagement card.
 */
interface SuccessToastProps {
  entryId: string
  /** Display label for the toast — channel name / creator title. */
  channelName: string
  /** Called when the toast finishes (auto or manual dismiss). Parent
   *  should clear its state so the toast unmounts cleanly. */
  onDismiss: () => void
}

export function SuccessToast({ entryId, channelName, onDismiss }: SuccessToastProps) {
  const [visible, setVisible] = useState(false)

  // Mount → fade in next tick (lets the initial-state styles render
  // first so the transition has a "from" to animate from).
  useEffect(() => {
    const raf = requestAnimationFrame(() => setVisible(true))
    return () => cancelAnimationFrame(raf)
  }, [])

  // Auto-dismiss after 6s. Slightly longer than a typical toast
  // because the user might still be watching confetti when this
  // first appears and we want them to actually catch the CTA.
  useEffect(() => {
    const t = setTimeout(() => handleDismiss(), 6000)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function handleDismiss() {
    setVisible(false)
    // Wait for the exit transition (200ms) before unmounting so the
    // chip doesn't pop. Matches the duration on the className below.
    setTimeout(onDismiss, 220)
  }

  function handleNavigate(ev: React.MouseEvent) {
    ev.stopPropagation()
    window.dispatchEvent(
      new CustomEvent('goto-active-client', { detail: { entryId } }),
    )
    handleDismiss()
  }

  // Long channel names get truncated so the chip stays slim. The
  // emoji + arrow stay visible; the name in the middle ellipses.
  const displayName = channelName || 'Engagement'

  return (
    <div
      role="status"
      aria-live="polite"
      className={`fixed bottom-6 right-6 z-[99998] transition-all duration-200 ${
        visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2 pointer-events-none'
      }`}
    >
      <div
        className="
          inline-flex items-center gap-2.5 px-4 py-2.5 rounded-full
          bg-card border border-border shadow-lg shadow-foreground/10
          backdrop-blur-sm
          max-w-[min(420px,calc(100vw-3rem))]
        "
      >
        {/* Click-the-pill region: navigates to the new Active Client */}
        <button
          type="button"
          onClick={handleNavigate}
          className="
            inline-flex items-center gap-2 text-left
            text-[13px] text-foreground hover:text-brand
            transition-colors min-w-0
          "
        >
          {/* Brand-gradient celebration dot — matches the "C" tile
              and the brand CTAs across the marketing site. Reads as
              "this is the brand moment" without an emoji. */}
          <span
            aria-hidden
            className="
              inline-flex items-center justify-center
              w-5 h-5 rounded-full
              bg-gradient-to-br from-brand to-brand-2 text-primary-foreground
              text-[10px] font-bold shrink-0
              shadow-sm shadow-brand/30
            "
          >
            ✓
          </span>

          <span className="min-w-0 truncate">
            <span className="font-medium">{displayName}</span>
            <span className="text-muted-foreground"> — Active Client</span>
          </span>

          {/* Subtle CTA arrow. Becomes more visible on hover via the
              text-brand transition above. */}
          <span
            aria-hidden
            className="text-muted-foreground shrink-0 transition-transform group-hover:translate-x-0.5"
          >
            →
          </span>
        </button>

        {/* Explicit dismiss — small, low-contrast so it doesn't
            compete with the primary action. */}
        <button
          type="button"
          onClick={handleDismiss}
          aria-label="Dismiss notification"
          className="
            ml-1 inline-flex items-center justify-center
            w-5 h-5 rounded-full
            text-muted-foreground/60 hover:text-foreground hover:bg-muted
            transition-colors shrink-0
          "
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="10"
            height="10"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  )
}
