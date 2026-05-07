import Link from 'next/link'
import Image from 'next/image'
import { VersionSwitcher } from '@/components/landing/VersionSwitcher'
import { getLandingAuthState } from '@/components/landing/getLandingData'

/**
 * V1 — LINEAR-STYLE
 *
 * Reference: linear.app
 *
 * Visual signatures we're modeling:
 *   - Near-black charcoal substrate (#08090A), never #000
 *   - Subtle violet/blue radial gradient mesh behind hero
 *   - Tight Inter Display headlines, white, slightly negative tracking
 *   - Single CTA pill with subtle 1px gradient border, glow underneath
 *   - Product screenshot in dark frame with multi-layer blur shadow
 *   - "Built for / Made for" positioning copy
 *   - Status pill at top (e.g. "New: ___") with tiny dot
 *   - Mid-page "Trusted by" customer logo strip (we use placeholders
 *     since we don't have logos to ship — labeled "PEOPLE WE'RE
 *     BUILDING THIS FOR" to stay honest)
 *   - 3-column feature row with subtle icons + restrained copy
 *   - Final CTA section: huge type, single button, faded gradient
 */

export const metadata = {
  title: 'Creator Outreach — Built for the modern outreach operator',
  description: 'Search five platforms. Score every creator in plain English. Pitch them with the right templated message. Track every reply.',
}

export default async function LandingV1() {
  const { isAuthed } = await getLandingAuthState()

  return (
    <main className="min-h-screen text-white relative overflow-hidden font-[family-name:var(--font-geist-sans)]" style={{ backgroundColor: '#08090A' }}>
      <VersionSwitcher />

      {/* Hero gradient mesh — Linear's signature. Multiple layered radial
          gradients in violet/blue. Locked z=0, pointer-events-none. */}
      <div
        aria-hidden
        className="absolute inset-x-0 top-0 h-[1100px] pointer-events-none"
        style={{
          background: `
            radial-gradient(ellipse 80% 50% at 50% -10%, rgba(124,58,237,0.28) 0%, transparent 60%),
            radial-gradient(ellipse 50% 40% at 80% 5%, rgba(56,189,248,0.16) 0%, transparent 55%),
            radial-gradient(ellipse 60% 50% at 20% 8%, rgba(168,85,247,0.14) 0%, transparent 60%)
          `,
        }}
      />
      {/* Subtle grain noise overlay — Linear has this too */}
      <div
        aria-hidden
        className="absolute inset-x-0 top-0 h-[1100px] pointer-events-none opacity-[0.03] mix-blend-overlay"
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
            <a href="#features" className="hover:text-white transition-colors">Product</a>
            <a href="#preview"  className="hover:text-white transition-colors">Preview</a>
            <a href="#pricing"  className="hover:text-white transition-colors">Pricing</a>
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
      <section className="relative z-10 px-6 pt-20 md:pt-32 pb-20 md:pb-28">
        <div className="max-w-[1100px] mx-auto text-center">
          {/* Status pill */}
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
            className="font-medium tracking-[-0.035em] leading-[0.96] mx-auto max-w-[15ch]"
            style={{ fontSize: 'clamp(2.75rem, 7.5vw, 6.5rem)' }}
          >
            Outreach without the spreadsheet.
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
                  backgroundImage: 'linear-gradient(180deg, rgba(255,255,255,1), rgba(245,245,245,1))',
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

          <p className="mt-7 text-[12px] text-white/40">
            No credit card · Free during beta · Made by one operator
          </p>
        </div>
      </section>

      {/* Product preview — single hero asset, premium dark frame */}
      <section id="preview" className="relative z-10 px-6 pb-24 md:pb-32">
        <div className="max-w-[1100px] mx-auto">
          <div
            className="rounded-2xl overflow-hidden border border-white/10 bg-white/[0.02] relative"
            style={{
              boxShadow:
                '0 100px 200px -60px rgba(124,58,237,0.35), 0 60px 100px -30px rgba(0,0,0,0.6)',
            }}
          >
            {/* Top chrome strip */}
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
              {/* Glow overlay around top of screenshot */}
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

      {/* "People we're building for" — honest replacement for fake logo wall */}
      <section className="relative z-10 px-6 pb-20 md:pb-28">
        <div className="max-w-[1100px] mx-auto text-center">
          <div className="text-[11px] uppercase tracking-[0.2em] text-white/35 mb-8">
            People we're building this for
          </div>
          <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-4 text-[14px] md:text-[15px] text-white/55 font-medium">
            <span>Indie operators</span>
            <span aria-hidden className="text-white/15">·</span>
            <span>Founders running their own GTM</span>
            <span aria-hidden className="text-white/15">·</span>
            <span>Solo agencies</span>
            <span aria-hidden className="text-white/15">·</span>
            <span>Anyone who hates spreadsheets</span>
          </div>
        </div>
      </section>

      {/* Three-column features — restrained, single accent on each icon */}
      <section id="features" className="relative z-10 px-6 pb-24 md:pb-32 border-t border-white/[0.05]">
        <div className="max-w-[1100px] mx-auto pt-20 md:pt-28">
          <div className="text-center mb-14 md:mb-20">
            <div className="text-[12px] uppercase tracking-[0.2em] text-violet-400/85 mb-4">Built for outreach</div>
            <h2
              className="font-medium tracking-[-0.025em] mx-auto max-w-[20ch]"
              style={{ fontSize: 'clamp(2rem, 4.5vw, 3.5rem)' }}
            >
              Everything you need.
              <br />
              <span className="text-white/45">Nothing you don't.</span>
            </h2>
          </div>
          <div className="grid md:grid-cols-3 gap-10 md:gap-6">
            <Feature
              accent="violet"
              kicker="01 · Search"
              title="Five platforms. One query."
              body="YouTube, Instagram, TikTok, X, LinkedIn — all in one search. Filter by audience, region, recency."
            />
            <Feature
              accent="cyan"
              kicker="02 · Score"
              title="Plain-English fit."
              body="The AI ranks fit, reach, and recency in English you can correct. The next search learns."
            />
            <Feature
              accent="violet"
              kicker="03 · Pitch"
              title="The right message."
              body="One click composes a templated message per channel. Auto-cadence pings you when silence hits 3 days."
            />
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="relative z-10 px-6 py-24 md:py-32 border-t border-white/[0.05]">
        <div className="max-w-[800px] mx-auto text-center">
          <div className="text-[12px] uppercase tracking-[0.2em] text-violet-400/85 mb-4">Pricing</div>
          <h2
            className="font-medium tracking-[-0.025em] leading-[1.05] mb-7"
            style={{ fontSize: 'clamp(2.25rem, 5vw, 4rem)' }}
          >
            Free while we figure this out.
          </h2>
          <p className="text-[17px] text-white/60 leading-[1.55] max-w-[52ch] mx-auto">
            No card on file, no seat cap, no annual upsell. Beta users
            grandfathered into a price announced before any tier change.
          </p>
          <Link
            href={isAuthed ? '/' : '/auth/signup'}
            className="mt-10 inline-flex items-center gap-2 bg-white text-black px-7 py-3.5 rounded-md font-medium text-[15px] hover:bg-white/95 active:scale-[0.98] transition-all"
            style={{
              boxShadow: '0 0 0 1px rgba(255,255,255,0.1), 0 8px 32px -4px rgba(124,58,237,0.4)',
            }}
          >
            {isAuthed ? 'Open the app' : 'Start for free'}
            <span aria-hidden className="text-black/60">→</span>
          </Link>
        </div>
      </section>

      {/* Final CTA — Linear-style huge type with restrained gradient */}
      <section className="relative z-10 px-6 py-24 md:py-32 border-t border-white/[0.05]">
        <div className="max-w-[900px] mx-auto text-center">
          <h2
            className="font-medium tracking-[-0.03em] leading-[0.95] mx-auto max-w-[14ch]"
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
      <footer className="relative z-10 border-t border-white/[0.06] px-6 py-10">
        <div className="max-w-[1100px] mx-auto flex flex-wrap items-center justify-between gap-3 text-[12px] text-white/40">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center justify-center w-5 h-5 rounded-md bg-gradient-to-br from-violet-500 to-violet-700 text-white text-[10px] font-bold">C</span>
            <span>© 2026 Creator Outreach</span>
          </div>
          <div className="flex gap-5">
            <Link href="/privacy" className="hover:text-white transition-colors">Privacy</Link>
            <Link href="/terms" className="hover:text-white transition-colors">Terms</Link>
            <a href="mailto:dmeehanj@gmail.com" className="hover:text-white transition-colors">Contact</a>
          </div>
        </div>
      </footer>
    </main>
  )
}

function Feature({ accent, kicker, title, body }: { accent: 'violet' | 'cyan'; kicker: string; title: string; body: string }) {
  const accentColor = accent === 'violet' ? 'text-violet-400' : 'text-cyan-400'
  const accentBg = accent === 'violet' ? 'bg-violet-500/10 ring-violet-400/30' : 'bg-cyan-500/10 ring-cyan-400/30'
  return (
    <div>
      <div className={`inline-flex items-center justify-center w-9 h-9 rounded-lg ring-1 mb-4 ${accentBg}`}>
        <span className={`w-2 h-2 rounded-full ${accent === 'violet' ? 'bg-violet-400' : 'bg-cyan-400'}`} />
      </div>
      <div className={`text-[11px] uppercase tracking-[0.18em] mb-2 ${accentColor}`}>{kicker}</div>
      <h3 className="text-[20px] md:text-[22px] font-medium tracking-[-0.015em] mb-3">{title}</h3>
      <p className="text-[15px] text-white/60 leading-[1.55]">{body}</p>
    </div>
  )
}
