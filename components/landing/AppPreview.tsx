'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { ResultsPreview } from './ResultsPreview'
import { FollowUpsPreview } from './FollowUpsPreview'
import { AnalyticsPreview } from './AnalyticsPreview'

type View = 'results' | 'followups' | 'analytics'

const VIEWS: { id: View; label: string; sub: string }[] = [
  { id: 'results',    label: 'Results',    sub: 'Discover the right creators' },
  { id: 'followups',  label: 'Follow-ups', sub: 'Stay on top of every lead' },
  { id: 'analytics',  label: 'Analytics',  sub: 'See what is actually working' },
]

export function AppPreview() {
  const [idx, setIdx] = useState(0)
  const [direction, setDirection] = useState<1 | -1>(1)
  const view = VIEWS[idx]

  function go(delta: number) {
    setDirection(delta > 0 ? 1 : -1)
    setIdx(i => (i + delta + VIEWS.length) % VIEWS.length)
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 40 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.9, delay: 0.6, ease: 'easeOut' }}
      className="relative mx-auto w-full max-w-4xl"
    >
      {/* Outer glow */}
      <div className="absolute inset-x-0 -inset-y-6 bg-gradient-to-r from-purple-600/30 via-blue-600/20 to-pink-600/20 blur-3xl pointer-events-none" />

      {/* Carousel */}
      <div className="relative">
        <div className="relative">
          <AnimatePresence mode="wait">
            <motion.div
              key={view.id}
              initial={{ opacity: 0, x: direction * 24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: direction * -24 }}
              transition={{ duration: 0.35, ease: 'easeOut' }}
            >
              {view.id === 'results' && <ResultsPreview />}
              {view.id === 'followups' && <FollowUpsPreview />}
              {view.id === 'analytics' && <AnalyticsPreview />}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Prev arrow */}
        <button
          onClick={() => go(-1)}
          aria-label="Previous view"
          className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-1/2 md:-translate-x-full w-10 h-10 rounded-full bg-white backdrop-blur-md border border-gray-200 hover:border-purple-300 hover:bg-purple-50 text-gray-600 hover:text-purple-700 flex items-center justify-center transition-colors shadow-lg dark:bg-gray-900/80 dark:border-white/10 dark:text-gray-300 dark:hover:text-white"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>

        {/* Next arrow */}
        <button
          onClick={() => go(1)}
          aria-label="Next view"
          className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 md:translate-x-full w-10 h-10 rounded-full bg-white backdrop-blur-md border border-gray-200 hover:border-purple-300 hover:bg-purple-50 text-gray-600 hover:text-purple-700 flex items-center justify-center transition-colors shadow-lg dark:bg-gray-900/80 dark:border-white/10 dark:text-gray-300 dark:hover:text-white"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>

      {/* Pagination dots + label */}
      <div className="flex items-center justify-center gap-3 mt-6">
        <div className="flex gap-1.5">
          {VIEWS.map((v, i) => (
            <button
              key={v.id}
              onClick={() => { setDirection(i > idx ? 1 : -1); setIdx(i) }}
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
