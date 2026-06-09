/**
 * Centralized display labels + color classes for OutreachEntry.status.
 *
 * The DB / type values stay as they always were ('Open', 'No Response',
 * etc.) — this module is purely a presentation layer so we can rename
 * the user-facing terminology without a schema migration.
 *
 * Renames (Dylan 2026-05-31):
 *   • 'Open'        → label "Warm"               (active back-and-forth)
 *   • 'No Response' → label "Pending Response"   (sent, awaiting reply)
 *
 * Old semantics of 'No Response' (ghosted after 14d) still work — the
 * follow-ups view treats it as overdue once the cadence elapses. The
 * label just stops sounding terminal before the user gives up on it.
 */

import type { OutreachEntry } from './types'

export type OutreachStatus = OutreachEntry['status']

/** User-facing label for a status value. */
export function statusLabel(status: OutreachStatus): string {
  switch (status) {
    case 'Open':         return 'Warm'
    case 'No Response':  return 'Pending Response'
    case 'Not Outreached': return 'Not Outreached'
    case 'Successful':   return 'Successful'
    case 'Rejected':     return 'Rejected'
    default:             return 'Not Outreached'
  }
}

/**
 * Tailwind classes for the status badge / select. Two variants because
 * the select needs `bg-*-50` light tones; the badge uses `bg-*-500/15`
 * tinted overlays.
 */
export function statusSelectClasses(status: OutreachStatus): string {
  switch (status) {
    case 'Successful':
      return 'bg-emerald-50 dark:bg-emerald-900/40 border-emerald-300 dark:border-emerald-700 text-emerald-800 dark:text-emerald-300'
    case 'Open': // labeled "Warm" — keep the existing blue
      return 'bg-blue-50 dark:bg-blue-900/40 border-blue-300 dark:border-blue-700 text-blue-800 dark:text-blue-300'
    case 'Rejected':
      return 'bg-red-50 dark:bg-red-900/40 border-red-300 dark:border-red-700 text-red-800 dark:text-red-300'
    case 'No Response': // labeled "Pending Response" — new light yellow
      return 'bg-yellow-50 dark:bg-yellow-900/30 border-yellow-300 dark:border-yellow-700 text-yellow-800 dark:text-yellow-300'
    default:
      return 'bg-muted border-border text-muted-foreground'
  }
}

/** Badge variant — heavier tint, used on Lead detail + activity chips. */
export function statusBadgeClasses(status: OutreachStatus): string {
  switch (status) {
    case 'Successful':
      return 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40'
    case 'Open':
      return 'bg-blue-500/15 text-blue-300 border-blue-500/40'
    case 'Rejected':
      return 'bg-red-500/15 text-red-300 border-red-500/40'
    case 'No Response':
      return 'bg-yellow-500/15 text-yellow-700 dark:text-yellow-300 border-yellow-500/40'
    default:
      return 'bg-muted/40 text-muted-foreground border-border'
  }
}

/** Ordered list for <select> dropdowns. */
export const STATUS_OPTIONS: Array<{ value: NonNullable<OutreachStatus>; label: string }> = [
  { value: 'Not Outreached', label: 'Not Outreached' },
  { value: 'No Response',    label: 'Pending Response' },
  { value: 'Open',           label: 'Warm' },
  { value: 'Successful',     label: 'Successful' },
  { value: 'Rejected',       label: 'Rejected' },
]
