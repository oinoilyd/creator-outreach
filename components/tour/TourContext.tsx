'use client'

/**
 * TourContext — global tour state. Owns the open/closed flag, the
 * current step index, persistence, and the navigation bridge to
 * the app shell.
 *
 * Navigation bridge:
 *   Tour steps can fire onEnter({ navigate }) which needs to change
 *   the app's active tab/sub-tab. Rather than threading state setters
 *   through the tree, we dispatch a CustomEvent ('tour-navigate')
 *   that app/page.tsx already listens for. Same pattern as the
 *   existing 'goto-active-client' / 'promote-outreach-to-active'
 *   events.
 *
 * Persistence:
 *   localStorage 'creator-outreach.tour.v1.status':
 *     null/missing  → never seen, auto-open on first load
 *     'skipped'     → user dismissed; don't auto-open again
 *     'completed'   → user finished; don't auto-open again
 *   Either way, the hamburger menu item re-opens manually.
 */

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { TOUR_STEPS, type TourStep } from './tourSteps'

const LS_KEY = 'creator-outreach.tour.v1.status'

type TourStatus = 'never' | 'skipped' | 'completed'

interface TourContextValue {
  isOpen: boolean
  stepIndex: number
  step: TourStep | null
  isFirstStep: boolean
  isLastStep: boolean
  steps: TourStep[]
  start: () => void
  next: () => void
  prev: () => void
  skip: () => void
  close: () => void
}

const TourContext = createContext<TourContextValue | null>(null)

export function useTour(): TourContextValue {
  const ctx = useContext(TourContext)
  if (!ctx) {
    throw new Error('useTour must be used inside TourProvider')
  }
  return ctx
}

/** Dispatch a tour navigation request — app/page.tsx picks this up. */
function dispatchNavigate(tab: 'results' | 'outreach' | 'dismissed', sub?: 'all' | 'analytics' | 'followups' | 'active'): void {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent('tour-navigate', { detail: { tab, sub } }))
}

function readStatus(): TourStatus {
  if (typeof window === 'undefined') return 'never'
  try {
    const raw = window.localStorage.getItem(LS_KEY)
    if (raw === 'skipped' || raw === 'completed') return raw
  } catch { /* ignore */ }
  return 'never'
}

function writeStatus(status: TourStatus): void {
  if (typeof window === 'undefined') return
  try { window.localStorage.setItem(LS_KEY, status) } catch { /* ignore */ }
}

interface TourProviderProps {
  /** Whether the user is signed in. We only auto-open the tour for
   *  signed-in users (no point showing it on auth pages). */
  signedIn: boolean
  children: React.ReactNode
}

export function TourProvider({ signedIn, children }: TourProviderProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [stepIndex, setStepIndex] = useState(0)

  // Auto-open on first visit for signed-in users. Slight delay so the
  // app shell renders first and the platform/search/etc anchors are
  // mounted before the tooltip tries to find them.
  useEffect(() => {
    if (!signedIn) return
    if (readStatus() !== 'never') return
    const t = window.setTimeout(() => {
      setStepIndex(0)
      setIsOpen(true)
    }, 800)
    return () => window.clearTimeout(t)
  }, [signedIn])

  // Manual trigger via CustomEvent — same pattern as the navigation
  // bridge. Lets the hamburger menu re-open the tour without prop-
  // drilling the start function through the component tree.
  useEffect(() => {
    function onStart() {
      setStepIndex(0)
      setIsOpen(true)
    }
    window.addEventListener('tour-start', onStart)
    return () => window.removeEventListener('tour-start', onStart)
  }, [])

  // Run the current step's onEnter side-effect (e.g. switch tabs).
  // Wrapped in a separate effect so going back/forward both fire it.
  useEffect(() => {
    if (!isOpen) return
    const step = TOUR_STEPS[stepIndex]
    if (!step) return
    step.onEnter?.({ navigate: dispatchNavigate })
  }, [isOpen, stepIndex])

  // Lock body scroll while tour is open — the spotlight overlay
  // assumes the page doesn't move underneath it. Without this, a
  // mid-scroll click during animation could land on a different
  // element than the spotlight is highlighting.
  useEffect(() => {
    if (!isOpen) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [isOpen])

  const start = useCallback(() => {
    setStepIndex(0)
    setIsOpen(true)
  }, [])

  const next = useCallback(() => {
    setStepIndex(i => {
      const ni = Math.min(i + 1, TOUR_STEPS.length - 1)
      // If we're past the last step, treat next as Finish.
      if (i >= TOUR_STEPS.length - 1) {
        setIsOpen(false)
        writeStatus('completed')
      }
      return ni
    })
  }, [])

  const prev = useCallback(() => {
    setStepIndex(i => Math.max(0, i - 1))
  }, [])

  const skip = useCallback(() => {
    setIsOpen(false)
    writeStatus('skipped')
  }, [])

  const close = useCallback(() => {
    setIsOpen(false)
    // Closing isn't the same as skipping — if they got to the final
    // step, we count it as completed; otherwise it's a skip.
    writeStatus(stepIndex >= TOUR_STEPS.length - 1 ? 'completed' : 'skipped')
  }, [stepIndex])

  const value = useMemo<TourContextValue>(() => ({
    isOpen,
    stepIndex,
    step: TOUR_STEPS[stepIndex] ?? null,
    isFirstStep: stepIndex === 0,
    isLastStep: stepIndex >= TOUR_STEPS.length - 1,
    steps: TOUR_STEPS,
    start,
    next,
    prev,
    skip,
    close,
  }), [isOpen, stepIndex, start, next, prev, skip, close])

  return (
    <TourContext.Provider value={value}>
      {children}
    </TourContext.Provider>
  )
}
