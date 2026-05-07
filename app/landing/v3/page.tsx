import Link from 'next/link'
import Image from 'next/image'
import { VersionSwitcher } from '@/components/landing/VersionSwitcher'
import { getLandingAuthState } from '@/components/landing/getLandingData'

/**
 * V3 — VERCEL-STYLE
 *
 * Reference: vercel.com
 *
 * Visual signatures we're modeling:
 *   - Pure #000 substrate, pure white type, near-zero color
 *   - Geist Sans + Geist Mono (already in the project)
 *   - Sharp geometric grid layouts, never softened
 *   - Mono details EVERYWHERE — version stamps, build numbers,
 *     status badges, footer signatures
 *   - Single accent reserved for one element only (we use lime green
 *     #00DC82 — Vercel's deploy-success color)
 *   - Terminal-flavored chrome on the screenshot frame
 *   - Tabular features grid, not rounded cards
 *   - Footer: dense, dev-tooling vibes
 *
 * Distinct from V1 (Linear): no gradient mesh, no glow, no warmth.
 * V1 is "premium dark"; V3 is "blacksmith — austere, sharp, precise."
 */

export const metadata = {
  title: 'Creator Outreach / v0.5 — outreach for the modern operator.',
  description: 'A precise tool for finding and pitching creators across YouTube, Instagram, TikTok, X, and LinkedIn. Free during beta.',
}

const FEATURES: { code: string; title: string; body: string }[] = [
  { code: '/01', title: 'Search', body: 'Five platforms in one query. Filter by audience, region, recency.' },
  { code: '/02', title: 'Score',  body: 'AI ranks fit, reach, recency. Reasoning shown in plain English.' },
  { code: '/03', title: 'Pitch',  body: 'One click composes a templated message per channel. Edit before send.' },
  { code: '/04', title: 'Track',  body: 'Replies update status. Auto-cadence pings you when silence hits.' },
]

export default async function LandingV3() {
  const { isAuthed } = await getLandingAuthState()

  return (
    <main className="min-h-screen text-white relative" style={{ backgroundColor: '#000' }}>
      <VersionSwitcher />

      {/* Top nav — sharp, no rounded pills */}
      <header className="border-b border-white/10">
        <div className="max-w-[1280px] mx-auto px-6 h-14 flex items-center justify-between">
          <Link href="/landing/v3" className="flex items-center gap-3">
            <span className="block w-5 h-5">
              {/* Vercel-style triangle */}
              <svg viewBox="0 0 24 24" fill="white">
                <path d="M12 2L2 22h20L12 2z" />
              </svg>
            </span>
            <span className="font-[family-name:var(--font-geist-sans)] font-semibold tracking-[-0.015em] text-[15px]">Creator Outreach</span>
            <span className="hidden sm:inline-block font-[family-name:var(--font-geist-mono)] text-[11px] text-white/45 border border-white/15 px-1.5 py-0.5">v0.5</span>
          </Link>
          <nav className="hidden md:flex items-center gap-6 text-[13px] font-medium text-white/55 font-[family-name:var(--font-geist-sans)]">
            <a href="#features" className="hover:text-white transition-colors">Features</a>
            <a href="#preview"  className="hover:text-white transition-colors">Preview</a>
            <a href="#pricing"  className="hover:text-white transition-colors">Pricing</a>
            <a href="#changelog" className="hover:text-white transition-colors">Changelog</a>
          </nav>
          <div className="flex items-center gap-2">
            {!isAuthed && (
              <Link href="/auth/signin" className="text-[13px] text-white/65 hover:text-white px-2.5 py-1.5 transition-colors">
                Sign in
              </Link>
            )}
            <Link
              href={isAuthed ? '/' : '/auth/signup'}
              className="inline-flex items-center gap-1 bg-white text-black hover:bg-white/90 px-3.5 py-1.5 text-[13px] font-medium transition-colors"
            >
              {isAuthed ? 'Open app' : 'Try free'}
              <span aria-hidden className="text-black/60">→</span>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative px-6 pt-28 md:pt-40 pb-20 md:pb-28">
        <div className="max-w-[1100px] mx-auto">
          {/* Status row — Vercel uses these all over */}
          <div className="flex items-center gap-2 mb-10 font-[family-name:var(--font-geist-mono)] text-[11px] text-white/50">
            <span className="inline-flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-[#00DC82]" />
              <span className="text-[#00DC82] font-medium">DEPLOYED</span>
            </span>
            <span className="text-white/20">|</span>
            <span>build 7f8d52c · main · {new Date().toISOString().slice(0, 10)}</span>
          </div>

          <h1
            className="font-[family-name:var(--font-geist-sans)] font-semibold tracking-[-0.04em] leading-[0.95] max-w-[18ch]"
            style={{ fontSize: 'clamp(3rem, 8vw, 7.5rem)' }}
          >
            Outreach as a discipline, not a spreadsheet.
          </h1>

          <p className="mt-9 max-w-[58ch] text-[18px] md:text-[19px] text-white/65 leading-[1.55] font-[family-name:var(--font-geist-sans)]">
            A precise tool for finding and pitching creators across
            five platforms. Built for operators who care about how the
            tools they ship fit their hand.
          </p>

          <div className="mt-10 flex items-center gap-3 font-[family-name:var(--font-geist-sans)]">
            <Link
              href={isAuthed ? '/' : '/auth/signup'}
              className="inline-flex items-center gap-2 bg-white text-black hover:bg-white/90 px-6 py-3 font-medium text-[15px] active:scale-[0.98] transition-all"
            >
              {isAuthed ? 'Open the app' : 'Start for free'}
              <span aria-hidden className="text-black/60">→</span>
            </Link>
            <Link
              href="#preview"
              className="inline-flex items-center gap-2 border border-white/15 hover:border-white/30 px-6 py-3 font-medium text-[15px] text-white/85 hover:text-white transition-colors"
            >
              See preview
            </Link>
          </div>
        </div>
      </section>

      {/* Stats row — sharp 4-up, divider lines, mono digits */}
      <section className="border-t border-white/10">
        <div className="max-w-[1280px] mx-auto grid grid-cols-2 md:grid-cols-4 divide-x divide-white/10 border-b border-white/10">
          <Stat n="5" label="PLATFORMS" />
          <Stat n="<10s" label="MEDIAN SEARCH" />
          <Stat n="$0" label="PRICE / BETA" />
          <Stat n="∞" label="SEATS / WORKSPACE" />
        </div>
      </section>

      {/* Product preview — Vercel-style raw frame, mono filename header */}
      <section id="preview" className="border-b border-white/10">
        <div className="max-w-[1280px] mx-auto px-6 py-20 md:py-28">
          <div className="border border-white/10 overflow-hidden bg-[#0A0A0A]">
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/10 font-[family-name:var(--font-geist-mono)] text-[11px] text-white/55">
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-[#00DC82]" />
                <span>creatoroutreach.net/results</span>
              </div>
              <div className="hidden sm:flex items-center gap-3">
                <span className="text-white/35">PROD</span>
                <span className="text-white/35">|</span>
                <span className="text-white/35">SCREEN CAPTURE</span>
              </div>
            </div>
            <div className="relative aspect-[1440/900]">
              <Image
                src="/screenshots/results.png"
                alt="Creator Outreach — Results view"
                fill
                priority
                sizes="(min-width: 1280px) 1280px, 100vw"
                className="object-cover object-top"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Features grid — sharp 4-up, mono codes, no rounded cards */}
      <section id="features" className="border-b border-white/10">
        <div className="max-w-[1280px] mx-auto px-6 py-20 md:py-28">
          <div className="mb-14 md:mb-16 max-w-[60ch]">
            <div className="font-[family-name:var(--font-geist-mono)] text-[11px] text-[#00DC82] tracking-[0.18em] uppercase mb-5">
              ▸ FEATURES
            </div>
            <h2 className="font-[family-name:var(--font-geist-sans)] font-semibold tracking-[-0.025em] leading-[1.05]" style={{ fontSize: 'clamp(2rem, 5vw, 3.75rem)' }}>
              Four primitives. <span className="text-white/45">No bloat.</span>
            </h2>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-white/10 border-y border-white/10">
            {FEATURES.map(f => (
              <div key={f.code} className="px-6 py-8 hover:bg-white/[0.02] transition-colors">
                <div className="font-[family-name:var(--font-geist-mono)] text-[11px] text-white/45 tracking-[0.12em] mb-4">{f.code}</div>
                <h3 className="font-[family-name:var(--font-geist-sans)] text-[20px] font-semibold tracking-[-0.01em] mb-3">{f.title}</h3>
                <p className="text-[14px] text-white/60 leading-[1.55] font-[family-name:var(--font-geist-sans)]">{f.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="border-b border-white/10">
        <div className="max-w-[1280px] mx-auto px-6 py-20 md:py-28">
          <div className="grid md:grid-cols-12 gap-8 items-end">
            <div className="md:col-span-7">
              <div className="font-[family-name:var(--font-geist-mono)] text-[11px] text-[#00DC82] tracking-[0.18em] uppercase mb-5">
                ▸ PRICING
              </div>
              <h2 className="font-[family-name:var(--font-geist-sans)] font-semibold tracking-[-0.025em] leading-[1.0]" style={{ fontSize: 'clamp(2.5rem, 6vw, 5rem)' }}>
                $0 / forever for early users.
              </h2>
              <p className="mt-7 max-w-[55ch] text-[16px] text-white/60 leading-[1.55] font-[family-name:var(--font-geist-sans)]">
                No card on file, no seat cap, no annual upsell. Beta
                users get grandfathered into a price announced before
                any tier change.
              </p>
            </div>
            <div className="md:col-span-5">
              <Link
                href={isAuthed ? '/' : '/auth/signup'}
                className="inline-flex items-center gap-2 bg-white text-black hover:bg-white/90 px-6 py-3.5 font-medium text-[15px] active:scale-[0.98] transition-all font-[family-name:var(--font-geist-sans)]"
              >
                {isAuthed ? 'Open the app' : 'Start for free'}
                <span aria-hidden className="text-black/60">→</span>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Changelog teaser — Vercel always has this */}
      <section id="changelog" className="border-b border-white/10">
        <div className="max-w-[1280px] mx-auto px-6 py-16 md:py-20 grid md:grid-cols-12 gap-8">
          <div className="md:col-span-4 font-[family-name:var(--font-geist-mono)] text-[11px] text-white/45 tracking-[0.18em] uppercase">
            ▸ CHANGELOG
          </div>
          <ul className="md:col-span-8 divide-y divide-white/10 -mt-3">
            {[
              { date: '2026-05-07', tag: 'PERF',    body: '2-phase enrichment ships — search now feels real-time on filtered platforms.' },
              { date: '2026-05-06', tag: 'FEAT',    body: 'Meta Instagram Graph API end-to-end loop wired into Results.' },
              { date: '2026-05-06', tag: 'INFRA',   body: 'Upstash Redis backend cache — repeat searches return in sub-200ms.' },
              { date: '2026-05-05', tag: 'AUTH',    body: 'Supabase auth + middleware live. Magic-link sign-in.' },
            ].map((c, i) => (
              <li key={`${c.date}-${i}`} className="py-3 flex items-baseline gap-4 font-[family-name:var(--font-geist-mono)]">
                <span className="text-[11px] text-white/45 tabular-nums shrink-0 w-[88px]">{c.date}</span>
                <span className="text-[10px] text-[#00DC82] font-medium tracking-[0.1em] shrink-0 w-[44px]">{c.tag}</span>
                <span className="text-[13px] text-white/80 font-[family-name:var(--font-geist-sans)]">{c.body}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Footer — dense, dev-tooling */}
      <footer className="border-b border-white/10">
        <div className="max-w-[1280px] mx-auto px-6 py-10 grid md:grid-cols-4 gap-6 font-[family-name:var(--font-geist-mono)] text-[11px] text-white/45">
          <div>
            <div className="text-white text-[13px] font-[family-name:var(--font-geist-sans)] font-semibold mb-3">Creator Outreach</div>
            <div>© 2026</div>
            <div>v0.5 / build 7f8d52c</div>
          </div>
          <FooterCol heading="Product" links={[['Features', '#features'], ['Preview', '#preview'], ['Pricing', '#pricing'], ['Changelog', '#changelog']]} />
          <FooterCol heading="Legal" links={[['Privacy', '/privacy'], ['Terms', '/terms']]} />
          <FooterCol heading="Contact" links={[['dmeehanj@gmail.com', 'mailto:dmeehanj@gmail.com']]} />
        </div>
      </footer>
    </main>
  )
}

function Stat({ n, label }: { n: string; label: string }) {
  return (
    <div className="px-6 py-7 text-center">
      <div className="font-[family-name:var(--font-geist-sans)] font-semibold tracking-[-0.025em] text-white tabular-nums" style={{ fontSize: 'clamp(2rem, 4vw, 3rem)' }}>
        {n}
      </div>
      <div className="mt-1 font-[family-name:var(--font-geist-mono)] text-[10px] text-white/45 tracking-[0.18em]">
        {label}
      </div>
    </div>
  )
}

function FooterCol({ heading, links }: { heading: string; links: [string, string][] }) {
  return (
    <div>
      <div className="text-white/65 tracking-[0.12em] mb-3 font-[family-name:var(--font-geist-mono)] text-[10px]">{heading}</div>
      <ul className="space-y-1.5">
        {links.map(([label, href]) => (
          <li key={label}>
            <Link href={href} className="text-white/55 hover:text-white transition-colors font-[family-name:var(--font-geist-sans)] text-[13px]">{label}</Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
