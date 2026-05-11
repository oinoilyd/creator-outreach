import Link from 'next/link'
import type React from 'react'

/**
 * Shared shell for every legal page (/terms, /privacy, /refunds,
 * /cookies). Centers the content, applies prose typography, and
 * provides a back-link + last-updated stamp.
 *
 * Keep this a server component — no client state needed.
 */
export function LegalLayout({
  title,
  lastUpdated,
  children,
}: {
  title: string
  lastUpdated: string
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Top bar — minimal, with wordmark + back link.
          Per Dylan 2026-05-11: both links go to "/" (NOT /landing).
          Middleware handles the auth-aware routing — authed users see
          the app at "/", unauthed users get rewritten to /landing.
          This way clicking back from a legal page sends an authed
          user straight to the app interface, not the marketing site. */}
      <header className="border-b border-border/60 bg-background/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link
            href="/"
            className="text-lg font-bold tracking-[-0.02em] bg-gradient-to-r from-foreground to-foreground/75 bg-clip-text text-transparent hover:opacity-80 transition-opacity"
          >
            Creator Outreach
          </Link>
          <Link
            href="/"
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            ← Back
          </Link>
        </div>
      </header>

      {/* Document body — readable measure, prose typography */}
      <main className="max-w-3xl mx-auto px-6 py-12">
        <div className="mb-8">
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-foreground mb-2">
            {title}
          </h1>
          <p className="text-sm text-muted-foreground">
            Last updated: <span className="font-medium text-foreground">{lastUpdated}</span>
          </p>
        </div>

        {/*
          Manual styling rather than `prose` so we don't pull in an
          extra Tailwind plugin. Keep it readable, generous spacing,
          consistent heading scale.
        */}
        <div className="space-y-6 text-[15px] leading-relaxed text-foreground/90 [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:text-foreground [&_h2]:mt-10 [&_h2]:mb-3 [&_h3]:text-base [&_h3]:font-semibold [&_h3]:text-foreground [&_h3]:mt-6 [&_h3]:mb-2 [&_p]:text-foreground/85 [&_ul]:list-disc [&_ul]:pl-6 [&_ul]:space-y-1 [&_li]:text-foreground/85 [&_a]:text-blue-600 [&_a]:dark:text-blue-400 [&_a]:underline [&_a]:underline-offset-2 [&_strong]:font-semibold [&_strong]:text-foreground">
          {children}
        </div>

        <div className="mt-12 pt-6 border-t border-border/60 text-sm text-muted-foreground">
          <p>
            Questions about this document? Email{' '}
            <a href="mailto:dmeehanj@gmail.com" className="text-blue-600 dark:text-blue-400 underline underline-offset-2">
              dmeehanj@gmail.com
            </a>
            .
          </p>
          <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-xs">
            <Link href="/terms" className="text-muted-foreground hover:text-foreground transition-colors">Terms of Service</Link>
            <Link href="/privacy" className="text-muted-foreground hover:text-foreground transition-colors">Privacy Policy</Link>
            <Link href="/refunds" className="text-muted-foreground hover:text-foreground transition-colors">Refund Policy</Link>
            <Link href="/support" className="text-muted-foreground hover:text-foreground transition-colors">Support</Link>
            <Link href="/cookies" className="text-muted-foreground hover:text-foreground transition-colors">Cookie Policy</Link>
          </div>
        </div>
      </main>
    </div>
  )
}
