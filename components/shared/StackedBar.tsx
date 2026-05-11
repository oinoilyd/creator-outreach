'use client'

/**
 * StackedBar — horizontal stacked bar with proportional segments +
 * legend underneath. Used by the Outreach analytics to visualize
 * pipeline distribution (Drafted / Sent / Replied / Won, etc).
 *
 * Extracted from app/page.tsx in Phase 2a refactor.
 *
 * memo'd in Phase 3a — `segments` is always a freshly-built array
 * but the parent (OutreachAnalytics) usually wraps it in useMemo,
 * so reference equality is usually preserved. Even when it does
 * re-render, this is a small pure component so the cost is low.
 */
import { memo } from 'react'

export const StackedBar = memo(function StackedBar({ segments, total }: { segments: { label: string; value: number; color: string }[]; total: number }) {
  return (
    <div>
      <div className="flex h-3 rounded-full overflow-hidden bg-muted">
        {segments.map(s => s.value > 0 && (
          <div key={s.label} className={s.color} style={{ width: `${(s.value / total) * 100}%` }} title={`${s.label}: ${s.value}`} />
        ))}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1.5 mt-3">
        {segments.map(s => (
          <div key={s.label} className="flex items-center gap-1.5 text-xs">
            <span className={`w-2.5 h-2.5 rounded-sm ${s.color}`} />
            <span className="text-muted-foreground">{s.label}</span>
            <span className="text-foreground tabular-nums">{s.value}</span>
          </div>
        ))}
      </div>
    </div>
  )
})
