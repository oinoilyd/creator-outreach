'use client'

import Link from 'next/link'
import { useState, useRef, useEffect } from 'react'
import { useTheme } from 'next-themes'

/**
 * Top nav for the production /landing page.
 *
 * Layout (left → right):
 *   - Logo + brand name
 *   - Inline section anchors (Product / Solutions / Customers /
 *     Pricing / Resources) — desktop only
 *   - Light/dark mode toggle (sun/moon swap) — always visible, sits
 *     OUTSIDE the hamburger as a sibling button
 *   - Hamburger button → opens dropdown with utility links
 *     (Sign in, Talk to founder, mobile-only section anchors)
 *   - Primary CTA (Open app / Start free)
 *
 * Design notes that bit us before:
 *   - Earlier version used a separate <ThemeToggle> component that
 *     rendered an empty <div> placeholder until `mounted` flipped
 *     true. In production that swap apparently never happened — Dylan
 *     reported the toggle was invisible. Inlining the button here
 *     means the SSR markup IS the final markup; only the icon swaps
 *     after hydration, which can't fail-closed to invisible.
 *   - Hamburger click-outside listener is gated on `open` so it can't
 *     close the menu before it ever opens. Hamburger button lives
 *     inside the same ref'd wrapper as the dropdown so clicking it
 *     never registers as "outside."
 *   - Both controls use self-contained light/dark Tailwind classes
 *     (no className prop overrides) so neither can render invisible
 *     against either substrate.
 */
export function LandingTopNav({ isAuthed }: { isAuthed: boolean }) {
  const [open, setOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  const { theme, resolvedTheme, setTheme } = useTheme()
  const wrapRef = useRef<HTMLDivElement>(null)

  // next-themes needs a client-side hydration tick before `theme` is
  // accurate. We render an inert moon icon during SSR + first paint
  // (the button is still visible and clickable — flip to whichever
  // mode you want).
  useEffect(() => setMounted(true), [])

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    if (open) document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [open])

  const isDark = mounted ? (resolvedTheme ?? theme) === 'dark' : false

  return (
    <header className="sticky top-0 z-40 bg-white/85 dark:bg-[#0A0E15]/85 backdrop-blur-md border-b border-[#0F1733]/8 dark:border-white/10">
      <div className="max-w-[1280px] mx-auto px-6 h-[64px] flex items-center justify-between">
        <Link href="/landing" className="flex items-center gap-2.5 shrink-0">
          <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-[#0F1733] dark:bg-[#F2A261] text-[#F2A261] dark:text-[#0F1733] text-[14px] font-bold">
            C
          </span>
          <span className="font-semibold tracking-[-0.01em] text-[16px] text-[#0F1733] dark:text-white">
            Creator Outreach
          </span>
        </Link>

        {/* Desktop section anchors */}
        <nav className="hidden md:flex items-center gap-6 text-[14px] text-[#0F1733]/70 dark:text-white/65 font-medium">
          <a href="#product" className="hover:text-[#0F1733] dark:hover:text-white transition-colors">Product</a>
          <a href="#solutions" className="hover:text-[#0F1733] dark:hover:text-white transition-colors">Solutions</a>
          <a href="#customers" className="hover:text-[#0F1733] dark:hover:text-white transition-colors">Customers</a>
          <a href="#pricing" className="hover:text-[#0F1733] dark:hover:text-white transition-colors">Pricing</a>
          <a href="#resources" className="hover:text-[#0F1733] dark:hover:text-white transition-colors">Resources</a>
        </nav>

        {/* Right-side controls — z-50 so neither stacking context from
            below (the hero's ScreenshotZoom wrapper has its own
            transform-induced stacking context) nor any future overlay
            can steal pointer events from these. pointer-events-auto is
            redundant defensively but explicit. */}
        <div className="relative z-50 flex items-center gap-2 shrink-0 pointer-events-auto">
          {/* THEME TOGGLE — inline button. No <ThemeToggle> indirection.
              Renders as a stable <button> on SSR + first paint so it's
              never invisible; only the SVG icon swaps after hydration. */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              setTheme(isDark ? 'light' : 'dark')
            }}
            aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
            title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
            className="relative z-10 w-9 h-9 inline-flex items-center justify-center rounded-lg border transition-colors border-[#0F1733]/15 dark:border-white/15 text-[#0F1733]/70 dark:text-white/70 hover:border-[#0F1733]/40 dark:hover:border-white/40 hover:text-[#0F1733] dark:hover:text-white cursor-pointer"
          >
            {/* Sun icon — shown when in dark mode (click to go light) */}
            {isDark ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <circle cx="12" cy="12" r="4" />
                <line x1="12" y1="2" x2="12" y2="4" />
                <line x1="12" y1="20" x2="12" y2="22" />
                <line x1="4.93" y1="4.93" x2="6.34" y2="6.34" />
                <line x1="17.66" y1="17.66" x2="19.07" y2="19.07" />
                <line x1="2" y1="12" x2="4" y2="12" />
                <line x1="20" y1="12" x2="22" y2="12" />
                <line x1="4.93" y1="19.07" x2="6.34" y2="17.66" />
                <line x1="17.66" y1="6.34" x2="19.07" y2="4.93" />
              </svg>
            ) : (
              /* Moon icon — shown when in light mode (click to go dark).
                 Also the SSR / pre-hydration default. */
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
              </svg>
            )}
          </button>

          {/* HAMBURGER + DROPDOWN — wrapped in ref'd div so click-outside
              detection treats both the button and the menu as "inside." */}
          <div ref={wrapRef} className="relative z-10">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                setOpen(v => !v)
              }}
              aria-label="Open menu"
              aria-expanded={open}
              className={`w-9 h-9 inline-flex items-center justify-center rounded-lg border transition-colors cursor-pointer ${
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
              <div
                role="menu"
                className="absolute right-0 top-[calc(100%+8px)] w-56 bg-white dark:bg-[#1A2034] border border-[#0F1733]/10 dark:border-white/10 rounded-xl shadow-2xl shadow-black/15 dark:shadow-black/40 z-50 overflow-hidden py-1"
              >
                {/* Mobile-only section anchors (hidden on desktop where
                    they live inline in the main nav). */}
                <div className="md:hidden py-1">
                  {[
                    { label: 'Product', href: '#product' },
                    { label: 'Solutions', href: '#solutions' },
                    { label: 'Customers', href: '#customers' },
                    { label: 'Pricing', href: '#pricing' },
                    { label: 'Resources', href: '#resources' },
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
