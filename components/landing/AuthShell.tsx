'use client'

import Link from 'next/link'
import { ReactNode } from 'react'
import { Aurora } from './Aurora'

// Shared shell for all auth pages (signin / signup / forgot / reset /
// check-email). Light by default; the body radial gradients in
// globals.css give the surface a soft violet/blue/pink wash so it
// doesn't read as a stock white form.
export function AuthShell({ children }: { children: ReactNode }) {
  return (
    <main className="relative min-h-screen flex flex-col bg-background text-foreground overflow-hidden">
      <Aurora className="z-0" />

      <header className="relative z-10 px-6 py-5 flex items-center justify-between max-w-6xl w-full mx-auto">
        {/* Brand mark — kept in lockstep with LandingTopNav.tsx so the
            "C" tile, wordmark, gap, and color treatment are identical
            across pre-sign-in marketing pages and the auth shell.
            Any tweak here MUST be mirrored in LandingTopNav.tsx
            (and vice versa) — visual inconsistency between /landing
            and /auth/* was the symptom that prompted this. */}
        <Link href="/landing" className="flex items-center gap-2.5">
          <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-[#0F1733] dark:bg-[#F2A261] text-[#F2A261] dark:text-[#0F1733] text-[14px] font-bold">
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
