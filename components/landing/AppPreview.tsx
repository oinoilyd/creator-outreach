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
  const [idx, setIdx] = useState(1) // start on Outreach — strongest CRM visual
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
      {/* Outer glow — purple/blue/pink wash to lift the dark screenshot
          off the light page background */}
      <div className="absolute inset-x-0 -inset-y-8 bg-gradient-to-r from-purple-500/30 via-blue-500/25 to-pink-500/25 blur-3xl pointer-events-none" />

      {/* Tab pills above the frame */}
      <div className="relative flex items-center justify-center gap-1.5 mb-4">
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
                  ? 'bg-purple-600 text-white border-purple-600 shadow-sm'
                  : 'bg-white text-gray-600 hover:text-gray-900 border-gray-200 hover:border-purple-300')
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
              url={`creatoroutreach.net/${view.id === 'results' ? '' : view.id}`}
            />
          </motion.div>
        </AnimatePresence>

        {/* Prev arrow */}
        <button
          onClick={() => go(-1)}
          aria-label="Previous view"
          className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-1/2 md:-translate-x-full w-10 h-10 rounded-full bg-white border border-gray-200 hover:border-purple-300 hover:bg-purple-50 text-gray-600 hover:text-purple-700 flex items-center justify-center transition-colors shadow-lg"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>

        {/* Next arrow */}
        <button
          onClick={() => go(1)}
          aria-label="Next view"
          className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 md:translate-x-full w-10 h-10 rounded-full bg-white border border-gray-200 hover:border-purple-300 hover:bg-purple-50 text-gray-600 hover:text-purple-700 flex items-center justify-center transition-colors shadow-lg"
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
                i === idx ? 'w-8 bg-purple-600' : 'w-1.5 bg-gray-300 hover:bg-gray-400'
              }`}
            />
          ))}
        </div>
      </div>
      <div className="text-center mt-3 text-[12px] text-gray-500">
        <span className="text-gray-900 font-medium">{view.label}</span>
        <span className="text-gray-400 mx-1.5">·</span>
        <span>{view.sub}</span>
      </div>
    </motion.div>
  )
}
