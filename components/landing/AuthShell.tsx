'use client'

import Link from 'next/link'
import { ReactNode } from 'react'
import { Aurora } from './Aurora'

// Shared shell for all auth pages (signin / signup / forgot / reset /
// check-email). Same Aurora background as the landing page so signing
// in feels continuous with the marketing site, plus a small header
// with the wordmark.
export function AuthShell({ children }: { children: ReactNode }) {
  return (
    <main className="relative min-h-screen flex flex-col bg-gray-950 text-white overflow-hidden">
      <Aurora className="z-0" />

      {/* Tiny header — links back to the landing on the wordmark */}
      <header className="relative z-10 px-6 py-5 flex items-center justify-between max-w-6xl w-full mx-auto">
        <Link href="/" className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-purple-600 to-blue-600 flex items-center justify-center text-sm font-bold">C</div>
          <span className="font-semibold tracking-tight">Creator Outreach</span>
        </Link>
      </header>

      {/* Form area */}
      <div className="relative z-10 flex-1 flex items-center justify-center p-4">
        {children}
      </div>
    </main>
  )
}
