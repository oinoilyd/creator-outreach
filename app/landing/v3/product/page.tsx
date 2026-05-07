import Link from 'next/link'
import { Sparkles, KanbanSquare, MailPlus, BarChart3, Globe, Clock, Download, Lock } from 'lucide-react'
import { HowItWorks } from '@/components/landing/HowItWorks'
import {
  BentoGrid, BentoCard,
  CrmVisual, AnalyticsVisual, CustomMetricsVisual, FiltersVisual,
} from '@/components/landing/BentoGrid'
import { getLandingAuthState } from '@/components/landing/getLandingData'

/**
 * V3 / Product — How it works + Bento grid + More features.
 */

export const metadata = {
  title: 'Creator Outreach — Product overview',
  description: 'How Creator Outreach works: search five platforms, score every lead in plain English, pitch with the right templated message per channel, track every reply.',
}

function FeatureCard({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <div className="group relative rounded-xl border border-border bg-card hover:border-brand/40 transition-colors p-5 dark:bg-white/[0.04] dark:backdrop-blur-md dark:border-white/10 dark:hover:border-brand/40">
      <div className="w-9 h-9 rounded-lg bg-brand/10 border border-brand/30 flex items-center justify-center text-brand mb-3">
        {icon}
      </div>
      <div className="text-sm font-semibold text-foreground tracking-tight mb-1">{title}</div>
      <p className="text-[13px] text-muted-foreground leading-relaxed">{description}</p>
    </div>
  )
}

export default async function V3Product() {
  const { isAuthed } = await getLandingAuthState()

  return (
    <>
      {/* Page header */}
      <section className="relative px-6 pt-12 md:pt-16 pb-10 z-10">
        <div className="max-w-3xl mx-auto text-center">
          <div className="text-[11px] uppercase tracking-[0.2em] text-brand mb-3">Product</div>
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4">
            Everything Creator Outreach does.
          </h1>
          <p className="text-base md:text-lg text-muted-foreground max-w-xl mx-auto leading-relaxed">
            One tool replaces creator discovery, a spreadsheet, a CRM, and a cadence reminder.
            Works across YouTube, Instagram, TikTok, X, and LinkedIn.
          </p>
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="relative px-6 pb-20 md:pb-28 z-10 scroll-mt-20">
        <div className="max-w-[1400px] mx-auto">
          <div className="text-center mb-6">
            <div className="text-[11px] uppercase tracking-[0.2em] text-brand mb-3">
              How it works
            </div>
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-3">
              Four steps. From search to signed.
            </h2>
            <p className="text-muted-foreground max-w-xl mx-auto">
              Search every platform, score for fit, pitch with the right template, track every touch — all in one queue.
            </p>
          </div>
          <HowItWorks />
        </div>
      </section>

      {/* Bento */}
      <section className="relative px-6 pb-20 md:pb-28 z-10">
        <div className="max-w-[1400px] mx-auto">
          <div className="text-center mb-12">
            <div className="text-[11px] uppercase tracking-[0.2em] text-brand mb-3">Built for outreach</div>
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-3">
              Everything you need, nothing you don&apos;t.
            </h2>
          </div>

          <BentoGrid>
            <BentoCard
              className="md:col-span-2 md:row-start-1"
              title="Built-in CRM"
              description="Track every outreach, status, response, and follow-up — channel, email, and status pills in one row. Replace your spreadsheet."
              icon={<KanbanSquare className="w-3.5 h-3.5" />}
              visual={<CrmVisual />}
            />
            <BentoCard
              className="md:col-start-3 md:row-span-2"
              title="Customize your metrics"
              description="Counts, percentages, sums, averages — over the filters you set. Saves to your dashboard. No formulas, no spreadsheets."
              icon={<BarChart3 className="w-3.5 h-3.5" />}
              visual={<CustomMetricsVisual />}
              delay={0.1}
            />
            <BentoCard
              className="md:col-span-2 md:row-start-2"
              title="Region-targeted, precision search"
              description="Pin views, subscribers, last-posted, has-email, language, and 22 specific regions to focus your queue on creators who fit your market."
              icon={<Globe className="w-3.5 h-3.5" />}
              visual={<FiltersVisual />}
              delay={0.15}
            />
            <BentoCard
              className="md:col-span-3"
              title="Analytics dashboard"
              description="Win rate, response rate, pipeline value, stale follow-ups, status breakdown — out of the box."
              icon={<BarChart3 className="w-3.5 h-3.5" />}
              visual={<AnalyticsVisual />}
              delay={0.2}
            />
          </BentoGrid>
        </div>
      </section>

      {/* More features */}
      <section className="relative px-6 pb-20 md:pb-28 z-10">
        <div className="max-w-[1400px] mx-auto">
          <div className="text-center mb-10">
            <div className="text-[11px] uppercase tracking-[0.2em] text-brand mb-3">More features</div>
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-3">
              And a few extras you didn&apos;t ask for.
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <FeatureCard
              icon={<Sparkles className="w-5 h-5" />}
              title="AI fit scoring, in your words"
              description="Describe a great lead in plain English — &ldquo;small US-based legal channels with consistent uploads.&rdquo; We turn that into weighted criteria and re-rank every result."
            />
            <FeatureCard
              icon={<MailPlus className="w-5 h-5" />}
              title="Outreach templates that actually paste"
              description="Click an Instagram handle, the DM lands in your clipboard. Click LinkedIn, the message is ready. Click email, the draft opens."
            />
            <FeatureCard
              icon={<Clock className="w-5 h-5" />}
              title="Follow-ups you don&apos;t forget"
              description="Set the cadence you actually run — defaults to 3d, 7d, 14d, 21d. We surface the queue when it&apos;s time and load your template."
            />
            <FeatureCard
              icon={<Download className="w-5 h-5" />}
              title="Bring your spreadsheet with you"
              description="Already running outreach in a sheet? Drag the CSV in. Every row, status, and note lands intact. Export back to xlsx anytime."
            />
            <FeatureCard
              icon={<Lock className="w-5 h-5" />}
              title="Privacy by design"
              description="Your data is yours alone. Privacy isn&apos;t a setting we toggle — it&apos;s built into the foundation. No other account can see a row of your queue."
            />
            <FeatureCard
              icon={<Globe className="w-5 h-5" />}
              title="Five platforms, one pipeline"
              description="One query searches YouTube, Instagram, TikTok, X, and LinkedIn in parallel. The same scoring criteria ranks all five."
            />
          </div>
        </div>
      </section>

      {/* CTA at end of product page */}
      <section className="relative px-6 pb-20 z-10">
        <div className="max-w-3xl mx-auto rounded-2xl border border-border bg-gradient-to-br from-brand/10 via-card to-brand-2/10 p-8 md:p-10 text-center shadow-sm dark:bg-gradient-to-br dark:from-brand/10 dark:via-transparent dark:to-brand-2/10 dark:backdrop-blur-md dark:border-white/10 dark:shadow-none">
          <h3 className="text-xl md:text-2xl font-bold tracking-tight mb-2">
            Try it on your own outreach.
          </h3>
          <p className="text-sm text-muted-foreground mb-5">
            Free while in beta. No credit card.
          </p>
          <Link
            href={isAuthed ? '/' : '/auth/signup'}
            className="inline-block bg-primary text-primary-foreground hover:opacity-90 px-5 py-2.5 rounded-lg font-semibold text-sm transition-opacity"
          >
            {isAuthed ? 'Open the app' : 'Get started'}
          </Link>
        </div>
      </section>
    </>
  )
}
