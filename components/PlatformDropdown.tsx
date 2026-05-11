'use client'

/**
 * PlatformDropdown — the "Find [LOGO] creators" affordance in the
 * top banner.
 *
 * 2026-05-10 v2 redesign per Dylan ('design feels cheesy'): pulled
 * way back on the marketing-pages energy (gradient bgs, glow rings,
 * HIGH ROI tags, scale+rotate animations). This control is in the
 * app interior, clicked dozens of times per session — it should feel
 * like Linear/Notion utility, not a hero CTA.
 *
 * The restrained version:
 *   • Just the brand-colored icon + tiny chevron in a quiet pill
 *   • Subtle hover state (background lightens, no scale jump)
 *   • Simple opacity-fade transition on platform change (no rotate)
 *   • Dropdown options use a small left-rail icon + "(suggested)"
 *     hint for the three platforms with proven returns
 */

import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import type { PlatformId } from '@/lib/types'
import { PLATFORM_CONFIGS } from '@/lib/platform'
import { PlatformIcon } from './ui'

export function PlatformDropdown({ activePlatform, onChange }: { activePlatform: PlatformId; onChange: (id: PlatformId) => void }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const active = PLATFORM_CONFIGS.find(p => p.id === activePlatform)!

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    if (open) document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  return (
    <div ref={ref} className="relative inline-flex">
      <button
        onClick={() => setOpen(v => !v)}
        aria-label={`Find ${active.label} creators — click to change platform`}
        title={`Currently searching ${active.label}. Click to switch.`}
        // 2026-05-10 v3 per Dylan: brought back some pop, kept it
        // restrained. h-10 + bigger icon means the brand color does
        // the heavy lifting visually. Border bumps from default to a
        // slightly heavier foreground/20 so the pill has actual
        // presence; hover lifts to foreground/40 for clear affordance.
        className="group inline-flex items-center gap-2.5 h-10 px-3 rounded-xl border border-foreground/15 bg-card/60 hover:bg-card hover:border-foreground/40 transition-colors"
      >
        <AnimatePresence mode="wait" initial={false}>
          <motion.span
            key={activePlatform}
            initial={{ opacity: 0, scale: 0.85 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.85 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            className="inline-flex items-center justify-center"
          >
            {/* Bumped 16px → 22px. The brand color now has room to
                actually read — that's the entire visual pop. */}
            <PlatformIcon id={activePlatform} className="w-[22px] h-[22px]" colored />
          </motion.span>
        </AnimatePresence>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className={`w-3 h-3 text-muted-foreground/70 transition-transform ${open ? 'rotate-180' : 'group-hover:text-foreground'}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2.5}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <motion.div
          initial={{ opacity: 0, y: -2 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.12 }}
          className="absolute left-0 top-11 w-56 bg-card border border-foreground/15 rounded-xl shadow-xl z-50 overflow-hidden py-1.5"
        >
          {PLATFORM_CONFIGS.map(p => {
            const isActive = p.id === activePlatform
            const isSuggested = p.id === 'youtube' || p.id === 'instagram' || p.id === 'twitter'
            return (
              <button
                key={p.id}
                onClick={() => { onChange(p.id); setOpen(false) }}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 text-left text-sm transition-colors ${
                  isActive
                    ? 'bg-muted text-foreground'
                    : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground'
                }`}
              >
                {/* Match the trigger's bigger logo so the dropdown
                    feels like a peer of the closed pill, not a smaller
                    cousin. */}
                <PlatformIcon id={p.id} className="w-5 h-5 shrink-0" colored />
                <span className="font-medium">{p.label}</span>
                {isSuggested && (
                  <span className="text-[10px] text-muted-foreground/70 ml-1">(suggested)</span>
                )}
                {isActive && (
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5 ml-auto text-purple-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </button>
            )
          })}
        </motion.div>
      )}
    </div>
  )
}
