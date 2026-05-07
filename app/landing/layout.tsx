'use client'

import { useEffect } from 'react'

/**
 * Landing layout: force LIGHT mode for marketing visitors regardless
 * of the user's app-side toggle. Marketing pages are designed for one
 * theme only — dark/light parity here is a maintenance tax for zero
 * user benefit, and historical attempts have produced inconsistent
 * visuals (the user explicitly called this out).
 *
 * Approach: strip `.dark` from <html> on mount, restore on unmount so
 * a user who toggled dark in the app still sees dark when they go
 * back. next-themes' localStorage key is unchanged — we're only
 * overriding the visible class for the duration of this route.
 */
export default function LandingLayout({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const html = document.documentElement
    const wasDark = html.classList.contains('dark')
    html.classList.remove('dark')
    html.classList.add('light')
    return () => {
      if (wasDark) {
        html.classList.add('dark')
        html.classList.remove('light')
      }
    }
  }, [])

  return <>{children}</>
}
