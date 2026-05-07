import Link from 'next/link'
import { Sparkles, KanbanSquare, MailPlus, BarChart3, Globe, Clock, Download, Lock } from 'lucide-react'
import { Aurora } from '@/components/landing/Aurora'
import { TextGenerateEffect } from '@/components/landing/TextGenerateEffect'
import { AppPreview } from '@/components/landing/AppPreview'
import { LandingNav } from '@/components/landing/LandingNav'
import { ContactForm } from '@/components/landing/ContactForm'
import { FAQ } from '@/components/landing/FAQ'
import { HowItWorks } from '@/components/landing/HowItWorks'
import { PlatformMarquee } from '@/components/landing/PlatformMarquee'
import {
  BentoGrid, BentoCard,
  CrmVisual, AnalyticsVisual, CustomMetricsVisual, FiltersVisual,
} from '@/components/landing/BentoGrid'
import { Meteors } from '@/components/ui/meteors'
import { BorderBeam } from '@/components/ui/border-beam'
import { createClient } from '@/lib/supabase/server'

/**
 * Compact icon + title + description card used in the "More features"
 * section (post-bento). Contrast with BentoCard: no screenshot, no
 * lift-on-hover, no spring physics — just a clean, readable list of
 * secondary capabilities. Reads as "and here's everything else."
 */
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

export const metadata = {
  title: 'Creator Outreach — find them, score them, pitch them, close them',
  description: 'Find creators across YouTube, Instagram, TikTok and more. Score them by fit, run your whole outreach pipeline in one place.',
}

export default async function LandingPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const isAuthed = !!user

  return (
    <main className="relative min-h-screen bg-background text-foreground overflow-x-hidden">
      <LandingNav isAuthed={isAuthed} />

      {/* Hero — centered. Tried asymmetric (text left, preview right
          col-span-5) in iter-1 but it shrank AppPreview to ~583px on
          1400px viewports, defeating Dylan's "make the visual at the
          top LARGER — that is the whole overview" intent. Centered
          hero + full-width AppPreview below = bigger product canvas.

          Container max-w-[1400px] per taste-skill default. */}
      <section className="relative px-6 pt-12 md:pt-16 pb-12 md:pb-16 overflow-hidden">
        {/* Aurora carries the lava-lamp atmosphere now (5 violet/cyan
            blobs on independent movement orbits + scale breathing).
            Spotlight removed — Dylan's note: "spotlight follows the
            cursor, it's laggy and chunky." */}
        <Aurora className="z-0" />
        <Meteors number={10} />

        <div className="relative z-10 max-w-3xl w-full mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-card border border-border text-[11px] uppercase tracking-[0.18em] text-muted-foreground mb-6 shadow-sm dark:bg-white/[0.06] dark:border-white/15 dark:backdrop-blur-md dark:shadow-none">
            <Sparkles className="w-3.5 h-3.5 text-brand" />
            <span>Creator outreach, end to end</span>
          </div>

          <TextGenerateEffect
            words="Stop burning leads in spreadsheets."
            accentWord="spreadsheets"
            className="text-4xl md:text-5xl lg:text-6xl xl:text-7xl font-bold tracking-tight mb-6 leading-[1.02]"
          />

          <p className="text-base md:text-lg text-muted-foreground max-w-2xl mx-auto mb-8 leading-relaxed">
            Find creators that fit. Let AI score them against your own criteria — defined in plain English — then run the whole pipeline. Discovery, pitch, follow-ups, analytics. No spreadsheet circus.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <span className="relative inline-block rounded-lg overflow-hidden">
              <Link
                href={isAuthed ? '/' : '/auth/signup'}
                className="relative z-10 inline-flex items-center gap-2 bg-primary text-primary-foreground hover:opacity-90 active:scale-[0.98] px-7 py-3.5 rounded-lg font-semibold text-base transition-[opacity,transform] duration-150 shadow-[0_8px_24px_-8px_rgba(0,0,0,0.18)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
              >
                {isAuthed ? 'Open app' : 'Get started — free'}
                <span aria-hidden>→</span>
              </Link>
              <BorderBeam size={110} duration={7} colorFrom="#7c3aed" colorTo="#06b6d4" />
            </span>
            {!isAuthed && (
              <Link
                href="/auth/signin"
                className="px-6 py-3.5 rounded-lg font-medium text-muted-foreground hover:text-foreground active:scale-[0.98] border border-border hover:border-brand/40 transition-[color,border-color,transform] duration-150 dark:border-white/15 dark:hover:border-white/30 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
              >
                Sign in
              </Link>
            )}
          </div>

          <p className="mt-6 text-xs text-muted-foreground/70">
            Free while in beta · No credit card · Cancel anytime
          </p>
        </div>
      </section>

      {/* App preview — full-width section. Per Dylan: "the visual at
          the top is still not larger — it needs to be larger, that
          is the whole overview." Bumped to max-w-[1400px] from
          start (was max-w-5xl, only growing on 2xl). */}
      <section className="relative px-6 pb-16 md:pb-24 z-10">
        <AppPreview />
      </section>

      {/* Platform marquee — single horizontal row of supported platforms.
          Accurate motion (we DO support these), no stats card. */}
      <section className="relative px-6 pb-16 md:pb-20 z-10">
        <PlatformMarquee />
      </section>

      {/* How it works */}
      <section className="relative px-6 pb-20 md:pb-28 z-10">
        <div className="max-w-[1400px] mx-auto">
          <div className="text-center mb-6">
            <div className="text-[11px] uppercase tracking-[0.2em] text-brand mb-3">
              How it works
            </div>
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-3">
              Two steps. From search to closed.
            </h2>
            <p className="text-muted-foreground max-w-xl mx-auto">
              Search every platform and let AI score the fits. Pitch them and let auto follow-ups do the rest.
            </p>
          </div>
          <HowItWorks />
        </div>
      </section>

      {/* Bento features */}
      <section className="relative px-6 pb-20 md:pb-28 z-10">
        <div className="max-w-[1400px] mx-auto">
          <div className="text-center mb-12">
            <div className="text-[11px] uppercase tracking-[0.2em] text-brand mb-3">Built for outreach</div>
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-3">
              Everything you need, nothing you don&apos;t.
            </h2>
            <p className="text-muted-foreground max-w-xl mx-auto">
              One tool replaces creator discovery, a spreadsheet, a CRM, and a cadence reminder. Works across YouTube, Instagram, TikTok, X, and LinkedIn.
            </p>
          </div>

          {/*
            Bento layout, iter-7 stacked-left per Dylan: CRM had the
            same "too big of a card for the screenshot and comment"
            problem Analytics had. Solution: stack CRM + Region on
            the left (col-span-2 each, each one short row), make
            Build any metric span both rows on the right (it's a
            naturally tall portrait visual — fills two rows
            cleanly). Analytics stays full-width bottom.

              [ CRM            (cols 1-2, row 1) ] [ Build any  ]
              [ Region search  (cols 1-2, row 2) ] [ metric     ]
                                                  [ rows 1-2,  ]
                                                  [ col 3      ]
              [ Analytics (cols 1-3, row 3, full width)         ]
          */}
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

      {/* "More features" — compact icon-only list. Per Dylan: items
          without strong screenshots ("Templated emails doesnt have a
          screenshot so put that somewhere else in like a cool
          features section"). Templated outreach is the headline; a
          handful of secondary capabilities round it out so this
          section reads as "and here's everything else." */}
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
              description="Describe a great lead in plain English — &ldquo;small US-based legal channels with consistent uploads.&rdquo; We turn that into weighted criteria and re-rank every result. Top of the queue ends up being what you said a good lead looks like."
            />
            <FeatureCard
              icon={<MailPlus className="w-5 h-5" />}
              title="Outreach templates that actually paste"
              description="Click an Instagram handle, the DM lands in your clipboard. Click LinkedIn, the message is ready. Click email, the draft opens. Stop writing &ldquo;hey, just wanted to reach out&rdquo; from scratch every time."
            />
            <FeatureCard
              icon={<Clock className="w-5 h-5" />}
              title="Follow-ups you don&apos;t forget"
              description="Set the cadence you actually run — defaults to 3d, 7d, 14d, 21d, or whatever rhythm fits the deal. We surface the queue when it&apos;s time and load your template. Personalize it for the lead, hit send."
            />
            <FeatureCard
              icon={<Download className="w-5 h-5" />}
              title="Bring your spreadsheet with you"
              description="Already running outreach in a sheet? Drag the CSV in. Every row, status, and note lands intact. Export back to xlsx anytime — your data stays yours."
            />
            <FeatureCard
              icon={<Lock className="w-5 h-5" />}
              title="Privacy by design"
              description="Your data is yours alone. Privacy isn&apos;t a setting we toggle — it&apos;s built into the foundation of the platform. No other account can see a row of your queue."
            />
            <FeatureCard
              icon={<Globe className="w-5 h-5" />}
              title="Five platforms, one pipeline"
              description="One query searches YouTube, Instagram, TikTok, X, and LinkedIn in parallel. The same scoring criteria ranks all five. The same outreach board collects all five. Stop juggling tabs."
            />
          </div>
        </div>
      </section>

      {/* About */}
      <section id="about" className="relative px-6 pb-20 md:pb-28 z-10 scroll-mt-20">
        <div className="max-w-3xl mx-auto">
          <div className="text-[11px] uppercase tracking-[0.2em] text-brand mb-3">About</div>
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-6">
            Built by someone who needed it.
          </h2>
          <p className="text-base md:text-lg text-muted-foreground leading-relaxed">
            Creator Outreach started as a tool I built for myself. I was running outreach to creators across YouTube, Instagram, and TikTok with a spreadsheet, three browser tabs, and a Notion page that was always out of date. The pricier tools cost more than my rent and still couldn&apos;t tell me what made a good lead — so I built this. It searches every major platform directly, scores creators against criteria you describe in plain English, and runs the whole pipeline — pitch, status, follow-up cadence, analytics — without copy-pasting between five tabs. It&apos;s still early, run by one person, and growing every week from feedback by the people using it. If you&apos;re using it and something&apos;s off, tell me — that&apos;s how it gets better.
          </p>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="relative px-6 pb-20 md:pb-28 z-10 scroll-mt-20">
        <div className="max-w-3xl mx-auto text-center">
          <div className="text-[11px] uppercase tracking-[0.2em] text-brand mb-3">Pricing</div>
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-3">
            Free while in beta.
          </h2>
          <p className="text-muted-foreground mb-10 max-w-xl mx-auto">
            No credit card to start. Beta users will be looked after when pricing arrives — early supporters get treated like early supporters.
          </p>

          <div className="grid sm:grid-cols-2 gap-4 max-w-2xl mx-auto text-left">
            <div className="rounded-2xl border border-border bg-card p-6 shadow-sm dark:bg-white/5 dark:backdrop-blur-md dark:border-white/10 dark:shadow-none">
              <div className="text-sm font-medium text-foreground mb-1">Beta</div>
              <div className="text-3xl font-bold tracking-tight mb-2">$0</div>
              <div className="text-xs text-muted-foreground mb-4">Free while in beta</div>
              {/* Per Dylan: "give less details for the free for beta and
                  just say some generic things, don't make promises or
                  assumptions." Replaced the specific feature list
                  ("Unlimited outreach tracking" / "AI fit scoring" /
                  etc) with vague capability lines that don't lock in
                  any particular feature scope. */}
              <ul className="text-sm text-muted-foreground space-y-1.5">
                <li>· Full access to what we&apos;re shipping</li>
                <li>· No card required</li>
                <li>· Help shape the roadmap</li>
              </ul>
            </div>
            <div className="rounded-2xl border border-brand/30 bg-gradient-to-br from-brand/10 to-brand-2/10 p-6 shadow-sm dark:backdrop-blur-md dark:shadow-none">
              <div className="text-sm font-medium text-brand mb-1">Coming later</div>
              <div className="text-3xl font-bold tracking-tight mb-2">TBD</div>
              <div className="text-xs text-muted-foreground mb-4">For heavier users + teams</div>
              <ul className="text-sm text-muted-foreground space-y-1.5">
                <li>· Higher search volume</li>
                <li>· Multi-seat teams</li>
                <li>· Bulk email enrichment</li>
                <li>· Priority support</li>
              </ul>
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

      {/* Contact */}
      <section id="contact" className="relative px-6 pb-20 md:pb-28 z-10 scroll-mt-20">
        <div className="max-w-2xl mx-auto">
          <div className="text-[11px] uppercase tracking-[0.2em] text-brand mb-3 text-center">Contact</div>
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-3 text-center">
            Get in touch.
          </h2>
          <p className="text-muted-foreground mb-8 text-center">
            Feedback, bugs, feature ideas, partnership questions — all land in the same inbox.
          </p>
          <div className="rounded-2xl border border-border bg-card p-6 md:p-8 shadow-sm dark:bg-white/5 dark:backdrop-blur-md dark:border-white/10 dark:shadow-none">
            <ContactForm />
          </div>
        </div>
      </section>

      {/* CTA strip */}
      {!isAuthed && (
        <section className="relative px-6 pb-20 z-10">
          <div className="max-w-3xl mx-auto rounded-2xl border border-border bg-gradient-to-br from-brand/10 via-card to-brand-2/10 p-8 md:p-10 text-center shadow-sm dark:bg-gradient-to-br dark:from-brand/10 dark:via-transparent dark:to-brand-2/10 dark:backdrop-blur-md dark:border-white/10 dark:shadow-none">
            <h3 className="text-xl md:text-2xl font-bold tracking-tight mb-2">
              Stop emailing the wrong creators.
            </h3>
            <p className="text-sm text-muted-foreground mb-5">
              Free to start. No card required.
            </p>
            <Link
              href="/auth/signup"
              className="inline-block bg-primary text-primary-foreground hover:opacity-90 px-5 py-2.5 rounded-lg font-semibold text-sm transition-opacity"
            >
              Get started
            </Link>
          </div>
        </section>
      )}

      <footer className="relative z-10 px-6 py-6 border-t border-border dark:border-white/10 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} Creator Outreach. <a href="#contact" className="hover:text-foreground transition-colors">Contact</a>
      </footer>
    </main>
  )
}
