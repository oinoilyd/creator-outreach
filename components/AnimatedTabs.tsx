'use client'

import { motion } from 'motion/react'
import { ReactNode } from 'react'

// A tab strip with a sliding underline driven by motion's layoutId.
// Used for both the top tabs (Results / Outreach / Dismissed) and the
// sub-tabs inside Outreach. Single-tone style for the top tabs, "pill"
// style for sub-tabs.

export function AnimatedTabs<T extends string>({
  tabs,
  active,
  onChange,
  variant = 'underline',
  layoutGroup,
}: {
  tabs: { id: T; label: ReactNode }[]
  active: T
  onChange: (id: T) => void
  variant?: 'underline' | 'pill'
  layoutGroup: string
}) {
  if (variant === 'pill') {
    return (
      <div className="flex flex-wrap gap-1">
        {tabs.map(t => {
          const isActive = active === t.id
          return (
            <button
              key={t.id}
              onClick={() => onChange(t.id)}
              className={`relative px-3.5 py-1.5 text-xs font-medium rounded-full transition-colors ${
                isActive ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {isActive && (
                <motion.span
                  layoutId={`${layoutGroup}-pill-bg`}
                  className="absolute inset-0 rounded-full bg-muted border border-border"
                  transition={{ type: 'spring', bounce: 0.18, duration: 0.5 }}
                />
              )}
              <span className="relative z-10">{t.label}</span>
            </button>
          )
        })}
      </div>
    )
  }

  // underline (default)
  return (
    <div className="flex gap-1 relative">
      {tabs.map(t => {
        const isActive = active === t.id
        return (
          <button
            key={t.id}
            onClick={() => onChange(t.id)}
            className={`relative px-5 py-2.5 text-sm font-medium transition-colors ${
              isActive ? 'text-foreground' : 'text-muted-foreground hover:text-foreground/80'
            }`}
          >
            {t.label}
            {isActive && (
              <motion.span
                layoutId={`${layoutGroup}-underline`}
                className="absolute left-3 right-3 -bottom-px h-0.5 bg-gradient-to-r from-purple-500 to-blue-500 rounded-full"
                transition={{ type: 'spring', bounce: 0.18, duration: 0.5 }}
              />
            )}
          </button>
        )
      })}
    </div>
  )
}
