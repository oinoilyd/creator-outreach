'use client'

/**
 * AStat — analytics stat card with optional NumberTicker animation
 * on numeric values. Used by the Outreach analytics dashboard.
 *
 * Extracted from app/page.tsx in Phase 2a refactor.
 *
 * memo'd in Phase 3a — props are primitives (label/value/sub/highlight)
 * so reference equality is sufficient; component only re-renders when
 * its actual displayed values change.
 */
import { memo } from 'react'
import { motion } from 'motion/react'
import { NumberTicker } from '@/components/NumberTicker'

export const AStat = memo(function AStat({ label, value, sub, highlight }: { label: string; value: number | string; sub?: string; highlight?: boolean }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '0px' }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      className={`relative bg-card/60 border rounded-xl p-4 shadow-sm shadow-black/5 hover:border-border/80 transition-colors ${highlight ? 'border-red-500/40' : 'border-border'}`}
    >
      <div className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1.5">{label}</div>
      <div className={`text-2xl font-bold tabular-nums ${highlight ? 'text-red-700 dark:text-red-400' : 'text-foreground'}`}>
        {typeof value === 'number' ? <NumberTicker value={value} /> : value}
      </div>
      {sub && <div className="text-[11px] text-muted-foreground mt-1">{sub}</div>}
    </motion.div>
  )
})
