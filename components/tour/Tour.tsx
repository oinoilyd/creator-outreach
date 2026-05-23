'use client'

/**
 * Tour — the visual layer. Composes:
 *   • SVG overlay that dims the page and cuts a spotlight around the
 *     current step's target element (or a full dim for centered
 *     "modal" steps with target = null).
 *   • Floating tooltip card with title / body / step counter /
 *     Skip + Back + Next controls.
 *
 * Target resolution:
 *   Steps reference targets by CSS selector. On each step change we
 *   look up the element via querySelector. If found → spotlight +
 *   tooltip positioned next to it. If NOT found (e.g. user has no
 *   creators loaded so the +-button row doesn't exist), we gracefully
 *   degrade to a centered modal with the same content. The step still
 *   "works", just without the visual anchoring.
 *
 * Positioning:
 *   Tooltip placement honours the step's `placement` hint with
 *   fallback if it would overflow the viewport. ~30 lines of math
 *   below — way simpler than pulling in Floating UI for 4 placements.
 *
 * Accessibility:
 *   role="dialog" + aria-modal, focus trap to the controls, ESC to
 *   skip, arrow keys to navigate. Hidden below md so the experience
 *   stays desktop-first (the spotlight math doesn't translate cleanly
 *   to phone-sized targets).
 */

import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'motion/react'
import { X as XIcon, ArrowLeft, ArrowRight, GraduationCap } from 'lucide-react'
import { useTour } from './TourContext'
import type { TourPlacement } from './tourSteps'

const TOOLTIP_WIDTH = 360
const TOOLTIP_GAP = 14   // gap between tooltip and target element
const VIEWPORT_PAD = 16  // min margin from viewport edges
const SPOTLIGHT_PAD = 10 // padding around the target inside the spotlight

interface TargetRect {
  left: number
  top: number
  width: number
  height: number
}

/**
 * Resolve a step's CSS selector to a viewport rect. Polls briefly
 * to handle elements that mount async after a tab switch.
 */
function useTargetRect(selector: string | null): TargetRect | null {
  const [rect, setRect] = useState<TargetRect | null>(null)

  useLayoutEffect(() => {
    if (!selector) { setRect(null); return }
    let raf = 0
    let attempts = 0
    const MAX_ATTEMPTS = 30 // ~1s at 60fps

    function tick() {
      const el = document.querySelector(selector!) as HTMLElement | null
      if (el) {
        const r = el.getBoundingClientRect()
        // Bring offscreen targets into view before measuring.
        const off = r.top < 0 || r.top > window.innerHeight - 100
        if (off) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' })
          // Re-measure after the smooth scroll resolves.
          attempts += 1
          if (attempts < MAX_ATTEMPTS) raf = requestAnimationFrame(tick)
          return
        }
        setRect({ left: r.left, top: r.top, width: r.width, height: r.height })
        return
      }
      attempts += 1
      if (attempts < MAX_ATTEMPTS) raf = requestAnimationFrame(tick)
      else setRect(null) // target never showed; fall back to centered modal
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [selector])

  // Re-measure on resize so the spotlight stays glued to the target.
  useEffect(() => {
    if (!selector) return
    function onResize() {
      const el = document.querySelector(selector!) as HTMLElement | null
      if (!el) return
      const r = el.getBoundingClientRect()
      setRect({ left: r.left, top: r.top, width: r.width, height: r.height })
    }
    window.addEventListener('resize', onResize)
    window.addEventListener('scroll', onResize, true)
    return () => {
      window.removeEventListener('resize', onResize)
      window.removeEventListener('scroll', onResize, true)
    }
  }, [selector])

  return rect
}

/**
 * Pick tooltip position based on requested placement, fall back to
 * the side with the most room if the requested side would overflow.
 */
function positionTooltip(
  target: TargetRect,
  placement: TourPlacement,
  tooltipWidth: number,
  tooltipHeight: number,
): { left: number; top: number; placement: 'top' | 'bottom' | 'left' | 'right' } {
  const vw = window.innerWidth
  const vh = window.innerHeight

  function fitsTop(): boolean    { return target.top - TOOLTIP_GAP - tooltipHeight >= VIEWPORT_PAD }
  function fitsBottom(): boolean { return target.top + target.height + TOOLTIP_GAP + tooltipHeight <= vh - VIEWPORT_PAD }
  function fitsLeft(): boolean   { return target.left - TOOLTIP_GAP - tooltipWidth >= VIEWPORT_PAD }
  function fitsRight(): boolean  { return target.left + target.width + TOOLTIP_GAP + tooltipWidth <= vw - VIEWPORT_PAD }

  const order: Array<'top' | 'bottom' | 'left' | 'right'> =
    placement === 'top'    ? ['top', 'bottom', 'right', 'left']
    : placement === 'bottom' ? ['bottom', 'top', 'right', 'left']
    : placement === 'left'   ? ['left', 'right', 'top', 'bottom']
    : placement === 'right'  ? ['right', 'left', 'top', 'bottom']
    : ['bottom', 'top', 'right', 'left']

  const chosen = order.find(p =>
    (p === 'top' && fitsTop()) ||
    (p === 'bottom' && fitsBottom()) ||
    (p === 'left' && fitsLeft()) ||
    (p === 'right' && fitsRight()),
  ) ?? order[0]

  let left = 0, top = 0
  if (chosen === 'top') {
    left = target.left + target.width / 2 - tooltipWidth / 2
    top = target.top - TOOLTIP_GAP - tooltipHeight
  } else if (chosen === 'bottom') {
    left = target.left + target.width / 2 - tooltipWidth / 2
    top = target.top + target.height + TOOLTIP_GAP
  } else if (chosen === 'left') {
    left = target.left - TOOLTIP_GAP - tooltipWidth
    top = target.top + target.height / 2 - tooltipHeight / 2
  } else {
    left = target.left + target.width + TOOLTIP_GAP
    top = target.top + target.height / 2 - tooltipHeight / 2
  }

  // Clamp to viewport.
  left = Math.max(VIEWPORT_PAD, Math.min(left, vw - tooltipWidth - VIEWPORT_PAD))
  top = Math.max(VIEWPORT_PAD, Math.min(top, vh - tooltipHeight - VIEWPORT_PAD))

  return { left, top, placement: chosen }
}

export function Tour() {
  const tour = useTour()
  const tooltipRef = useRef<HTMLDivElement>(null)
  const [tooltipSize, setTooltipSize] = useState({ width: TOOLTIP_WIDTH, height: 180 })
  const [mounted, setMounted] = useState(false)
  const titleId = useId()

  useEffect(() => { setMounted(true) }, [])

  // Measure the tooltip after each render so positioning math has
  // an accurate height (body text wraps differently per step).
  useLayoutEffect(() => {
    if (!tooltipRef.current) return
    const r = tooltipRef.current.getBoundingClientRect()
    setTooltipSize({ width: r.width, height: r.height })
  }, [tour.stepIndex, tour.isOpen])

  // Keyboard: Esc → skip, ArrowRight/Enter → next, ArrowLeft → back.
  useEffect(() => {
    if (!tour.isOpen) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') { e.preventDefault(); tour.skip() }
      else if (e.key === 'ArrowRight' || e.key === 'Enter') { e.preventDefault(); tour.next() }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); tour.prev() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [tour.isOpen, tour.next, tour.prev, tour.skip])

  const targetSelector = tour.step?.target ?? null
  const targetRect = useTargetRect(targetSelector)

  if (!mounted || !tour.isOpen || !tour.step) return null

  // Use portal so positioning math doesn't have to compensate for
  // ancestor transforms / scroll containers.
  return createPortal(
    <TourLayer
      step={tour.step}
      stepIndex={tour.stepIndex}
      totalSteps={tour.steps.length}
      isFirstStep={tour.isFirstStep}
      isLastStep={tour.isLastStep}
      targetRect={targetRect}
      tooltipRef={tooltipRef}
      tooltipSize={tooltipSize}
      titleId={titleId}
      onNext={tour.next}
      onPrev={tour.prev}
      onSkip={tour.skip}
    />,
    document.body,
  )
}

interface TourLayerProps {
  step: NonNullable<ReturnType<typeof useTour>['step']>
  stepIndex: number
  totalSteps: number
  isFirstStep: boolean
  isLastStep: boolean
  targetRect: TargetRect | null
  tooltipRef: React.RefObject<HTMLDivElement | null>
  tooltipSize: { width: number; height: number }
  titleId: string
  onNext: () => void
  onPrev: () => void
  onSkip: () => void
}

function TourLayer({
  step, stepIndex, totalSteps, isFirstStep, isLastStep,
  targetRect, tooltipRef, tooltipSize, titleId,
  onNext, onPrev, onSkip,
}: TourLayerProps) {
  // If target selector is set but element couldn't be found → degrade
  // to centered modal so the step still works.
  const useCenteredFallback = step.target !== null && targetRect === null
  const isCentered = step.target === null || useCenteredFallback

  // Tooltip position
  let tooltipStyle: React.CSSProperties = {}
  let arrowSide: 'top' | 'bottom' | 'left' | 'right' | null = null
  if (!isCentered && targetRect) {
    const pos = positionTooltip(
      targetRect,
      step.placement ?? 'bottom',
      tooltipSize.width,
      tooltipSize.height,
    )
    tooltipStyle = { left: pos.left, top: pos.top, width: TOOLTIP_WIDTH }
    arrowSide = pos.placement === 'top' ? 'bottom'
              : pos.placement === 'bottom' ? 'top'
              : pos.placement === 'left' ? 'right' : 'left'
  } else {
    // Centered: position with CSS transform via class instead of inline.
    tooltipStyle = { width: TOOLTIP_WIDTH }
  }

  return (
    <AnimatePresence>
      <motion.div
        key="tour-layer"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.25 }}
        className="fixed inset-0 z-[100] hidden md:block"
      >
        {/* SVG overlay with cutout mask. Click on dim → skip. */}
        <svg
          width="100%"
          height="100%"
          className="absolute inset-0 cursor-pointer"
          onClick={onSkip}
          aria-hidden
        >
          <defs>
            <mask id={`tour-mask-${stepIndex}`}>
              <rect x="0" y="0" width="100%" height="100%" fill="white" />
              {!isCentered && targetRect && (
                <rect
                  x={targetRect.left - SPOTLIGHT_PAD}
                  y={targetRect.top - SPOTLIGHT_PAD}
                  width={targetRect.width + SPOTLIGHT_PAD * 2}
                  height={targetRect.height + SPOTLIGHT_PAD * 2}
                  rx={10}
                  fill="black"
                />
              )}
            </mask>
          </defs>
          <rect
            x="0"
            y="0"
            width="100%"
            height="100%"
            fill="rgba(0, 0, 0, 0.62)"
            mask={`url(#tour-mask-${stepIndex})`}
          />
          {/* Spotlight border — purple glow around the cutout */}
          {!isCentered && targetRect && (
            <motion.rect
              key={`spotlight-border-${stepIndex}`}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.25 }}
              x={targetRect.left - SPOTLIGHT_PAD}
              y={targetRect.top - SPOTLIGHT_PAD}
              width={targetRect.width + SPOTLIGHT_PAD * 2}
              height={targetRect.height + SPOTLIGHT_PAD * 2}
              rx={10}
              fill="none"
              stroke="rgb(168, 85, 247)"
              strokeWidth={2}
              style={{ filter: 'drop-shadow(0 0 12px rgba(168, 85, 247, 0.55))' }}
            />
          )}
        </svg>

        {/* Tooltip card */}
        <motion.div
          key={`tooltip-${stepIndex}`}
          ref={tooltipRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          initial={{ opacity: 0, y: 8, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 8, scale: 0.97 }}
          transition={{ type: 'spring', bounce: 0.18, duration: 0.35 }}
          onClick={e => e.stopPropagation()}
          className={[
            'absolute bg-card border border-border rounded-2xl shadow-2xl shadow-black/40 overflow-hidden',
            isCentered ? 'left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2' : '',
          ].join(' ')}
          style={tooltipStyle}
        >
          {/* Header strip with subtle gradient. Carries the step
              counter + skip affordance — minimal chrome, clear exit. */}
          <div className="relative bg-gradient-to-r from-purple-500/12 via-blue-500/8 to-card/40 px-5 pt-3.5 pb-3 flex items-start gap-3 border-b border-border/60">
            <div className="shrink-0 w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center text-white shadow-sm shadow-purple-500/30">
              <GraduationCap className="w-4 h-4" aria-hidden />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[10.5px] uppercase tracking-wider font-semibold text-muted-foreground">
                Step {stepIndex + 1} of {totalSteps}
              </div>
              <h2 id={titleId} className="text-[15px] font-semibold text-foreground tracking-tight leading-tight mt-0.5">
                {step.title}
              </h2>
            </div>
            <button
              type="button"
              onClick={onSkip}
              aria-label="Skip tour"
              className="shrink-0 text-muted-foreground hover:text-foreground w-7 h-7 inline-flex items-center justify-center rounded hover:bg-muted/40 transition-colors"
              title="Skip tour"
            >
              <XIcon className="w-4 h-4" />
            </button>
          </div>

          {/* Body */}
          <div className="px-5 py-4">
            <p className="text-[13.5px] leading-relaxed text-foreground/90">
              {step.body}
            </p>
            {useCenteredFallback && (
              <p className="mt-2.5 text-[11.5px] text-muted-foreground/75 italic">
                (Open the relevant view to see this in action — it's not visible from where you are right now.)
              </p>
            )}
          </div>

          {/* Footer: Back / progress dots / Next */}
          <div className="px-5 py-3 bg-muted/30 border-t border-border/60 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={onPrev}
              disabled={isFirstStep}
              className={[
                'inline-flex items-center gap-1 text-[12px] font-medium px-2.5 py-1.5 rounded-md transition-colors',
                isFirstStep
                  ? 'text-muted-foreground/40 cursor-not-allowed'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/60',
              ].join(' ')}
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Back
            </button>

            <div className="flex items-center gap-1" aria-hidden>
              {Array.from({ length: totalSteps }).map((_, i) => (
                <span
                  key={i}
                  className={[
                    'rounded-full transition-all',
                    i === stepIndex
                      ? 'w-4 h-1.5 bg-purple-500'
                      : i < stepIndex
                        ? 'w-1.5 h-1.5 bg-purple-500/40'
                        : 'w-1.5 h-1.5 bg-muted-foreground/25',
                  ].join(' ')}
                />
              ))}
            </div>

            <button
              type="button"
              onClick={onNext}
              autoFocus
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-purple-500 hover:bg-purple-600 text-white text-[12.5px] font-semibold shadow-sm shadow-purple-500/30 transition-colors"
            >
              {step.nextLabel ?? (isLastStep ? 'Finish' : 'Next')}
              {!isLastStep && <ArrowRight className="w-3.5 h-3.5" />}
            </button>
          </div>

          {/* Pointer arrow for non-centered tooltips */}
          {arrowSide && (
            <div
              aria-hidden
              className={[
                'absolute w-3 h-3 bg-card border-border rotate-45',
                arrowSide === 'top'    ? '-top-1.5 left-1/2 -translate-x-1/2 border-t border-l' : '',
                arrowSide === 'bottom' ? '-bottom-1.5 left-1/2 -translate-x-1/2 border-b border-r' : '',
                arrowSide === 'left'   ? 'top-1/2 -left-1.5 -translate-y-1/2 border-l border-b' : '',
                arrowSide === 'right'  ? 'top-1/2 -right-1.5 -translate-y-1/2 border-r border-t' : '',
              ].join(' ')}
            />
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
