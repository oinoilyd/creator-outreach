import Link from 'next/link'
import { Sparkles } from 'lucide-react'
import { TextGenerateEffect } from '@/components/landing/TextGenerateEffect'
import { AppPreview } from '@/components/landing/AppPreview'
import { PlatformMarquee } from '@/components/landing/PlatformMarquee'
import { Meteors } from '@/components/ui/meteors'
import { BorderBeam } from '@/components/ui/border-beam'
import { getLandingAuthState } from '@/components/landing/getLandingData'

/**
 * V3 / Home — hero + product preview + platform marquee. Stops
 * here. Use the top nav to go to /product, /pricing, or /about.
 */

export const metadata = {
  title: 'Creator Outreach — Find them, score them, pitch them, close them.',
  description: 'Find creators across YouTube, Instagram, TikTok, X, and LinkedIn. Score them by fit, run your whole outreach pipeline in one place.',
}

export default async function V3Home() {
  const { isAuthed } = await getLandingAuthState()

  return (
    <>
      <section className="relative px-6 pt-12 md:pt-16 pb-12 md:pb-16 overflow-hidden">
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
                className="relative z-10 inline-flex items-center gap-2 bg-primary text-primary-foreground hover:opacity-90 active:scale-[0.98] px-7 py-3.5 rounded-lg font-semibold text-base transition-[opacity,transform] duration-150 shadow-[0_8px_24px_-8px_rgba(0,0,0,0.18)]"
              >
                {isAuthed ? 'Open app' : 'Get started — free'}
                <span aria-hidden>→</span>
              </Link>
              <BorderBeam size={110} duration={7} colorFrom="#7c3aed" colorTo="#06b6d4" />
            </span>
            <Link
              href="/landing/v3/product"
              className="px-6 py-3.5 rounded-lg font-medium text-muted-foreground hover:text-foreground active:scale-[0.98] border border-border hover:border-brand/40 transition-[color,border-color,transform] duration-150 dark:border-white/15 dark:hover:border-white/30"
            >
              See what it does
            </Link>
          </div>

          <p className="mt-6 text-xs text-muted-foreground/70">
            Free while in beta · No credit card · Cancel anytime
          </p>
        </div>
      </section>

      <section className="relative px-6 pb-16 md:pb-24 z-10">
        <AppPreview />
      </section>

      <section className="relative px-6 pb-20 md:pb-28 z-10">
        <PlatformMarquee />
      </section>

      <section className="relative px-6 pb-20 md:pb-28 z-10">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-2xl md:text-3xl font-bold tracking-tight mb-3">
            Want the full tour?
          </h2>
          <p className="text-muted-foreground mb-7">
            See every feature on the Product page, or jump straight to pricing.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/landing/v3/product"
              className="inline-flex items-center gap-2 bg-foreground text-background hover:opacity-90 px-5 py-2.5 rounded-lg font-medium text-sm transition-opacity"
            >
              See the product →
            </Link>
            <Link
              href="/landing/v3/pricing"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg font-medium text-sm border border-border hover:border-brand/40 transition-colors"
            >
              See pricing
            </Link>
          </div>
        </div>
      </section>
    </>
  )
}
