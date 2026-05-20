'use client'

/**
 * KeyboardShortcutsModal — cheat-sheet dialog listing every active
 * shortcut. Triggered by `?` (Shift+/) from anywhere in the app, or
 * by clicking the small "kbd" affordance in the bottom-right hint
 * chip on first session.
 *
 * The list is rendered from a static array so adding a new shortcut
 * is one edit: append to SHORTCUTS, wire the handler in page.tsx via
 * useKeyboardShortcuts. The label here MUST match what the handler
 * actually does.
 */

import { useEffect, useId, useRef } from 'react'
import { motion } from 'motion/react'
import { useFocusTrap } from '@/lib/hooks/useFocusTrap'
import type { ShortcutRow } from '@/lib/hooks/useKeyboardShortcuts'
import { X as XIcon, Keyboard } from 'lucide-react'

interface KeyboardShortcutsModalProps {
  open: boolean
  onClose: () => void
}

export const SHORTCUTS: ShortcutRow[] = [
  { scope: 'Global', keys: ['/'],          label: 'Focus search / filter input' },
  { scope: 'Global', keys: ['Shift', '?'], label: 'Open this cheat sheet' },
  { scope: 'Global', keys: ['Esc'],        label: 'Close modal / cancel typing' },
  // Reserved — to be wired when row-selection lands. Documented now
  // so the cheat sheet doesn't suddenly grow next release.
  // { scope: 'Outreach', keys: ['J'],         label: 'Next row (coming soon)' },
  // { scope: 'Outreach', keys: ['K'],         label: 'Previous row (coming soon)' },
  // { scope: 'Outreach', keys: ['F'],         label: 'Toggle favorite on selected row' },
  // { scope: 'Outreach', keys: ['S'],         label: 'Mark selected row Successful' },
]

export function KeyboardShortcutsModal({ open, onClose }: KeyboardShortcutsModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null)
  const titleId = useId()
  useFocusTrap(dialogRef, open)

  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  // Lock body scroll while open.
  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [open])

  if (!open) return null

  // Group by scope for readability.
  const grouped: Record<string, ShortcutRow[]> = {}
  for (const s of SHORTCUTS) {
    const k = s.scope || 'Other'
    grouped[k] = grouped[k] || []
    grouped[k].push(s)
  }
  const scopeOrder = Object.keys(grouped)

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <motion.div
        aria-hidden
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.15 }}
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
      />
      <motion.div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        initial={{ opacity: 0, scale: 0.97, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ type: 'spring', bounce: 0.18, duration: 0.35 }}
        className="relative bg-card border border-border rounded-2xl shadow-2xl w-full max-w-md focus:outline-none"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="flex items-center gap-2">
            <Keyboard className="w-4 h-4 text-muted-foreground" aria-hidden />
            <h2 id={titleId} className="text-[15px] font-semibold text-foreground">
              Keyboard shortcuts
            </h2>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 inline-flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors"
            aria-label="Close shortcut help"
          >
            <XIcon className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-4 space-y-4">
          {scopeOrder.map(scope => (
            <div key={scope}>
              <h3 className="text-[10.5px] uppercase tracking-wider font-semibold text-muted-foreground mb-2">
                {scope}
              </h3>
              <ul className="space-y-1.5">
                {grouped[scope].map((row, i) => (
                  <li key={i} className="flex items-center justify-between gap-3">
                    <span className="text-[13px] text-foreground/85">{row.label}</span>
                    <span className="flex items-center gap-1 shrink-0">
                      {row.keys.map((k, j) => (
                        <kbd
                          key={j}
                          className="inline-flex items-center justify-center min-w-[24px] h-[22px] px-1.5 rounded border border-border bg-background text-[11.5px] font-mono font-semibold text-foreground/85"
                        >
                          {k}
                        </kbd>
                      ))}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
          <p className="text-[11px] text-muted-foreground/70 pt-2 border-t border-border/60">
            More shortcuts (J/K row navigation, F favorite, S Successful)
            are on the roadmap — coming once row selection lands.
          </p>
        </div>
      </motion.div>
    </div>
  )
}
