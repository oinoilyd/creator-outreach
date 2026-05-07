'use client'

import { cn } from '@/lib/utils'

/**
 * Browser-chrome wrapper for screenshots. Renders a Mac-style window
 * (red/yellow/green dots + URL bar) with a soft shadow + subtle border.
 *
 * Use to wrap product screenshots so they feel like real app windows
 * instead of flat images. Pass `src` for an actual screenshot, or
 * `children` for an inline visual (SVG mock, fallback, etc.).
 */
export function ScreenshotFrame({
  src,
  alt,
  className,
  imgClassName,
  children,
}: {
  src?: string
  alt?: string
  /** Kept for backwards compat — chrome is no longer rendered. */
  url?: string
  className?: string
  imgClassName?: string
  children?: React.ReactNode
}) {
  return (
    <div
      className={cn(
        'relative rounded-xl border border-gray-200/80 bg-white overflow-hidden',
        'shadow-[0_30px_80px_-20px_rgba(76,29,149,0.18),0_10px_30px_-10px_rgba(0,0,0,0.1)]',
        'dark:border-white/10 dark:bg-gray-950',
        className,
      )}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={alt ?? 'Product screenshot'}
          className={cn('block w-full h-auto', imgClassName)}
        />
      ) : (
        children
      )}
    </div>
  )
}
