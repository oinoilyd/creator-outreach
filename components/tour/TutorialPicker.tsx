'use client'

/**
 * TutorialPicker — first-run modal that lets a new user pick which
 * tutorial tier to run (Short / Pro / Granular) or skip entirely.
 *
 * Three big cards in a row (stacked on mobile), each showing the
 * tier's label, time estimate, pitch, and step count. Click a card
 * to start that tutorial; click Skip to dismiss without running one.
 *
 * Lives outside <main> in the render tree (rendered alongside the
 * Tour itself) so its fixed-position backdrop covers the whole
 * viewport regardless of ancestor stacking contexts.
 *
 * The picker is ALSO available from the hamburger menu — same
 * component, different open trigger. Pass `mode='hamburger'` so
 * the dismiss action just closes the picker without writing a
 * 'skipped' status (which the user already implicitly opted out of
 * the first time).
 */

import { motion, AnimatePresence } from 'motion/react'
import { useTour } from './TourContext'
import {
  TIER_META,
  stepCountForTier,
  type TutorialTier,
} from '@/lib/tutorial-catalog'

interface TutorialPickerProps {
  /** Whether the picker is visible. Driven by TourContext for
   *  first-run; by local state for hamburger replay. */
  open: boolean
  /** First-run: writes 'skipped' status on dismiss. Hamburger replay:
   *  just closes. */
  mode: 'first-run' | 'replay'
  /** Whether the user is admin — surfaces in the granular pitch
   *  ("includes admin tools") and filters the step count accurately. */
  isAdmin?: boolean
  onClose: () => void
}

const ACCENT_CLASSES: Record<'emerald' | 'violet' | 'amber', {
  ring: string
  bg: string
  text: string
  dot: string
}> = {
  emerald: {
    ring: 'hover:border-emerald-500/60 hover:shadow-lg hover:shadow-emerald-500/20',
    bg: 'group-hover:bg-emerald-500/10',
    text: 'text-emerald-700 dark:text-emerald-300',
    dot: 'bg-emerald-500',
  },
  violet: {
    ring: 'hover:border-purple-500/60 hover:shadow-lg hover:shadow-purple-500/20',
    bg: 'group-hover:bg-purple-500/10',
    text: 'text-purple-700 dark:text-purple-300',
    dot: 'bg-purple-500',
  },
  amber: {
    ring: 'hover:border-amber-500/60 hover:shadow-lg hover:shadow-amber-500/20',
    bg: 'group-hover:bg-amber-500/10',
    text: 'text-amber-700 dark:text-amber-300',
    dot: 'bg-amber-500',
  },
}

export function TutorialPicker({ open, mode, isAdmin = false, onClose }: TutorialPickerProps) {
  const tour = useTour()

  function pick(tier: TutorialTier) {
    tour.start(tier)
    onClose()
  }

  function dismiss() {
    if (mode === 'first-run') {
      tour.dismissFirstRunPicker()
    }
    onClose()
  }

  const tiers: TutorialTier[] = ['short', 'pro', 'granular']

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4">
          {/* Backdrop */}
          <motion.div
            aria-hidden
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={dismiss}
          />

          {/* Modal */}
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="tutorial-picker-title"
            initial={{ opacity: 0, y: 20, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.96 }}
            transition={{ type: 'spring', bounce: 0.18, duration: 0.4 }}
            className="
              relative w-full max-w-4xl
              bg-card border border-border rounded-2xl shadow-2xl shadow-black/40
              max-h-[calc(100vh-2rem)] overflow-y-auto
            "
          >
            {/* Header */}
            <div className="px-6 pt-6 pb-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-[11px] uppercase tracking-[0.18em] font-bold text-muted-foreground mb-1">
                    {mode === 'first-run' ? 'Welcome' : 'Pick a tour'}
                  </div>
                  <h2
                    id="tutorial-picker-title"
                    className="text-[20px] sm:text-[22px] font-bold tracking-tight text-foreground"
                  >
                    {mode === 'first-run'
                      ? 'How deep do you want to go?'
                      : 'Replay a tutorial'}
                  </h2>
                  <p className="mt-1.5 text-[13px] text-muted-foreground leading-snug max-w-[60ch]">
                    {mode === 'first-run'
                      ? 'Pick the tour that fits your patience. You can always retake any of them from the hamburger menu later.'
                      : 'Each tutorial covers a different depth. The previously-completed one is highlighted.'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={dismiss}
                  aria-label="Dismiss"
                  className="text-muted-foreground hover:text-foreground p-1 -m-1 rounded transition-colors"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M18 6L6 18M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Tier cards — 1 col on mobile, 3 col on desktop */}
            <div className="px-6 pb-6 grid sm:grid-cols-3 gap-4">
              {tiers.map(tierId => {
                const meta = TIER_META[tierId]
                const stepCount = stepCountForTier(tierId, { isAdmin })
                const accent = ACCENT_CLASSES[meta.accent]
                const isLastCompleted = tour.lastCompletedTier === tierId

                return (
                  <button
                    key={tierId}
                    type="button"
                    onClick={() => pick(tierId)}
                    className={`
                      group relative text-left
                      bg-background border-2 border-border rounded-xl p-5
                      transition-all duration-200
                      ${accent.ring}
                      ${isLastCompleted ? 'border-foreground/30' : ''}
                    `}
                  >
                    {/* "Last picked" pill */}
                    {isLastCompleted && mode === 'replay' && (
                      <span className="absolute -top-2 right-3 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-card border border-border text-[9.5px] uppercase tracking-wider font-bold text-muted-foreground">
                        Last completed
                      </span>
                    )}

                    {/* Dot + label */}
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`inline-block w-2 h-2 rounded-full ${accent.dot}`} />
                      <span className={`text-[10px] uppercase tracking-[0.18em] font-bold ${accent.text}`}>
                        {meta.duration}
                      </span>
                    </div>

                    <h3 className="text-[18px] font-bold tracking-tight text-foreground mb-2">
                      {meta.label}
                    </h3>

                    <p className="text-[12.5px] text-muted-foreground leading-snug mb-4 min-h-[3.6rem]">
                      {meta.pitch}
                    </p>

                    <div className="flex items-center justify-between text-[11.5px]">
                      <span className="text-muted-foreground tabular-nums">
                        {stepCount} step{stepCount === 1 ? '' : 's'}
                      </span>
                      <span className={`font-semibold ${accent.text} inline-flex items-center gap-1`}>
                        Start
                        <span aria-hidden className="transition-transform group-hover:translate-x-0.5">→</span>
                      </span>
                    </div>

                    {/* Subtle gradient backdrop appears on hover via group-hover */}
                    <div
                      aria-hidden
                      className={`absolute inset-0 rounded-xl pointer-events-none transition-colors ${accent.bg}`}
                      style={{ zIndex: -1 }}
                    />
                  </button>
                )
              })}
            </div>

            {/* Footer */}
            <div className="px-6 pb-5 pt-2 border-t border-border flex items-center justify-between gap-3 flex-wrap text-[12px] text-muted-foreground">
              <span>You can change your mind any time — hamburger menu → Tutorials.</span>
              <button
                type="button"
                onClick={dismiss}
                className="text-muted-foreground hover:text-foreground transition-colors underline underline-offset-2"
              >
                {mode === 'first-run' ? 'Skip for now' : 'Close'}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}

/**
 * FirstRunPickerHost — auto-binds the TutorialPicker to the tour
 * context's `showFirstRunPicker` flag. Mount once at the page root
 * (next to <Tour />); it stays invisible until the context flips
 * the flag, then renders the picker.
 *
 * Pass `isAdmin` so admin-only granular steps are counted in the
 * preview step total.
 */
export function FirstRunPickerHost({ isAdmin = false }: { isAdmin?: boolean }) {
  const tour = useTour()
  return (
    <TutorialPicker
      open={tour.showFirstRunPicker}
      mode="first-run"
      isAdmin={isAdmin}
      onClose={() => { /* dismiss handled inside via tour.dismissFirstRunPicker */ }}
    />
  )
}
