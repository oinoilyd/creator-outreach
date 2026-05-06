'use client'

import Link from 'next/link'
import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { ThemeToggle } from '@/components/ThemeToggle'

// Top-of-page navigation for the public landing site.
// Hamburger holds secondary nav (About / Pricing / FAQ / Contact + auth);
// "Get started" / "Open app" stays inline as the primary CTA so the
// conversion path doesn't disappear behind a menu.
export function LandingNav({ isAuthed }: { isAuthed: boolean }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    if (open) document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [open])

  async function signOut() {
    setOpen(false)
    await fetch('/auth/signout', { method: 'POST' })
    window.location.href = '/'
  }

  // Anchor links for marketing sections — both states get these.
  const sectionItems = [
    { label: 'About', href: '#about' },
    { label: 'Pricing', href: '#pricing' },
    { label: 'FAQ', href: '#faq' },
    { label: 'Contact', href: '#contact' },
  ]

  return (
    <header className="relative z-30 px-6 py-5 flex items-center justify-between max-w-6xl w-full mx-auto">
      <Link href="/" className="flex items-center gap-2">
        <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-purple-600 to-blue-600 flex items-center justify-center text-sm font-bold text-white">C</div>
        <span className="font-semibold tracking-tight">Creator Outreach</span>
      </Link>

      <div className="flex items-center gap-2">
        <ThemeToggle />

        <Link
          href={isAuthed ? '/' : '/auth/signup'}
          className="text-sm bg-gray-900 text-white hover:bg-gray-800 dark:bg-white dark:text-gray-950 dark:hover:bg-gray-200 px-4 py-2 rounded-lg font-medium transition-colors"
        >
          {isAuthed ? 'Open app' : 'Get started'}
        </Link>

        <div ref={ref} className="relative">
          <button
            onClick={() => setOpen(v => !v)}
            aria-label="Open menu"
            aria-expanded={open}
            className={`flex flex-col gap-1.5 p-2 rounded-lg border transition-colors ${open ? 'bg-gray-100 dark:bg-white/10 border-gray-300 dark:border-white/20 text-gray-900 dark:text-white' : 'bg-transparent border-gray-200 dark:border-white/10 text-gray-700 dark:text-gray-300 hover:border-gray-300 dark:hover:border-white/20'}`}
          >
            <span className="block w-5 h-px bg-current rounded" />
            <span className="block w-5 h-px bg-current rounded" />
            <span className="block w-5 h-px bg-current rounded" />
          </button>

          <AnimatePresence>
            {open && (
              <motion.div
                initial={{ opacity: 0, y: -8, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -8, scale: 0.96 }}
                transition={{ type: 'spring', bounce: 0.18, duration: 0.3 }}
                className="absolute right-0 top-12 w-56 bg-white/95 dark:bg-gray-900/95 backdrop-blur-xl border border-gray-200 dark:border-white/10 rounded-xl shadow-2xl shadow-black/10 dark:shadow-black/40 z-50 overflow-hidden py-1"
              >
                {/* Section anchors */}
                {sectionItems.map(item => (
                  <a
                    key={item.href}
                    href={item.href}
                    onClick={() => setOpen(false)}
                    className="block px-4 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/5 hover:text-gray-900 dark:hover:text-white transition-colors"
                  >
                    {item.label}
                  </a>
                ))}

                <div className="mx-4 my-1 border-t border-gray-200 dark:border-white/10" />

                {/* Auth row */}
                {isAuthed ? (
                  <>
                    <Link
                      href="/"
                      onClick={() => setOpen(false)}
                      className="block px-4 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/5 hover:text-gray-900 dark:hover:text-white transition-colors"
                    >
                      Open app
                    </Link>
                    <button
                      onClick={signOut}
                      className="w-full text-left block px-4 py-2.5 text-sm text-red-700 dark:text-red-300 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
                    >
                      Sign out
                    </button>
                  </>
                ) : (
                  <>
                    <Link
                      href="/auth/signin"
                      onClick={() => setOpen(false)}
                      className="block px-4 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/5 hover:text-gray-900 dark:hover:text-white transition-colors"
                    >
                      Sign in
                    </Link>
                    <Link
                      href="/auth/signup"
                      onClick={() => setOpen(false)}
                      className="block px-4 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/5 hover:text-gray-900 dark:hover:text-white transition-colors"
                    >
                      Sign up
                    </Link>
                  </>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </header>
  )
}
