'use client'

/**
 * ActivityTimeline — append-only timeline of state changes on an
 * active-client engagement. Rendered inside the detail modal.
 *
 * The timeline is driven by the clientActivity JSONB column. New
 * entries are written by the parent on every meaningful change
 * (lifecycle, budget, timeline, scope, contract, milestone, note).
 * This component is purely a renderer — no edit or delete.
 *
 * The newest event sits at the top. If the array is empty we show a
 * one-line empty state so users understand the timeline will fill
 * in as they work.
 */

import type { ClientActivityEvent } from '@/lib/types'
import {
  Activity, ArrowRight, CircleDollarSign, Calendar, FileText,
  ListChecks, MessageSquare, Sparkles, type LucideIcon,
} from 'lucide-react'

interface ActivityTimelineProps {
  events: ClientActivityEvent[]
}

const ICONS: Record<ClientActivityEvent['type'], LucideIcon> = {
  created:   Sparkles,
  lifecycle: ArrowRight,
  budget:    CircleDollarSign,
  timeline:  Calendar,
  scope:     FileText,
  contract:  FileText,
  milestone: ListChecks,
  note:      MessageSquare,
}

const COLORS: Record<ClientActivityEvent['type'], string> = {
  created:   'text-purple-500',
  lifecycle: 'text-blue-500',
  budget:    'text-green-500',
  timeline:  'text-amber-500',
  scope:     'text-foreground/70',
  contract:  'text-rose-500',
  milestone: 'text-blue-400',
  note:      'text-muted-foreground',
}

export function ActivityTimeline({ events }: ActivityTimelineProps) {
  const sorted = [...events].sort((a, b) => b.ts - a.ts)

  // Header is intentionally omitted — the consumer (ActivityLogModal)
  // owns the "Activity log" title. Keeping the title here would be a
  // duplicate visual element inside the modal body.
  return (
    <div>
      {sorted.length === 0 ? (
        <p className="text-[12px] text-muted-foreground/70 italic">
          State changes will appear here as you update the engagement.
        </p>
      ) : (
        // No max-h here — ActivityLogModal owns scrolling via its
        // overflow-y-auto body. A double-scroll would feel janky.
        <ol className="space-y-2">
          {sorted.map((ev, i) => {
            const Icon = ICONS[ev.type] ?? Activity
            return (
              <li
                key={`${ev.ts}-${i}`}
                className="flex items-start gap-2 text-[12.5px]"
              >
                <Icon className={`w-3.5 h-3.5 mt-0.5 shrink-0 ${COLORS[ev.type] ?? 'text-muted-foreground'}`} aria-hidden />
                <div className="flex-1 min-w-0">
                  <div className="text-foreground/90 leading-snug">
                    {ev.summary}
                  </div>
                  <div className="text-[10.5px] text-muted-foreground/65 tabular-nums">
                    {formatTs(ev.ts)}
                  </div>
                </div>
              </li>
            )
          })}
        </ol>
      )}
    </div>
  )
}

function formatTs(ts: number): string {
  const d = new Date(ts)
  const now = new Date()
  const sameDay = d.toDateString() === now.toDateString()
  if (sameDay) {
    return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  }
  const sameYear = d.getFullYear() === now.getFullYear()
  return d.toLocaleDateString('en-US', sameYear
    ? { month: 'short', day: 'numeric' }
    : { month: 'short', day: 'numeric', year: 'numeric' })
}
