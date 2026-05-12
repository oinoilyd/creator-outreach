'use client'

import Link from 'next/link'
import { ReactNode } from 'react'
import { Aurora } from './Aurora'
import { PlatformRain } from './PlatformRain'

// Shared shell for all auth pages (signin / signup / forgot / reset /
// check-email). Light by default; the body radial gradients in
// globals.css give the surface a soft violet/blue/pink wash so it
// doesn't read as a stock white form.
//
// Layered backgrounds (bottom → top):
//   1. Aurora gradient (z-0) — soft violet/blue/pink radial wash
//   2. PlatformRain (z-5) — five brand marks falling at low opacity,
//      reinforces what the product does at first impression
//   3. Form content (z-10) — sign-in / sign-up card
export function AuthShell({ children }: { children: ReactNode }) {
  return (
    <main className="relative min-h-screen flex flex-col bg-background text-foreground overflow-hidden">
      <Aurora className="z-0" />
      <PlatformRain />

      <header className="relative z-10 px-6 py-5 flex items-center justify-between max-w-6xl w-full mx-auto">
        {/* Brand mark — purple-to-blue gradient is Creator Outreach's
            brand. Must stay in lockstep with LandingTopNav.tsx so the
            "C" tile, wordmark, gap, and color treatment are identical
            across pre-sign-in marketing pages and the auth shell.
            Any spec change here MUST be mirrored in LandingTopNav
            (and vice versa). */}
        <Link href="/landing" className="flex items-center gap-2.5">
          <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-gradient-to-br from-brand to-brand-2 text-primary-foreground text-[14px] font-bold">
            C
          </span>
          <span className="font-semibold tracking-[-0.01em] text-[16px] text-[#0F1733] dark:text-white">
            Creator Outreach
          </span>
        </Link>
      </header>

      <div className="relative z-10 flex-1 flex items-center justify-center p-4">
        {children}
      </div>
    </main>
  )
}
