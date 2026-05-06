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
        <Link href="/landing" className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-purple-600 to-blue-600 flex items-center justify-center text-sm font-bold text-white">C</div>
          <span className="font-semibold tracking-tight">Creator Outreach</span>
        </Link>
      </header>

      <div className="relative z-10 flex-1 flex items-center justify-center p-4">
        {children}
      </div>
    </main>
  )
}
