'use client'

/**
 * PlatformDropdown — the "Find [LOGO] creators" affordance in the
 * top banner.
 *
 * 2026-05-10 redesign per Dylan: when a platform is selected, the
 * button shows ONLY that platform's brand logo (no label text) —
 * smooth scale+fade transition on platform change. Each platform
 * has its own brand-tinted ring + background so the button is
 * instantly recognizable at a glance. The dropdown options still
 * carry text labels for clarity at selection time.
 */

import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import type { PlatformId } from '@/lib/types'
import { PLATFORM_CONFIGS } from '@/lib/platform'
import { PlatformIcon } from './ui'

// Per-brand visual treatment for the trigger button. Subtle ring +
// background gradient — strong enough to feel branded, soft enough
// to fit the rest of the UI.
const PLATFORM_THEME: Record<PlatformId, { ring: string; bg: string; hoverBg: string; glow: string; label: string }> = {
  youtube:   { ring: 'ring-red-500/30',     bg: 'bg-gradient-to-br from-red-500/15 to-red-500/5',          hoverBg: 'hover:from-red-500/25 hover:to-red-500/10',          glow: 'shadow-red-500/20',    label: 'YouTube' },
  instagram: { ring: 'ring-pink-500/30',    bg: 'bg-gradient-to-br from-pink-500/15 via-orange-400/10 to-purple-500/10', hoverBg: 'hover:from-pink-500/25 hover:to-purple-500/15', glow: 'shadow-pink-500/20',   label: 'Instagram' },
  tiktok:    { ring: 'ring-cyan-500/30',    bg: 'bg-gradient-to-br from-cyan-500/15 to-pink-500/10',       hoverBg: 'hover:from-cyan-500/25 hover:to-pink-500/15',       glow: 'shadow-cyan-500/20',   label: 'TikTok' },
  twitter:   { ring: 'ring-foreground/25',  bg: 'bg-gradient-to-br from-foreground/15 to-foreground/5',    hoverBg: 'hover:from-foreground/25 hover:to-foreground/10',   glow: 'shadow-foreground/15', label: 'X' },
  linkedin:  { ring: 'ring-blue-500/30',    bg: 'bg-gradient-to-br from-blue-600/15 to-blue-500/5',        hoverBg: 'hover:from-blue-600/25 hover:to-blue-500/10',       glow: 'shadow-blue-500/20',   label: 'LinkedIn' },
}

export function PlatformDropdown({ activePlatform, onChange }: { activePlatform: PlatformId; onChange: (id: PlatformId) => void }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const active = PLATFORM_CONFIGS.find(p => p.id === activePlatform)!
  const theme = PLATFORM_THEME[activePlatform]

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
        className={`group relative inline-flex items-center gap-2 h-9 px-3 leading-none font-semibold rounded-xl border border-border transition-all shadow-sm ${theme.bg} ${theme.hoverBg} ${theme.glow} hover:shadow-lg hover:scale-[1.02] ring-1 ${theme.ring}`}
      >
        {/* Logo — large, brand-colored. Animated swap on platform change. */}
        <AnimatePresence mode="wait" initial={false}>
          <motion.span
            key={activePlatform}
            initial={{ opacity: 0, scale: 0.6, rotate: -8 }}
            animate={{ opacity: 1, scale: 1, rotate: 0 }}
            exit={{ opacity: 0, scale: 0.6, rotate: 8 }}
            transition={{ type: 'spring', stiffness: 360, damping: 22, mass: 0.6 }}
            className="inline-flex items-center justify-center"
          >
            <PlatformIcon id={activePlatform} className="w-5 h-5" colored />
          </motion.span>
        </AnimatePresence>

        {/* Tiny chevron — signals "this is interactive" without crowding the logo */}
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className={`w-3 h-3 text-muted-foreground transition-transform ${open ? 'rotate-180' : 'group-hover:translate-y-0.5'}`}
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
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.15 }}
          className="absolute left-0 top-10 w-56 bg-card border border-border rounded-xl shadow-2xl z-50 overflow-hidden py-1"
        >
          {PLATFORM_CONFIGS.map(p => {
            const opt = PLATFORM_THEME[p.id]
            return (
              <button
                key={p.id}
                onClick={() => { onChange(p.id); setOpen(false) }}
                className={`w-full flex items-center gap-3 px-4 py-2.5 text-left text-sm transition-colors ${
                  p.id === activePlatform
                    ? 'bg-muted text-foreground'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                }`}
              >
                <span className={`inline-flex items-center justify-center w-7 h-7 rounded-lg ${opt.bg} ring-1 ${opt.ring}`}>
                  <PlatformIcon id={p.id} className="w-4 h-4 shrink-0" colored />
                </span>
                <span className="font-medium">{opt.label}</span>
                {(p.id === 'youtube' || p.id === 'instagram' || p.id === 'twitter') && (
                  <span className="text-[10px] text-emerald-700 dark:text-emerald-400 ml-1 font-semibold uppercase tracking-wider">High ROI</span>
                )}
                {p.id === activePlatform && (
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
