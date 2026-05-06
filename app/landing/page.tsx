import Link from 'next/link'
import { Search, Sparkles, KanbanSquare, MailPlus, Star } from 'lucide-react'
import { BackgroundBeams } from '@/components/landing/BackgroundBeams'
import { TextGenerateEffect } from '@/components/landing/TextGenerateEffect'
import { BentoGrid, BentoCard } from '@/components/landing/BentoGrid'

export const metadata = {
  title: 'Creator Outreach — find them, score them, pitch them, close them',
  description: 'Search YouTube, score creators by fit, run your whole outreach pipeline in one place.',
}

export default function LandingPage() {
  return (
    <main className="relative min-h-screen bg-gray-950 text-white overflow-x-hidden">
      {/* Header */}
      <header className="relative z-10 px-6 py-5 flex items-center justify-between max-w-6xl w-full mx-auto">
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
      <section className="relative px-6 pt-12 md:pt-20 pb-20 md:pb-28">
        <BackgroundBeams className="z-0" />
        <div className="relative z-10 max-w-5xl w-full mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 backdrop-blur-sm text-xs text-gray-300 mb-6">
            <Sparkles className="w-3.5 h-3.5 text-purple-300" />
            <span>YouTube outreach, end to end</span>
          </div>
          <TextGenerateEffect
            words="Find them. Score them. Pitch them. Close them."
            className="text-4xl md:text-6xl lg:text-7xl font-bold tracking-tight mb-6 bg-gradient-to-br from-white to-gray-400 bg-clip-text text-transparent leading-[1.05]"
          />
          <p className="text-base md:text-lg text-gray-400 max-w-2xl mx-auto mb-9 leading-relaxed">
            Search YouTube, score creators by fit to your offer, then run your whole outreach pipeline — without juggling spreadsheets, tabs, or tools.
          </p>
          <div className="flex items-center justify-center gap-3">
            <Link
              href="/auth/signup"
              className="bg-white text-gray-950 hover:bg-gray-200 px-6 py-3 rounded-lg font-semibold transition-colors shadow-[0_0_40px_-8px_rgba(168,85,247,0.4)]"
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

      {/* Bento features */}
      <section className="relative px-6 pb-24 z-10">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-10">
            <div className="text-[11px] uppercase tracking-[0.2em] text-purple-300/80 mb-2">Built for outreach</div>
            <h2 className="text-2xl md:text-4xl font-bold tracking-tight">
              Everything you need to close more creators.
            </h2>
          </div>
          <BentoGrid>
            {/* Big card — spans 2 cols */}
            <BentoCard
              className="md:col-span-2 md:row-span-2"
              title="Smart search across YouTube"
              description="Filter by keyword, audience size, region, and last-posted date. Skip the dead channels and ghost-towns automatically."
              icon={<Search className="w-5 h-5" />}
              visual={
                <div className="aspect-[2/1] bg-gradient-to-br from-purple-900/40 via-gray-900 to-blue-900/30 border-b border-gray-800 relative overflow-hidden flex items-center justify-center">
                  <div className="absolute inset-0 opacity-20" style={{
                    backgroundImage: 'radial-gradient(circle at 25% 25%, rgba(168,85,247,0.4) 0%, transparent 50%), radial-gradient(circle at 75% 75%, rgba(59,130,246,0.4) 0%, transparent 50%)',
                  }} />
                  <div className="relative px-6 py-3 rounded-full bg-gray-900/80 border border-gray-700 backdrop-blur-sm text-xs text-gray-300 font-mono">
                    "fitness creators · 10k–100k subs · last 30d"
                  </div>
                </div>
              }
            />

            <BentoCard
              title="AI fit scoring"
              description="Tell the tool what makes a good lead in plain English. It tunes the weights and ranks your queue."
              icon={<Sparkles className="w-5 h-5" />}
              delay={0.1}
            />

            <BentoCard
              title="Built-in CRM"
              description="Track outreach, status, follow-ups, and notes. Replace your spreadsheet."
              icon={<KanbanSquare className="w-5 h-5" />}
              delay={0.2}
            />

            <BentoCard
              className="md:col-span-2"
              title="Smart follow-up cadence"
              description="When you reach out, the system schedules the next ping (3d → 7d → 14d → 21d). Your queue is always up to date."
              icon={<MailPlus className="w-5 h-5" />}
              delay={0.3}
            />

            <BentoCard
              title="Favorites & analytics"
              description="Star the best leads. Track win rates, response rates, and pipeline value with custom metrics."
              icon={<Star className="w-5 h-5" />}
              delay={0.4}
            />
          </BentoGrid>
        </div>
      </section>

      {/* Bottom CTA */}
      <section className="relative px-6 pb-24 z-10">
        <div className="max-w-3xl mx-auto text-center bg-gray-900/40 border border-gray-800 rounded-2xl p-10">
          <h3 className="text-2xl md:text-3xl font-bold tracking-tight mb-3">
            Stop emailing the wrong creators.
          </h3>
          <p className="text-gray-400 mb-6">
            Free to start. No card required.
          </p>
          <Link
            href="/auth/signup"
            className="inline-block bg-white text-gray-950 hover:bg-gray-200 px-6 py-3 rounded-lg font-semibold transition-colors"
          >
            Get started
          </Link>
        </div>
      </section>

      <footer className="relative z-10 px-6 py-6 border-t border-gray-900 text-center text-xs text-gray-600">
        © {new Date().getFullYear()} Creator Outreach. <a href="mailto:dmeehanj@gmail.com" className="hover:text-gray-400">Contact</a>
      </footer>
    </main>
  )
}
