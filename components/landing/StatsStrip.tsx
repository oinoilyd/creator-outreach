'use client'

import { NumberTicker } from '@/components/ui/number-ticker'

/**
 * Stat strip — sits between the hero and the feature bento. Four
 * animated counters that tick up when scrolled into view, giving the
 * page a moment of "this is real" between the headline and the
 * details. Numbers reflect actual product capability:
 *   - 5 platforms (YT / IG / TT / X / LI)
 *   - 13 niche buckets (Fitness, Legal, Tech, etc.)
 *   - 30+ search queries auto-generated per request
 *   - $0 pricing
 */
const STATS: { value: number; suffix?: string; prefix?: string; label: string }[] = [
  { value: 5,  label: 'platforms' },
  { value: 13, label: 'niche buckets' },
  { value: 30, suffix: '+', label: 'queries / search' },
  { value: 0,  prefix: '$', label: 'while in beta' },
]

export function StatsStrip() {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white/80 backdrop-blur-md px-4 md:px-8 py-6 md:py-8 grid grid-cols-2 md:grid-cols-4 gap-y-6 shadow-[0_10px_40px_-20px_rgba(76,29,149,0.15)]">
      {STATS.map((s) => (
        <div key={s.label} className="text-center">
          <div className="text-3xl md:text-4xl font-bold tracking-tight text-purple-700">
            {s.prefix}
            <NumberTicker value={s.value} />
            {s.suffix}
          </div>
          <div className="text-xs md:text-sm text-gray-500 mt-1">{s.label}</div>
        </div>
      ))}
    </div>
  )
}
