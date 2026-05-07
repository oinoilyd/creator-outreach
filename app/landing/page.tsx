import Link from 'next/link'
import { Search, Sparkles, KanbanSquare, MailPlus, BarChart3 } from 'lucide-react'
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
  SearchVisual, ScoringVisual, CrmVisual, CadenceVisual, AnalyticsVisual, CustomMetricsVisual,
} from '@/components/landing/BentoGrid'
import { Spotlight } from '@/components/ui/spotlight'
import { Meteors } from '@/components/ui/meteors'
import { BorderBeam } from '@/components/ui/border-beam'
import { createClient } from '@/lib/supabase/server'

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

      {/* Hero — asymmetric on lg+ (text left, AppPreview right per
          taste-skill "ANTI-CENTER BIAS"), centered on mobile. Headline
          downsized per "NO Oversized H1s" — gradient lives ONLY on
          accent word, rest is solid foreground.

          Container max-w-[1400px] per taste-skill default, comfortable
          on 16" laptops + 27" monitors. */}
      <section className="relative px-6 pt-12 md:pt-16 pb-16 md:pb-24 overflow-hidden">
        <Aurora className="z-0" />
        <Spotlight size={700} color="rgba(124, 58, 237, 0.22)" />
        <Meteors number={10} />

        <div className="relative z-10 max-w-[1400px] w-full mx-auto grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-center">
          {/* Left — text column */}
          <div className="lg:col-span-7 text-center lg:text-left">
            {/* Eyebrow badge */}
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-card border border-border text-[11px] uppercase tracking-[0.18em] text-muted-foreground mb-6 shadow-sm dark:bg-white/[0.06] dark:border-white/15 dark:backdrop-blur-md dark:shadow-none">
              <Sparkles className="w-3.5 h-3.5 text-brand" />
              <span>Creator outreach, end to end</span>
            </div>

            {/* Headline — downsized per taste-skill. Gradient is only on
                the accent word. Rest = solid text-foreground via the
                TextGenerateEffect's non-accent branch. */}
            <TextGenerateEffect
              words="Stop burning leads in spreadsheets."
              accentWord="spreadsheets"
              className="text-4xl md:text-5xl lg:text-6xl xl:text-7xl font-bold tracking-tight mb-6 leading-[1.02]"
            />

            <p className="text-base md:text-lg text-muted-foreground max-w-xl lg:max-w-none mb-8 leading-relaxed mx-auto lg:mx-0">
              Find creators that fit. Score them in plain English. Run the whole pipeline — discovery, pitch, follow-ups, analytics — without the spreadsheet circus.
            </p>

            <div className="flex flex-col sm:flex-row items-center lg:justify-start justify-center gap-3">
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

          {/* Right — AppPreview column. Hidden visually below lg
              because the carousel is too dense for narrow screens
              (it appears as its own section below instead). */}
          <div className="hidden lg:block lg:col-span-5">
            <AppPreview />
          </div>
        </div>
      </section>

      {/* App preview — only renders on viewports < lg, where it sits
          as a standalone section below the hero. lg+ shows it inline
          as the right column of the hero. */}
      <section className="relative px-6 pt-2 mb-16 md:mb-20 z-10 lg:hidden">
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

          <BentoGrid>
            <BentoCard
              className="md:col-span-2"
              title="Smart search across every platform"
              description="Search YouTube, Instagram, TikTok, X, and LinkedIn. Filter by occupation, niche, audience size, region, and last-posted date. Skip the dead channels automatically."
              icon={<Search className="w-3.5 h-3.5" />}
              visual={<SearchVisual />}
            />
            <BentoCard
              title="AI fit scoring"
              description="Tell the tool what makes a good lead in plain English. It tunes the weights and ranks your queue."
              icon={<Sparkles className="w-3.5 h-3.5" />}
              visual={<ScoringVisual />}
              delay={0.1}
            />
            <BentoCard
              className="md:col-span-2"
              title="Built-in CRM"
              description="Track every outreach, status, response, and follow-up. Channel, email, and status pills in one row — replace your spreadsheet."
              icon={<KanbanSquare className="w-3.5 h-3.5" />}
              visual={<CrmVisual />}
              delay={0.15}
            />
            <BentoCard
              title="Smart follow-up cadence"
              description="When you reach out, the system schedules the next ping — 3d, 7d, 14d, then 21d. Your queue stays sharp without you babysitting it."
              icon={<MailPlus className="w-3.5 h-3.5" />}
              visual={<CadenceVisual />}
              delay={0.2}
            />
            <BentoCard
              className="md:col-span-2"
              title="Analytics dashboard"
              description="Win rate, response rate, pipeline value, stale follow-ups, status breakdown. The dashboard you'd build in 4 hours, ready out of the box."
              icon={<BarChart3 className="w-3.5 h-3.5" />}
              visual={<AnalyticsVisual />}
              delay={0.25}
            />
            <BentoCard
              title="Build any metric"
              description="Count, percentage, sum, average — over any filter. Saves to your dashboard. No formulas, no spreadsheets."
              icon={<BarChart3 className="w-3.5 h-3.5" />}
              visual={<CustomMetricsVisual />}
              delay={0.3}
            />
          </BentoGrid>
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
            No credit card. No usage cap on outreach. When pricing lands, beta users keep a generous free tier forever.
          </p>

          <div className="grid sm:grid-cols-2 gap-4 max-w-2xl mx-auto text-left">
            <div className="rounded-2xl border border-border bg-card p-6 shadow-sm dark:bg-white/5 dark:backdrop-blur-md dark:border-white/10 dark:shadow-none">
              <div className="text-sm font-medium text-foreground mb-1">Beta</div>
              <div className="text-3xl font-bold tracking-tight mb-2">$0</div>
              <div className="text-xs text-muted-foreground mb-4">Free, no card required</div>
              <ul className="text-sm text-muted-foreground space-y-1.5">
                <li>· Unlimited outreach tracking</li>
                <li>· AI fit scoring</li>
                <li>· Smart follow-up cadence</li>
                <li>· Analytics + custom metrics</li>
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
