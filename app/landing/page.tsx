import Link from 'next/link'
import { Search, Sparkles, KanbanSquare, MailPlus, BarChart3 } from 'lucide-react'
import { Aurora } from '@/components/landing/Aurora'
import { TextGenerateEffect } from '@/components/landing/TextGenerateEffect'
import { AppPreview } from '@/components/landing/AppPreview'
import { LandingNav } from '@/components/landing/LandingNav'
import { ContactForm } from '@/components/landing/ContactForm'
import { FAQ } from '@/components/landing/FAQ'
import {
  BentoGrid, BentoCard,
  SearchVisual, ScoringVisual, CrmVisual, CadenceVisual, AnalyticsVisual,
} from '@/components/landing/BentoGrid'
import { createClient } from '@/lib/supabase/server'

export const metadata = {
  title: 'Creator Outreach — find them, score them, pitch them, close them',
  description: 'Search YouTube, score creators by fit, run your whole outreach pipeline in one place.',
}

export default async function LandingPage() {
  // Server-side auth check so the nav can show "Open app" / "Sign out"
  // for logged-in visitors instead of the signup CTA.
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const isAuthed = !!user

  return (
    <main className="relative min-h-screen bg-background text-foreground overflow-x-hidden">
      <LandingNav isAuthed={isAuthed} />

      {/* Hero */}
      <section className="relative px-6 pt-12 md:pt-16 pb-12 md:pb-20">
        <Aurora className="z-0" />
        <div className="relative z-10 max-w-5xl w-full mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-gray-900/5 dark:bg-white/5 border border-gray-900/10 dark:border-white/10 backdrop-blur-md text-xs text-gray-700 dark:text-gray-300 mb-7">
            <Sparkles className="w-3.5 h-3.5 text-purple-500 dark:text-purple-300" />
            <span>YouTube outreach, end to end</span>
          </div>
          <TextGenerateEffect
            words="Find them. Score them. Pitch them. Close them."
            className="text-4xl md:text-6xl lg:text-7xl font-bold tracking-tight mb-6 bg-gradient-to-br from-gray-900 via-gray-900 to-gray-500 dark:from-white dark:via-white dark:to-gray-400 bg-clip-text text-transparent leading-[1.05]"
          />
          <p className="text-base md:text-lg text-gray-600 dark:text-gray-400 max-w-xl mx-auto mb-9 leading-relaxed">
            Search YouTube, score creators by fit, and run your whole outreach pipeline — without the spreadsheet circus.
          </p>
          <div className="flex items-center justify-center gap-3">
            <Link
              href={isAuthed ? '/' : '/auth/signup'}
              className="bg-gray-900 text-white hover:bg-gray-800 dark:bg-white dark:text-gray-950 dark:hover:bg-gray-200 px-6 py-3 rounded-lg font-semibold transition-colors shadow-[0_0_60px_-12px_rgba(168,85,247,0.6)]"
            >
              {isAuthed ? 'Open app' : 'Get started — free'}
            </Link>
            {!isAuthed && (
              <Link
                href="/auth/signin"
                className="px-6 py-3 rounded-lg font-medium text-gray-700 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white border border-gray-900/10 dark:border-white/10 hover:border-gray-900/30 dark:hover:border-white/30 backdrop-blur-sm transition-colors"
              >
                Sign in
              </Link>
            )}
          </div>
        </div>
      </section>

      {/* App preview */}
      <section className="relative px-6 -mt-8 md:-mt-4 mb-24 md:mb-32 z-10">
        <AppPreview />
      </section>

      {/* Bento features */}
      <section className="relative px-6 pb-20 md:pb-28 z-10">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <div className="text-[11px] uppercase tracking-[0.2em] text-purple-600/90 dark:text-purple-300/80 mb-3">Built for outreach</div>
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-3">
              Everything you need, nothing you don't.
            </h2>
            <p className="text-gray-600 dark:text-gray-400 max-w-xl mx-auto">
              One tool replaces YouTube discovery, a spreadsheet, a CRM, and a cadence reminder.
            </p>
          </div>

          <BentoGrid>
            <BentoCard
              className="md:col-span-2"
              title="Smart search across YouTube"
              description="Filter by keyword, audience size, region, and last-posted date. Skip the dead channels and ghost towns automatically."
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
              title="Built-in CRM"
              description="Track every outreach, status, response, and follow-up. Replace your spreadsheet."
              icon={<KanbanSquare className="w-3.5 h-3.5" />}
              visual={<CrmVisual />}
              delay={0.15}
            />
            <BentoCard
              className="md:col-span-2"
              title="Smart follow-up cadence"
              description="When you reach out, the system schedules the next ping — 3d, 7d, 14d, then 21d. Your queue stays sharp without you babysitting it."
              icon={<MailPlus className="w-3.5 h-3.5" />}
              visual={<CadenceVisual />}
              delay={0.2}
            />
            <BentoCard
              className="md:col-span-3"
              title="Analytics + custom metrics"
              description="Win rate, response rate, pipeline value. Build your own metric cards in seconds — count, percentage, sum, or average over any filter."
              icon={<BarChart3 className="w-3.5 h-3.5" />}
              visual={<AnalyticsVisual />}
              delay={0.25}
            />
          </BentoGrid>
        </div>
      </section>

      {/* About */}
      <section id="about" className="relative px-6 pb-20 md:pb-28 z-10 scroll-mt-20">
        <div className="max-w-3xl mx-auto">
          <div className="text-[11px] uppercase tracking-[0.2em] text-purple-600/90 dark:text-purple-300/80 mb-3">About</div>
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-6">
            Built by someone who needed it.
          </h2>
          <p className="text-base md:text-lg text-gray-600 dark:text-gray-400 leading-relaxed">
            Creator Outreach started as a tool I built for myself. I was running outreach to YouTube creators with a spreadsheet, three browser tabs, and a Notion page that was always out of date. The pricier tools cost more than my rent and still couldn't tell me what made a good lead — so I built this. It searches YouTube directly, scores creators against criteria you describe in plain English, and runs the whole pipeline — pitch, status, follow-up cadence, analytics — without copy-pasting between five tabs. It's still early, run by one person, and growing every week from feedback by the people using it. If you're using it and something's off, tell me — that's how it gets better.
          </p>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="relative px-6 pb-20 md:pb-28 z-10 scroll-mt-20">
        <div className="max-w-3xl mx-auto text-center">
          <div className="text-[11px] uppercase tracking-[0.2em] text-purple-600/90 dark:text-purple-300/80 mb-3">Pricing</div>
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-3">
            Free while in beta.
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mb-10 max-w-xl mx-auto">
            No credit card. No usage cap on outreach. When pricing lands, beta users keep a generous free tier forever.
          </p>

          <div className="grid sm:grid-cols-2 gap-4 max-w-2xl mx-auto text-left">
            <div className="rounded-2xl border border-gray-200 dark:border-white/10 bg-white/60 dark:bg-gray-900/40 backdrop-blur-sm p-6">
              <div className="text-sm font-medium text-gray-900 dark:text-white mb-1">Beta</div>
              <div className="text-3xl font-bold tracking-tight mb-2">$0</div>
              <div className="text-xs text-gray-500 dark:text-gray-500 mb-4">Free, no card required</div>
              <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1.5">
                <li>· Unlimited outreach tracking</li>
                <li>· AI fit scoring</li>
                <li>· Smart follow-up cadence</li>
                <li>· Analytics + custom metrics</li>
              </ul>
            </div>
            <div className="rounded-2xl border border-purple-200 dark:border-purple-500/30 bg-gradient-to-br from-purple-50 to-blue-50 dark:from-purple-500/10 dark:to-blue-500/10 backdrop-blur-sm p-6">
              <div className="text-sm font-medium text-purple-700 dark:text-purple-300 mb-1">Coming later</div>
              <div className="text-3xl font-bold tracking-tight mb-2">TBD</div>
              <div className="text-xs text-gray-500 dark:text-gray-500 mb-4">For heavier users + teams</div>
              <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1.5">
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
          <div className="text-[11px] uppercase tracking-[0.2em] text-purple-600/90 dark:text-purple-300/80 mb-3 text-center">FAQ</div>
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-10 text-center">
            Common questions.
          </h2>
          <FAQ />
        </div>
      </section>

      {/* Contact */}
      <section id="contact" className="relative px-6 pb-20 md:pb-28 z-10 scroll-mt-20">
        <div className="max-w-2xl mx-auto">
          <div className="text-[11px] uppercase tracking-[0.2em] text-purple-600/90 dark:text-purple-300/80 mb-3 text-center">Contact</div>
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-3 text-center">
            Get in touch.
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mb-8 text-center">
            Feedback, bugs, feature ideas, partnership questions — all land in the same inbox.
          </p>
          <div className="rounded-2xl border border-gray-200 dark:border-white/10 bg-white/60 dark:bg-gray-900/40 backdrop-blur-sm p-6 md:p-8">
            <ContactForm />
          </div>
        </div>
      </section>

      {/* CTA strip */}
      {!isAuthed && (
        <section className="relative px-6 pb-20 z-10">
          <div className="max-w-3xl mx-auto rounded-2xl border border-gray-200 dark:border-white/5 bg-gray-50 dark:bg-gray-900/40 p-8 md:p-10 text-center backdrop-blur-sm">
            <h3 className="text-xl md:text-2xl font-bold tracking-tight mb-2">
              Stop emailing the wrong creators.
            </h3>
            <p className="text-sm text-gray-500 mb-5">
              Free to start. No card required.
            </p>
            <Link
              href="/auth/signup"
              className="inline-block bg-gray-900 text-white hover:bg-gray-800 dark:bg-white dark:text-gray-950 dark:hover:bg-gray-200 px-5 py-2.5 rounded-lg font-semibold text-sm transition-colors"
            >
              Get started
            </Link>
          </div>
        </section>
      )}

      <footer className="relative z-10 px-6 py-6 border-t border-gray-200 dark:border-white/5 text-center text-xs text-gray-500 dark:text-gray-600">
        © {new Date().getFullYear()} Creator Outreach. <a href="#contact" className="hover:text-gray-700 dark:hover:text-gray-400">Contact</a>
      </footer>
    </main>
  )
}
