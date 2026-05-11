'use client'

import { useEffect } from 'react'

/**
 * Right-click / two-finger-click context menu rendered when the user
 * triggers contextmenu on a column header in either table. Tiny
 * popover positioned at the click coordinates with two actions:
 *
 *   - Hide column     → flips visible=false on the matching colConfig
 *                       entry. Disabled for "favorite" (locked col).
 *   - Customize…      → opens the table's full customize modal so the
 *                       user can re-show / reorder later.
 *
 * Click anywhere outside or hit Escape to dismiss.
 */
export function ColumnContextMenu({
  x,
  y,
  label,
  canHide,
  canMoveLeft,
  canMoveRight,
  onHide,
  onMoveLeft,
  onMoveRight,
  onCustomize,
  onClose,
}: {
  x: number
  y: number
  label: string
  canHide: boolean
  canMoveLeft: boolean
  canMoveRight: boolean
  onHide: () => void
  onMoveLeft: () => void
  onMoveRight: () => void
  onCustomize: () => void
  onClose: () => void
}) {
  useEffect(() => {
    const onMouseDown = () => onClose()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    // Defer the listener registration by one tick so the same click
    // event that opened the menu doesn't immediately dismiss it.
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', onMouseDown)
      document.addEventListener('keydown', onKey)
    }, 0)
    return () => {
      clearTimeout(timer)
      document.removeEventListener('mousedown', onMouseDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [onClose])

  // Clamp the menu inside the viewport — prevents the popover
  // overflowing off the right edge when the user right-clicks the
  // last column.
  const MENU_WIDTH = 220
  // Height bumped to fit the new "Move left / Move right" rows. The
  // viewport-clamp below uses this to keep the menu fully on-screen
  // when the header is near the bottom edge.
  const MENU_HEIGHT = 180
  const viewportW = typeof window !== 'undefined' ? window.innerWidth : 1024
  const viewportH = typeof window !== 'undefined' ? window.innerHeight : 768
  const left = Math.min(x, viewportW - MENU_WIDTH - 8)
  const top = Math.min(y, viewportH - MENU_HEIGHT - 8)

  return (
    <div
      role="menu"
      onMouseDown={e => e.stopPropagation()}
      style={{ position: 'fixed', left, top, width: MENU_WIDTH }}
      className="z-50 rounded-lg border border-border bg-card shadow-2xl shadow-black/30 overflow-hidden"
    >
      <div className="px-3 py-2 text-[10px] uppercase tracking-[0.18em] font-bold text-muted-foreground border-b border-border truncate">
        {label}
      </div>
      <button
        type="button"
        role="menuitem"
        onClick={() => {
          if (!canMoveLeft) return
          onMoveLeft()
          onClose()
        }}
        disabled={!canMoveLeft}
        className="w-full text-left px-3 py-2 text-sm text-foreground hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <line x1="19" y1="12" x2="5" y2="12" />
          <polyline points="12 19 5 12 12 5" />
        </svg>
        Move left
      </button>
      <button
        type="button"
        role="menuitem"
        onClick={() => {
          if (!canMoveRight) return
          onMoveRight()
          onClose()
        }}
        disabled={!canMoveRight}
        className="w-full text-left px-3 py-2 text-sm text-foreground hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2 border-t border-border"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <line x1="5" y1="12" x2="19" y2="12" />
          <polyline points="12 5 19 12 12 19" />
        </svg>
        Move right
      </button>
      <button
        type="button"
        role="menuitem"
        onClick={() => {
          if (!canHide) return
          onHide()
          onClose()
        }}
        disabled={!canHide}
        className="w-full text-left px-3 py-2 text-sm text-foreground hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2 border-t border-border"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
          <line x1="1" y1="1" x2="23" y2="23" />
        </svg>
        Hide column
      </button>
      <button
        type="button"
        onClick={() => {
          onCustomize()
          onClose()
        }}
        className="w-full text-left px-3 py-2 text-sm text-foreground hover:bg-muted border-t border-border transition-colors flex items-center gap-2"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
        </svg>
        Customize columns…
      </button>
    </div>
  )
}
