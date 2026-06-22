import Link from 'next/link'

// Branded 404. Renders INSIDE the root layout, so it inherits
// globals.css + ThemeProvider — design tokens (bg-background,
// from-brand, text-muted-foreground, …) all resolve and it adapts to
// light/dark like the rest of the app. Replaces Next's bare default
// ("404 | This page could not be found").
export default function NotFound() {
  return (
    <main className="relative min-h-screen flex flex-col items-center justify-center bg-background text-foreground overflow-hidden px-6">
      {/* Soft brand-tinted glow for depth — pure CSS, no JS. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 opacity-[0.18]"
        style={{ background: 'radial-gradient(60% 50% at 50% 35%, var(--brand) 0%, transparent 70%)' }}
      />

      {/* Brand mark — kept in lockstep with AuthShell / LandingTopNav. */}
      <Link href="/landing" className="flex items-center gap-2.5 mb-10">
        <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-gradient-to-br from-brand to-brand-2 text-white text-[14px] font-bold">
          C
        </span>
        <span className="font-semibold tracking-[-0.01em] text-[16px]">Creator Outreach</span>
      </Link>

      <p className="font-black leading-none tracking-tight bg-gradient-to-br from-brand to-brand-2 bg-clip-text text-transparent" style={{ fontSize: 'clamp(4rem, 12vw, 8rem)' }}>
        404
      </p>

      <h1 className="mt-4 text-2xl font-bold">This page doesn&rsquo;t exist</h1>
      <p className="mt-2 max-w-sm text-center text-muted-foreground text-sm">
        The link may be broken, or the page may have moved. Let&rsquo;s get you back on track.
      </p>

      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        <Link
          href="/"
          className="px-5 py-2.5 rounded-lg bg-gradient-to-br from-brand to-brand-2 text-white font-semibold text-sm shadow-lg shadow-brand/20 hover:opacity-90 transition-opacity focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/50"
        >
          Open the app
        </Link>
        <Link
          href="/landing"
          className="px-5 py-2.5 rounded-lg border border-border bg-card/60 font-medium text-sm hover:bg-card transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
        >
          Back to home
        </Link>
      </div>
    </main>
  )
}
