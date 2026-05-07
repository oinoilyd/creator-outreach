'use client'

import Link from 'next/link'
import { useState, useRef, useEffect } from 'react'

/**
 * Brutalist masthead — replaces the prior LandingNav (gradient
 * logo square + rounded hamburger + theme toggle were all AI-tells).
 *
 * Visual posture: classified-document header. Mono everywhere, all
 * caps, no rounded corners, single hazard-red accent on the CTA.
 * Sticky on scroll so the document number / version stay visible
 * while scanning the page.
 */
export function MastheadNav({ isAuthed }: { isAuthed: boolean }) {
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

  return (
    <header className="border-b border-ink/90">
      <div className="max-w-[1280px] mx-auto px-6 py-3 flex items-center justify-between gap-6 font-[family-name:var(--font-ibm-plex-mono)] text-[11px] uppercase tracking-[0.14em] text-ink">
        {/* Left — masthead identity, all mono. No icon, no gradient. */}
        <Link
          href="/landing"
          className="flex items-center gap-3 shrink-0 hover:underline decoration-hazard underline-offset-4"
        >
          <span className="font-semibold">CREATOR&nbsp;OUTREACH</span>
          <span aria-hidden className="opacity-50">®</span>
        </Link>

        {/* Center — document metadata. Hidden on mobile, visible md+. */}
        <div className="hidden md:flex items-center gap-4 opacity-70">
          <span>V0.5</span>
          <span aria-hidden>///</span>
          <span>2026</span>
          <span aria-hidden>///</span>
          <span>DOC-001</span>
        </div>

        {/* Right — primary action + minimal menu. */}
        <div className="flex items-center gap-3">
          <Link
            href={isAuthed ? '/' : '/auth/signup'}
            className="inline-flex items-center gap-2 border border-ink bg-ink text-paper px-3 py-1.5 hover:bg-hazard hover:border-hazard hover:text-paper transition-colors"
          >
            {isAuthed ? '↗ OPEN APP' : '↗ TRY IT FREE'}
          </Link>

          <div ref={ref} className="relative">
            <button
              onClick={() => setOpen(v => !v)}
              aria-label="Open menu"
              aria-expanded={open}
              className="border border-ink/80 px-2 py-1.5 hover:bg-ink hover:text-paper transition-colors"
            >
              [{open ? 'X' : '+'}]
            </button>

            {open && (
              <div className="absolute right-0 top-full mt-1 min-w-[220px] border border-ink bg-paper z-50">
                <div className="px-3 py-2 border-b border-ink/30 opacity-60 text-[10px]">
                  &gt; SECTIONS
                </div>
                {[
                  { label: 'COVER', href: '#cover' },
                  { label: '01 / WHAT IT REPLACES', href: '#section-replaces' },
                  { label: '02 / HOW IT WORKS', href: '#section-method' },
                  { label: '03 / INTERFACE', href: '#section-interface' },
                  { label: '04 / PRICING', href: '#pricing' },
                  { label: '05 / OPERATOR', href: '#section-operator' },
                  { label: '06 / FAQ', href: '#faq' },
                  { label: '07 / CONTACT', href: '#contact' },
                ].map(item => (
                  <a
                    key={item.href}
                    href={item.href}
                    onClick={() => setOpen(false)}
                    className="block px-3 py-2 hover:bg-ink hover:text-paper transition-colors"
                  >
                    {item.label}
                  </a>
                ))}

                <div className="border-t border-ink/30" />

                {isAuthed ? (
                  <>
                    <Link
                      href="/"
                      onClick={() => setOpen(false)}
                      className="block px-3 py-2 hover:bg-ink hover:text-paper transition-colors"
                    >
                      ↗ OPEN APP
                    </Link>
                    <button
                      onClick={signOut}
                      className="w-full text-left block px-3 py-2 text-hazard hover:bg-hazard hover:text-paper transition-colors"
                    >
                      ↗ SIGN OUT
                    </button>
                  </>
                ) : (
                  <>
                    <Link
                      href="/auth/signin"
                      onClick={() => setOpen(false)}
                      className="block px-3 py-2 hover:bg-ink hover:text-paper transition-colors"
                    >
                      ↗ SIGN IN
                    </Link>
                    <Link
                      href="/auth/signup"
                      onClick={() => setOpen(false)}
                      className="block px-3 py-2 hover:bg-ink hover:text-paper transition-colors"
                    >
                      ↗ SIGN UP
                    </Link>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  )
}
