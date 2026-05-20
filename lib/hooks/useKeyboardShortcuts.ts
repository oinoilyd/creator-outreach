'use client'

/**
 * useKeyboardShortcuts — single global keydown listener that fires
 * registered handlers based on the pressed key. Keeps the wiring in
 * page.tsx tiny: instead of 5 useEffect-with-window-keydown blocks
 * we have one source of truth.
 *
 * Auto-suppresses when focus is in a text-entry control (input,
 * textarea, contenteditable) so typing a "?" in a notes field
 * doesn't spawn the help modal mid-sentence. The `/` shortcut is
 * the canonical "focus search" pattern in modern apps (Gmail, GitHub,
 * Linear, Slack) — same semantics here.
 *
 * Handlers receive the original KeyboardEvent so they can
 * preventDefault if they want (e.g. `/` should preempt the browser's
 * "find on page" UI in some contexts — we let the host decide).
 */

import { useEffect } from 'react'

export interface ShortcutBinding {
  /** Single-character key (case-sensitive). Multi-key combos via
   *  `meta`, `ctrl`, `shift`, `alt` flags. */
  key: string
  meta?: boolean
  ctrl?: boolean
  shift?: boolean
  alt?: boolean
  /** Whether to fire even when focus is in an input/textarea. Default
   *  false. Only Escape, Cmd+K-style global shortcuts should set true. */
  fireWhileTyping?: boolean
  handler: (e: KeyboardEvent) => void
  /** Optional human-readable label used by the cheat-sheet modal. */
  label?: string
}

/**
 * Best-effort detection of "user is currently typing in an input."
 * Returns true if the focused element is one of:
 *   • <input> (any non-button type)
 *   • <textarea>
 *   • [contenteditable="true"]
 *   • inside a Radix/HeadlessUI listbox/dialog input
 */
function isTyping(): boolean {
  if (typeof document === 'undefined') return false
  const el = document.activeElement as HTMLElement | null
  if (!el) return false
  const tag = el.tagName
  if (tag === 'TEXTAREA') return true
  if (tag === 'INPUT') {
    const type = (el as HTMLInputElement).type
    // Buttons / checkboxes / radios don't count as "typing."
    return type !== 'button' && type !== 'checkbox' && type !== 'radio' && type !== 'submit'
  }
  if (el.isContentEditable) return true
  return false
}

export function useKeyboardShortcuts(bindings: ShortcutBinding[], enabled: boolean = true) {
  useEffect(() => {
    if (!enabled) return
    function onKeyDown(e: KeyboardEvent) {
      const typing = isTyping()
      for (const b of bindings) {
        // Modifier match must be exact — a binding without ctrl/meta
        // shouldn't fire when ctrl/meta is held (that usually means
        // the user is invoking a browser/OS shortcut instead).
        if (e.key !== b.key) continue
        if (!!b.meta !== e.metaKey) continue
        if (!!b.ctrl !== e.ctrlKey) continue
        if (!!b.shift !== e.shiftKey) continue
        if (!!b.alt !== e.altKey) continue
        if (typing && !b.fireWhileTyping) continue
        b.handler(e)
        return
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [bindings, enabled])
}

/**
 * Stable shape for the cheat-sheet modal — the same array drives
 * both `useKeyboardShortcuts` and the help dialog's rendered table,
 * so labels can't drift out of sync.
 */
export interface ShortcutRow {
  keys: string[]      // visual representation (e.g. ['Shift', '?'])
  label: string       // what the shortcut does
  scope?: string      // optional grouping ('Global', 'Outreach', etc.)
}
