'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'motion/react'

const FAQS: { q: string; a: string }[] = [
  {
    q: 'What is Creator Outreach?',
    a: 'A tool for finding creators across YouTube, Instagram, TikTok, X, and LinkedIn, and running your outreach pipeline — search, score by fit, pitch, follow up, and track results in one place.',
  },
  {
    q: 'How is it different from a spreadsheet?',
    a: 'It does the search for you, ranks leads by criteria you describe in plain English, and schedules follow-ups automatically based on where each lead is in your pipeline. The spreadsheet just sits there.',
  },
  {
    q: "What's the pricing?",
    a: '$50/mo or $500/yr (save 17%). Every plan includes a 14-day free trial — no charges until your trial ends, and you can cancel anytime from the customer portal.',
  },
  {
    q: 'Do I need an API key for any of the platforms?',
    a: 'No. Search runs through the tool — you don\'t manage credentials.',
  },
  {
    q: 'Can I import my existing outreach?',
    a: 'Yes — paste a CSV or .xlsx and your existing leads land in your pipeline with their statuses preserved.',
  },
  {
    q: 'Is my data private?',
    a: 'Yes. Each user\'s data is isolated by row-level security in the database — no one else can see your leads, even other users on the same instance.',
  },
]

export function FAQ() {
  const [openIdx, setOpenIdx] = useState<number | null>(0)

  return (
    <div className="space-y-2">
      {FAQS.map((item, i) => {
        const isOpen = openIdx === i
        return (
          <div
            key={i}
            className="border border-border rounded-lg bg-card overflow-hidden dark:bg-white/[0.04] dark:backdrop-blur-md dark:border-white/10"
          >
            <button
              onClick={() => setOpenIdx(isOpen ? null : i)}
              className="w-full flex items-center justify-between gap-4 px-5 py-4 text-left hover:bg-muted/60 dark:hover:bg-white/[0.06] transition-colors"
            >
              <span className="text-sm md:text-base font-medium text-foreground">{item.q}</span>
              <motion.span
                animate={{ rotate: isOpen ? 45 : 0 }}
                transition={{ duration: 0.2 }}
                className="shrink-0 text-muted-foreground text-xl leading-none"
              >
                +
              </motion.span>
            </button>
            <AnimatePresence initial={false}>
              {isOpen && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2, ease: 'easeOut' }}
                  className="overflow-hidden"
                >
                  <div className="px-5 pb-4 text-sm text-muted-foreground leading-relaxed">
                    {item.a}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )
      })}
    </div>
  )
}
