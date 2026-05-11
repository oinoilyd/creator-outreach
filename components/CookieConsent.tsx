'use client'

/**
 * CookieConsent — GDPR-style banner shown on first visit.
 *
 * Displays a small bottom-anchored sheet asking the user to accept
 * or reject non-essential cookies. Choice is persisted in localStorage
 * under `cookie-consent` (`accepted` | `rejected`). Subsequent visits
 * skip the banner.
 *
 * Implementation notes:
 *   - Pure client component; rendered from app/layout.tsx so it
 *     appears on every page.
 *   - SSR-safe: reads localStorage only after mount (useEffect).
 *   - Doesn't actually fire any analytics yet — we don't run third-
 *     party analytics. Banner exists so consent is captured for when
 *     we do, and so we satisfy GDPR's "ask first" requirement up
 *     front.
 */

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { AnimatePresence, motion } from 'motion/react'

type ConsentChoice = 'accepted' | 'rejected'

const STORAGE_KEY = 'cookie-consent'

export function CookieConsent() {
  // `null` = not yet decided; 'accepted' | 'rejected' = decided.
  const [choice, setChoice] = useState<ConsentChoice | null>(null)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    if (typeof window === 'undefined') return
    const saved = window.localStorage.getItem(STORAGE_KEY) as ConsentChoice | null
    if (saved === 'accepted' || saved === 'rejected') {
      setChoice(saved)
    }
  }, [])

  function persist(value: ConsentChoice) {
    setChoice(value)
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(STORAGE_KEY, value)
    }
  }

  // Don't render anything during SSR or if user has already decided.
  if (!mounted) return null
  if (choice !== null) return null

  return (
    <AnimatePresence>
      <motion.div
        key="cookie-banner"
        initial={{ y: 80, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 80, opacity: 0 }}
        transition={{ duration: 0.3, ease: 'easeOut' }}
        role="dialog"
        aria-label="Cookie consent"
        className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:bottom-4 md:max-w-md z-[60]"
      >
        <div className="rounded-2xl border border-border bg-card/95 backdrop-blur-xl shadow-2xl shadow-black/30 p-5">
          <div className="flex items-start gap-3 mb-4">
            <div className="w-8 h-8 rounded-full bg-purple-500/15 flex items-center justify-center shrink-0 mt-0.5">
              {/* Cookie icon */}
              <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-purple-600 dark:text-purple-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 11-9-9c0 1.5.5 3 2 3a1 1 0 011 1c0 1.5 1 2 2 2a1 1 0 011 1c0 1.5 1 2 3 2z" />
                <circle cx="9" cy="10" r="0.8" fill="currentColor" />
                <circle cx="13" cy="14" r="0.8" fill="currentColor" />
                <circle cx="16" cy="9" r="0.8" fill="currentColor" />
              </svg>
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="text-sm font-semibold text-foreground mb-1">Cookies</h3>
              <p className="text-[13px] leading-relaxed text-muted-foreground">
                We use essential cookies to keep you signed in and remember your preferences. We don&rsquo;t use marketing or tracking cookies.{' '}
                <Link href="/cookies" className="text-foreground underline underline-offset-2 hover:opacity-80">
                  Learn more
                </Link>
                .
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => persist('rejected')}
              className="flex-1 px-3 py-2 text-[13px] font-medium rounded-lg border border-border text-muted-foreground hover:text-foreground hover:border-foreground/40 transition-colors"
            >
              Reject non-essential
            </button>
            <button
              type="button"
              onClick={() => persist('accepted')}
              className="flex-1 px-3 py-2 text-[13px] font-semibold rounded-lg bg-purple-600 hover:bg-purple-700 text-white transition-colors"
            >
              Accept all
            </button>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  )
}
