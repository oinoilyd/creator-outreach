'use client'

import { useEffect } from 'react'

/**
 * Auth layout: same light-mode lock as the landing layout. Sign-in /
 * sign-up / forgot-password / reset-password / check-email all live
 * in /auth/*, all share the same brand surface, all should look
 * identical regardless of the visitor's theme preference.
 */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
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
