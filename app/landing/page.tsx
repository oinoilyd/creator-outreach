import Link from 'next/link'
import { Search, Sparkles, KanbanSquare, MailPlus, BarChart3 } from 'lucide-react'
import { Aurora } from '@/components/landing/Aurora'
import { TextGenerateEffect } from '@/components/landing/TextGenerateEffect'
import { AppPreview } from '@/components/landing/AppPreview'
import {
  BentoGrid, BentoCard,
  SearchVisual, ScoringVisual, CrmVisual, CadenceVisual, AnalyticsVisual,
} from '@/components/landing/BentoGrid'

export const metadata = {
  title: 'Creator Outreach — find them, score them, pitch them, close them',
  description: 'Search YouTube, score creators by fit, run your whole outreach pipeline in one place.',
}

export default function LandingPage() {
  return (
    <main className="relative min-h-screen bg-gray-950 text-white overflow-x-hidden">
      {/* Header */}
      <header className="relative z-20 px-6 py-5 flex items-center justify-between max-w-6xl w-full mx-auto">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-purple-600 to-blue-600 flex items-center justify-center text-sm font-bold">C</div>
          <span className="font-semibold tracking-tight">Creator Outreach</span>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/auth/signin" className="text-sm text-gray-300 hover:text-white">Sign in</Link>
          <Link
            href="/auth/signup"
            className="text-sm bg-white text-gray-950 hover:bg-gray-200 px-4 py-2 rounded-lg font-medium transition-colors"
          >
            Get started
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="relative px-6 pt-12 md:pt-16 pb-12 md:pb-20">
        <Aurora className="z-0" />
        <div className="relative z-10 max-w-5xl w-full mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 backdrop-blur-md text-xs text-gray-300 mb-7">
            <Sparkles className="w-3.5 h-3.5 text-purple-300" />
            <span>YouTube outreach, end to end</span>
          </div>
          <TextGenerateEffect
            words="Find them. Score them. Pitch them. Close them."
            className="text-4xl md:text-6xl lg:text-7xl font-bold tracking-tight mb-6 bg-gradient-to-br from-white via-white to-gray-400 bg-clip-text text-transparent leading-[1.05]"
          />
          <p className="text-base md:text-lg text-gray-400 max-w-xl mx-auto mb-9 leading-relaxed">
            Search YouTube, score creators by fit, and run your whole outreach pipeline — without the spreadsheet circus.
          </p>
          <div className="flex items-center justify-center gap-3">
            <Link
              href="/auth/signup"
              className="bg-white text-gray-950 hover:bg-gray-200 px-6 py-3 rounded-lg font-semibold transition-colors shadow-[0_0_60px_-12px_rgba(168,85,247,0.6)]"
            >
              Get started — free
            </Link>
            <Link
              href="/auth/signin"
              className="px-6 py-3 rounded-lg font-medium text-gray-300 hover:text-white border border-white/10 hover:border-white/30 backdrop-blur-sm transition-colors"
            >
              Sign in
            </Link>
          </div>
        </div>
      </section>

      {/* App preview — the hero's visual anchor */}
      <section className="relative px-6 -mt-8 md:-mt-4 mb-24 md:mb-32 z-10">
        <AppPreview />
      </section>

      {/* Bento features */}
      <section className="relative px-6 pb-20 md:pb-28 z-10">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <div className="text-[11px] uppercase tracking-[0.2em] text-purple-300/80 mb-3">Built for outreach</div>
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-3">
              Everything you need, nothing you don't.
            </h2>
            <p className="text-gray-400 max-w-xl mx-auto">
              One tool replaces YouTube discovery, a spreadsheet, a CRM, and a cadence reminder.
            </p>
          </div>

          <BentoGrid>
            {/* Row 1: big search + tall AI scoring */}
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

            {/* Row 2: small CRM + wide cadence */}
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

            {/* Row 3: full-width analytics */}
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

      {/* CTA strip — softer, less marketing-bro */}
      <section className="relative px-6 pb-20 z-10">
        <div className="max-w-3xl mx-auto rounded-2xl border border-white/5 bg-gray-900/40 p-8 md:p-10 text-center backdrop-blur-sm">
          <h3 className="text-xl md:text-2xl font-bold tracking-tight mb-2">
            Stop emailing the wrong creators.
          </h3>
          <p className="text-sm text-gray-500 mb-5">
            Free to start. No card required.
          </p>
          <Link
            href="/auth/signup"
            className="inline-block bg-white text-gray-950 hover:bg-gray-200 px-5 py-2.5 rounded-lg font-semibold text-sm transition-colors"
          >
            Get started
          </Link>
        </div>
      </section>

      <footer className="relative z-10 px-6 py-6 border-t border-white/5 text-center text-xs text-gray-600">
        © {new Date().getFullYear()} Creator Outreach. <a href="mailto:dmeehanj@gmail.com" className="hover:text-gray-400">Contact</a>
      </footer>
    </main>
  )
}
