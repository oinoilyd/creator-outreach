'use client'

import Link from 'next/link'
import { useState, useRef, useEffect } from 'react'
import { ThemeToggle } from '@/components/ThemeToggle'

/**
 * Top nav for the production /landing page.
 *
 * Layout (left → right):
 *   - Logo + brand name
 *   - Inline section anchors (Product / Solutions / Customers /
 *     Pricing / Resources)  — desktop only
 *   - ThemeToggle (light/dark switch)  — always visible
 *   - Hamburger button (always visible, opens dropdown with utility
 *     links: Sign in, Talk to founder, mobile-only section anchors)
 *   - Primary CTA (Open app / Start free)
 *
 * Per Dylan: theme toggle sits next to the hamburger. Both visible
 * on every viewport, not just mobile.
 */
export function LandingTopNav({ isAuthed }: { isAuthed: boolean }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    if (open) document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [open])

  return (
    <header className="sticky top-0 z-40 bg-white/85 dark:bg-[#0A0E15]/85 backdrop-blur-md border-b border-[#0F1733]/8 dark:border-white/10">
      <div className="max-w-[1280px] mx-auto px-6 h-[64px] flex items-center justify-between">
        <Link href="/landing" className="flex items-center gap-2.5 shrink-0">
          <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-[#0F1733] dark:bg-[#F2A261] text-[#F2A261] dark:text-[#0F1733] text-[14px] font-bold">
            C
          </span>
          <span className="font-semibold tracking-[-0.01em] text-[16px] text-[#0F1733] dark:text-white">Creator Outreach</span>
        </Link>

        {/* Desktop section anchors */}
        <nav className="hidden md:flex items-center gap-6 text-[14px] text-[#0F1733]/70 dark:text-white/65 font-medium">
          <a href="#product"   className="hover:text-[#0F1733] dark:hover:text-white transition-colors">Product</a>
          <a href="#solutions" className="hover:text-[#0F1733] dark:hover:text-white transition-colors">Solutions</a>
          <a href="#customers" className="hover:text-[#0F1733] dark:hover:text-white transition-colors">Customers</a>
          <a href="#pricing"   className="hover:text-[#0F1733] dark:hover:text-white transition-colors">Pricing</a>
          <a href="mailto:dmeehanj@gmail.com" className="hover:text-[#0F1733] dark:hover:text-white transition-colors">Resources</a>
        </nav>

        <div className="flex items-center gap-1.5 shrink-0">
          {/* Theme toggle (left of hamburger) */}
          <ThemeToggle className="!border-[#0F1733]/15 hover:!border-[#0F1733]/40 !text-[#0F1733]/70 hover:!text-[#0F1733] dark:!border-white/15 dark:hover:!border-white/40 dark:!text-white/70 dark:hover:!text-white" />

          {/* Hamburger — always visible. Opens utility menu (Sign in,
              Talk to founder, mobile anchors). */}
          <div ref={ref} className="relative">
            <button
              onClick={() => setOpen(v => !v)}
              aria-label="Open menu"
              aria-expanded={open}
              className={`w-9 h-9 inline-flex items-center justify-center rounded-lg border transition-colors ${
                open
                  ? 'bg-[#0F1733]/5 dark:bg-white/10 border-[#0F1733]/20 dark:border-white/30 text-[#0F1733] dark:text-white'
                  : 'border-[#0F1733]/15 dark:border-white/15 text-[#0F1733]/70 dark:text-white/70 hover:border-[#0F1733]/40 dark:hover:border-white/40 hover:text-[#0F1733] dark:hover:text-white'
              }`}
            >
              <span className="flex flex-col gap-[3px]">
                <span className="block w-4 h-px bg-current" />
                <span className="block w-4 h-px bg-current" />
                <span className="block w-4 h-px bg-current" />
              </span>
            </button>

            {open && (
              <div className="absolute right-0 top-12 w-56 bg-white dark:bg-[#1A1F2E] border border-[#0F1733]/10 dark:border-white/10 rounded-xl shadow-2xl shadow-black/15 dark:shadow-black/40 z-50 overflow-hidden py-1">
                {/* Mobile-only anchors (hidden on desktop where they're inline) */}
                <div className="md:hidden py-1">
                  {[
                    { label: 'Product',    href: '#product' },
                    { label: 'Solutions',  href: '#solutions' },
                    { label: 'Customers',  href: '#customers' },
                    { label: 'Pricing',    href: '#pricing' },
                    { label: 'Resources',  href: 'mailto:dmeehanj@gmail.com' },
                  ].map(item => (
                    <a
                      key={item.href}
                      href={item.href}
                      onClick={() => setOpen(false)}
                      className="block px-4 py-2.5 text-[14px] text-[#0F1733]/75 dark:text-white/75 hover:bg-[#0F1733]/5 dark:hover:bg-white/5 hover:text-[#0F1733] dark:hover:text-white transition-colors"
                    >
                      {item.label}
                    </a>
                  ))}
                  <div className="mx-4 my-1 border-t border-[#0F1733]/10 dark:border-white/10" />
                </div>

                {/* Utility links (always shown in menu) */}
                {!isAuthed && (
                  <Link
                    href="/auth/signin"
                    onClick={() => setOpen(false)}
                    className="block px-4 py-2.5 text-[14px] text-[#0F1733]/80 dark:text-white/80 hover:bg-[#0F1733]/5 dark:hover:bg-white/5 hover:text-[#0F1733] dark:hover:text-white transition-colors"
                  >
                    Sign in
                  </Link>
                )}
                <a
                  href="mailto:dmeehanj@gmail.com?subject=Creator%20Outreach%20demo"
                  onClick={() => setOpen(false)}
                  className="block px-4 py-2.5 text-[14px] text-[#0F1733]/80 dark:text-white/80 hover:bg-[#0F1733]/5 dark:hover:bg-white/5 hover:text-[#0F1733] dark:hover:text-white transition-colors"
                >
                  Talk to founder
                </a>
                {isAuthed && (
                  <>
                    <div className="mx-4 my-1 border-t border-[#0F1733]/10 dark:border-white/10" />
                    <button
                      onClick={async () => {
                        setOpen(false)
                        await fetch('/auth/signout', { method: 'POST' })
                        window.location.href = '/'
                      }}
                      className="w-full text-left block px-4 py-2.5 text-[14px] text-red-500 hover:bg-red-500/10 transition-colors"
                    >
                      Sign out
                    </button>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Primary CTA */}
          <Link
            href={isAuthed ? '/' : '/auth/signup'}
            className="ml-1 inline-flex items-center gap-1.5 bg-[#0F1733] dark:bg-[#F2A261] text-white dark:text-[#0F1733] hover:bg-[#E85D2F] dark:hover:bg-white px-4 py-2 rounded-md text-[14px] font-semibold transition-colors"
          >
            {isAuthed ? 'Open app' : 'Start free'}
          </Link>
        </div>
      </div>
    </header>
  )
}
