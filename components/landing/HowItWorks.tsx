'use client'

import { forwardRef, useRef } from 'react'
import { Search, Sparkles, MailPlus, Clock } from 'lucide-react'
import { AnimatedBeam } from '@/components/ui/animated-beam'
import { cn } from '@/lib/utils'

/**
 * "How it works" — TWO labeled steps connected by a single animated
 * beam. Per Dylan: "the first step should be search and score, the
 * second should be add to outreach & trigger follow up. Simplify it."
 *
 * Each step is a chunky pill that holds TWO icons stacked horizontally
 * — visually communicates the combined concept ("Search & Score" =
 * search-icon + sparkles-icon together) without inflating to 3 visual
 * stages.
 */
const Pill = forwardRef<HTMLDivElement, { className?: string; children?: React.ReactNode }>(
  ({ className, children }, ref) => (
    <div
      ref={ref}
      className={cn(
        'z-10 flex h-20 items-center justify-center gap-3 rounded-2xl border px-7',
        'bg-white/[0.04] backdrop-blur-md shadow-[0_0_40px_-8px_rgba(124,58,237,0.6)]',
        'border-brand/40',
        className,
      )}
    >
      {children}
    </div>
  ),
)
Pill.displayName = 'Pill'

export function HowItWorks() {
  const containerRef = useRef<HTMLDivElement>(null)
  const stepARef = useRef<HTMLDivElement>(null)
  const stepBRef = useRef<HTMLDivElement>(null)

  return (
    <div className="max-w-4xl mx-auto">
      <div
        ref={containerRef}
        className="relative flex w-full items-center justify-between gap-4 py-12 px-4 flex-col md:flex-row"
      >
        <Step
          refEl={stepARef}
          icons={[
            <Search key="s" className="h-6 w-6 text-brand" />,
            <Sparkles key="sp" className="h-6 w-6 text-brand-2" />,
          ]}
          label="Search & Score"
          sub="Find creators across every platform. AI ranks by fit."
        />
        <Step
          refEl={stepBRef}
          icons={[
            <MailPlus key="m" className="h-6 w-6 text-brand" />,
            <Clock key="c" className="h-6 w-6 text-brand-2" />,
          ]}
          label="Outreach & Follow-up"
          sub="Add to pipeline. Auto-cadence pings the right ones."
        />

        <AnimatedBeam
          containerRef={containerRef}
          fromRef={stepARef}
          toRef={stepBRef}
          duration={5}
          curvature={-30}
          gradientStartColor="#7c3aed"
          gradientStopColor="#06b6d4"
        />
      </div>
    </div>
  )
}

function Step({
  refEl,
  icons,
  label,
  sub,
}: {
  refEl: React.RefObject<HTMLDivElement | null>
  icons: React.ReactNode[]
  label: string
  sub: string
}) {
  return (
    <div className="flex flex-col items-center gap-3 flex-1 max-w-sm">
      <Pill ref={refEl}>
        {icons.map((icon, i) => (
          <span key={i}>{icon}</span>
        ))}
      </Pill>
      <div className="text-center">
        <div className="text-base font-semibold text-foreground">{label}</div>
        <div className="text-sm text-muted-foreground mt-1">{sub}</div>
      </div>
    </div>
  )
}
