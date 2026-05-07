import Link from 'next/link'
import Image from 'next/image'
import { VersionSwitcher } from '@/components/landing/VersionSwitcher'
import { getLandingAuthState } from '@/components/landing/getLandingData'

/**
 * V1 — LINEAR × CLAY HYBRID
 *
 * Per Dylan: "a mix of linear and clay maybe as one preview option."
 *
 * The hybrid model:
 *   - HERO: Linear-style. Dark charcoal substrate (#08090A), violet
 *     + cyan radial mesh, tight Inter/Geist Display headline, premium
 *     polish, restrained CTA with subtle gradient glow underneath.
 *   - SOCIAL PROOF: Clay-style. Warm pill with stacked avatars + a
 *     plain-spoken "trusted by indie operators" line, sits between
 *     hero and product preview as a tone-shift bridge.
 *   - PRODUCT PREVIEW: Linear-style. Dark frame, mac chrome, multi-
 *     layer violet shadow.
 *   - USE-CASE TILES: Clay-style. Switches the page background to
 *     warm cream (#FDF8F0). Three rounded white tiles, hover-lift,
 *     terracotta-orange icon spots.
 *   - TESTIMONIALS: Clay-style. Two cards on the cream background
 *     with quote marks and attribution (no fake names).
 *   - STAT BAND: Clay-style. Dark rounded panel inside the cream
 *     section — same composition Clay uses to break the warmth.
 *   - PRICING: Clay-style. Centered, terracotta accent on the
 *     kicker, dark CTA button.
 *   - FINAL CTA: Linear-style. Page transitions back to dark. Huge
 *     headline, single button, gradient glow.
 *   - FOOTER: Dark Linear-style.
 *
 * Rationale: Linear's premium dark + restraint reads as "this is
 * built well." Clay's warmth + B2B framing reads as "this is built
 * for me." The hybrid lets the page open with credibility (dark
 * Linear hero) and pivot to relatability (warm Clay middle) before
 * closing with credibility again (dark Linear CTA).
 */

export const metadata = {
  title: 'Creator Outreach — Built for the operators who actually send the messages.',
  description: 'Search five platforms in one query. Score every creator in plain English. Pitch with the right templated message per channel. Track every reply.',
}

export default async function LandingV1() {
  const { isAuthed } = await getLandingAuthState()

  return (
    <main className="min-h-screen text-white relative overflow-hidden font-[family-name:var(--font-geist-sans)]" style={{ backgroundColor: '#08090A' }}>
      <VersionSwitcher />

      {/* ── DARK HERO (Linear) ──────────────────────────────────── */}

      {/* Radial mesh — violet + cyan + violet, layered. */}
      <div
        aria-hidden
        className="absolute inset-x-0 top-0 h-[1100px] pointer-events-none"
        style={{
          background: `
            radial-gradient(ellipse 80% 50% at 50% -10%, rgba(124,58,237,0.30) 0%, transparent 60%),
            radial-gradient(ellipse 50% 40% at 80% 5%, rgba(56,189,248,0.18) 0%, transparent 55%),
            radial-gradient(ellipse 60% 50% at 20% 8%, rgba(168,85,247,0.16) 0%, transparent 60%)
          `,
        }}
      />
      {/* Subtle grain — Linear has this */}
      <div
        aria-hidden
        className="absolute inset-x-0 top-0 h-[1100px] pointer-events-none opacity-[0.035] mix-blend-overlay"
        style={{
          backgroundImage:
            'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 200 200\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'noiseFilter\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.85\' numOctaves=\'3\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23noiseFilter)\'/%3E%3C/svg%3E")',
        }}
      />

      {/* Top nav */}
      <header className="relative z-10 px-6 py-4 border-b border-white/[0.06] backdrop-blur-sm">
        <div className="max-w-[1200px] mx-auto flex items-center justify-between">
          <Link href="/landing/v1" className="flex items-center gap-2.5">
            <span className="inline-flex items-center justify-center w-6 h-6 rounded-md bg-gradient-to-br from-violet-500 to-violet-700 text-white text-[11px] font-bold tracking-tight">
              C
            </span>
            <span className="font-semibold tracking-[-0.01em] text-[15px]">Creator Outreach</span>
          </Link>
          <nav className="hidden md:flex items-center gap-7 text-[13px] text-white/55">
            <a href="#preview"   className="hover:text-white transition-colors">Product</a>
            <a href="#useCases"  className="hover:text-white transition-colors">Use cases</a>
            <a href="#pricing"   className="hover:text-white transition-colors">Pricing</a>
          </nav>
          <div className="flex items-center gap-2">
            {!isAuthed && (
              <Link href="/auth/signin" className="text-[13px] text-white/65 hover:text-white px-2.5 py-1.5">
                Sign in
              </Link>
            )}
            <Link
              href={isAuthed ? '/' : '/auth/signup'}
              className="inline-flex items-center gap-1 bg-white text-black hover:bg-white/90 px-3.5 py-1.5 rounded-md text-[13px] font-medium transition-colors"
            >
              {isAuthed ? 'Open app' : 'Try free'}
              <span aria-hidden className="text-black/60">→</span>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative z-10 px-6 pt-20 md:pt-32 pb-16 md:pb-20">
        <div className="max-w-[1100px] mx-auto text-center">
          <Link
            href="#preview"
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/[0.06] border border-white/10 text-[12px] text-white/75 hover:text-white hover:bg-white/[0.08] transition-colors backdrop-blur-sm mb-9"
          >
            <span className="inline-flex items-center gap-1.5">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full rounded-full bg-violet-400 opacity-75 animate-ping" />
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-violet-400" />
              </span>
              <span className="font-medium tracking-wide">New</span>
            </span>
            <span className="text-white/40">·</span>
            <span>Instagram metrics live in your queue</span>
            <span aria-hidden className="text-white/40 ml-1">→</span>
          </Link>

          <h1
            className="font-medium tracking-[-0.035em] leading-[0.96] mx-auto max-w-[16ch]"
            style={{ fontSize: 'clamp(2.75rem, 7.5vw, 6.5rem)' }}
          >
            Outreach without the <span className="text-violet-400">spreadsheet.</span>
          </h1>

          <p className="mt-8 mx-auto max-w-[55ch] text-[18px] md:text-[19px] text-white/65 leading-[1.55]">
            Built for the operators who actually send the messages.
            Search five platforms. Score every creator in plain English.
            Pitch with the right template. Track every reply.
          </p>

          <div className="mt-10 flex items-center justify-center gap-3">
            <div className="relative">
              <div
                aria-hidden
                className="absolute inset-0 blur-2xl opacity-50 -z-10"
                style={{ background: 'linear-gradient(90deg, #7C3AED 0%, #38BDF8 100%)' }}
              />
              <Link
                href={isAuthed ? '/' : '/auth/signup'}
                className="relative inline-flex items-center gap-2 bg-white text-black px-6 py-3 rounded-md font-medium text-[15px] hover:bg-white/95 active:scale-[0.98] transition-all"
                style={{
                  boxShadow: '0 0 0 1px rgba(255,255,255,0.1), 0 8px 32px -4px rgba(124,58,237,0.4)',
                }}
              >
                {isAuthed ? 'Open the app' : 'Start for free'}
                <span aria-hidden className="text-black/60">→</span>
              </Link>
            </div>
            <Link
              href="#preview"
              className="text-[14px] text-white/65 hover:text-white px-3 py-3 transition-colors"
            >
              See the product ↓
            </Link>
          </div>

          {/* Clay-style social proof pill — warm tone-shift bridge */}
          <div className="mt-14 inline-flex items-center gap-3 px-4 py-2 rounded-full bg-white/95 border border-white text-[12px] text-black/65 backdrop-blur-sm">
            <span className="inline-flex -space-x-1.5">
              <span className="w-5 h-5 rounded-full bg-[#E85D2F] border-2 border-white" />
              <span className="w-5 h-5 rounded-full bg-[#F2A261] border-2 border-white" />
              <span className="w-5 h-5 rounded-full bg-violet-600 border-2 border-white" />
            </span>
            <span className="font-medium text-black">Trusted by indie operators running their own GTM.</span>
          </div>
        </div>
      </section>

      {/* Product preview — dark Linear frame */}
      <section id="preview" className="relative z-10 px-6 pb-24 md:pb-32">
        <div className="max-w-[1100px] mx-auto">
          <div
            className="rounded-2xl overflow-hidden border border-white/10 bg-white/[0.02] relative"
            style={{
              boxShadow:
                '0 100px 200px -60px rgba(124,58,237,0.35), 0 60px 100px -30px rgba(0,0,0,0.6)',
            }}
          >
            <div className="flex items-center gap-1.5 px-4 py-3 border-b border-white/[0.06] bg-gradient-to-b from-white/[0.04] to-transparent">
              <span className="w-2.5 h-2.5 rounded-full bg-white/20" />
              <span className="w-2.5 h-2.5 rounded-full bg-white/20" />
              <span className="w-2.5 h-2.5 rounded-full bg-white/20" />
              <span className="ml-3 text-[11px] text-white/40 font-[family-name:var(--font-geist-mono)]">creatoroutreach.net/results</span>
            </div>
            <div className="relative aspect-[1440/900] bg-[#050608]">
              <Image
                src="/screenshots/results.png"
                alt="Creator Outreach — Results view"
                fill
                priority
                sizes="(min-width: 1100px) 1100px, 100vw"
                className="object-cover object-top"
              />
              <div
                aria-hidden
                className="absolute inset-x-0 top-0 h-32 pointer-events-none"
                style={{
                  background:
                    'linear-gradient(180deg, rgba(124,58,237,0.10) 0%, transparent 100%)',
                }}
              />
            </div>
          </div>
        </div>
      </section>

      {/* ── WARM MIDDLE (Clay) ────────────────────────────────────
           Page background flips to cream for the use-case +
           testimonial sections. Wrapper div carries the warm bg. */}
      <section
        id="useCases"
        className="relative z-10 -mx-0"
        style={{
          background: 'linear-gradient(180deg, #FDF8F0 0%, #FBE8DA 60%, #FDF8F0 100%)',
          color: '#1A1716',
        }}
      >
        <div className="px-6 py-20 md:py-28">
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
                body="Search five platforms in one query. Filter by audience, region, recency. AI surfaces creators who match the criteria you typed in plain English."
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
        </div>

        {/* Testimonials */}
        <div className="px-6 pb-20 md:pb-28">
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
        </div>

        {/* Dark stat band — Clay's pattern, breaks the warmth */}
        <div className="px-6 pb-20 md:pb-28">
          <div className="max-w-[1200px] mx-auto bg-[#1A1716] rounded-3xl px-8 py-14 md:py-16 text-[#FDF8F0]">
            <div className="grid md:grid-cols-4 gap-10 md:gap-6 text-center">
              <Stat n="5" label="platforms in one search" />
              <Stat n="~30s" label="time to a scored result list" />
              <Stat n="$0" label="while in beta" />
              <Stat n="∞" label="seats per workspace" />
            </div>
          </div>
        </div>

        {/* Pricing — Clay-warm */}
        <div id="pricing" className="px-6 pb-20 md:pb-28">
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
        </div>
      </section>

      {/* ── DARK FINAL CTA (Linear) ─────────────────────────────── */}

      <section className="relative z-10 px-6 py-24 md:py-32" style={{ backgroundColor: '#08090A' }}>
        {/* Mini gradient mesh for the final CTA */}
        <div
          aria-hidden
          className="absolute inset-x-0 inset-y-0 pointer-events-none"
          style={{
            background:
              'radial-gradient(ellipse 60% 50% at 50% 50%, rgba(124,58,237,0.20) 0%, transparent 60%)',
          }}
        />
        <div className="relative max-w-[900px] mx-auto text-center">
          <h2
            className="font-medium tracking-[-0.03em] leading-[0.95] mx-auto max-w-[14ch] text-white"
            style={{ fontSize: 'clamp(2.5rem, 7vw, 6rem)' }}
          >
            Stop running outreach in <span className="text-violet-400">spreadsheets.</span>
          </h2>
          <Link
            href={isAuthed ? '/' : '/auth/signup'}
            className="mt-12 inline-flex items-center gap-2 bg-white text-black px-7 py-3.5 rounded-md font-medium text-[15px] hover:bg-white/95 active:scale-[0.98] transition-all"
            style={{
              boxShadow: '0 0 0 1px rgba(255,255,255,0.1), 0 12px 48px -8px rgba(124,58,237,0.5)',
            }}
          >
            {isAuthed ? 'Open the app' : 'Start for free'}
            <span aria-hidden className="text-black/60">→</span>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 border-t border-white/[0.06] px-6 py-10" style={{ backgroundColor: '#08090A' }}>
        <div className="max-w-[1100px] mx-auto flex flex-wrap items-center justify-between gap-3 text-[12px] text-white/40">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center justify-center w-5 h-5 rounded-md bg-gradient-to-br from-violet-500 to-violet-700 text-white text-[10px] font-bold">C</span>
            <span>© 2026 Creator Outreach</span>
          </div>
          <div className="flex gap-5">
            <Link href="/privacy" className="hover:text-white transition-colors">Privacy</Link>
            <Link href="/terms"   className="hover:text-white transition-colors">Terms</Link>
            <a href="mailto:dmeehanj@gmail.com" className="hover:text-white transition-colors">Contact</a>
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
