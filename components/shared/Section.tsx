'use client'

/**
 * Section — accent-colored header + count chip + body.
 * Used by the Follow-ups tab to group rows (Overdue / Due today /
 * Upcoming) with consistent visual rhythm.
 *
 * Extracted from app/page.tsx in Phase 2a refactor — same code,
 * own file so React can stabilize its reference and Next.js can
 * code-split.
 */
import type React from 'react'

export function Section({ title, accent, count, subtitle, icon, children, headerRight }: {
  title: string
  accent: 'red' | 'yellow' | 'blue' | 'green'
  count: number
  subtitle?: string
  icon?: React.ReactNode
  children: React.ReactNode
  /** Right-floated slot in the header row — used by the Follow-ups
   *  tab to embed the sort pills inline with the first section header
   *  instead of as a separate row above. */
  headerRight?: React.ReactNode
}) {
  const accentText = { red: 'text-red-700 dark:text-red-300', yellow: 'text-amber-800 dark:text-yellow-300', blue: 'text-blue-700 dark:text-blue-300', green: 'text-emerald-700 dark:text-emerald-300' }[accent]
  const accentBorder = { red: 'border-red-200 dark:border-red-500/40', yellow: 'border-amber-200 dark:border-yellow-500/40', blue: 'border-blue-200 dark:border-blue-500/30', green: 'border-emerald-200 dark:border-emerald-500/30' }[accent]
  return (
    <section>
      <div className="flex items-center gap-2 mb-3">
        {icon}
        <h3 className={`text-sm font-semibold ${accentText}`}>{title}</h3>
        <span className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full border ${accentBorder} ${accentText}`}>{count}</span>
        {subtitle && <span className="text-[11px] text-muted-foreground ml-1">· {subtitle}</span>}
        {headerRight && <div className="ml-auto">{headerRight}</div>}
      </div>
      <div className="space-y-2">{children}</div>
    </section>
  )
}
