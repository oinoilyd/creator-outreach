'use client'

import { forwardRef, useRef } from 'react'
import { Search, Sparkles, MailPlus } from 'lucide-react'
import { AnimatedBeam } from '@/components/ui/animated-beam'
import { cn } from '@/lib/utils'

/**
 * "How it works" — three labeled steps connected by animated beams.
 * Mirrors the actual product flow: discover → score → outreach.
 *
 * The beams (purple gradient with a flowing highlight) connect the
 * center of each circular step. Resizing the window re-projects the
 * beam paths via the AnimatedBeam component's ResizeObserver.
 */
const Circle = forwardRef<HTMLDivElement, { className?: string; children?: React.ReactNode }>(
  ({ className, children }, ref) => (
    <div
      ref={ref}
      className={cn(
        'z-10 flex h-16 w-16 items-center justify-center rounded-full border bg-white/[0.04] backdrop-blur-md shadow-[0_0_30px_-8px_rgba(124,58,237,0.6)]',
        'border-brand/40',
        className,
      )}
    >
      {children}
    </div>
  ),
)
Circle.displayName = 'Circle'

export function HowItWorks() {
  const containerRef = useRef<HTMLDivElement>(null)
  const stepARef = useRef<HTMLDivElement>(null)
  const stepBRef = useRef<HTMLDivElement>(null)
  const stepCRef = useRef<HTMLDivElement>(null)

  return (
    <div className="max-w-4xl mx-auto">
      <div
        ref={containerRef}
        className="relative flex w-full items-center justify-between gap-4 py-12 px-4"
      >
        <Step refEl={stepARef} icon={<Search className="h-7 w-7 text-brand" />} label="Search" sub="Discover creators" />
        <Step refEl={stepBRef} icon={<Sparkles className="h-7 w-7 text-brand" />} label="Score" sub="AI ranks fit" />
        <Step refEl={stepCRef} icon={<MailPlus className="h-7 w-7 text-brand" />} label="Pitch" sub="With auto follow-ups" />

        <AnimatedBeam
          containerRef={containerRef}
          fromRef={stepARef}
          toRef={stepBRef}
          duration={4}
          curvature={-30}
          gradientStartColor="#7c3aed"
          gradientStopColor="#06b6d4"
        />
        <AnimatedBeam
          containerRef={containerRef}
          fromRef={stepBRef}
          toRef={stepCRef}
          duration={4}
          delay={0.5}
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
  icon,
  label,
  sub,
}: {
  refEl: React.RefObject<HTMLDivElement | null>
  icon: React.ReactNode
  label: string
  sub: string
}) {
  return (
    <div className="flex flex-col items-center gap-2 flex-1">
      <Circle ref={refEl}>{icon}</Circle>
      <div className="text-center">
        <div className="text-sm font-semibold text-foreground">{label}</div>
        <div className="text-xs text-muted-foreground mt-0.5">{sub}</div>
      </div>
    </div>
  )
}
