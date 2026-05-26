'use client'

/**
 * TeamFilterBar — pill row at the top of Outreach for filtering by
 * assignee.
 *
 *   [ All team ] [ Mine ] [ Test Owner ] [ Test Admin ] [ Sarah ] …
 *
 * Only renders when the user is in a team (mode='team'). Members
 * never see this — RLS already filters them down to their own rows,
 * so the filter would be redundant.
 *
 * Selection state is owned by the parent (so the parent can apply
 * it to `entries` before passing into the table).
 */

import type { TeamMember } from '@/lib/team-client'

/** Sentinel values used by the parent to interpret the filter. */
export const ASSIGNEE_FILTER_ALL = '__all__'
export const ASSIGNEE_FILTER_MINE = '__mine__'

export type AssigneeFilter = typeof ASSIGNEE_FILTER_ALL | typeof ASSIGNEE_FILTER_MINE | string

interface Props {
  members: TeamMember[]
  selected: AssigneeFilter
  onChange: (next: AssigneeFilter) => void
  /** The viewing user's own id — used to highlight the "Mine" pill. */
  currentUserId: string | null
  /** Per-bucket counts for badge display. */
  counts: {
    all: number
    mine: number
    byUser: Record<string, number>
  }
}

function rolePillClass(role: 'owner' | 'admin' | 'member'): string {
  if (role === 'owner') return 'bg-purple-500/15 text-purple-700 dark:text-purple-400'
  if (role === 'admin') return 'bg-blue-500/15 text-blue-700 dark:text-blue-400'
  return 'bg-muted text-muted-foreground/70'
}

export function TeamFilterBar({ members, selected, onChange, currentUserId, counts }: Props) {
  return (
    <div className="flex items-center gap-2 flex-wrap py-2 px-3 bg-card/40 border border-border rounded-lg">
      <span className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground/80 mr-1">
        Filter by
      </span>

      <FilterPill
        active={selected === ASSIGNEE_FILTER_ALL}
        onClick={() => onChange(ASSIGNEE_FILTER_ALL)}
        label="All team"
        count={counts.all}
      />
      <FilterPill
        active={selected === ASSIGNEE_FILTER_MINE}
        onClick={() => onChange(ASSIGNEE_FILTER_MINE)}
        label="Mine"
        count={counts.mine}
      />

      <span className="text-muted-foreground/30 mx-1 select-none">·</span>

      {members.map(m => {
        const isMe = m.userId === currentUserId
        return (
          <FilterPill
            key={m.userId}
            active={selected === m.userId}
            onClick={() => onChange(m.userId)}
            label={
              <span className="flex items-center gap-1.5">
                <span>{m.fullName || m.email}</span>
                <span
                  className={`px-1 py-0.5 rounded-full text-[9px] font-mono uppercase ${rolePillClass(m.role)}`}
                >
                  {m.role.charAt(0)}
                </span>
                {isMe && <span className="text-[9px] text-muted-foreground/60">(you)</span>}
              </span>
            }
            count={counts.byUser[m.userId] ?? 0}
          />
        )
      })}
    </div>
  )
}

function FilterPill({
  active,
  onClick,
  label,
  count,
}: {
  active: boolean
  onClick: () => void
  label: React.ReactNode
  count: number
}) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium border transition-colors ${
        active
          ? 'bg-foreground text-background border-foreground'
          : 'bg-background text-foreground/80 border-border hover:bg-card hover:text-foreground'
      }`}
    >
      <span>{label}</span>
      <span
        className={`text-[10px] tabular-nums ${
          active ? 'text-background/70' : 'text-muted-foreground/70'
        }`}
      >
        {count}
      </span>
    </button>
  )
}
