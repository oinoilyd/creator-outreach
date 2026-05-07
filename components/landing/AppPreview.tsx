'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { ChevronLeft, ChevronRight, Search, KanbanSquare, MailPlus, BarChart3 } from 'lucide-react'
import { ScreenshotFrame } from '@/components/ui/screenshot-frame'

/**
 * Hero product preview — 4-tab carousel showing real screenshots of
 * the live app inside a Mac-style browser frame. Replaces the old
 * SVG mocks (which don't match the actual UI). Dark screenshots on a
 * light landing page is a deliberate Linear/Vercel-style choice —
 * the contrast is the polish.
 */
type View = 'results' | 'outreach' | 'followups' | 'analytics'

const VIEWS: { id: View; label: string; sub: string; src: string; Icon: typeof Search }[] = [
  {
    id: 'results',
    label: 'Results',
    sub: 'Search every platform · score by fit',
    src: '/screenshots/results.png',
    Icon: Search,
  },
  {
    id: 'outreach',
    label: 'Outreach',
    sub: 'Track status, email, medium per lead',
    src: '/screenshots/outreach.png',
    Icon: KanbanSquare,
  },
  {
    id: 'followups',
    label: 'Follow-ups',
    sub: 'Auto-cadence keeps your queue sharp',
    src: '/screenshots/followups.png',
    Icon: MailPlus,
  },
  {
    id: 'analytics',
    label: 'Analytics',
    sub: 'Win rate, response rate, pipeline value',
    src: '/screenshots/analytics.png',
    Icon: BarChart3,
  },
]

export function AppPreview() {
  // Default to the first tab (Results). Dylan's note: "default it to be
  // at the top when loaded not the first visual" — landing on tab 0
  // (Results) instead of tab 1 (Outreach) so the carousel reads
  // top-to-bottom, left-to-right.
  const [idx, setIdx] = useState(0)
  const [direction, setDirection] = useState<1 | -1>(1)
  const view = VIEWS[idx]

  function go(delta: number) {
    setDirection(delta > 0 ? 1 : -1)
    setIdx((i) => (i + delta + VIEWS.length) % VIEWS.length)
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 40 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.9, delay: 0.6, ease: 'easeOut' }}
      className="relative mx-auto w-full max-w-5xl"
    >
      {/* Outer glow — violet + cyan wash to lift the dark screenshot
          off the dark page background */}
      <div className="absolute inset-x-0 -inset-y-8 bg-gradient-to-r from-brand/35 via-brand-2/25 to-brand/30 blur-3xl pointer-events-none" />

      {/* Tab pills above the frame */}
      <div className="relative flex items-center justify-center gap-1.5 mb-4 flex-wrap">
        {VIEWS.map((v, i) => {
          const Icon = v.Icon
          const active = i === idx
          return (
            <button
              key={v.id}
              onClick={() => {
                setDirection(i > idx ? 1 : -1)
                setIdx(i)
              }}
              className={
                'group inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all border ' +
                (active
                  ? 'bg-primary text-primary-foreground border-primary shadow-[0_0_24px_-4px_rgba(124,58,237,0.6)]'
                  : 'bg-card text-muted-foreground hover:text-foreground border-border hover:border-brand/40 dark:bg-white/5 dark:border-white/10 dark:hover:border-white/30')
              }
            >
              <Icon className="w-3.5 h-3.5" />
              {v.label}
            </button>
          )
        })}
      </div>

      {/* Framed screenshot carousel */}
      <div className="relative">
        {/* Live-preview pulsing dot — top-right of the screenshot frame.
            Signals "this is real product, not a stock screenshot." */}
        <div className="absolute top-3 right-3 z-20 flex items-center gap-2 px-2.5 py-1 rounded-full bg-black/40 backdrop-blur-md border border-white/10">
          <span className="relative flex h-2 w-2">
            <span className="animate-live-pulse absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400" />
          </span>
          <span className="text-[10px] uppercase tracking-[0.15em] text-white/80 font-medium">Live</span>
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={view.id}
            initial={{ opacity: 0, x: direction * 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: direction * -24 }}
            transition={{ duration: 0.35, ease: 'easeOut' }}
          >
            <ScreenshotFrame
              src={view.src}
              alt={`${view.label} view of Creator Outreach`}
            />
          </motion.div>
        </AnimatePresence>

        {/* Prev arrow */}
        <button
          onClick={() => go(-1)}
          aria-label="Previous view"
          className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-1/2 md:-translate-x-full w-10 h-10 rounded-full bg-card border border-border hover:border-brand/40 hover:bg-card text-muted-foreground hover:text-foreground flex items-center justify-center transition-colors shadow-lg dark:bg-card/80 dark:backdrop-blur-md dark:border-white/10 dark:hover:border-white/30"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>

        {/* Next arrow */}
        <button
          onClick={() => go(1)}
          aria-label="Next view"
          className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 md:translate-x-full w-10 h-10 rounded-full bg-card border border-border hover:border-brand/40 hover:bg-card text-muted-foreground hover:text-foreground flex items-center justify-center transition-colors shadow-lg dark:bg-card/80 dark:backdrop-blur-md dark:border-white/10 dark:hover:border-white/30"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>

      {/* Caption + dots */}
      <div className="flex items-center justify-center gap-3 mt-6">
        <div className="flex gap-1.5">
          {VIEWS.map((v, i) => (
            <button
              key={v.id}
              onClick={() => {
                setDirection(i > idx ? 1 : -1)
                setIdx(i)
              }}
              aria-label={`Show ${v.label}`}
              className={`h-1.5 rounded-full transition-all ${
                i === idx ? 'w-8 bg-primary' : 'w-1.5 bg-white/20 hover:bg-white/40'
              }`}
            />
          ))}
        </div>
      </div>
      <div className="text-center mt-3 text-[12px] text-muted-foreground">
        <span className="text-foreground font-medium">{view.label}</span>
        <span className="text-muted-foreground/60 mx-1.5">·</span>
        <span>{view.sub}</span>
      </div>
    </motion.div>
  )
}
