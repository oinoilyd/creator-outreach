'use client'

/**
 * PlatformDropdown — the "Find [LOGO] creators" affordance in the
 * top banner.
 *
 * Design history:
 *   v1: gradient bg + glow + scale+rotate spring + "HIGH ROI" tag
 *       — too cheesy for an in-app control (Dylan)
 *   v2: stripped everything, h-8 with neutral border + bare icon
 *       — too restrained, "STILL NO POP"
 *   v3: h-10 with bigger 22px icon, brand-color icons against neutral
 *       — "colors kinda feel out of place", transition too slow
 *   v4 (this): icon contained in a brand-tinted soft ring so the
 *       color reads as intentional UI ornament, not a sticker. Faster
 *       transition (no scale, ~70ms opacity only). Pill itself stays
 *       muted; the ring is what carries the brand hint.
 */

import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import type { PlatformId } from '@/lib/types'
import { PLATFORM_CONFIGS } from '@/lib/platform'
import { PlatformIcon } from './ui'

// Soft per-platform ring tint that frames the icon. Low-opacity
// background + matching border makes the brand color feel like an
// intentional UI ornament rather than a colorful sticker. Same brand
// hue as the icon itself, so they read as one composed unit.
const ICON_FRAME: Record<PlatformId, string> = {
  youtube:   'bg-red-500/10 ring-1 ring-red-500/25',
  instagram: 'bg-pink-500/10 ring-1 ring-pink-500/25',
  tiktok:    'bg-cyan-500/10 ring-1 ring-cyan-500/25',
  twitter:   'bg-foreground/10 ring-1 ring-foreground/20',
  linkedin:  'bg-blue-500/10 ring-1 ring-blue-500/25',
}

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
        className="group inline-flex items-center gap-2 h-10 pl-1.5 pr-2.5 rounded-xl border border-foreground/15 bg-card hover:border-foreground/40 transition-colors"
      >
        {/* Brand-tinted ring frames the icon — the color now reads
            as intentional UI ornament rather than a loose sticker.
            Inline-block + flex centering keeps the icon perfectly
            optical-center inside the 28px frame. */}
        <AnimatePresence mode="wait" initial={false}>
          <motion.span
            key={activePlatform}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.07, ease: 'easeOut' }}
            className={`inline-flex items-center justify-center w-7 h-7 rounded-lg shrink-0 ${ICON_FRAME[activePlatform]}`}
          >
            <PlatformIcon id={activePlatform} className="w-[18px] h-[18px]" colored />
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
                className={`w-full flex items-center gap-3 px-3.5 py-2 text-left text-sm transition-colors ${
                  isActive
                    ? 'bg-muted text-foreground'
                    : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground'
                }`}
              >
                {/* Same ring treatment as the trigger so the dropdown
                    visually links back to the closed state. */}
                <span className={`inline-flex items-center justify-center w-7 h-7 rounded-lg shrink-0 ${ICON_FRAME[p.id]}`}>
                  <PlatformIcon id={p.id} className="w-[18px] h-[18px]" colored />
                </span>
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
