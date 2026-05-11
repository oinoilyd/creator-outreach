'use client'

import React, { memo } from 'react'
import { motion } from 'motion/react'
import { NumberTicker } from '@/components/NumberTicker'
import { BorderBeam } from '@/components/BorderBeam'

// memo'd in Phase 3a — primitives + a stable onClick callback (parent
// passes useCallback'd setter). Re-renders only when the displayed
// number or active state actually changes.
export const FUStat = memo(function FUStat({ label, value, accent, sub, onClick, active }: {
  label: string
  value: number | string
  accent: 'red' | 'yellow' | 'blue' | 'green' | 'gray'
  sub?: string
  onClick?: () => void
  active?: boolean
}) {
  const accentText = {
    red: 'text-red-700 dark:text-red-400', yellow: 'text-amber-700 dark:text-yellow-400', blue: 'text-foreground',
    green: 'text-emerald-700 dark:text-emerald-400', gray: 'text-foreground',
  }[accent]
  const accentBorder = {
    red: 'border-red-200 dark:border-red-500/30', yellow: 'border-amber-200 dark:border-yellow-500/30', blue: 'border-border',
    green: 'border-emerald-200 dark:border-emerald-500/30', gray: 'border-border',
  }[accent]
  const accentGlow = {
    red: 'before:bg-red-500/[0.04]', yellow: 'before:bg-yellow-500/[0.04]',
    blue: 'before:bg-transparent', green: 'before:bg-emerald-500/[0.04]', gray: 'before:bg-transparent',
  }[accent]
  // High-priority "red" stat card gets the animated beam to scream urgency.
  const showBeam = accent === 'red' && typeof value === 'number' && value > 0
  const isClickable = !!onClick
  const Wrapper = isClickable ? 'button' : 'div'
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '0px' }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      whileHover={isClickable ? { y: -2 } : undefined}
    >
      <Wrapper
        {...(isClickable ? { onClick, type: 'button' } : {})}
        className={`relative w-full text-left bg-card/60 border ${accentBorder} rounded-xl p-4 shadow-sm shadow-black/5 overflow-hidden before:absolute before:inset-0 before:pointer-events-none ${accentGlow} ${isClickable ? 'cursor-pointer hover:border-border/80 hover:shadow-md hover:shadow-black/10' : 'hover:border-border/80'} transition-all ${active ? 'ring-2 ring-purple-500/60 border-purple-500/60' : ''}`}
      >
        <div className="relative">
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1.5 flex items-center justify-between">
            <span>{label}</span>
            {active && <span className="text-purple-700 dark:text-purple-300 text-[10px]">filtered</span>}
          </div>
          <div className={`text-2xl font-bold tabular-nums ${accentText}`}>
            {typeof value === 'number' ? <NumberTicker value={value} /> : value}
          </div>
          {sub && <div className="text-[11px] text-muted-foreground mt-1">{sub}</div>}
        </div>
        {showBeam && <BorderBeam size={120} duration={6} colorFrom="#ef4444" colorTo="#a855f7" />}
      </Wrapper>
    </motion.div>
  )
})
