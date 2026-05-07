import Link from 'next/link'
import { Aurora } from '@/components/landing/Aurora'
import { VersionSwitcher } from '@/components/landing/VersionSwitcher'
import { ThemeToggle } from '@/components/ThemeToggle'
import { V3Nav } from '@/components/landing/V3Nav'
import { getLandingAuthState } from '@/components/landing/getLandingData'

/**
 * V3 — MULTI-PAGE SHELL
 *
 * Per Dylan: "take the one we are currently using and make it so it
 * isn't one continuous page like keep the visual feel and most the
 * content but lay it out as an official webpage."
 *
 * Same Aurora lava-lamp backdrop as production (V2). Same color
 * palette. Same component vocabulary (BentoGrid, FAQ, ContactForm,
 * etc). What changes is structure: the long single-page scroll is
 * split across:
 *
 *   /landing/v3              → Home (hero + preview + 4-step CTA)
 *   /landing/v3/product      → Bento + More features + How it works
 *   /landing/v3/pricing      → Pricing tiers + FAQ
 *   /landing/v3/about        → About + Contact + final CTA
 *
 * Top nav links route between pages. Footer is shared. The Aurora
 * background is fixed inset-0 so it persists across navigation
 * without re-mounting (no flash on page transitions).
 */

export default async function V3Layout({ children }: { children: React.ReactNode }) {
  const { isAuthed } = await getLandingAuthState()

  return (
    <main className="relative min-h-screen text-foreground overflow-x-hidden flex flex-col">
      <VersionSwitcher />

      {/* Page-wide lava-lamp backdrop — same as V2 / production. */}
      <div className="fixed inset-0 z-[-1] bg-background pointer-events-none">
        <Aurora />
      </div>

      <V3Nav isAuthed={isAuthed} />

      <div className="relative z-10 flex-1">
        {children}
      </div>

      {/* Footer — shared across all V3 pages */}
      <footer className="relative z-10 px-6 py-10 border-t border-border dark:border-white/10">
        <div className="max-w-[1400px] mx-auto grid md:grid-cols-4 gap-8">
          <div>
            <Link href="/landing/v3" className="flex items-center gap-2 mb-3">
              <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-gradient-to-br from-purple-600 to-blue-600 text-white text-sm font-bold">C</span>
              <span className="font-semibold tracking-tight text-foreground">Creator Outreach</span>
            </Link>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Find creators that fit. Score them in plain English. Run the whole pipeline in one place.
            </p>
          </div>
          <FooterCol heading="Product" links={[
            ['Overview',   '/landing/v3/product'],
            ['How it works','/landing/v3/product#how-it-works'],
            ['Pricing',    '/landing/v3/pricing'],
          ]} />
          <FooterCol heading="Company" links={[
            ['About',     '/landing/v3/about'],
            ['Contact',   '/landing/v3/about#contact'],
            ['FAQ',       '/landing/v3/pricing#faq'],
          ]} />
          <FooterCol heading="Legal" links={[
            ['Privacy', '/privacy'],
            ['Terms',   '/terms'],
          ]} />
        </div>
        <div className="max-w-[1400px] mx-auto mt-10 pt-6 border-t border-border/60 dark:border-white/[0.05] flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground">
          <div>© {new Date().getFullYear()} Creator Outreach</div>
          <ThemeToggle />
        </div>
      </footer>
    </main>
  )
}

function FooterCol({ heading, links }: { heading: string; links: [string, string][] }) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground mb-3 font-medium">{heading}</div>
      <ul className="space-y-1.5">
        {links.map(([label, href]) => (
          <li key={label}>
            <Link href={href} className="text-sm text-foreground/75 hover:text-foreground transition-colors">{label}</Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
