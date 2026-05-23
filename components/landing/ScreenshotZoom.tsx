'use client'

import { useState, useEffect, useRef } from 'react'

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
 *   - Wraps `children` in a div[role="button"] (cursor-zoom-in,
 *     hover lift). Why div not button: the children include block
 *     elements (OperatorConsole's <div> root) which is invalid
 *     inside <button> and breaks click handling in some browsers.
 *   - On click → opens a fixed-position modal with the same children
 *     scaled to fit
 *   - CSS transition drives the fade+scale entrance (~250ms). Earlier
 *     anime.js version had a race where the modal could render and
 *     stay at opacity 0 if the selector match missed — CSS transitions
 *     bind to the element directly so no race.
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
  // `entered` flips one frame after mount → triggers CSS transition
  // without depending on a JS animation library.
  const [entered, setEntered] = useState(false)
  const closeBtnRef = useRef<HTMLButtonElement>(null)

  // Lock body scroll while modal is open
  useEffect(() => {
    if (!open) {
      setEntered(false)
      return
    }
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    // Flip `entered` on the next frame so the CSS transition fires
    // (initial render → opacity 0 → next frame → opacity 1).
    const raf = requestAnimationFrame(() => setEntered(true))
    closeBtnRef.current?.focus()

    return () => {
      cancelAnimationFrame(raf)
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

  return (
    <>
      {/* Trigger — div[role=button] (NOT <button>) because children
          include block elements which are invalid inside <button>
          and break click handling in some browsers. */}
      <div
        role="button"
        tabIndex={0}
        onClick={() => setOpen(true)}
        onKeyDown={e => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            setOpen(true)
          }
        }}
        className={`group relative w-full cursor-zoom-in transition-transform hover:-translate-y-0.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 rounded-2xl ${className}`}
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
      </div>

      {/* Modal — fullscreen lightbox.
          Visibility is driven by `entered` flag + CSS transitions so
          there's no anime.js race condition. Initial render is
          opacity-0 / scale-95; one frame later `entered` flips and
          the transition fires. */}
      {open && (
        <div
          className={`fixed inset-0 z-[200] flex items-center justify-center p-4 sm:p-8 bg-black/80 backdrop-blur-md transition-opacity duration-200 ease-out ${entered ? 'opacity-100' : 'opacity-0'}`}
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
            className={`relative w-full max-w-[1600px] max-h-[90vh] transition-all duration-300 ease-out ${entered ? 'opacity-100 scale-100' : 'opacity-0 scale-95'}`}
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
