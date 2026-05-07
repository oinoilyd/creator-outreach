import Link from 'next/link'
import Image from 'next/image'
import { VersionSwitcher } from '@/components/landing/VersionSwitcher'
import { getLandingAuthState } from '@/components/landing/getLandingData'

/**
 * V3 — PREMIUM TECH
 *
 * Direction: Linear × Stripe × Vercel × Cursor × Raycast.
 * Dark navy substrate (#0B0D14, off-black with blue undertone — never
 * pure #000), restrained warm gradient, big white space, premium
 * typographic restraint, real product screenshots displayed as the
 * hero asset. The polish IS the design — confidence through omission.
 *
 * One accent color (warm amber #F2A261, not violet). One subtle
 * gradient. Real numbers. No bento grid. No pill row. No marquee.
 */

export const metadata = {
  title: 'Creator Outreach — Run outreach across five platforms.',
  description: 'A premium creator-outreach tool for indie operators and small teams. Search, score, pitch, track — all in one queue. Free in beta.',
}

export default async function LandingV3() {
  const { isAuthed } = await getLandingAuthState()

  return (
    <main className="min-h-screen text-white overflow-hidden" style={{ backgroundColor: '#0B0D14' }}>
      <VersionSwitcher />

      {/* Soft amber gradient behind the hero — single, directional,
          confident. No second color, no orbs. */}
      <div
        aria-hidden
        className="absolute inset-x-0 top-0 h-[700px] pointer-events-none"
        style={{
          background:
            'radial-gradient(ellipse 80% 60% at 50% 0%, rgba(242,162,97,0.18) 0%, rgba(242,162,97,0.05) 35%, transparent 70%)',
        }}
      />

      {/* Top nav */}
      <header className="relative z-10 border-b border-white/[0.06]">
        <div className="max-w-[1200px] mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/landing/v3" className="flex items-center gap-2.5 group">
            <span className="inline-block w-6 h-6 rounded-md bg-white text-black flex items-center justify-center text-xs font-bold">
              ✱
            </span>
            <span className="font-medium tracking-tight text-[15px]">Creator&nbsp;Outreach</span>
          </Link>
          <nav className="hidden md:flex items-center gap-7 text-[13px] text-white/60">
            <a href="#why" className="hover:text-white transition-colors">Why this exists</a>
            <a href="#preview" className="hover:text-white transition-colors">Product</a>
            <a href="#pricing" className="hover:text-white transition-colors">Pricing</a>
          </nav>
          <div className="flex items-center gap-2 text-[13px]">
            {!isAuthed && (
              <Link href="/auth/signin" className="text-white/70 hover:text-white px-2 py-1.5">Sign in</Link>
            )}
            <Link
              href={isAuthed ? '/' : '/auth/signup'}
              className="inline-flex items-center gap-1.5 bg-white text-black px-3.5 py-1.5 rounded-md font-medium hover:bg-white/90 transition-colors"
            >
              {isAuthed ? 'Open app' : 'Try free'}
              <span aria-hidden>→</span>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero — large quiet headline, single CTA, restrained. */}
      <section className="relative z-10 px-6 pt-24 pb-20 md:pt-36 md:pb-28">
        <div className="max-w-[1100px] mx-auto text-center">
          <div className="inline-flex items-center gap-2 text-[12px] text-white/55 mb-8 px-3 py-1.5 rounded-full border border-white/10 bg-white/[0.02]">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#F2A261]" />
            Beta · Free for early users
          </div>
          <h1
            className="font-medium tracking-[-0.025em] leading-[0.98] mx-auto max-w-[14ch]"
            style={{ fontSize: 'clamp(3rem, 8vw, 7.5rem)' }}
          >
            Outreach that<br />
            <span className="text-[#F2A261]">closes the loop.</span>
          </h1>
          <p className="mt-9 mx-auto max-w-[58ch] text-[18px] md:text-[19px] text-white/65 leading-[1.55]">
            Find creators across five platforms. Score them in plain
            English. Pitch with the right templated message per
            channel. Track every reply in a single queue.
          </p>
          <div className="mt-11 flex items-center justify-center gap-4">
            <Link
              href={isAuthed ? '/' : '/auth/signup'}
              className="inline-flex items-center gap-2 bg-white text-black px-6 py-3 rounded-md font-medium text-[15px] hover:bg-white/95 active:scale-[0.98] transition-all"
            >
              {isAuthed ? 'Open the app' : 'Start free'}
              <span aria-hidden>→</span>
            </Link>
            <a
              href="#preview"
              className="text-[14px] text-white/65 hover:text-white px-3 py-3 transition-colors"
            >
              See it in action ↓
            </a>
          </div>
        </div>
      </section>

      {/* Product preview — single hero asset, framed simply. */}
      <section id="preview" className="relative z-10 px-6 pb-24 md:pb-32">
        <div className="max-w-[1100px] mx-auto">
          <div className="rounded-xl overflow-hidden border border-white/10 bg-white/[0.02] shadow-[0_60px_120px_-40px_rgba(242,162,97,0.25)]">
            <div className="flex items-center gap-1.5 px-4 py-3 border-b border-white/[0.06]">
              <span className="w-2.5 h-2.5 rounded-full bg-white/15" />
              <span className="w-2.5 h-2.5 rounded-full bg-white/15" />
              <span className="w-2.5 h-2.5 rounded-full bg-white/15" />
              <span className="ml-3 text-[11px] text-white/40 font-mono">creatoroutreach.net/results</span>
            </div>
            <div className="relative aspect-[1440/900] bg-[#080A11]">
              <Image
                src="/screenshots/results.png"
                alt="Creator Outreach — Results view"
                fill
                priority
                sizes="(min-width: 1100px) 1100px, 100vw"
                className="object-cover object-top"
              />
            </div>
          </div>
          <p className="mt-4 text-center text-[13px] text-white/45">
            Live product. Search results across YouTube, Instagram, TikTok, X, and LinkedIn.
          </p>
        </div>
      </section>

      {/* Three feature blocks — typographic, no boxes. */}
      <section className="relative z-10 px-6 pb-24 md:pb-32 border-t border-white/[0.06]">
        <div className="max-w-[1100px] mx-auto pt-20 md:pt-28">
          <div className="grid md:grid-cols-3 gap-12 md:gap-8">
            <FeatureBlock
              kicker="01 · Search"
              title="Five platforms. One query."
              body="A single search returns YouTube, Instagram, TikTok, X, and LinkedIn creators in the same table. Filter by audience, region, recency."
            />
            <FeatureBlock
              kicker="02 · Score"
              title="Plain-English fit."
              body="The AI ranks fit, reach, and recency. The score is computed in English — you read the reasoning, you correct the criteria, the next search learns."
            />
            <FeatureBlock
              kicker="03 · Pitch"
              title="The right message, per channel."
              body="One click composes a templated message — DM on Instagram, message on LinkedIn, email everywhere else. Auto-cadence pings you when a reply lapses."
            />
          </div>
        </div>
      </section>

      {/* Stat strip — numbers, restrained. */}
      <section className="relative z-10 px-6 py-20 md:py-28 border-t border-white/[0.06]">
        <div className="max-w-[1100px] mx-auto grid md:grid-cols-4 gap-10 md:gap-6">
          <Stat n="5" label="platforms searched" />
          <Stat n="1" label="queue, end to end" />
          <Stat n="$0" label="while in beta" />
          <Stat n="∞" label="seats per workspace" />
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="relative z-10 px-6 py-24 md:py-32 border-t border-white/[0.06]">
        <div className="max-w-[800px] mx-auto text-center">
          <div className="text-[12px] uppercase tracking-[0.2em] text-[#F2A261] mb-5">Pricing</div>
          <h2 className="font-medium tracking-[-0.02em] leading-[1.05]" style={{ fontSize: 'clamp(2.25rem, 5vw, 4rem)' }}>
            Free while we figure this out.
          </h2>
          <p className="mt-7 text-[17px] text-white/60 leading-[1.55] max-w-[52ch] mx-auto">
            No card on file, no seat cap, no annual upsell. Beta users
            will be grandfathered into a price that has not yet been
            set, announced before any tier change.
          </p>
          <Link
            href={isAuthed ? '/' : '/auth/signup'}
            className="mt-10 inline-flex items-center gap-2 bg-white text-black px-7 py-3.5 rounded-md font-medium hover:bg-white/95 active:scale-[0.98] transition-all"
          >
            {isAuthed ? 'Open the app' : 'Start free'}
            <span aria-hidden>→</span>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 border-t border-white/[0.06] px-6 py-10">
        <div className="max-w-[1100px] mx-auto flex flex-wrap items-center justify-between gap-3 text-[12px] text-white/45">
          <div className="flex items-center gap-2">
            <span className="inline-block w-5 h-5 rounded-md bg-white/90 text-black flex items-center justify-center text-[10px] font-bold">✱</span>
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

function FeatureBlock({ kicker, title, body }: { kicker: string; title: string; body: string }) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-[0.2em] text-[#F2A261] mb-3">{kicker}</div>
      <h3 className="text-[22px] md:text-[24px] font-medium tracking-[-0.015em] mb-3">{title}</h3>
      <p className="text-[15px] text-white/60 leading-[1.55]">{body}</p>
    </div>
  )
}

function Stat({ n, label }: { n: string; label: string }) {
  return (
    <div>
      <div className="font-medium tracking-[-0.025em] text-white" style={{ fontSize: 'clamp(2.5rem, 5vw, 4rem)' }}>{n}</div>
      <div className="mt-1 text-[12px] uppercase tracking-[0.18em] text-white/45">{label}</div>
    </div>
  )
}
