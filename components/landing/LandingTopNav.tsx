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
          {/* Roadmap intentionally absent from the desktop bar — it
              lives in the hamburger menu only so the bar stays focused
              on the marketing-page anchors (Product / Solutions /
              Customers / Pricing). */}
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
              detection treats both the button and the menu as "inside."
              `inline-flex` on the wrapper centers the button vertically
              so it lines up with the theme toggle (was 1.5px low). */}
          <div ref={wrapRef} className="relative z-10 inline-flex items-center">
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
                className="absolute right-0 top-[calc(100%+8px)] w-72 bg-white dark:bg-[#1A2034] border border-[#0F1733]/10 dark:border-white/10 rounded-xl shadow-2xl shadow-black/15 dark:shadow-black/40 z-50 overflow-hidden py-2 max-h-[calc(100vh-90px)] overflow-y-auto"
              >
                {/* Cleaner menu (2026-05-08, second pass): tighter
                    one-word labels, no descriptors, no obsolete
                    "playbooks" link. Three groups + Account. */}

                <MenuGroup label="Product">
                  <MenuItem href="#sourcing" onSelect={() => setOpen(false)}>Sourcing</MenuItem>
                  <MenuItem href="#outreach" onSelect={() => setOpen(false)}>Outreach</MenuItem>
                  <MenuItem href="#analytics" onSelect={() => setOpen(false)}>Analytics</MenuItem>
                  <MenuItem href="#followups" onSelect={() => setOpen(false)}>Follow-ups</MenuItem>
                </MenuGroup>

                <MenuGroup label="Site">
                  <MenuItem href="#solutions" onSelect={() => setOpen(false)}>Solutions</MenuItem>
                  <MenuItem href="#customers" onSelect={() => setOpen(false)}>Why this exists</MenuItem>
                  <MenuItem href="#pricing" onSelect={() => setOpen(false)}>Pricing</MenuItem>
                  <MenuItem href="/roadmap" onSelect={() => setOpen(false)}>Roadmap</MenuItem>
                </MenuGroup>

                <MenuGroup label="Connect">
                  <MenuItem
                    href="mailto:dmeehanj@gmail.com?subject=Creator%20Outreach%20demo"
                    onSelect={() => setOpen(false)}
                  >
                    Talk to founder
                  </MenuItem>
                  <MenuItem
                    href="mailto:dmeehanj@gmail.com?subject=Creator%20Outreach%20feedback"
                    onSelect={() => setOpen(false)}
                  >
                    Send feedback
                  </MenuItem>
                </MenuGroup>

                {/* GROUP 4 — Account */}
                <div className="px-2 pt-2">
                  {!isAuthed && (
                    <>
                      {/* Mobile-only primary CTA — sm+ uses the nav CTA. */}
                      <Link
                        href="/auth/signup"
                        onClick={() => setOpen(false)}
                        className="sm:hidden mb-2 inline-flex items-center justify-center gap-1.5 bg-[#0F1733] dark:bg-[#F2A261] text-white dark:text-[#0F1733] hover:bg-[#E85D2F] dark:hover:bg-white px-4 py-2.5 rounded-md text-[14px] font-semibold transition-colors w-full"
                      >
                        Start free
                      </Link>
                      <Link
                        href="/auth/signin"
                        onClick={() => setOpen(false)}
                        className="block px-3 py-2 rounded-md text-[14px] text-[#0F1733]/80 dark:text-white/80 hover:bg-[#0F1733]/5 dark:hover:bg-white/5 hover:text-[#0F1733] dark:hover:text-white transition-colors"
                      >
                        Sign in
                      </Link>
                    </>
                  )}
                  {isAuthed && (
                    <>
                      <Link
                        href="/"
                        onClick={() => setOpen(false)}
                        className="block px-3 py-2 rounded-md text-[14px] text-[#0F1733]/80 dark:text-white/80 hover:bg-[#0F1733]/5 dark:hover:bg-white/5 hover:text-[#0F1733] dark:hover:text-white transition-colors"
                      >
                        Open app
                      </Link>
                      <button
                        onClick={async () => {
                          setOpen(false)
                          await fetch('/auth/signout', { method: 'POST' })
                          window.location.href = '/'
                        }}
                        className="w-full text-left block px-3 py-2 rounded-md text-[14px] text-red-500 hover:bg-red-500/10 transition-colors"
                      >
                        Sign out
                      </button>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Primary CTA — visible from 'sm' (640px) up. Below sm the
              CTA was pushing total nav width to ~386px which on iPhone
              widths (320–375) caused horizontal overflow → toggle and
              hamburger ended up partially off-screen, taps landed on
              dead space. CTA is surfaced inside the hamburger menu on
              mobile so it's still reachable. */}
          <Link
            href={isAuthed ? '/' : '/auth/signup'}
            className="ml-1 hidden sm:inline-flex items-center gap-1.5 bg-[#0F1733] dark:bg-[#F2A261] text-white dark:text-[#0F1733] hover:bg-[#E85D2F] dark:hover:bg-white px-4 py-2 rounded-md text-[14px] font-semibold transition-colors"
          >
            {isAuthed ? 'Open app' : 'Start free'}
          </Link>
        </div>
      </div>
    </header>
  )
}

/* ─── menu primitives ─── */

function MenuGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="px-2 pb-1">
      <div className="px-2 pt-2 pb-1 text-[10px] uppercase tracking-[0.2em] font-bold text-[#0F1733]/40 dark:text-white/40">
        {label}
      </div>
      {children}
      <div className="mx-2 my-2 border-t border-[#0F1733]/10 dark:border-white/10" />
    </div>
  )
}

function MenuItem({
  href,
  onSelect,
  children,
}: {
  href: string
  onSelect: () => void
  children: React.ReactNode
}) {
  return (
    <a
      href={href}
      onClick={onSelect}
      className="block px-3 py-2 rounded-md text-[13.5px] text-[#0F1733]/80 dark:text-white/80 hover:bg-[#0F1733]/5 dark:hover:bg-white/5 hover:text-[#0F1733] dark:hover:text-white transition-colors"
    >
      {children}
    </a>
  )
}
