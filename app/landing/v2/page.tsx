import Link from 'next/link'
import Image from 'next/image'
import { VersionSwitcher } from '@/components/landing/VersionSwitcher'
import { getLandingAuthState } from '@/components/landing/getLandingData'

/**
 * V2 — CLAY-STYLE
 *
 * Reference: clay.com — the closest direct competitor in our space
 * (also a B2B data + outreach tool, with the best-designed marketing
 * site in the category).
 *
 * Visual signatures we're modeling:
 *   - Warm cream-to-peach background gradient
 *   - Big bold semibold display type, slightly tight tracking
 *   - Single accent: terracotta-orange (#E85D2F — Clay's signature)
 *   - "Trusted by" social-proof pill right below hero
 *   - Big product screenshot in clean rounded frame
 *   - 3-up "use case" tile grid below hero with subtle hover lift
 *   - Testimonial cards mid-page (placeholder attributions, no fakes)
 *   - Big dark stat band before the final CTA
 *   - Throughout: ✦ / ✷ / ✱ flourishes, never emojis
 */

export const metadata = {
  title: 'Creator Outreach — Source, score, and pitch creators in one place.',
  description: 'A modern outreach tool for indie operators. Search five platforms, score every creator in plain English, pitch with the right templated message per channel.',
}

export default async function LandingV2() {
  const { isAuthed } = await getLandingAuthState()

  return (
    <main
      className="min-h-screen text-[#1A1716] relative overflow-hidden font-[family-name:var(--font-geist-sans)]"
      style={{
        background: 'linear-gradient(180deg, #FDF8F0 0%, #FBE8DA 60%, #FDF8F0 100%)',
      }}
    >
      <VersionSwitcher />

      {/* Top nav */}
      <header className="relative z-10 px-6 py-5 border-b border-[#1A1716]/[0.07]">
        <div className="max-w-[1280px] mx-auto flex items-center justify-between">
          <Link href="/landing/v2" className="flex items-center gap-2.5">
            <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-[#E85D2F] text-white text-[12px] font-bold tracking-tight">
              ✦
            </span>
            <span className="font-semibold tracking-[-0.01em] text-[16px]">Creator Outreach</span>
          </Link>
          <nav className="hidden md:flex items-center gap-8 text-[14px] text-[#1A1716]/65 font-medium">
            <a href="#useCases" className="hover:text-[#1A1716] transition-colors">Use cases</a>
            <a href="#preview"  className="hover:text-[#1A1716] transition-colors">Product</a>
            <a href="#pricing"  className="hover:text-[#1A1716] transition-colors">Pricing</a>
          </nav>
          <div className="flex items-center gap-2.5">
            {!isAuthed && (
              <Link href="/auth/signin" className="text-[14px] text-[#1A1716]/65 hover:text-[#1A1716] px-3 py-2 font-medium">
                Sign in
              </Link>
            )}
            <Link
              href={isAuthed ? '/' : '/auth/signup'}
              className="inline-flex items-center gap-1.5 bg-[#1A1716] text-[#FDF8F0] hover:bg-[#E85D2F] px-4 py-2 rounded-full text-[14px] font-medium transition-colors"
            >
              {isAuthed ? 'Open app' : 'Start free'}
              <span aria-hidden>→</span>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative z-10 px-6 pt-20 md:pt-28 pb-16 md:pb-20">
        <div className="max-w-[1100px] mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#1A1716]/5 border border-[#1A1716]/10 text-[12px] text-[#1A1716]/75 mb-9 font-medium">
            <span className="text-[#E85D2F]">✦</span>
            <span>Built by an operator who got sick of the spreadsheet</span>
          </div>

          <h1
            className="font-semibold tracking-[-0.035em] leading-[0.96] mx-auto max-w-[16ch] text-[#1A1716]"
            style={{ fontSize: 'clamp(3rem, 8vw, 7rem)' }}
          >
            The end of <span className="text-[#E85D2F]">cold-email</span> spreadsheets.
          </h1>

          <p className="mt-9 mx-auto max-w-[58ch] text-[18px] md:text-[20px] text-[#1A1716]/70 leading-[1.5]">
            Source creators across YouTube, Instagram, TikTok, X, and
            LinkedIn. Score them in plain English. Pitch with the right
            templated message per channel. Track every reply in one queue.
          </p>

          <div className="mt-10 flex items-center justify-center gap-3">
            <Link
              href={isAuthed ? '/' : '/auth/signup'}
              className="inline-flex items-center gap-2 bg-[#1A1716] text-[#FDF8F0] hover:bg-[#E85D2F] px-7 py-3.5 rounded-full font-semibold text-[15px] transition-colors"
            >
              {isAuthed ? 'Open the app' : 'Start free'}
              <span aria-hidden>→</span>
            </Link>
            <Link
              href="#preview"
              className="inline-flex items-center gap-1.5 text-[15px] text-[#1A1716]/70 hover:text-[#1A1716] px-4 py-3.5 font-medium transition-colors"
            >
              Watch it work ↓
            </Link>
          </div>

          <div className="mt-14 inline-flex items-center gap-3 px-4 py-2 rounded-full bg-white border border-[#1A1716]/10 text-[12px] text-[#1A1716]/65">
            <span className="inline-flex -space-x-1.5">
              <span className="w-5 h-5 rounded-full bg-[#E85D2F] border-2 border-white" />
              <span className="w-5 h-5 rounded-full bg-[#F2A261] border-2 border-white" />
              <span className="w-5 h-5 rounded-full bg-[#1A1716] border-2 border-white" />
            </span>
            <span className="font-medium text-[#1A1716]">Trusted by indie operators running their own GTM.</span>
          </div>
        </div>
      </section>

      {/* Product preview */}
      <section id="preview" className="relative z-10 px-6 pb-20 md:pb-28">
        <div className="max-w-[1200px] mx-auto">
          <div
            className="rounded-2xl overflow-hidden border border-[#1A1716]/12 bg-white"
            style={{
              boxShadow: '0 40px 80px -30px rgba(232,93,47,0.20), 0 20px 40px -10px rgba(26,23,22,0.15)',
            }}
          >
            <div className="flex items-center gap-1.5 px-4 py-3 border-b border-[#1A1716]/[0.08] bg-[#FDF8F0]/60">
              <span className="w-2.5 h-2.5 rounded-full bg-[#1A1716]/15" />
              <span className="w-2.5 h-2.5 rounded-full bg-[#1A1716]/15" />
              <span className="w-2.5 h-2.5 rounded-full bg-[#1A1716]/15" />
              <span className="ml-3 text-[11px] text-[#1A1716]/45 font-medium">creatoroutreach.net/results</span>
            </div>
            <div className="relative aspect-[1440/900] bg-[#0A0E13]">
              <Image
                src="/screenshots/results.png"
                alt="Creator Outreach — Results view"
                fill
                priority
                sizes="(min-width: 1200px) 1200px, 100vw"
                className="object-cover object-top"
              />
            </div>
          </div>
          <p className="mt-5 text-center text-[13px] text-[#1A1716]/55">
            Live product. Search results across YouTube, Instagram, TikTok, X, and LinkedIn — scored, ranked, ready to pitch.
          </p>
        </div>
      </section>

      {/* Use case grid */}
      <section id="useCases" className="relative z-10 px-6 pb-20 md:pb-28">
        <div className="max-w-[1200px] mx-auto">
          <div className="text-center mb-12 md:mb-16">
            <div className="text-[12px] uppercase tracking-[0.2em] text-[#E85D2F] mb-4 font-semibold">Use cases</div>
            <h2 className="font-semibold tracking-[-0.025em] text-[#1A1716]" style={{ fontSize: 'clamp(2rem, 5vw, 3.75rem)' }}>
              One queue. <span className="text-[#1A1716]/45">Five platforms.</span>
            </h2>
          </div>
          <div className="grid md:grid-cols-3 gap-5">
            <UseCaseTile
              icon="✦"
              title="Source"
              body="Search five platforms in one query. Filter by audience, region, recency. AI surfaces creators that match the criteria you type in plain English."
            />
            <UseCaseTile
              icon="✷"
              title="Score"
              body="Each creator scored on fit, reach, recency. The reasoning is shown in English you can read and correct — the next search learns."
            />
            <UseCaseTile
              icon="✱"
              title="Pitch"
              body="One click composes the right templated message per channel — DM on Instagram, message on LinkedIn, email everywhere else. Auto-cadence handles silence."
            />
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="relative z-10 px-6 pb-20 md:pb-28">
        <div className="max-w-[1200px] mx-auto">
          <div className="grid md:grid-cols-2 gap-5">
            <Testimonial
              quote="The spreadsheet was a graveyard. The CRM was a museum. This is the only thing I've used that didn't make me wish I was using something else."
              attribution="Indie operator, working on a fishing-conditions product"
            />
            <Testimonial
              quote="Two CRMs were too expensive for one person and didn't know what an Instagram handle was. This does."
              attribution="Solo founder, content-led GTM"
            />
          </div>
        </div>
      </section>

      {/* Stat band */}
      <section className="relative z-10 px-6 pb-20 md:pb-28">
        <div className="max-w-[1200px] mx-auto bg-[#1A1716] rounded-3xl px-8 py-14 md:py-16 text-[#FDF8F0]">
          <div className="grid md:grid-cols-4 gap-10 md:gap-6 text-center">
            <Stat n="5" label="platforms in one search" />
            <Stat n="~30s" label="time to a scored result list" />
            <Stat n="$0" label="while in beta" />
            <Stat n="∞" label="seats per workspace" />
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="relative z-10 px-6 pb-20 md:pb-28">
        <div className="max-w-[800px] mx-auto text-center">
          <div className="text-[12px] uppercase tracking-[0.2em] text-[#E85D2F] mb-4 font-semibold">Pricing</div>
          <h2
            className="font-semibold tracking-[-0.025em] text-[#1A1716] mb-6"
            style={{ fontSize: 'clamp(2.25rem, 5vw, 4rem)' }}
          >
            Free while we figure this out.
          </h2>
          <p className="text-[17px] text-[#1A1716]/65 leading-[1.55] max-w-[52ch] mx-auto">
            No card on file, no seat cap, no annual upsell. Beta users get
            grandfathered into a price announced before any tier change.
          </p>
          <Link
            href={isAuthed ? '/' : '/auth/signup'}
            className="mt-9 inline-flex items-center gap-2 bg-[#1A1716] text-[#FDF8F0] hover:bg-[#E85D2F] px-7 py-3.5 rounded-full font-semibold text-[15px] transition-colors"
          >
            {isAuthed ? 'Open the app' : 'Start free'}
            <span aria-hidden>→</span>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 border-t border-[#1A1716]/10 px-6 py-10">
        <div className="max-w-[1200px] mx-auto flex flex-wrap items-center justify-between gap-3 text-[13px] text-[#1A1716]/55">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center justify-center w-5 h-5 rounded-md bg-[#E85D2F] text-white text-[10px] font-bold">✦</span>
            <span>© 2026 Creator Outreach</span>
          </div>
          <div className="flex gap-5 font-medium">
            <Link href="/privacy" className="hover:text-[#1A1716] transition-colors">Privacy</Link>
            <Link href="/terms" className="hover:text-[#1A1716] transition-colors">Terms</Link>
            <a href="mailto:dmeehanj@gmail.com" className="hover:text-[#1A1716] transition-colors">Contact</a>
          </div>
        </div>
      </footer>
    </main>
  )
}

function UseCaseTile({ icon, title, body }: { icon: string; title: string; body: string }) {
  return (
    <div
      className="bg-white rounded-2xl border border-[#1A1716]/10 p-7 hover:-translate-y-1 transition-transform duration-200"
      style={{ boxShadow: '0 1px 3px rgba(26,23,22,0.06), 0 12px 32px -16px rgba(232,93,47,0.18)' }}
    >
      <span className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-[#FBE8DA] text-[#E85D2F] text-[18px] mb-5">
        {icon}
      </span>
      <h3 className="text-[20px] md:text-[22px] font-semibold tracking-[-0.015em] mb-2.5 text-[#1A1716]">{title}</h3>
      <p className="text-[15px] text-[#1A1716]/65 leading-[1.55]">{body}</p>
    </div>
  )
}

function Testimonial({ quote, attribution }: { quote: string; attribution: string }) {
  return (
    <figure className="bg-white rounded-2xl border border-[#1A1716]/10 p-7 md:p-8" style={{ boxShadow: '0 1px 3px rgba(26,23,22,0.06)' }}>
      <span className="text-[#E85D2F] text-[24px] mb-3 inline-block leading-none">“</span>
      <blockquote className="text-[16px] md:text-[17px] text-[#1A1716]/85 leading-[1.55] mb-5">
        {quote}
      </blockquote>
      <figcaption className="text-[13px] text-[#1A1716]/55 font-medium">— {attribution}</figcaption>
    </figure>
  )
}

function Stat({ n, label }: { n: string; label: string }) {
  return (
    <div>
      <div className="font-semibold tracking-[-0.025em] text-[#FDF8F0]" style={{ fontSize: 'clamp(2.5rem, 5vw, 4rem)' }}>{n}</div>
      <div className="mt-1 text-[13px] uppercase tracking-[0.18em] text-[#FDF8F0]/55 font-medium">{label}</div>
    </div>
  )
}
