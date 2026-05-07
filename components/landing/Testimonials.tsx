'use client'

import { Marquee } from '@/components/ui/marquee'
import { cn } from '@/lib/utils'

/**
 * Two-row testimonial marquee. Top row scrolls left, bottom scrolls
 * right (different speeds), pausing on hover. All quotes here are
 * placeholder-but-honest — written from the perspective of indie
 * founders / agency operators / creators who would actually use the
 * tool. Replace with real testimonials once you have them.
 */
type Testimonial = {
  name: string
  role: string
  quote: string
  initials: string
  tint: string
}

const TESTIMONIALS: Testimonial[] = [
  {
    name: 'Maya R.',
    role: 'Indie founder · DTC fitness brand',
    quote: 'Replaced my outreach spreadsheet, three browser tabs, and a Notion page that was always out of date. Score chips alone saved me an hour a day.',
    initials: 'MR',
    tint: 'from-purple-500 to-pink-500',
  },
  {
    name: 'Devon K.',
    role: 'Growth lead · SaaS',
    quote: 'The AI fit scoring is the cheat code. I pasted my ideal-customer profile in plain English and the queue re-sorted to match. No spreadsheet I built ever did that.',
    initials: 'DK',
    tint: 'from-blue-500 to-cyan-500',
  },
  {
    name: 'Priya S.',
    role: 'Agency owner',
    quote: 'I run outreach for five clients. The CRM-by-client view + automatic follow-up cadence cut my Monday admin from 3 hours to maybe 30 minutes.',
    initials: 'PS',
    tint: 'from-emerald-500 to-teal-500',
  },
  {
    name: 'Sam L.',
    role: 'Creator · 80k YouTube',
    quote: 'I use it from the other side too — searching for collab partners. The Last Video / Last Short split is genuinely useful for filtering ghosts.',
    initials: 'SL',
    tint: 'from-amber-500 to-orange-500',
  },
  {
    name: 'Jordan T.',
    role: 'BD · Creator agency',
    quote: 'Replaces the $400/mo tools I was using to find creators. The follow-up cadence reminders alone justify it.',
    initials: 'JT',
    tint: 'from-violet-500 to-fuchsia-500',
  },
  {
    name: 'Ava M.',
    role: 'Founder · early-stage SaaS',
    quote: 'Honest review: the email-finding hit rate isn\'t 100%. But it\'s 70%+ on the platforms I care about, and the workflow around it makes the rest fast.',
    initials: 'AM',
    tint: 'from-rose-500 to-red-500',
  },
]

function Card({ t }: { t: Testimonial }) {
  return (
    <figure
      className={cn(
        'relative h-full w-72 cursor-default overflow-hidden rounded-xl border p-4',
        'border-gray-200 bg-white hover:bg-gray-50',
        'transition-colors',
      )}
    >
      <div className="flex flex-row items-center gap-2">
        <div
          className={cn(
            'h-8 w-8 rounded-full bg-gradient-to-br text-[11px] text-white flex items-center justify-center font-semibold',
            t.tint,
          )}
        >
          {t.initials}
        </div>
        <div className="flex flex-col">
          <figcaption className="text-sm font-medium text-gray-900">{t.name}</figcaption>
          <p className="text-xs text-gray-500">{t.role}</p>
        </div>
      </div>
      <blockquote className="mt-3 text-sm leading-relaxed text-gray-700">{t.quote}</blockquote>
    </figure>
  )
}

export function Testimonials() {
  const firstRow = TESTIMONIALS.slice(0, TESTIMONIALS.length / 2)
  const secondRow = TESTIMONIALS.slice(TESTIMONIALS.length / 2)
  return (
    <div className="relative flex w-full flex-col items-center justify-center overflow-hidden">
      <Marquee pauseOnHover className="[--duration:50s]">
        {firstRow.map((t) => (
          <Card key={t.name} t={t} />
        ))}
      </Marquee>
      <Marquee reverse pauseOnHover className="[--duration:60s]">
        {secondRow.map((t) => (
          <Card key={t.name} t={t} />
        ))}
      </Marquee>
      {/* Side fades so the marquee disappears into the page edges */}
      <div className="pointer-events-none absolute inset-y-0 left-0 w-1/6 bg-gradient-to-r from-[var(--background)]" />
      <div className="pointer-events-none absolute inset-y-0 right-0 w-1/6 bg-gradient-to-l from-[var(--background)]" />
    </div>
  )
}
