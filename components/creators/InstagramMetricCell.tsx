'use client'

import { useInstagramMetrics, formatFollowers } from '@/lib/hooks/useInstagramMetrics'

/**
 * Tiny render-only cell for IG-API-derived metric columns (followers,
 * posts). Reuses the same useInstagramMetrics polling hook the
 * InstagramCell uses, so the network roundtrip dedupes per handle.
 *
 * States:
 *   - no IG handle on the row     →  '—'
 *   - polling                     →  spinner dot
 *   - ready                       →  formatted number (1.2M / 538K)
 *   - unavailable / unconfigured  →  '—' with tooltip explaining why
 */
export function InstagramMetricCell({ instagramUrl, field }: { instagramUrl: string; field: 'followers' | 'posts' }) {
  const status = useInstagramMetrics(instagramUrl || undefined)

  if (!instagramUrl) {
    return <span className="text-muted-foreground/40">—</span>
  }
  if (status.status === 'pending' || status.status === 'idle') {
    return <span className="text-muted-foreground/40 animate-pulse">⋯</span>
  }
  if (status.status === 'ready') {
    const m = status.metrics as { followers?: number; mediaCount?: number; posts?: number }
    const value = field === 'followers' ? m.followers : (m.posts ?? m.mediaCount)
    if (value == null) return <span className="text-muted-foreground/40">—</span>
    return (
      <span title={`${(value).toLocaleString()} ${field}`}>
        {formatFollowers(value)}
      </span>
    )
  }
  // unavailable / timeout / unconfigured / invalid_handle
  const reason =
    status.status === 'unavailable' ? (status as any).reason
    : status.status === 'unconfigured' ? 'Meta Graph API not configured yet'
    : status.status === 'timeout' ? 'IG metrics lookup timed out'
    : 'IG metrics unavailable'
  return (
    <span className="text-muted-foreground/40" title={reason}>—</span>
  )
}
