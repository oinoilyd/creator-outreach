import type { Metadata } from 'next'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'

const ADMIN_EMAIL = 'dmeehanj@gmail.com'

/**
 * Admin segment layout. Attaches `noindex` to every /admin/* page so
 * Googlebot doesn't index operational tooling, and renders a persistent
 * "Back to app" bar so you can always escape admin from any sub-page
 * (Messages, Dashboard, etc.) — not just the admin home.
 *
 * The bar is sticky in normal flow (h-11). Scrollable admin pages keep
 * their own headers below it; the full-height Messages page subtracts
 * the bar height (h-[calc(100vh-2.75rem)]) so its app-shell still fits.
 *
 * Admin auth gate runs HERE at the segment level (audit P0, 2026-06-22):
 * every /admin/* page is gated by this layout, so a client-only preview
 * page with no server gate of its own (e.g. menu-preview) can no longer
 * leak admin tooling / PII to a non-admin authenticated user. Per-page
 * notFound() gates stay as defense-in-depth.
 */
export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
    googleBot: { index: false, follow: false },
  },
}

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.email?.toLowerCase() !== ADMIN_EMAIL) notFound()

  return (
    <>
      <div className="sticky top-0 z-40 h-11 border-b border-border bg-card/70 backdrop-blur supports-[backdrop-filter]:bg-card/60 flex items-center justify-between px-3 sm:px-4">
        <Link
          href="/"
          className="inline-flex items-center gap-1 text-[12.5px] font-medium text-muted-foreground hover:text-foreground rounded-lg pl-1.5 pr-2.5 py-1 hover:bg-muted/50 transition-colors"
        >
          <ChevronLeft className="w-4 h-4" /> Back to app
        </Link>
        <span className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground/45 font-semibold select-none">Admin</span>
      </div>
      {children}
    </>
  )
}
