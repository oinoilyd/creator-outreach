'use client'

/**
 * Lifecycle filter pills above the Active Clients card grid.
 *
 * Five slots: All / Active / Paused / Completed / Churned. Each shows
 * a count of engagements in that bucket. Clicking a pill scopes the
 * card grid to that lifecycle. "All" shows everything (default).
 *
 * Counts come from the parent — this component is dumb. The lifecycle
 * field on an OutreachEntry is nullable; NULL is treated as 'active'
 * everywhere (consistent with what the DB column defaults to via the
 * app, not via Postgres default — see lib/types.ts ClientLifecycle).
 */

import type { ClientLifecycle } from '@/lib/types'

export type LifecycleFilter = 'all' | ClientLifecycle

interface LifecycleFilterBarProps {
  active: LifecycleFilter
  onChange: (next: LifecycleFilter) => void
  counts: Record<LifecycleFilter, number>
}

interface PillDef {
  id: LifecycleFilter
  label: string
  /** Accent color for the count badge + active state. */
  accent:
    | 'neutral'
    | 'green'
    | 'amber'
    | 'blue'
    | 'rose'
}

const PILLS: PillDef[] = [
  { id: 'all',       label: 'All',        accent: 'neutral' },
  { id: 'active',    label: 'Active',     accent: 'green'   },
  { id: 'paused',    label: 'Paused',     accent: 'amber'   },
  { id: 'completed', label: 'Completed',  accent: 'blue'    },
  { id: 'churned',   label: 'Churned',    accent: 'rose'    },
]

export function LifecycleFilterBar({ active, onChange, counts }: LifecycleFilterBarProps) {
  return (
    <div
      role="tablist"
      aria-label="Filter by engagement lifecycle"
      className="flex flex-wrap items-center gap-1.5 mb-4"
    >
      {PILLS.map(pill => {
        const isActive = active === pill.id
        const count = counts[pill.id] ?? 0
        return (
          <button
            key={pill.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(pill.id)}
            className={[
              'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full',
              'text-[12.5px] font-medium border transition-colors',
              'focus:outline-none focus:ring-2 focus:ring-purple-500/30',
              isActive
                ? activeStyles(pill.accent)
                : 'bg-card/40 border-border text-muted-foreground hover:text-foreground hover:bg-muted/50',
            ].join(' ')}
          >
            <span>{pill.label}</span>
            <span
              className={[
                'inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[10.5px] font-semibold tabular-nums',
                isActive ? activeBadgeStyles(pill.accent) : 'bg-muted text-muted-foreground/80',
              ].join(' ')}
            >
              {count}
            </span>
          </button>
        )
      })}
    </div>
  )
}

// Tailwind-safe variant classes — typed instead of constructed so the
// JIT picks them up.
function activeStyles(accent: PillDef['accent']): string {
  switch (accent) {
    case 'green':
      return 'bg-green-500/10 border-green-500/40 text-green-700 dark:text-green-300'
    case 'amber':
      return 'bg-amber-500/10 border-amber-500/40 text-amber-700 dark:text-amber-300'
    case 'blue':
      return 'bg-blue-500/10 border-blue-500/40 text-blue-700 dark:text-blue-300'
    case 'rose':
      return 'bg-rose-500/10 border-rose-500/40 text-rose-700 dark:text-rose-300'
    case 'neutral':
    default:
      return 'bg-foreground/10 border-foreground/30 text-foreground'
  }
}

function activeBadgeStyles(accent: PillDef['accent']): string {
  switch (accent) {
    case 'green':
      return 'bg-green-500/20 text-green-700 dark:text-green-300'
    case 'amber':
      return 'bg-amber-500/20 text-amber-700 dark:text-amber-300'
    case 'blue':
      return 'bg-blue-500/20 text-blue-700 dark:text-blue-300'
    case 'rose':
      return 'bg-rose-500/20 text-rose-700 dark:text-rose-300'
    case 'neutral':
    default:
      return 'bg-foreground/15 text-foreground'
  }
}
