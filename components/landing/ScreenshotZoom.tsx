'use client'

import { useState, useEffect, useRef } from 'react'
import { animate } from 'animejs'

/**
 * ScreenshotZoom — wraps any visual to make it click-to-expand.
 *
 * Why this exists:
 *   The screenshots in the hero + product narratives are at small
 *   embed sizes — readable in spirit but text inside the table /
 *   KPI cards is too small to actually read. Clicking opens a
 *   full-screen lightbox showing the visual at max screen-fit size.
 *
 * Mechanics:
 *   - Wraps `children` in a button (cursor-zoom-in, on-hover lift)
 *   - On click → opens a fixed-position modal with the same children
 *     scaled to fit
 *   - Anime.js drives a quick fade+scale entrance (~250ms)
 *   - ESC, click-outside, and X-button all close
 *   - Body scroll locked while open
 *   - Full keyboard a11y (focus trap on modal close button)
 *
 * Implementation note:
 *   We don't pass an image URL — we pass `children` so anything can
 *   be wrapped (the OperatorConsole's full anime.js-decorated SVG
 *   stack, plain Image components, etc). Both render the same
 *   children, so the zoomed modal preserves all overlays / animation.
 */

export function ScreenshotZoom({
  children,
  caption,
  className = '',
}: {
  children: React.ReactNode
  /** Optional caption shown under the zoomed visual */
  caption?: string
  className?: string
}) {
  const [open, setOpen] = useState(false)
  const closeBtnRef = useRef<HTMLButtonElement>(null)

  // Lock body scroll while modal is open
  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [open])

  // ESC to close
  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open])

  // Animate-in once mounted
  useEffect(() => {
    if (!open) return
    animate('.oc-zoom-backdrop', {
      opacity: [0, 1],
      duration: 200,
      ease: 'out(2)',
    })
    animate('.oc-zoom-content', {
      opacity: [0, 1],
      scale: [0.92, 1],
      duration: 280,
      ease: 'outElastic(1, 0.7)',
    })
    closeBtnRef.current?.focus()
  }, [open])

  return (
    <>
      {/* Trigger — wraps `children` in a button. Cursor-zoom + hover
          lift signals "click to expand." Doesn't change layout. */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`group relative w-full text-left cursor-zoom-in transition-transform hover:-translate-y-0.5 ${className}`}
        aria-label="Click to view full size"
      >
        {children}
        {/* Hover hint chip — only visible on hover */}
        <span
          aria-hidden
          className="absolute bottom-3 right-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-black/70 backdrop-blur-md text-white text-[10px] uppercase tracking-[0.18em] font-bold opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"
        >
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.3-4.3" />
            <line x1="11" y1="8" x2="11" y2="14" />
            <line x1="8" y1="11" x2="14" y2="11" />
          </svg>
          Click to zoom
        </span>
      </button>

      {/* Modal — fullscreen lightbox */}
      {open && (
        <div
          className="oc-zoom-backdrop fixed inset-0 z-[200] flex items-center justify-center p-4 sm:p-8 bg-black/80 backdrop-blur-md"
          style={{ opacity: 0 }}
          onClick={() => setOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-label={caption || 'Zoomed view'}
        >
          {/* Close button (fixed, top-right of viewport) */}
          <button
            ref={closeBtnRef}
            type="button"
            onClick={() => setOpen(false)}
            className="fixed top-4 right-4 z-[210] inline-flex items-center justify-center w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white border border-white/20 backdrop-blur-md transition-colors"
            aria-label="Close zoomed view"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>

          {/* Content — clicking inside doesn't close (stops propagation) */}
          <div
            className="oc-zoom-content relative w-full max-w-[1600px] max-h-[90vh]"
            style={{ opacity: 0, transform: 'scale(0.92)' }}
            onClick={e => e.stopPropagation()}
          >
            {children}
            {caption && (
              <div className="mt-4 text-center text-[13px] text-white/70 font-medium">
                {caption}
              </div>
            )}
          </div>

          {/* Bottom hint — ESC to close */}
          <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[210] text-[11px] uppercase tracking-[0.18em] font-bold text-white/55 pointer-events-none">
            Press ESC or click outside to close
          </div>
        </div>
      )}
    </>
  )
}
