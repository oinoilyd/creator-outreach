'use client'

import { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { ArrowRight } from 'lucide-react'

/**
 * Magic UI BentoGrid — modern bento layout with a "background" slot
 * (the visual that fills the card body) and a "header" slot (title +
 * description that appear at the bottom on hover).
 *
 * Replaces the old hand-rolled BentoGrid. Cards lift on hover, the
 * header animates up, and there's a CTA chevron tucked at the bottom.
 */
export function BentoGrid({
  className,
  children,
}: {
  className?: string
  children: ReactNode
}) {
  return (
    <div className={cn('grid w-full auto-rows-[22rem] grid-cols-3 gap-4', className)}>
      {children}
    </div>
  )
}

export function BentoCard({
  name,
  className,
  background,
  Icon,
  description,
  href,
  cta,
}: {
  name: string
  className?: string
  background?: ReactNode
  Icon?: React.ComponentType<{ className?: string }>
  description: string
  href?: string
  cta?: string
}) {
  return (
    <div
      className={cn(
        'group relative col-span-3 flex flex-col justify-between overflow-hidden rounded-xl',
        // light styles
        'bg-white border border-gray-200',
        'shadow-[0_0_0_1px_rgba(0,0,0,0.03),0_2px_4px_rgba(0,0,0,0.05),0_12px_24px_rgba(0,0,0,0.05)]',
        // dark fallback (rare on landing now but kept for safety)
        'dark:bg-gray-900 dark:border-white/10',
        className,
      )}
    >
      {/* Background visual sits absolutely so the gradient/screenshot fills the card */}
      <div className="absolute inset-0">{background}</div>

      {/* Soft fade so the title/description has a readable backdrop */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-2/5 bg-gradient-to-t from-white via-white/85 to-transparent dark:from-gray-900 dark:via-gray-900/85" />

      <div
        className={cn(
          'pointer-events-none z-10 flex transform-gpu flex-col gap-1 p-6 transition-all duration-300',
          'group-hover:-translate-y-10',
        )}
      >
        {Icon && (
          <Icon className="h-10 w-10 origin-left transform-gpu text-purple-600 transition-all duration-300 ease-in-out group-hover:scale-75 dark:text-purple-300" />
        )}
        <h3 className="text-xl font-semibold text-gray-900 dark:text-white mt-auto">{name}</h3>
        <p className="max-w-lg text-sm text-gray-600 dark:text-gray-400">{description}</p>
      </div>

      {cta && href && (
        <div
          className={cn(
            'pointer-events-none absolute bottom-0 z-10 flex w-full translate-y-10 transform-gpu flex-row items-center p-4 opacity-0 transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100',
          )}
        >
          <a
            href={href}
            className="pointer-events-auto inline-flex items-center gap-1 rounded-md text-sm font-medium text-purple-700 hover:underline dark:text-purple-300"
          >
            {cta}
            <ArrowRight className="ml-1 h-4 w-4" />
          </a>
        </div>
      )}

      {/* Hover overlay: subtle violet wash */}
      <div className="pointer-events-none absolute inset-0 transform-gpu transition-all duration-300 group-hover:bg-purple-500/[0.03] dark:group-hover:bg-white/[0.02]" />
    </div>
  )
}
