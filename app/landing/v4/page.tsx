import Link from 'next/link'
import Image from 'next/image'
import { VersionSwitcher } from '@/components/landing/VersionSwitcher'
import { getLandingAuthState } from '@/components/landing/getLandingData'

/**
 * V4 — GUMROAD-STYLE
 *
 * Reference: gumroad.com (the modern era — saturated color blocks,
 * Migra-flavored serif display, hard 3D shadows, neo-brutalist
 * borders, no apologies).
 *
 * Visual signatures we're modeling:
 *   - Hot pink primary substrate (#FF90E8 — Gumroad's signature)
 *   - Black borders (3-4px) on every container
 *   - Hard 3D drop-shadows (no blur — solid color offset boxes)
 *   - Chunky serif display font (Fraunces 800)
 *   - Yellow + cyan + black secondary blocks
 *   - "Get paid when..." copy energy: punchy, plain-spoken
 *   - Buttons are big chunky boxes with the same shadow as cards
 *   - Personality-forward: the design IS the brand
 *
 * Distinct from V2 (Clay): Clay is warm + soft + restrained. V4 is
 * loud + saturated + uncompromising. They're both "warm" palettes
 * but they feel like different planets.
 */

export const metadata = {
  title: 'CREATOR OUTREACH ◆ Make outreach easier than the spreadsheet.',
  description: 'A loud little tool for indie operators. Search five platforms, score every creator, pitch with templated messages, and track every reply.',
}

export default async function LandingV4() {
  const { isAuthed } = await getLandingAuthState()

  return (
    <main className="min-h-screen relative overflow-hidden text-black" style={{ backgroundColor: '#FF90E8' }}>
      <VersionSwitcher />

      {/* Top nav — chunky black bar */}
      <header className="border-b-[3px] border-black bg-black text-[#FFE066]">
        <div className="max-w-[1280px] mx-auto px-5 h-14 flex items-center justify-between">
          <Link href="/landing/v4" className="flex items-center gap-2.5 font-[family-name:var(--font-fraunces)] font-extrabold">
            <span className="inline-flex items-center justify-center w-7 h-7 bg-[#FFE066] text-black text-[14px] font-bold border-[2px] border-[#FFE066]">
              ◆
            </span>
            <span className="text-[18px]">Creator Outreach</span>
          </Link>
          <Link
            href={isAuthed ? '/' : '/auth/signup'}
            className="bg-[#FFE066] text-black hover:bg-white px-4 py-1.5 font-[family-name:var(--font-fraunces)] font-bold text-[14px] border-[2px] border-[#FFE066] hover:border-white transition-colors"
          >
            {isAuthed ? 'Open app →' : 'Try free →'}
          </Link>
        </div>
      </header>

      {/* Hero — chunky, loud */}
      <section className="relative px-5 py-16 md:py-24">
        <div className="max-w-[1200px] mx-auto grid md:grid-cols-12 gap-8 items-center">
          <div className="md:col-span-7">
            <div className="inline-flex items-center gap-2 bg-black text-[#FFE066] px-3 py-1.5 mb-7 font-bold text-[12px] uppercase tracking-[0.16em] border-[3px] border-black" style={{ boxShadow: '5px 5px 0 0 #FFFFFF' }}>
              ◆ A loud little outreach tool
            </div>
            <h1
              className="font-[family-name:var(--font-fraunces)] font-black tracking-[-0.04em] leading-[0.86] text-black"
              style={{ fontSize: 'clamp(3rem, 9vw, 8rem)' }}
            >
              Outreach,<br />
              <span className="bg-[#FFE066] inline-block px-3 border-[4px] border-black" style={{ boxShadow: '8px 8px 0 0 #000' }}>
                made easy.
              </span>
            </h1>
            <p className="mt-9 max-w-[48ch] text-[18px] md:text-[20px] text-black font-medium leading-[1.4]">
              Source creators across five platforms. Score them in
              plain English. Pitch them with the right templated
              message per channel. Track every reply.{' '}
              <span className="font-[family-name:var(--font-fraunces)] italic">No CRM cosplay.</span>
            </p>

            <div className="mt-10 flex flex-wrap items-center gap-3 font-[family-name:var(--font-fraunces)] font-extrabold">
              <Link
                href={isAuthed ? '/' : '/auth/signup'}
                className="inline-flex items-center gap-2 bg-black text-[#FFE066] px-6 py-3.5 text-[16px] border-[3px] border-black hover:bg-[#FFE066] hover:text-black active:translate-y-[3px] transition-all"
                style={{ boxShadow: '6px 6px 0 0 #000' }}
              >
                {isAuthed ? 'Open the app →' : 'Try it free →'}
              </Link>
              <Link
                href="#preview"
                className="inline-flex items-center gap-2 bg-white text-black px-6 py-3.5 text-[16px] border-[3px] border-black hover:bg-[#FFE066] active:translate-y-[3px] transition-all"
                style={{ boxShadow: '6px 6px 0 0 #000' }}
              >
                Watch it work ↓
              </Link>
            </div>

            <div className="mt-7 inline-flex items-center gap-2 text-[13px] font-bold uppercase tracking-[0.14em] bg-white text-black px-3 py-1.5 border-[3px] border-black">
              ◆ NO CARD ◆ FREE BETA ◆ GRANDFATHERED FOREVER
            </div>
          </div>

          {/* Hero stack — three chunky offset cards */}
          <div className="md:col-span-5 relative h-[420px] md:h-[480px]">
            <BrutalistCard
              className="absolute top-0 right-2 w-[78%] z-30"
              bg="#FFE066"
              tag="◆ FIVE PLATFORMS"
              rotate={-2}
            >
              <span className="font-[family-name:var(--font-fraunces)] font-black text-[28px] leading-[0.95]">
                YouTube · Instagram · TikTok · X · LinkedIn
              </span>
            </BrutalistCard>
            <BrutalistCard
              className="absolute top-[28%] left-2 w-[80%] z-20"
              bg="#9DEAFF"
              tag="◆ PLAIN ENGLISH"
              rotate={3}
            >
              <span className="font-[family-name:var(--font-fraunces)] font-black text-[26px] leading-[0.95]">
                "Strong fit. Posts about commercial real estate weekly."
              </span>
            </BrutalistCard>
            <BrutalistCard
              className="absolute bottom-0 right-3 w-[72%] z-10"
              bg="#FFFFFF"
              tag="◆ ONE QUEUE"
              rotate={-3}
            >
              <span className="font-[family-name:var(--font-fraunces)] font-black text-[28px] leading-[0.95]">
                Pitch. Track. Follow up. Auto-cadence.
              </span>
            </BrutalistCard>
          </div>
        </div>
      </section>

      {/* Big yellow stat band */}
      <section className="border-y-[3px] border-black bg-[#FFE066]">
        <div className="max-w-[1200px] mx-auto px-5 py-10 grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
          <Stat n="5" label="platforms" />
          <Stat n="~30s" label="to a list" />
          <Stat n="$0" label="while in beta" />
          <Stat n="∞" label="seats" />
        </div>
      </section>

      {/* Product preview — chunky white panel */}
      <section id="preview" className="px-5 py-16 md:py-24">
        <div className="max-w-[1200px] mx-auto">
          <div className="border-[4px] border-black bg-white" style={{ boxShadow: '12px 12px 0 0 #000' }}>
            <div className="border-b-[3px] border-black bg-[#FFE066] px-4 py-2.5 flex items-center justify-between text-[12px] font-bold uppercase tracking-[0.14em]">
              <span>creatoroutreach.net/results</span>
              <span className="hidden sm:inline">◆ LIVE PRODUCT</span>
            </div>
            <div className="relative aspect-[1440/900] bg-black">
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
        </div>
      </section>

      {/* Feature blocks — 4 chunky tiles, each different color */}
      <section className="px-5 pb-16 md:pb-24">
        <div className="max-w-[1200px] mx-auto">
          <h2 className="font-[family-name:var(--font-fraunces)] font-black text-black mb-10 leading-[0.95]" style={{ fontSize: 'clamp(2.5rem, 6vw, 4.5rem)' }}>
            Four moves.<br />
            <span className="bg-black text-[#FFE066] inline-block px-3 mt-1">No bloat.</span>
          </h2>
          <div className="grid md:grid-cols-2 gap-5">
            <FeatureTile bg="#FFE066" idx="01" title="Search" body="Five platforms in one query. Filter by audience, region, recency." />
            <FeatureTile bg="#9DEAFF" idx="02" title="Score"  body="Every creator scored on fit, reach, recency. The reasoning shows." />
            <FeatureTile bg="#FFFFFF" idx="03" title="Pitch"  body="One click composes the right templated message for the channel." />
            <FeatureTile bg="#C0FFB3" idx="04" title="Track"  body="Replies update status. Auto-cadence pings you when silence hits." />
          </div>
        </div>
      </section>

      {/* Pricing block */}
      <section id="pricing" className="px-5 pb-16 md:pb-24">
        <div className="max-w-[1100px] mx-auto border-[4px] border-black bg-white p-8 md:p-12 grid md:grid-cols-12 gap-8 items-center" style={{ boxShadow: '14px 14px 0 0 #000' }}>
          <div className="md:col-span-7">
            <div className="inline-flex items-center gap-2 bg-black text-[#FFE066] px-3 py-1.5 mb-5 font-bold text-[11px] uppercase tracking-[0.16em] border-[3px] border-black">
              ◆ PRICING
            </div>
            <h2 className="font-[family-name:var(--font-fraunces)] font-black tracking-[-0.025em] leading-[0.95]" style={{ fontSize: 'clamp(2.5rem, 6vw, 4.5rem)' }}>
              Free<br />
              <span className="italic">while in beta.</span>
            </h2>
            <p className="mt-6 max-w-[44ch] text-[16px] font-medium text-black leading-[1.5]">
              No card. No seat cap. Beta users get grandfathered into a
              price announced before any tier change. Tell me if it's
              broken before I make you pay for it.
            </p>
          </div>
          <div className="md:col-span-5">
            <div className="bg-[#FFE066] border-[3px] border-black p-6">
              <div className="font-[family-name:var(--font-fraunces)] font-black text-black flex items-baseline gap-2" style={{ fontSize: 'clamp(3rem, 7vw, 5rem)' }}>
                $0
                <span className="text-[14px] font-bold normal-case tracking-normal">/forever<sup>*</sup></span>
              </div>
              <ul className="mt-4 space-y-2 text-[15px] font-medium">
                {[
                  'Five-platform search',
                  'AI scoring + plain-English reasoning',
                  'Templated outreach per channel',
                  'Auto-cadence follow-ups',
                  'CSV export, anytime',
                ].map(s => (
                  <li key={s} className="flex items-start gap-2">
                    <span className="text-black font-black mt-0.5">✓</span>
                    <span>{s}</span>
                  </li>
                ))}
              </ul>
              <Link
                href={isAuthed ? '/' : '/auth/signup'}
                className="mt-6 block text-center bg-black text-[#FFE066] py-3.5 font-[family-name:var(--font-fraunces)] font-extrabold text-[16px] border-[3px] border-black hover:bg-[#FFE066] hover:text-black active:translate-y-[3px] transition-all"
                style={{ boxShadow: '4px 4px 0 0 #FFFFFF' }}
              >
                {isAuthed ? 'Open the app →' : 'Try it free →'}
              </Link>
              <div className="mt-3 text-[10px] uppercase tracking-[0.14em] font-bold opacity-70">
                <sup>*</sup> for early users — grandfathered when paid plans drop.
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t-[3px] border-black bg-black text-[#FFE066] px-5 py-8">
        <div className="max-w-[1280px] mx-auto flex flex-wrap items-center justify-between gap-3 font-[family-name:var(--font-fraunces)] font-bold text-[14px]">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center justify-center w-6 h-6 bg-[#FFE066] text-black text-[12px] border-[2px] border-[#FFE066]">◆</span>
            © 2026 CREATOR OUTREACH
          </div>
          <div className="flex gap-5">
            <Link href="/privacy" className="hover:text-white">Privacy</Link>
            <Link href="/terms" className="hover:text-white">Terms</Link>
            <a href="mailto:dmeehanj@gmail.com" className="hover:text-white">Contact</a>
          </div>
        </div>
      </footer>
    </main>
  )
}

function BrutalistCard({ children, className = '', bg, tag, rotate = 0 }: { children: React.ReactNode; className?: string; bg: string; tag: string; rotate?: number }) {
  return (
    <div
      className={'border-[4px] border-black p-5 ' + className}
      style={{
        backgroundColor: bg,
        transform: `rotate(${rotate}deg)`,
        boxShadow: '8px 8px 0 0 #000',
      }}
    >
      <div className="text-[10px] uppercase tracking-[0.16em] font-bold mb-2 text-black/70">{tag}</div>
      {children}
    </div>
  )
}

function Stat({ n, label }: { n: string; label: string }) {
  return (
    <div>
      <div className="font-[family-name:var(--font-fraunces)] font-black text-black tabular-nums leading-[0.9]" style={{ fontSize: 'clamp(2.5rem, 6vw, 4.5rem)' }}>{n}</div>
      <div className="mt-1 text-[12px] uppercase tracking-[0.16em] font-bold">{label}</div>
    </div>
  )
}

function FeatureTile({ bg, idx, title, body }: { bg: string; idx: string; title: string; body: string }) {
  return (
    <div className="border-[4px] border-black p-6 md:p-8 hover:translate-x-[-3px] hover:translate-y-[-3px] transition-transform" style={{ backgroundColor: bg, boxShadow: '8px 8px 0 0 #000' }}>
      <div className="flex items-baseline gap-3 mb-3">
        <span className="inline-flex items-center justify-center w-9 h-9 bg-black text-[#FFE066] font-[family-name:var(--font-fraunces)] font-extrabold text-[14px]">{idx}</span>
        <h3 className="font-[family-name:var(--font-fraunces)] font-black text-[28px] md:text-[32px] tracking-[-0.02em] text-black">{title}</h3>
      </div>
      <p className="text-[16px] font-medium text-black leading-[1.5]">{body}</p>
    </div>
  )
}
