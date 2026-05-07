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
  url = 'creatoroutreach.net',
  className,
  imgClassName,
  children,
}: {
  src?: string
  alt?: string
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
      {/* Title bar */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-200/70 bg-gray-50/80 dark:border-white/10 dark:bg-gray-900/60">
        <div className="flex gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-red-400/80" />
          <span className="w-2.5 h-2.5 rounded-full bg-yellow-400/80" />
          <span className="w-2.5 h-2.5 rounded-full bg-green-400/80" />
        </div>
        <div className="flex-1 flex justify-center">
          <div className="px-3 py-0.5 rounded-md bg-white border border-gray-200 text-[11px] text-gray-500 font-mono dark:bg-gray-800 dark:border-white/5 dark:text-gray-400">
            {url}
          </div>
        </div>
        <div className="w-12" />
      </div>

      {/* Body */}
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
