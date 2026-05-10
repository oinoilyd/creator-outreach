'use client'

/**
 * LocalDateTime — renders an ISO timestamp in the viewer's local
 * timezone using Intl.DateTimeFormat. Server renders an empty
 * placeholder; client hydrates with the localized string.
 *
 * Why a client component: Vercel servers run in UTC, so any
 * server-rendered toLocaleString() shows UTC times to operators.
 * That's wrong for almost every admin/dashboard view ("a user
 * signed up at 4am" looks weirder when it's actually 11pm in
 * their timezone). Rendering on the client uses the browser's
 * resolved timezone, which is what humans want.
 *
 * Variants:
 *   - 'datetime' (default): "May 9, 11:42 PM"
 *   - 'date': "May 9, 2026"
 *   - 'relative': "3m ago" / "2h ago" / "May 9" (matches the rest
 *     of the app's relative-time conventions)
 *
 * suppressHydrationWarning is intentional — the initial empty
 * render mismatches the eventual client-rendered string. Browsers
 * that disable JS get an empty span; everyone else sees the
 * localized time within milliseconds.
 */

import { useEffect, useState } from 'react'

type Variant = 'datetime' | 'date' | 'relative' | 'datetime-short'

export function LocalDateTime({
  iso,
  variant = 'datetime',
  fallback = '—',
}: {
  iso: string | null | undefined
  variant?: Variant
  fallback?: string
}) {
  const [text, setText] = useState<string>('')

  useEffect(() => {
    if (!iso) {
      setText(fallback)
      return
    }
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) {
      setText(fallback)
      return
    }
    if (variant === 'relative') {
      setText(formatRelative(d))
      return
    }
    if (variant === 'date') {
      setText(d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }))
      return
    }
    if (variant === 'datetime-short') {
      // Same shape as the server fmtDate did: "May 9, 11:42 PM"
      // when in the current year; "Jan 14, 2025" when older.
      const now = new Date()
      const sameYear = d.getFullYear() === now.getFullYear()
      setText(
        d.toLocaleString(undefined, {
          month: 'short',
          day: 'numeric',
          ...(sameYear
            ? { hour: 'numeric', minute: '2-digit' }
            : { year: 'numeric' }),
        }),
      )
      return
    }
    setText(d.toLocaleString())
  }, [iso, variant, fallback])

  if (!iso) return <span>{fallback}</span>
  return <span suppressHydrationWarning>{text || ' '}</span>
}

/** "3m ago" / "2h ago" / "5d ago" / Mar 14. Matches the formatting
 *  used elsewhere in the app for relative timestamps. */
function formatRelative(d: Date): string {
  const ms = Date.now() - d.getTime()
  const s = Math.floor(ms / 1000)
  if (s < 60) return `${s}s ago`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const days = Math.floor(h / 24)
  if (days < 30) return `${days}d ago`
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}
