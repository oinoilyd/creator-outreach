'use client'

import { useEffect, useState } from 'react'

/**
 * Admin-only load-timing badge (temporary diagnostic, Dylan 2026-06-12).
 *
 * The admin page felt laggy to open, but the server data fetch measured
 * ~330ms — so this surfaces REAL numbers to localize the rest instead of
 * guessing:
 *
 *   server — in-code data-fetch + render time (the Promise.all etc).
 *   ttfb   — Navigation Timing responseStart: time to first byte, which
 *            INCLUDES any serverless COLD-START boot (boot happens before
 *            the page code — and thus before `server` — runs).
 *   total  — full page load (loadEventEnd).
 *
 * Reading it: big ttfb with small server  → cold start / network.
 *             big (total − ttfb)           → client JS / hydration.
 *
 * On an in-app (SPA) navigation the Navigation Timing entry describes the
 * ORIGINAL page load, not this transition, so we detect that (the entry's
 * URL won't be /admin) and show only the reliable server number.
 */
export function AdminLoadStat({ serverMs }: { serverMs: number }) {
  const [client, setClient] = useState<{ ttfb: number; total: number } | null>(null)
  const [spaNav, setSpaNav] = useState(false)

  useEffect(() => {
    try {
      const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined
      if (!nav || !nav.name.includes('/admin')) {
        setSpaNav(true)
        return
      }
      const finish = () => {
        setClient({
          ttfb: Math.round(nav.responseStart),
          total: Math.round(nav.loadEventEnd || nav.domComplete || performance.now()),
        })
      }
      if (nav.loadEventEnd > 0) {
        finish()
        return
      }
      window.addEventListener('load', finish, { once: true })
      return () => window.removeEventListener('load', finish)
    } catch {
      /* Navigation Timing unavailable — show only the server number. */
    }
  }, [])

  const fmt = (ms: number) => (ms >= 1000 ? `${(ms / 1000).toFixed(1)}s` : `${ms}ms`)

  return (
    <span
      className="text-[11px] font-mono text-muted-foreground/70 whitespace-nowrap"
      title="Admin-only load timing. server = data fetch + render on the server. ttfb = time to first byte (includes any serverless cold start). total = full page load. Big ttfb with small server → cold start; big total−ttfb → client hydration."
    >
      ⏱ server {fmt(serverMs)}
      {client && (
        <>
          {' '}· ttfb {fmt(client.ttfb)} · total {fmt(client.total)}
        </>
      )}
      {spaNav && <> · (in-app nav)</>}
    </span>
  )
}
