'use client'

import { motion, AnimatePresence } from 'motion/react'
import { ReactNode, useEffect, useId, useRef } from 'react'
import { useFocusTrap } from '@/lib/hooks/useFocusTrap'

/**
 * Premium modal wrapper. Spring-based scale-in entrance, fade
 * backdrop, click-outside to close, escape-to-close, focus trap +
 * return-focus, role=dialog + aria-modal.
 *
 * Use this in place of the raw `<div className="fixed inset-0 z-50 ...">`
 * patterns. Caller should provide an accessible name via either
 * `ariaLabel` (for visually-hidden labels) or `ariaLabelledBy` (when
 * the dialog has a visible heading) — without one, screen readers
 * announce only "dialog" with no context.
 */
export function Modal({
  open,
  onClose,
  children,
  size = 'md',
  ariaLabel,
  ariaLabelledBy,
}: {
  open: boolean
  onClose: () => void
  children: ReactNode
  size?: 'sm' | 'md' | 'lg' | 'xl'
  ariaLabel?: string
  ariaLabelledBy?: string
}) {
  const dialogRef = useRef<HTMLDivElement>(null)
  // Stable fallback label ID generated once per Modal mount, so the
  // dialog has SOMETHING for assistive tech to announce when neither
  // ariaLabel nor ariaLabelledBy is provided. Caller-provided label
  // wins.
  const fallbackId = useId()

  useFocusTrap(dialogRef, open)

  // Esc-to-close stays on window so it works regardless of focus
  // location inside the dialog.
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  const widthClass = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-2xl',
  }[size]

  return (
    <AnimatePresence>
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          onClick={onClose}
        >
          <motion.div
            aria-hidden
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          />
          <motion.div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-label={ariaLabelledBy ? undefined : (ariaLabel ?? 'Dialog')}
            aria-labelledby={ariaLabelledBy ?? undefined}
            id={!ariaLabel && !ariaLabelledBy ? fallbackId : undefined}
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ type: 'spring', bounce: 0.18, duration: 0.4 }}
            className={`relative w-full ${widthClass} bg-card border border-border rounded-2xl shadow-2xl shadow-black/20 dark:shadow-black/60 max-h-[92vh] overflow-y-auto focus:outline-none`}
            onClick={e => e.stopPropagation()}
          >
            {children}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}
