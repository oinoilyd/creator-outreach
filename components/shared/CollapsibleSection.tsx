'use client'

/**
 * CollapsibleSection — accordion-style section with chevron + count.
 * Used in the Follow-ups tab for less-urgent buckets (Snoozed, Done)
 * so they don't compete with the active follow-ups visually.
 *
 * Extracted from app/page.tsx in Phase 2a refactor.
 */
import type React from 'react'

export function CollapsibleSection({ title, count, subtitle, open, onToggle, children }: {
  title: string
  count: number
  subtitle?: string
  open: boolean
  onToggle: () => void
  children: React.ReactNode
}) {
  return (
    <section className="border-t border-border pt-4">
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-2 text-left hover:bg-card/30 rounded px-1 py-1 -mx-1 transition-colors"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className={`w-3.5 h-3.5 text-muted-foreground transition-transform ${open ? 'rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
        <h3 className="text-sm font-semibold text-foreground/80">{title}</h3>
        <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full border border-border text-muted-foreground">{count}</span>
        {subtitle && <span className="text-[11px] text-muted-foreground ml-1">· {subtitle}</span>}
      </button>
      {open && <div className="space-y-2 mt-3">{children}</div>}
    </section>
  )
}
