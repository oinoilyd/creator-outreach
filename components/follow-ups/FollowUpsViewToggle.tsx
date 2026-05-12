'use client'

import React from 'react'

// Type union for the Follow-ups tab view selector. Lives at module
// scope so OutreachFollowUps + FollowUpsViewToggle can share it.
export type FUView = 'list' | 'month' | 'week' | 'gantt' | 'split'

/**
 * List/Calendar toggle pill rendered at the top of the Follow-ups
 * tab. Two-button segmented control. Shared by both the empty-state
 * and populated returns of OutreachFollowUps.
 */
export function FollowUpsViewToggle({
  current,
  onChange,
}: {
  current: FUView
  onChange: (next: FUView) => void
}) {
  // 5 options: List + 4 calendar shapes. Each user picks their preferred
  // mode (persisted to localStorage in the parent). Compact segmented
  // control — tooltips on each button describe the trade-off so users
  // can find the right fit without trial-and-error.
  return (
    <div className="flex items-center justify-between flex-wrap gap-2">
      <div className="text-[11px] uppercase tracking-wider text-muted-foreground">View</div>
      <div className="flex bg-card/60 rounded-md p-0.5 border border-border flex-wrap">
        {([
          { id: 'list',  label: 'List',   hint: 'Priority buckets: High / Medium / Low / Ghosted' },
          { id: 'week',  label: 'Week',   hint: '7-day strip with previews + day-detail panel' },
          { id: 'month', label: 'Month',  hint: 'Classic month-grid calendar' },
          { id: 'gantt', label: 'Gantt',  hint: '3-week horizontal timeline, bars from Sent → Follow-up' },
          { id: 'split', label: 'Split',  hint: 'Mini calendar + always-visible day agenda (Outlook-style)' },
        ] as { id: FUView; label: string; hint: string }[]).map(opt => (
          <button
            key={opt.id}
            type="button"
            onClick={() => onChange(opt.id)}
            title={opt.hint}
            className={`px-2.5 py-1 text-[11px] rounded transition-colors ${
              current === opt.id
                ? 'bg-muted text-foreground'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  )
}
