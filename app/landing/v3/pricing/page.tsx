import Link from 'next/link'
import { FAQ } from '@/components/landing/FAQ'
import { getLandingAuthState } from '@/components/landing/getLandingData'

/**
 * V3 / Pricing — pricing tiers + FAQ.
 */

export const metadata = {
  title: 'Creator Outreach — Pricing',
  description: 'Free while in beta. No credit card. Beta users grandfathered when paid plans arrive.',
}

export default async function V3Pricing() {
  const { isAuthed } = await getLandingAuthState()

  return (
    <>
      {/* Page header */}
      <section className="relative px-6 pt-12 md:pt-16 pb-10 z-10">
        <div className="max-w-3xl mx-auto text-center">
          <div className="text-[11px] uppercase tracking-[0.2em] text-brand mb-3">Pricing</div>
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4">
            Free while in beta.
          </h1>
          <p className="text-base md:text-lg text-muted-foreground max-w-xl mx-auto leading-relaxed">
            No credit card to start. Beta users will be looked after when pricing arrives —
            early supporters get treated like early supporters.
          </p>
        </div>
      </section>

      {/* Pricing tiers */}
      <section className="relative px-6 pb-20 md:pb-28 z-10">
        <div className="max-w-3xl mx-auto">
          <div className="grid sm:grid-cols-2 gap-4 text-left">
            <div className="rounded-2xl border border-border bg-card p-6 shadow-sm dark:bg-white/5 dark:backdrop-blur-md dark:border-white/10 dark:shadow-none">
              <div className="text-sm font-medium text-foreground mb-1">Beta</div>
              <div className="text-3xl font-bold tracking-tight mb-2">$0</div>
              <div className="text-xs text-muted-foreground mb-4">Free while in beta</div>
              <ul className="text-sm text-muted-foreground space-y-1.5 mb-6">
                <li>· Full access to what we&apos;re shipping</li>
                <li>· No card required</li>
                <li>· Help shape the roadmap</li>
              </ul>
              <Link
                href={isAuthed ? '/' : '/auth/signup'}
                className="block text-center bg-primary text-primary-foreground hover:opacity-90 px-4 py-2.5 rounded-lg font-semibold text-sm transition-opacity"
              >
                {isAuthed ? 'Open the app' : 'Get started — free'}
              </Link>
            </div>
            <div className="rounded-2xl border border-brand/30 bg-gradient-to-br from-brand/10 to-brand-2/10 p-6 shadow-sm dark:backdrop-blur-md dark:shadow-none">
              <div className="text-sm font-medium text-brand mb-1">Coming later</div>
              <div className="text-3xl font-bold tracking-tight mb-2">TBD</div>
              <div className="text-xs text-muted-foreground mb-4">For heavier users + teams</div>
              <ul className="text-sm text-muted-foreground space-y-1.5 mb-6">
                <li>· Higher search volume</li>
                <li>· Multi-seat teams</li>
                <li>· Bulk email enrichment</li>
                <li>· Priority support</li>
              </ul>
              <button
                disabled
                className="block w-full text-center bg-muted text-muted-foreground/70 cursor-not-allowed px-4 py-2.5 rounded-lg font-semibold text-sm"
              >
                Notify me when ready
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="relative px-6 pb-20 md:pb-28 z-10 scroll-mt-20">
        <div className="max-w-3xl mx-auto">
          <div className="text-[11px] uppercase tracking-[0.2em] text-brand mb-3 text-center">FAQ</div>
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-10 text-center">
            Common questions.
          </h2>
          <FAQ />
        </div>
      </section>
    </>
  )
}
