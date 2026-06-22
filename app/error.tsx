'use client'

import { useEffect } from 'react'
import Link from 'next/link'

// Branded runtime-error boundary. Catches uncaught render/runtime
// errors in any route below the root layout (the root layout itself is
// covered by global-error.tsx). Error boundaries MUST be client
// components. Replaces Next's bare default error screen.
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // Surface to the console; Vercel captures this in runtime logs.
    // `digest` correlates the client-visible error with the server
    // stack in Vercel's log explorer.
    console.error(error)
  }, [error])

  return (
    <main className="relative min-h-screen flex flex-col items-center justify-center bg-background text-foreground overflow-hidden px-6">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 opacity-[0.18]"
        style={{ background: 'radial-gradient(60% 50% at 50% 35%, var(--brand) 0%, transparent 70%)' }}
      />

      <Link href="/landing" className="flex items-center gap-2.5 mb-10">
        <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-gradient-to-br from-brand to-brand-2 text-white text-[14px] font-bold">
          C
        </span>
        <span className="font-semibold tracking-[-0.01em] text-[16px]">Creator Outreach</span>
      </Link>

      {/* A glyph, not a number — visually distinct from the 404 page. */}
      <div className="flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-brand to-brand-2 text-white text-4xl font-black shadow-xl shadow-brand/25">
        !
      </div>

      <h1 className="mt-8 text-2xl font-bold">Something went wrong</h1>
      <p className="mt-2 max-w-sm text-center text-muted-foreground text-sm">
        An unexpected error occurred on our end. Try again — if it keeps happening, email{' '}
        <a href="mailto:support@creatoroutreach.net" className="text-brand hover:underline">
          support@creatoroutreach.net
        </a>
        .
      </p>

      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        <button
          onClick={reset}
          className="px-5 py-2.5 rounded-lg bg-gradient-to-br from-brand to-brand-2 text-white font-semibold text-sm shadow-lg shadow-brand/20 hover:opacity-90 transition-opacity focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/50"
        >
          Try again
        </button>
        <Link
          href="/"
          className="px-5 py-2.5 rounded-lg border border-border bg-card/60 font-medium text-sm hover:bg-card transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
        >
          Back to the app
        </Link>
      </div>

      {error?.digest && (
        <p className="mt-6 text-[11px] text-muted-foreground/60 font-mono">Reference: {error.digest}</p>
      )}
    </main>
  )
}
