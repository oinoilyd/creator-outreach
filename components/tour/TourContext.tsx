'use client'

/**
 * TourContext — global tour state. Owns the open/closed flag, the
 * current step index, the active tier, persistence, and the
 * navigation bridge to the app shell.
 *
 * Three-tier system (Dylan 2026-05-24):
 *   - First-run flow: app/page.tsx surfaces the TutorialPicker before
 *     auto-starting the tour. The picker calls start(tier).
 *   - Hamburger sub-menu: emits 'tour-start' CustomEvent with detail
 *     `{ tier }`. We honor whichever tier the user picked, default
 *     to 'short' if missing.
 *
 * Navigation bridge:
 *   Tour steps can fire onEnter({ navigate }) which needs to change
 *   the app's active tab/sub-tab. Rather than threading state setters
 *   through the tree, we dispatch a CustomEvent ('tour-navigate')
 *   that app/page.tsx already listens for.
 *
 * Persistence:
 *   localStorage 'creator-outreach.tour.v2.status':
 *     null/missing     → never seen, show first-run picker
 *     'skipped'        → user dismissed; don't auto-show picker
 *     'completed:tier' → user finished a specific tier; remember it
 *                        so the hamburger replay default is sensible
 *   Hamburger menu always lets the user replay any tier.
 *
 * The v1 → v2 storage key bump is intentional: users who already
 * completed the old single-tier tour get re-prompted with the new
 * picker once. After that, their tier choice sticks.
 */

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import type { TourStep } from './tourSteps'
import { stepsForTier } from './tourSteps'
import type { TutorialTier } from '@/lib/tutorial-catalog'

const LS_KEY = 'creator-outreach.tour.v2.status'

type TourStatus =
  | 'never'
  | 'skipped'
  | { kind: 'completed'; tier: TutorialTier }

interface TourContextValue {
  isOpen: boolean
  /** Whether the first-run picker should be visible. False once the
   *  user has picked a tier OR explicitly skipped. */
  showFirstRunPicker: boolean
  stepIndex: number
  step: TourStep | null
  isFirstStep: boolean
  isLastStep: boolean
  steps: TourStep[]
  /** Currently-active tier — drives which step array is in use. */
  tier: TutorialTier
  /** Start a tour for a specific tier. Pass from the picker or
   *  hamburger sub-menu. */
  start: (tier?: TutorialTier) => void
  next: () => void
  prev: () => void
  skip: () => void
  close: () => void
  /** Dismiss the first-run picker without starting a tour. */
  dismissFirstRunPicker: () => void
  /** The tier the user most recently completed, if any. Used by the
   *  hamburger sub-menu to highlight "your last pick" visually. */
  lastCompletedTier: TutorialTier | null
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
function dispatchNavigate(
  tab: 'results' | 'outreach' | 'dismissed',
  sub?: 'all' | 'analytics' | 'followups' | 'active',
): void {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent('tour-navigate', { detail: { tab, sub } }))
}

/**
 * Build the TourHelpers object for the active tour step. Each helper
 * dispatches a CustomEvent the relevant state-owner listens for:
 *   - tour-navigate           — app/page.tsx (tab switching)
 *   - tour-interact           — app/page.tsx + HamburgerMenu
 *                               (modal/panel opens, hamburger expand)
 * Granular tour steps use these to actually OPEN modals/panels so
 * the spotlight has real UI to anchor on, not just a tooltip
 * describing where to click.
 */
function buildTourHelpers(): import('@/lib/tutorial-catalog').TourHelpers {
  function emit(kind: string, payload?: Record<string, unknown>) {
    if (typeof window === 'undefined') return
    window.dispatchEvent(new CustomEvent('tour-interact', { detail: { kind, ...payload } }))
  }
  return {
    navigate: dispatchNavigate,
    openFilterPanel:      () => emit('open-filter-panel'),
    closeFilterPanel:     () => emit('close-filter-panel'),
    openLeadCriteria:     () => emit('open-lead-criteria'),
    closeLeadCriteria:    () => emit('close-lead-criteria'),
    openTemplates:        () => emit('open-templates'),
    closeTemplates:       () => emit('close-templates'),
    openHamburger:        (options) => emit('open-hamburger', { options: options ?? {} }),
    closeHamburger:       () => emit('close-hamburger'),
    openCustomizeColumns: () => emit('open-customize-columns'),
    closeCustomizeColumns:() => emit('close-customize-columns'),
  }
}

function readStatus(): TourStatus {
  if (typeof window === 'undefined') return 'never'
  try {
    const raw = window.localStorage.getItem(LS_KEY)
    if (!raw) return 'never'
    if (raw === 'skipped') return 'skipped'
    // 'completed:short' / 'completed:pro' / 'completed:granular'
    if (raw.startsWith('completed:')) {
      const tier = raw.slice('completed:'.length) as TutorialTier
      if (tier === 'short' || tier === 'pro' || tier === 'granular') {
        return { kind: 'completed', tier }
      }
    }
    // Legacy 'completed' from the v1 single-tier tour. Treat as
    // never-seen so the user gets the new picker.
  } catch { /* ignore */ }
  return 'never'
}

function writeStatus(status: TourStatus): void {
  if (typeof window === 'undefined') return
  try {
    if (status === 'never') {
      window.localStorage.removeItem(LS_KEY)
    } else if (status === 'skipped') {
      window.localStorage.setItem(LS_KEY, 'skipped')
    } else {
      window.localStorage.setItem(LS_KEY, `completed:${status.tier}`)
    }
  } catch { /* ignore */ }
}

interface TourProviderProps {
  /** Whether the user is signed in. We only auto-open the picker for
   *  signed-in users (no point showing it on auth pages). */
  signedIn: boolean
  /** Whether the user is an admin. Filters admin-only steps. */
  isAdmin?: boolean
  children: React.ReactNode
}

export function TourProvider({ signedIn, isAdmin = false, children }: TourProviderProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [stepIndex, setStepIndex] = useState(0)
  const [tier, setTier] = useState<TutorialTier>('short')
  const [showFirstRunPicker, setShowFirstRunPicker] = useState(false)
  const [lastCompletedTier, setLastCompletedTier] = useState<TutorialTier | null>(null)

  // Compute the active step list each render based on the active
  // tier + admin status. Memoized so identity is stable when neither
  // input changed.
  const steps = useMemo(() => stepsForTier(tier, { isAdmin }), [tier, isAdmin])

  // Auto-show the first-run picker on first visit for signed-in users.
  // Slight delay so the app shell renders first (the picker is
  // centered modal — doesn't need anchors — but a smoother first-paint
  // experience).
  useEffect(() => {
    if (!signedIn) return
    const status = readStatus()
    if (status !== 'never') {
      // Remember the user's last tier choice so hamburger highlights it.
      if (typeof status === 'object' && status.kind === 'completed') {
        setLastCompletedTier(status.tier)
      }
      return
    }
    const t = window.setTimeout(() => setShowFirstRunPicker(true), 800)
    return () => window.clearTimeout(t)
  }, [signedIn])

  // Manual trigger via CustomEvent — same pattern as the navigation
  // bridge. Hamburger sub-menu emits this with the user's chosen tier.
  useEffect(() => {
    function onStart(ev: Event) {
      const detail = (ev as CustomEvent<{ tier?: TutorialTier }>).detail
      const requested = detail?.tier
      const next: TutorialTier =
        requested === 'short' || requested === 'pro' || requested === 'granular'
          ? requested
          : (lastCompletedTier ?? 'short')
      setTier(next)
      setStepIndex(0)
      setShowFirstRunPicker(false)
      setIsOpen(true)
    }
    window.addEventListener('tour-start', onStart as EventListener)
    return () => window.removeEventListener('tour-start', onStart as EventListener)
  }, [lastCompletedTier])

  // Track the previous step so we can fire onExit when stepping
  // forward/backward. The PREVIOUS step's onExit fires BEFORE the
  // current step's onEnter, so any modals/panels the prior step
  // opened get a chance to close before the new spotlight tries to
  // anchor on something else.
  const prevStepRef = useRef<{ stepIndex: number; tier: TutorialTier } | null>(null)

  useEffect(() => {
    if (!isOpen) {
      // Tour just closed — fire onExit for the last step so we
      // don't leave a modal open behind us.
      if (prevStepRef.current) {
        const lastSteps = stepsForTier(prevStepRef.current.tier, { isAdmin })
        const last = lastSteps[prevStepRef.current.stepIndex]
        last?.onExit?.(buildTourHelpers())
        prevStepRef.current = null
      }
      return
    }
    const helpers = buildTourHelpers()
    // Fire the previous step's onExit before the new step's onEnter.
    // Skips on initial open (prevStepRef.current === null) since
    // there's nothing to exit from.
    if (prevStepRef.current && (
      prevStepRef.current.stepIndex !== stepIndex ||
      prevStepRef.current.tier !== tier
    )) {
      const prevTierSteps = stepsForTier(prevStepRef.current.tier, { isAdmin })
      const prev = prevTierSteps[prevStepRef.current.stepIndex]
      prev?.onExit?.(helpers)
    }
    const step = steps[stepIndex]
    if (!step) return
    step.onEnter?.(helpers)
    prevStepRef.current = { stepIndex, tier }
  }, [isOpen, stepIndex, steps, tier, isAdmin])

  // Lock body scroll while tour or picker is open — the spotlight
  // overlay assumes the page doesn't move underneath it.
  useEffect(() => {
    if (!isOpen && !showFirstRunPicker) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [isOpen, showFirstRunPicker])

  const start = useCallback((startTier?: TutorialTier) => {
    setTier(startTier ?? 'short')
    setStepIndex(0)
    setShowFirstRunPicker(false)
    setIsOpen(true)
  }, [])

  const next = useCallback(() => {
    setStepIndex(i => {
      const lastIdx = steps.length - 1
      if (i >= lastIdx) {
        // Past the last step — finish.
        setIsOpen(false)
        writeStatus({ kind: 'completed', tier })
        setLastCompletedTier(tier)
        return i
      }
      return Math.min(i + 1, lastIdx)
    })
  }, [steps, tier])

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
    // step, count it as completed; otherwise as a skip.
    if (stepIndex >= steps.length - 1) {
      writeStatus({ kind: 'completed', tier })
      setLastCompletedTier(tier)
    } else {
      writeStatus('skipped')
    }
  }, [stepIndex, steps, tier])

  const dismissFirstRunPicker = useCallback(() => {
    setShowFirstRunPicker(false)
    writeStatus('skipped')
  }, [])

  const value = useMemo<TourContextValue>(() => ({
    isOpen,
    showFirstRunPicker,
    stepIndex,
    step: steps[stepIndex] ?? null,
    isFirstStep: stepIndex === 0,
    isLastStep: stepIndex >= steps.length - 1,
    steps,
    tier,
    start,
    next,
    prev,
    skip,
    close,
    dismissFirstRunPicker,
    lastCompletedTier,
  }), [
    isOpen, showFirstRunPicker, stepIndex, steps, tier, start, next, prev,
    skip, close, dismissFirstRunPicker, lastCompletedTier,
  ])

  return (
    <TourContext.Provider value={value}>
      {children}
    </TourContext.Provider>
  )
}
