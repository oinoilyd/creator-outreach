'use client'

import { useEffect, useState, useRef } from 'react'

/**
 * Polls /api/instagram-status until the IG metrics cache resolves
 * (status: 'ready'), the handle is declared 'unavailable' (personal
 * account / not found / rate-limited / unconfigured), or we've polled
 * for the configured timeout.
 *
 * Why polling and not WebSocket / SSE / live subscribe:
 *   - Vercel functions are stateless. Holding a long-lived connection
 *     would force us to a different runtime.
 *   - Most lookups resolve within ~5 seconds (Meta API is fast). A
 *     3s poll cadence is plenty.
 *   - One stable HTTP endpoint is far simpler to debug.
 *
 * Caller usage:
 *   const ig = useInstagramMetrics(creator.instagram)
 *   if (ig.status === 'ready') return <span>{formatFollowers(ig.metrics.followers)}</span>
 *
 * Disabled when handle is empty/missing — the hook becomes a no-op
 * and never starts polling.
 */

export interface InstagramMetricsLite {
  username: string
  followers: number
  follows: number
  mediaCount: number
  biography: string
  website: string
  profilePictureUrl: string
  name: string
  avgLikesPerPost: number
  engagementRate: number
  fetchedAt: string
}

export type InstagramStatus =
  | { status: 'idle' }                  // no handle to check yet
  | { status: 'pending' }               // polling in progress
  | { status: 'ready'; metrics: InstagramMetricsLite }
  | { status: 'unavailable'; reason: string }
  | { status: 'unconfigured' }
  | { status: 'invalid_handle' }
  | { status: 'timeout' }

const POLL_INTERVAL_MS = 3_000
const MAX_POLL_DURATION_MS = 30_000 // give up after 30s

export function useInstagramMetrics(handleOrUrl: string | undefined): InstagramStatus {
  const [state, setState] = useState<InstagramStatus>({ status: 'idle' })
  const startedAt = useRef<number>(0)
  const timer = useRef<NodeJS.Timeout | null>(null)
  const cancelled = useRef(false)

  useEffect(() => {
    cancelled.current = false
    if (!handleOrUrl) {
      setState({ status: 'idle' })
      return
    }
    setState({ status: 'pending' })
    startedAt.current = Date.now()

    async function poll() {
      if (cancelled.current) return

      // Timeout guard: stop polling after MAX_POLL_DURATION_MS.
      if (Date.now() - startedAt.current > MAX_POLL_DURATION_MS) {
        setState({ status: 'timeout' })
        return
      }

      try {
        const res = await fetch(
          `/api/instagram-status?handle=${encodeURIComponent(handleOrUrl ?? '')}`,
          { cache: 'no-store' },
        )
        if (!res.ok) {
          // 401 / 5xx — back off and try once more, then give up.
          timer.current = setTimeout(poll, POLL_INTERVAL_MS)
          return
        }
        const json = (await res.json()) as InstagramStatus
        if (cancelled.current) return

        if (json.status === 'ready' || json.status === 'unavailable' || json.status === 'unconfigured' || json.status === 'invalid_handle') {
          setState(json)
          return
        }

        // status === 'pending' (or anything else): keep polling.
        timer.current = setTimeout(poll, POLL_INTERVAL_MS)
      } catch {
        // Network blip — try again once, then give up via timeout.
        timer.current = setTimeout(poll, POLL_INTERVAL_MS)
      }
    }

    poll()

    return () => {
      cancelled.current = true
      if (timer.current) clearTimeout(timer.current)
    }
  }, [handleOrUrl])

  return state
}

/** Format follower counts (1234 → 1.2K, 1234567 → 1.2M). */
export function formatFollowers(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return String(n)
}

/** Format engagement rate as percentage (0.0234 → 2.34%). */
export function formatEngagementRate(rate: number): string {
  return `${(rate * 100).toFixed(2)}%`
}
