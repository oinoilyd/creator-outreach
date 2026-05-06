'use client'

import { motion, AnimatePresence } from 'motion/react'
import { ReactNode, useEffect } from 'react'

// Premium modal wrapper. Spring-based scale-in entrance, fade backdrop,
// click-outside to close, escape-to-close. Use this in place of the
// raw `<div className="fixed inset-0 z-50 ...">` patterns.

export function Modal({
  open,
  onClose,
  children,
  size = 'md',
}: {
  open: boolean
  onClose: () => void
  children: ReactNode
  size?: 'sm' | 'md' | 'lg' | 'xl'
}) {
  // Esc-to-close
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ type: 'spring', bounce: 0.18, duration: 0.4 }}
            className={`relative w-full ${widthClass} bg-card border border-border rounded-2xl shadow-2xl shadow-black/20 dark:shadow-black/60 max-h-[92vh] overflow-y-auto`}
            onClick={e => e.stopPropagation()}
          >
            {children}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}
