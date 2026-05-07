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
    <header className="relative z-30 px-6 py-5 flex items-center justify-between max-w-[1400px] w-full mx-auto">
      <Link href="/landing" className="flex items-center gap-2">
        <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-purple-600 to-blue-600 flex items-center justify-center text-sm font-bold text-white">C</div>
        <span className="font-semibold tracking-tight">Creator Outreach</span>
      </Link>

      <div className="flex items-center gap-2">
        <ThemeToggle />

        <Link
          href={isAuthed ? '/' : '/auth/signup'}
          className="text-sm bg-primary text-primary-foreground hover:opacity-90 px-4 py-2 rounded-lg font-medium transition-opacity"
        >
          {isAuthed ? 'Open app' : 'Get started'}
        </Link>

        <div ref={ref} className="relative">
          <button
            onClick={() => setOpen(v => !v)}
            aria-label="Open menu"
            aria-expanded={open}
            className={`flex flex-col gap-1.5 p-2 rounded-lg border transition-colors ${open ? 'bg-muted border-border text-foreground' : 'bg-transparent border-border text-muted-foreground hover:border-brand/40 hover:text-foreground dark:border-white/10 dark:hover:border-white/20'}`}
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
                className="absolute right-0 top-12 w-56 bg-card border border-border rounded-xl shadow-2xl shadow-black/10 dark:shadow-black/40 dark:bg-card/95 dark:backdrop-blur-xl dark:border-white/10 z-50 overflow-hidden py-1"
              >
                {/* Section anchors */}
                {sectionItems.map(item => (
                  <a
                    key={item.href}
                    href={item.href}
                    onClick={() => setOpen(false)}
                    className="block px-4 py-2.5 text-sm text-muted-foreground hover:bg-muted hover:text-foreground dark:hover:bg-white/5 transition-colors"
                  >
                    {item.label}
                  </a>
                ))}

                <div className="mx-4 my-1 border-t border-border dark:border-white/10" />

                {/* Auth row */}
                {isAuthed ? (
                  <>
                    <Link
                      href="/"
                      onClick={() => setOpen(false)}
                      className="block px-4 py-2.5 text-sm text-muted-foreground hover:bg-muted hover:text-foreground dark:hover:bg-white/5 transition-colors"
                    >
                      Open app
                    </Link>
                    <button
                      onClick={signOut}
                      className="w-full text-left block px-4 py-2.5 text-sm text-red-300 hover:bg-red-500/10 transition-colors"
                    >
                      Sign out
                    </button>
                  </>
                ) : (
                  <>
                    <Link
                      href="/auth/signin"
                      onClick={() => setOpen(false)}
                      className="block px-4 py-2.5 text-sm text-muted-foreground hover:bg-muted hover:text-foreground dark:hover:bg-white/5 transition-colors"
                    >
                      Sign in
                    </Link>
                    <Link
                      href="/auth/signup"
                      onClick={() => setOpen(false)}
                      className="block px-4 py-2.5 text-sm text-muted-foreground hover:bg-muted hover:text-foreground dark:hover:bg-white/5 transition-colors"
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
