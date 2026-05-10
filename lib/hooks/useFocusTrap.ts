'use client'

import { useEffect, useRef, RefObject } from 'react'

/**
 * Trap keyboard focus inside a container while it's open. Standard
 * dialog/modal pattern from the WAI-ARIA Authoring Practices:
 *
 *   1. When the dialog opens, remember which element had focus
 *      before so we can restore it on close.
 *   2. Move focus into the dialog. Default: the first focusable
 *      element. If the caller supplies `initialFocus`, use that.
 *   3. While open, intercept Tab + Shift+Tab to wrap focus around
 *      the dialog's focusable boundary instead of escaping into the
 *      page below.
 *   4. When the dialog closes, restore focus to the previously
 *      focused element.
 *
 * Usage:
 *   const dialogRef = useRef<HTMLDivElement>(null)
 *   useFocusTrap(dialogRef, isOpen)
 *   return isOpen ? <div ref={dialogRef} role="dialog" aria-modal>...</div> : null
 *
 * Caller can opt out of return-focus by passing `restoreFocus: false`
 * — useful when the dialog programmatically navigates somewhere else
 * on close (e.g. a confirmation modal that triggers a route change).
 */
export function useFocusTrap(
  containerRef: RefObject<HTMLElement | null>,
  enabled: boolean,
  options: { initialFocus?: RefObject<HTMLElement | null>; restoreFocus?: boolean } = {},
) {
  const { initialFocus, restoreFocus = true } = options
  // Snapshot of the element that had focus when the trap turned on.
  // Stored in a ref so the cleanup closure sees the right value even
  // if React swaps the parent component out before unmount.
  const previousFocusRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (!enabled) return
    const container: HTMLElement | null = containerRef.current
    if (!container) return
    // Narrow once into a non-null local for the closures below; TS
    // doesn't carry the not-null narrowing through the timeline of
    // a `useEffect` body across multiple inner functions.
    const root: HTMLElement = container

    previousFocusRef.current = (document.activeElement as HTMLElement | null) ?? null

    // Move focus into the dialog on the next frame so any animation
    // wrapper has time to mount its descendants. Without the rAF,
    // querying focusables before the children paint can return an
    // empty list.
    const focusFrame = requestAnimationFrame(() => {
      const target = initialFocus?.current ?? firstFocusable(root) ?? root
      if (target instanceof HTMLElement) {
        // Some containers (the wrapping <div role="dialog">) aren't
        // natively focusable; setting tabIndex=-1 + .focus() makes
        // them focusable as a fallback so the dialog at least owns
        // focus instead of leaving it on the page below.
        if (!target.hasAttribute('tabindex') && !isNativelyFocusable(target)) {
          target.tabIndex = -1
        }
        target.focus()
      }
    })

    function onKey(e: KeyboardEvent) {
      if (e.key !== 'Tab') return
      const focusables = focusableElements(root)
      if (focusables.length === 0) {
        e.preventDefault()
        return
      }
      const first = focusables[0]
      const last = focusables[focusables.length - 1]
      const active = document.activeElement
      if (e.shiftKey && active === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && active === last) {
        e.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', onKey)
    return () => {
      cancelAnimationFrame(focusFrame)
      document.removeEventListener('keydown', onKey)
      if (restoreFocus) {
        const prev = previousFocusRef.current
        if (prev && document.contains(prev)) prev.focus()
      }
    }
  }, [enabled, containerRef, initialFocus, restoreFocus])
}

// ── helpers ────────────────────────────────────────────────────────

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
  'audio[controls]',
  'video[controls]',
  '[contenteditable]:not([contenteditable="false"])',
].join(',')

function focusableElements(root: HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
    el => !el.hasAttribute('aria-hidden') && el.offsetWidth > 0 && el.offsetHeight > 0,
  )
}

function firstFocusable(root: HTMLElement): HTMLElement | null {
  const list = focusableElements(root)
  return list[0] ?? null
}

function isNativelyFocusable(el: HTMLElement): boolean {
  const tag = el.tagName
  if (tag === 'A' || tag === 'BUTTON' || tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') {
    return true
  }
  return el.tabIndex >= 0
}
