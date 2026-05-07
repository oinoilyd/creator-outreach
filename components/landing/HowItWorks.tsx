'use client'

import { forwardRef, useRef } from 'react'
import { Search, Sparkles, MailPlus, BarChart3 } from 'lucide-react'
import { AnimatedBeam } from '@/components/ui/animated-beam'
import { cn } from '@/lib/utils'

/**
 * "How it works" — FOUR labeled steps connected by three animated
 * beams. Per Dylan: "this should be four steps... change [from] two
 * steps to a 4 step methodology."
 *
 * Reference: ui-ux-pro-max landing.csv pattern #5 "Funnel (3-Step
 * Conversion)" extends naturally to 4. Step number badges + beam
 * connectors satisfy the SKILL.md "multi-step-progress" rule
 * (visual progression / step indicators).
 *
 * Pills: glass on dark, solid card on light. Step number lives in
 * a small badge top-right of each pill so the order reads
 * unambiguously.
 */
const Pill = forwardRef<HTMLDivElement, { className?: string; children?: React.ReactNode; n: number }>(
  ({ className, children, n }, ref) => (
    <div className="relative">
      {/* Step number badge */}
      <span
        aria-hidden
        className="absolute -top-2 -right-2 z-20 w-6 h-6 rounded-full bg-brand text-primary-foreground text-[11px] font-bold flex items-center justify-center shadow-[0_4px_12px_-2px_rgba(124,58,237,0.5)]"
      >
        {n}
      </span>
      <div
        ref={ref}
        className={cn(
          'z-10 flex h-16 w-16 items-center justify-center rounded-2xl border',
          'bg-card border-brand/40 shadow-[0_0_30px_-8px_rgba(124,58,237,0.4)]',
          'dark:bg-white/[0.04] dark:backdrop-blur-md dark:shadow-[0_0_30px_-8px_rgba(124,58,237,0.6)]',
          className,
        )}
      >
        {children}
      </div>
    </div>
  ),
)
Pill.displayName = 'Pill'

export function HowItWorks() {
  const containerRef = useRef<HTMLDivElement>(null)
  const ref1 = useRef<HTMLDivElement>(null)
  const ref2 = useRef<HTMLDivElement>(null)
  const ref3 = useRef<HTMLDivElement>(null)
  const ref4 = useRef<HTMLDivElement>(null)

  return (
    <div className="max-w-5xl mx-auto">
      <div
        ref={containerRef}
        className="relative grid grid-cols-1 md:grid-cols-4 gap-8 md:gap-4 py-10 px-4"
      >
        <Step
          n={1}
          refEl={ref1}
          icon={<Search className="h-6 w-6 text-brand" />}
          label="Search"
          sub="Find creators across YouTube, Instagram, TikTok, X, and LinkedIn."
        />
        <Step
          n={2}
          refEl={ref2}
          icon={<Sparkles className="h-6 w-6 text-brand" />}
          label="Score"
          sub="AI ranks every result against the criteria you describe in plain English."
        />
        <Step
          n={3}
          refEl={ref3}
          icon={<MailPlus className="h-6 w-6 text-brand" />}
          label="Outreach"
          sub="One click loads the templated message — Instagram DM, LinkedIn note, or email. Personalize templated message, review and send."
        />
        <Step
          n={4}
          refEl={ref4}
          icon={<BarChart3 className="h-6 w-6 text-brand" />}
          label="Track"
          sub="Auto-cadence pings until they reply or you mark closed. Analytics on win rate, response, pipeline."
        />

        <AnimatedBeam
          containerRef={containerRef}
          fromRef={ref1}
          toRef={ref2}
          duration={5}
          curvature={-25}
          gradientStartColor="#7c3aed"
          gradientStopColor="#06b6d4"
        />
        <AnimatedBeam
          containerRef={containerRef}
          fromRef={ref2}
          toRef={ref3}
          duration={5}
          delay={0.4}
          curvature={-25}
          gradientStartColor="#7c3aed"
          gradientStopColor="#06b6d4"
        />
        <AnimatedBeam
          containerRef={containerRef}
          fromRef={ref3}
          toRef={ref4}
          duration={5}
          delay={0.8}
          curvature={-25}
          gradientStartColor="#7c3aed"
          gradientStopColor="#06b6d4"
        />
      </div>
    </div>
  )
}

function Step({
  n,
  refEl,
  icon,
  label,
  sub,
}: {
  n: number
  refEl: React.RefObject<HTMLDivElement | null>
  icon: React.ReactNode
  label: string
  sub: string
}) {
  return (
    <div className="flex flex-col items-center gap-3 text-center">
      <Pill ref={refEl} n={n}>
        {icon}
      </Pill>
      <div>
        <div className="text-base font-semibold text-foreground">{label}</div>
        <div className="text-sm text-muted-foreground mt-1 max-w-[200px]">{sub}</div>
      </div>
    </div>
  )
}
