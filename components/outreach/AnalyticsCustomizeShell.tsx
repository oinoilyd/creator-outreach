'use client'

import React, { useEffect } from 'react'

export function AnalyticsCustomizeShell({
  onClose,
  children,
}: {
  onClose: () => void
  children: React.ReactNode
}) {
  useEffect(() => {
    function onKey(ev: KeyboardEvent) {
      if (ev.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    // Lock body scroll while the panel is open.
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prevOverflow
    }
  }, [onClose])

  return (
    <div className="fixed inset-0 z-50 flex">
      <button
        type="button"
        onClick={onClose}
        aria-label="Close panel"
        className="flex-1 bg-black/50 cursor-pointer"
      />
      {/* Stop click propagation INSIDE the panel so the backdrop
          click doesn't fire when the user interacts with controls. */}
      <div onClick={e => e.stopPropagation()} className="flex">
        {children}
      </div>
    </div>
  )
}
