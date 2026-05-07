import Link from 'next/link'
import Image from 'next/image'
import { VersionSwitcher } from '@/components/landing/VersionSwitcher'
import { getLandingAuthState } from '@/components/landing/getLandingData'

/**
 * V2 — HUBSPOT / LEMLIST-STYLE WARM B2B CRM SITE
 *
 * Per Dylan: "professional CRM/Lead identifying website" feel.
 *
 * Reference shape: hubspot.com × lemlist.com — corporate B2B
 * marketing pages with warmer personality. Orange accent (HubSpot's
 * signature), bold display headlines, multiple module sections,
 * "Hub-style" feature framing (Sales Hub / Marketing Hub /...),
 * ROI claims, customer outcome cards, integrations, big footer.
 *
 * Distinct from V1 (Apollo/Clay):
 *   - Warmer / louder palette — orange-forward instead of navy-led
 *   - "Hub" framing for product modules (Sourcing Hub / Outreach
 *     Hub / Analytics Hub) instead of plain feature sections
 *   - Bigger ROI claims with explicit hours-saved framing
 *   - Customer outcome cards with metric badges
 *   - More content density per section
 *
 * Distinct from V3 (Pipedrive multi-page):
 *   - Single long-scroll page (V3 splits into multiple routes)
 *   - V2 = one-page corporate site, V3 = multi-page corporate site
 */

export const metadata = {
  title: 'Creator Outreach — The all-in-one platform for creator outreach',
  description: 'Source, score, pitch, and track creator partnerships across YouTube, Instagram, TikTok, X, and LinkedIn. Built for sales, GTM, and marketing teams.',
}

export default async function LandingV2() {
  const { isAuthed } = await getLandingAuthState()

  return (
    <main className="min-h-screen text-[#1A1F2E] font-[family-name:var(--font-geist-sans)]" style={{ backgroundColor: '#FFF7F2' }}>
      <VersionSwitcher />

      {/* ── ANNOUNCEMENT BAR ──────────────────────────────────── */}
      <div className="bg-[#1A1F2E] text-white text-center py-2.5 text-[13px] font-medium">
        <span className="opacity-75">New:</span>{' '}
        <span>Real Instagram metrics now live in your queue.</span>{' '}
        <a href="#product" className="text-[#FF7A45] hover:text-[#FFB89C] underline decoration-1 underline-offset-2 ml-1">Read more →</a>
      </div>

      {/* ── TOP NAV ──────────────────────────────────────────── */}
      <header className="sticky top-[40px] z-40 bg-white/95 backdrop-blur-md border-b border-[#1A1F2E]/8">
        <div className="max-w-[1280px] mx-auto px-6 h-[68px] flex items-center justify-between">
          <Link href="/landing/v2" className="flex items-center gap-2.5 shrink-0">
            <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-[#FF7A45] text-white text-[14px] font-bold">
              ◆
            </span>
            <span className="font-bold tracking-[-0.01em] text-[16px]">Creator Outreach</span>
          </Link>
          <nav className="hidden md:flex items-center gap-6 text-[14px] text-[#1A1F2E]/70 font-semibold">
            <a href="#product"      className="hover:text-[#1A1F2E] transition-colors">Software</a>
            <a href="#solutions"    className="hover:text-[#1A1F2E] transition-colors">Solutions</a>
            <a href="#customers"    className="hover:text-[#1A1F2E] transition-colors">Customers</a>
            <a href="#pricing"      className="hover:text-[#1A1F2E] transition-colors">Pricing</a>
            <a href="mailto:dmeehanj@gmail.com" className="hover:text-[#1A1F2E] transition-colors">Resources</a>
          </nav>
          <div className="flex items-center gap-2 shrink-0">
            {!isAuthed && (
              <Link href="/auth/signin" className="hidden sm:inline-flex text-[14px] text-[#1A1F2E]/70 hover:text-[#1A1F2E] px-3 py-2 font-semibold transition-colors">
                Sign in
              </Link>
            )}
            <a
              href="mailto:dmeehanj@gmail.com?subject=Creator%20Outreach%20demo"
              className="hidden lg:inline-flex items-center bg-white text-[#1A1F2E] hover:bg-[#1A1F2E] hover:text-white border border-[#1A1F2E] px-4 py-2 rounded-md text-[14px] font-semibold transition-colors"
            >
              Get a demo
            </a>
            <Link
              href={isAuthed ? '/' : '/auth/signup'}
              className="inline-flex items-center bg-[#FF7A45] text-white hover:bg-[#E5602D] px-4 py-2 rounded-md text-[14px] font-semibold transition-colors"
            >
              {isAuthed ? 'Open app' : 'Start free'}
            </Link>
          </div>
        </div>
      </header>

      {/* ── HERO ──────────────────────────────────────────────── */}
      <section className="px-6 pt-16 md:pt-24 pb-12 md:pb-20 relative overflow-hidden">
        {/* Soft warm gradient blob */}
        <div
          aria-hidden
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              'radial-gradient(ellipse 60% 50% at 80% 20%, rgba(255,122,69,0.18) 0%, transparent 60%), radial-gradient(ellipse 60% 50% at 20% 80%, rgba(255,194,154,0.20) 0%, transparent 60%)',
          }}
        />
        <div className="relative max-w-[1280px] mx-auto grid md:grid-cols-12 gap-10 items-center">
          <div className="md:col-span-6">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#FF7A45]/10 border border-[#FF7A45]/20 text-[12px] text-[#9C3D1F] mb-7 font-semibold">
              ◆ The all-in-one platform for creator outreach
            </div>
            <h1
              className="font-bold tracking-[-0.035em] leading-[0.98]"
              style={{ fontSize: 'clamp(2.75rem, 6.5vw, 5.5rem)' }}
            >
              Outreach software for the operators{' '}
              <span className="text-[#FF7A45]">running their own GTM.</span>
            </h1>
            <p className="mt-7 text-[18px] md:text-[19px] text-[#1A1F2E]/70 leading-[1.55] max-w-[60ch]">
              Source, score, pitch, and track creator partnerships
              across five platforms — without the spreadsheet, the
              CRM bill, or the four-tab workflow.
            </p>
            <div className="mt-9 flex flex-wrap items-center gap-3">
              <Link
                href={isAuthed ? '/' : '/auth/signup'}
                className="inline-flex items-center gap-2 bg-[#FF7A45] text-white hover:bg-[#E5602D] px-7 py-3.5 rounded-md font-bold text-[15px] transition-colors"
              >
                {isAuthed ? 'Open the app' : 'Start free → no card'}
              </Link>
              <a
                href="mailto:dmeehanj@gmail.com?subject=Creator%20Outreach%20demo"
                className="inline-flex items-center gap-2 bg-white text-[#1A1F2E] hover:bg-[#1A1F2E] hover:text-white border border-[#1A1F2E]/15 hover:border-[#1A1F2E] px-7 py-3.5 rounded-md font-bold text-[15px] transition-colors"
              >
                Get a demo
              </a>
            </div>
            <div className="mt-7 flex items-center gap-3 text-[13px] text-[#1A1F2E]/60">
              <span className="inline-flex -space-x-1.5">
                <span className="w-6 h-6 rounded-full bg-[#FF7A45] border-2 border-white" />
                <span className="w-6 h-6 rounded-full bg-[#FFB89C] border-2 border-white" />
                <span className="w-6 h-6 rounded-full bg-[#1A1F2E] border-2 border-white" />
              </span>
              <span>Trusted by indie operators + growth teams</span>
            </div>
          </div>
          <div className="md:col-span-6">
            <div className="rounded-2xl overflow-hidden border-2 border-[#1A1F2E] bg-white" style={{ boxShadow: '12px 12px 0 rgba(255,122,69,0.30)' }}>
              <div className="flex items-center gap-1.5 px-4 py-2.5 border-b-2 border-[#1A1F2E] bg-[#FFF7F2]">
                <span className="w-2.5 h-2.5 rounded-full bg-[#FF7A45]" />
                <span className="w-2.5 h-2.5 rounded-full bg-[#FFD600]" />
                <span className="w-2.5 h-2.5 rounded-full bg-[#06D6A0]" />
                <span className="ml-3 text-[11px] font-semibold text-[#1A1F2E]/55">creatoroutreach.net</span>
              </div>
              <div className="relative aspect-[16/10] bg-[#0A0E13]">
                <Image src="/screenshots/results.png" alt="Creator Outreach product" fill priority sizes="(min-width: 1280px) 700px, 100vw" className="object-cover object-top" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── SOCIAL PROOF STRIP ───────────────────────────────── */}
      <section className="bg-white border-y-2 border-[#1A1F2E]/10">
        <div className="max-w-[1280px] mx-auto px-6 py-10">
          <div className="text-center text-[12px] uppercase tracking-[0.2em] text-[#1A1F2E]/50 mb-6 font-bold">
            Built for the people running their own outreach
          </div>
          <div className="flex flex-wrap items-center justify-center gap-x-12 gap-y-3 text-[15px] text-[#1A1F2E]/65 font-bold">
            <span>Indie operators</span>
            <span aria-hidden className="text-[#FF7A45]">◆</span>
            <span>Solo founders</span>
            <span aria-hidden className="text-[#FF7A45]">◆</span>
            <span>Growth teams</span>
            <span aria-hidden className="text-[#FF7A45]">◆</span>
            <span>Solo agencies</span>
            <span aria-hidden className="text-[#FF7A45]">◆</span>
            <span>RevOps consultants</span>
          </div>
        </div>
      </section>

      {/* ── HUBS — 3 product modules with screenshots ───────── */}
      <section id="product" className="px-6 py-20 md:py-28 scroll-mt-32">
        <div className="max-w-[1280px] mx-auto">
          <div className="text-center max-w-[700px] mx-auto mb-16">
            <div className="text-[12px] uppercase tracking-[0.2em] text-[#FF7A45] mb-4 font-bold">The platform</div>
            <h2 className="font-bold tracking-[-0.025em] leading-[1.0]" style={{ fontSize: 'clamp(2.25rem, 5vw, 4rem)' }}>
              Three Hubs. One queue. Real outcomes.
            </h2>
            <p className="mt-6 text-[17px] text-[#1A1F2E]/65 leading-[1.55]">
              Sourcing, Outreach, and Analytics — each a standalone
              module that snaps into the same pipeline. Use one or all
              three. They share data and templates so your queue stays
              in one place.
            </p>
          </div>

          <HubSection
            tag="◆ HUB / 01"
            title="Sourcing Hub"
            body="Search five platforms in one query — YouTube, Instagram, TikTok, X, LinkedIn. Filter by audience, region, recency. AI scores every result against criteria you describe in plain English. Real Instagram follower + post counts inline."
            bullets={[
              '5-platform parallel search',
              '22 region filters + audience-size + recency',
              'AI fit scoring with editable criteria',
              'Live Instagram metrics in queue',
            ]}
            shotSrc="/screenshots/results.png"
          />
          <HubSection
            tag="◆ HUB / 02"
            title="Outreach Hub"
            body="One click composes the right templated message per channel — DM on Instagram, Message on LinkedIn, email everywhere else. Edit before send. Auto-cadence pings you when silence hits your follow-up window."
            bullets={[
              'Channel-correct templated messages',
              'Click-to-copy DM / email / LinkedIn',
              'Auto-cadence with editable intervals',
              'Personalize before send',
            ]}
            shotSrc="/screenshots/outreach.png"
            reverse
          />
          <HubSection
            tag="◆ HUB / 03"
            title="Analytics Hub"
            body="Win-rate, response-rate, pipeline value, stale-follow-up surfacing. Customize the metric stack with no formulas required — counts, sums, averages, percentages over the filters you choose. Export anytime."
            bullets={[
              'Win-rate / response-rate / pipeline-value out of box',
              'Custom metrics — no formulas',
              'Stale-follow-up surfacing',
              'CSV / Excel export anytime',
            ]}
            shotSrc="/screenshots/analytics.png"
          />
        </div>
      </section>

      {/* ── ROI BAND ─────────────────────────────────────────── */}
      <section className="px-6 py-20 md:py-28 bg-[#1A1F2E] text-white">
        <div className="max-w-[1280px] mx-auto">
          <div className="text-center max-w-[700px] mx-auto mb-12">
            <div className="text-[12px] uppercase tracking-[0.2em] text-[#FF7A45] mb-4 font-bold">By the numbers</div>
            <h2 className="font-bold tracking-[-0.02em] leading-[1.05]" style={{ fontSize: 'clamp(2rem, 4.5vw, 3.5rem)' }}>
              What teams replace when they switch.
            </h2>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            <Stat n="~8h" label="hours/week saved per rep on outreach admin" />
            <Stat n="3×" label="more follow-ups sent before silence costs you the deal" />
            <Stat n="$400/mo" label="average CRM bill replaced — beta is $0" />
            <Stat n="5" label="platforms searched in parallel, one query" />
          </div>
        </div>
      </section>

      {/* ── SOLUTIONS — by team ──────────────────────────────── */}
      <section id="solutions" className="px-6 py-20 md:py-28 scroll-mt-32">
        <div className="max-w-[1280px] mx-auto">
          <div className="max-w-[700px] mb-14">
            <div className="text-[12px] uppercase tracking-[0.2em] text-[#FF7A45] mb-4 font-bold">Solutions</div>
            <h2 className="font-bold tracking-[-0.025em] leading-[1.0]" style={{ fontSize: 'clamp(2.25rem, 5vw, 4rem)' }}>
              Built for the team running outreach.
            </h2>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-5">
            <SolutionCard
              tag="For sales"
              title="Replace the spreadsheet."
              body="Move pipeline tracking out of Sheets and into a queue with discipline. Status, channel, follow-up — all in one row."
            />
            <SolutionCard
              tag="For growth"
              title="Run multi-channel."
              body="Five platforms in parallel. Same scoring, same template stack, same queue. Stop juggling tabs."
            />
            <SolutionCard
              tag="For founders"
              title="$400/mo CRM, removed."
              body="Beta is $0 with no seat cap. Run the whole pipeline on the cheapest line item in your stack."
            />
            <SolutionCard
              tag="For agencies"
              title="Multiple pipelines."
              body="Run separate pipelines per client without per-seat fees. Export the data when the engagement ends."
            />
          </div>
        </div>
      </section>

      {/* ── CUSTOMERS ───────────────────────────────────────── */}
      <section id="customers" className="px-6 py-20 md:py-28 bg-white border-y border-[#1A1F2E]/10 scroll-mt-32">
        <div className="max-w-[1280px] mx-auto">
          <div className="text-center mb-14">
            <div className="text-[12px] uppercase tracking-[0.2em] text-[#FF7A45] mb-4 font-bold">Customers</div>
            <h2 className="font-bold tracking-[-0.025em] mx-auto max-w-[24ch]" style={{ fontSize: 'clamp(2rem, 4.5vw, 3.5rem)' }}>
              The folks who actually run their own outreach.
            </h2>
          </div>
          <div className="grid md:grid-cols-3 gap-5">
            <CustomerCard
              metric="3 tabs + Notion replaced"
              quote="The spreadsheet was a graveyard. The CRM was a museum. This is the only thing I&apos;ve used that didn&apos;t make me wish I was using something else."
              persona="Indie operator"
              context="Solo GTM · fishing-conditions product"
            />
            <CustomerCard
              metric="$0 vs. $400/mo"
              quote="Two CRMs were too expensive for one person and didn&apos;t know what an Instagram handle was. This does."
              persona="Solo founder"
              context="Content-led GTM · DTC"
            />
            <CustomerCard
              metric="3× more follow-ups sent"
              quote="The auto-cadence alone is worth it. I stopped forgetting follow-ups that were sitting on day-7."
              persona="Growth lead"
              context="Pre-seed B2B · two-person team"
            />
          </div>
        </div>
      </section>

      {/* ── INTEGRATIONS-style PLATFORMS ──────────────────────── */}
      <section className="px-6 py-20 md:py-28">
        <div className="max-w-[1280px] mx-auto">
          <div className="text-center max-w-[640px] mx-auto mb-12">
            <div className="text-[12px] uppercase tracking-[0.2em] text-[#FF7A45] mb-4 font-bold">Platforms supported</div>
            <h2 className="font-bold tracking-[-0.025em]" style={{ fontSize: 'clamp(1.75rem, 4vw, 3rem)' }}>
              Five sources, one ranked queue.
            </h2>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
            {[
              { name: 'YouTube',  bg: '#FFEDED' },
              { name: 'Instagram',bg: '#FFF1F4' },
              { name: 'TikTok',   bg: '#F0F0F0' },
              { name: 'X',        bg: '#F0F0F0' },
              { name: 'LinkedIn', bg: '#EAF1F8' },
            ].map(p => (
              <div key={p.name} className="rounded-xl border-2 border-[#1A1F2E]/10 bg-white px-4 py-7 text-center hover:border-[#FF7A45] hover:-translate-y-0.5 transition-all">
                <div className="w-10 h-10 mx-auto rounded-lg mb-3" style={{ backgroundColor: p.bg }} />
                <div className="text-[14px] font-bold">{p.name}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── PRICING ────────────────────────────────────────── */}
      <section id="pricing" className="px-6 py-20 md:py-28 bg-white border-y border-[#1A1F2E]/10 scroll-mt-32">
        <div className="max-w-[1100px] mx-auto">
          <div className="text-center mb-12">
            <div className="text-[12px] uppercase tracking-[0.2em] text-[#FF7A45] mb-4 font-bold">Pricing</div>
            <h2 className="font-bold tracking-[-0.025em] mb-4" style={{ fontSize: 'clamp(2rem, 4.5vw, 3.5rem)' }}>
              Simple. Free during beta. Honest after.
            </h2>
            <p className="max-w-[60ch] mx-auto text-[16px] text-[#1A1F2E]/65 leading-[1.55]">
              No card on file. No seat cap. No annual upsell. Beta users get grandfathered when paid plans launch — announced before any tier change.
            </p>
          </div>
          <div className="grid md:grid-cols-2 gap-5 max-w-[820px] mx-auto">
            <PricingCard
              tier="Beta"
              price="$0"
              priceSub="Free while in beta"
              features={[
                'Five-platform search + AI scoring',
                'Templated outreach per channel',
                'Auto-cadence follow-ups',
                'Real Instagram metrics in queue',
                'CSV / Excel export anytime',
              ]}
              cta={isAuthed ? 'Open the app' : 'Start for free'}
              ctaHref={isAuthed ? '/' : '/auth/signup'}
              featured
            />
            <PricingCard
              tier="Pro (coming)"
              price="TBD"
              priceSub="For heavier users + teams"
              features={[
                'Higher search volume',
                'Multi-seat workspaces',
                'Bulk email enrichment',
                'Priority support',
                'Beta users grandfathered',
              ]}
              cta="Notify me"
              ctaHref="mailto:dmeehanj@gmail.com?subject=Notify%20me%20when%20Creator%20Outreach%20Pro%20is%20ready"
            />
          </div>
        </div>
      </section>

      {/* ── FAQ ─────────────────────────────────────────────── */}
      <section className="px-6 py-20 md:py-28">
        <div className="max-w-[820px] mx-auto">
          <div className="text-center mb-12">
            <div className="text-[12px] uppercase tracking-[0.2em] text-[#FF7A45] mb-4 font-bold">FAQ</div>
            <h2 className="font-bold tracking-[-0.025em]" style={{ fontSize: 'clamp(2rem, 4.5vw, 3.5rem)' }}>
              Common questions.
            </h2>
          </div>
          <div className="space-y-3">
            <FaqItem q="Do I need a credit card to start?" a="No. Beta is $0 with no card required. Sign up and start searching." />
            <FaqItem q="What happens to my data if I leave?" a="It's yours. Export to CSV or Excel anytime. Privacy isn't a setting we toggle — it's the default posture of the platform." />
            <FaqItem q="Will pricing change later?" a="Eventually, yes — when we launch paid tiers we'll announce ahead of any change. Beta users will be grandfathered." />
            <FaqItem q="Which platforms are supported today?" a="YouTube, Instagram, TikTok, X, and LinkedIn — all in one query." />
            <FaqItem q="Is this just for solo operators?" a="No. Indie operators, solo founders, growth teams, and small agencies all run on it. The Pro tier (coming) adds team-shaped features." />
          </div>
        </div>
      </section>

      {/* ── FINAL CTA ───────────────────────────────────────── */}
      <section className="px-6 pb-20 md:pb-28">
        <div className="max-w-[1100px] mx-auto rounded-3xl bg-[#1A1F2E] text-white px-8 py-14 md:py-20 text-center relative overflow-hidden">
          <div
            aria-hidden
            className="absolute inset-0 pointer-events-none"
            style={{
              background:
                'radial-gradient(ellipse 60% 50% at 80% 30%, rgba(255,122,69,0.30) 0%, transparent 60%)',
            }}
          />
          <div className="relative">
            <h2 className="font-bold tracking-[-0.025em] mx-auto max-w-[24ch] mb-6" style={{ fontSize: 'clamp(2rem, 4.5vw, 3.5rem)' }}>
              Replace your <span className="text-[#FF7A45]">creator-outreach spreadsheet</span> today.
            </h2>
            <p className="max-w-[52ch] mx-auto text-[16px] text-white/70 leading-[1.55] mb-9">
              Free during beta. No card. Built by one operator who got sick of the spreadsheet.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3">
              <Link
                href={isAuthed ? '/' : '/auth/signup'}
                className="inline-flex items-center gap-2 bg-[#FF7A45] text-white hover:bg-[#E5602D] px-7 py-3.5 rounded-md font-bold text-[15px] transition-colors"
              >
                {isAuthed ? 'Open the app' : 'Start for free'}
                <span aria-hidden>→</span>
              </Link>
              <a
                href="mailto:dmeehanj@gmail.com?subject=Creator%20Outreach%20demo"
                className="inline-flex items-center gap-2 bg-white text-[#1A1F2E] hover:bg-[#FF7A45] hover:text-white px-7 py-3.5 rounded-md font-bold text-[15px] transition-colors"
              >
                Talk to founder
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* ── BIG FOOTER ─────────────────────────────────────── */}
      <footer className="bg-white border-t border-[#1A1F2E]/10 px-6 py-14">
        <div className="max-w-[1280px] mx-auto grid md:grid-cols-6 gap-8">
          <div className="md:col-span-2">
            <Link href="/landing/v2" className="flex items-center gap-2 mb-4">
              <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-[#FF7A45] text-white text-[14px] font-bold">◆</span>
              <span className="font-bold tracking-tight text-[16px]">Creator Outreach</span>
            </Link>
            <p className="text-[13px] text-[#1A1F2E]/60 leading-[1.55] max-w-[36ch]">
              The all-in-one platform for sourcing, scoring, pitching, and tracking creator partnerships.
            </p>
            <div className="mt-6 text-[12px] text-[#1A1F2E]/50">
              © 2026 Creator Outreach
            </div>
          </div>
          <FooterCol heading="Software" links={[
            ['Sourcing Hub', '#product'],
            ['Outreach Hub', '#product'],
            ['Analytics Hub','#product'],
            ['Pricing',      '#pricing'],
          ]} />
          <FooterCol heading="Solutions" links={[
            ['For sales',     '#solutions'],
            ['For growth',    '#solutions'],
            ['For founders',  '#solutions'],
            ['For agencies',  '#solutions'],
          ]} />
          <FooterCol heading="Resources" links={[
            ['Customers',     '#customers'],
            ['Guides',        'mailto:dmeehanj@gmail.com'],
            ['Changelog',     'mailto:dmeehanj@gmail.com'],
          ]} />
          <FooterCol heading="Company" links={[
            ['Contact',       'mailto:dmeehanj@gmail.com'],
            ['Talk to us',    'mailto:dmeehanj@gmail.com?subject=Creator%20Outreach%20demo'],
            ['Privacy',       '/privacy'],
            ['Terms',         '/terms'],
          ]} />
        </div>
      </footer>
    </main>
  )
}

/* ─── primitives ─── */

function HubSection({ tag, title, body, bullets, shotSrc, reverse = false }: { tag: string; title: string; body: string; bullets: string[]; shotSrc: string; reverse?: boolean }) {
  return (
    <div className={`grid md:grid-cols-2 gap-10 md:gap-16 items-center mb-20 md:mb-28 last:mb-0`}>
      <div className={reverse ? 'md:order-2' : ''}>
        <div className="text-[11px] uppercase tracking-[0.22em] text-[#FF7A45] mb-3 font-bold">{tag}</div>
        <h3 className="font-bold tracking-[-0.02em] mb-5" style={{ fontSize: 'clamp(1.75rem, 3.5vw, 2.75rem)' }}>{title}</h3>
        <p className="text-[16px] text-[#1A1F2E]/70 leading-[1.6] mb-6">{body}</p>
        <ul className="space-y-2.5 text-[15px] text-[#1A1F2E]/85">
          {bullets.map(b => (
            <li key={b} className="flex items-start gap-2.5">
              <span className="text-[#FF7A45] font-bold mt-0.5 shrink-0">✓</span>
              <span>{b}</span>
            </li>
          ))}
        </ul>
      </div>
      <div className={reverse ? 'md:order-1' : ''}>
        <div className="rounded-xl overflow-hidden border-2 border-[#1A1F2E] bg-white" style={{ boxShadow: '8px 8px 0 rgba(255,122,69,0.20)' }}>
          <div className="relative aspect-[16/10] bg-[#0A0E13]">
            <Image src={shotSrc} alt={title} fill sizes="(min-width: 1280px) 600px, 100vw" className="object-cover object-top" />
          </div>
        </div>
      </div>
    </div>
  )
}

function SolutionCard({ tag, title, body }: { tag: string; title: string; body: string }) {
  return (
    <div className="rounded-xl border-2 border-[#1A1F2E]/10 bg-white p-6 hover:border-[#FF7A45] hover:-translate-y-1 transition-all">
      <div className="text-[10px] uppercase tracking-[0.18em] text-[#FF7A45] mb-3 font-bold">{tag}</div>
      <h3 className="text-[18px] font-bold tracking-[-0.01em] mb-3">{title}</h3>
      <p className="text-[14px] text-[#1A1F2E]/65 leading-[1.55]">{body}</p>
    </div>
  )
}

function CustomerCard({ metric, quote, persona, context }: { metric: string; quote: string; persona: string; context: string }) {
  return (
    <figure className="rounded-xl border-2 border-[#1A1F2E]/10 bg-white p-7 flex flex-col">
      <div className="inline-flex items-center self-start gap-1.5 px-3 py-1 rounded-full bg-[#FF7A45]/15 text-[#9C3D1F] text-[11px] uppercase tracking-[0.16em] font-bold mb-5">
        ↑ {metric}
      </div>
      <blockquote className="text-[15px] md:text-[16px] text-[#1A1F2E]/85 leading-[1.55] mb-6 flex-1" dangerouslySetInnerHTML={{ __html: quote }} />
      <div className="border-t border-[#1A1F2E]/10 pt-4">
        <div className="text-[14px] font-bold mb-1">{persona}</div>
        <div className="text-[12px] text-[#1A1F2E]/55">{context}</div>
      </div>
    </figure>
  )
}

function Stat({ n, label }: { n: string; label: string }) {
  return (
    <div className="text-center">
      <div className="font-bold tracking-[-0.025em] text-[#FF7A45] mb-2" style={{ fontSize: 'clamp(2.5rem, 5vw, 4rem)' }}>{n}</div>
      <div className="text-[13px] text-white/60 leading-[1.5] max-w-[26ch] mx-auto">{label}</div>
    </div>
  )
}

function PricingCard({ tier, price, priceSub, features, cta, ctaHref, featured = false }: { tier: string; price: string; priceSub: string; features: string[]; cta: string; ctaHref: string; featured?: boolean }) {
  return (
    <div className={`rounded-2xl p-7 md:p-8 ${featured ? 'bg-[#FF7A45] text-white' : 'bg-white border-2 border-[#1A1F2E]/10'}`} style={featured ? { boxShadow: '0 30px 60px -30px rgba(255,122,69,0.5)' } : undefined}>
      <div className={`text-[13px] uppercase tracking-[0.18em] mb-3 font-bold ${featured ? 'text-white/85' : 'text-[#FF7A45]'}`}>{tier}</div>
      <div className="font-bold tracking-[-0.025em] mb-1" style={{ fontSize: 'clamp(2.25rem, 4vw, 3rem)' }}>{price}</div>
      <div className={`text-[13px] mb-6 ${featured ? 'text-white/75' : 'text-[#1A1F2E]/55'}`}>{priceSub}</div>
      <ul className="space-y-2.5 mb-7 text-[14px]">
        {features.map(f => (
          <li key={f} className="flex items-start gap-2.5">
            <span className={featured ? 'text-white font-bold mt-0.5 shrink-0' : 'text-[#FF7A45] font-bold mt-0.5 shrink-0'}>✓</span>
            <span className={featured ? 'text-white/95' : 'text-[#1A1F2E]/85'}>{f}</span>
          </li>
        ))}
      </ul>
      <Link href={ctaHref} className={`block text-center px-5 py-3 rounded-md font-bold text-[15px] transition-colors ${featured ? 'bg-white text-[#FF7A45] hover:bg-[#1A1F2E] hover:text-white' : 'bg-[#1A1F2E] text-white hover:bg-[#FF7A45]'}`}>
        {cta} <span aria-hidden>→</span>
      </Link>
    </div>
  )
}

function FaqItem({ q, a }: { q: string; a: string }) {
  return (
    <details className="group rounded-xl border border-[#1A1F2E]/10 bg-white px-6 py-5 hover:border-[#FF7A45]/50 transition-colors">
      <summary className="flex items-center justify-between cursor-pointer list-none">
        <span className="text-[16px] font-bold pr-4">{q}</span>
        <span className="text-[#FF7A45] text-[20px] group-open:rotate-45 transition-transform shrink-0">+</span>
      </summary>
      <p className="mt-3 text-[14px] text-[#1A1F2E]/70 leading-[1.6]">{a}</p>
    </details>
  )
}

function FooterCol({ heading, links }: { heading: string; links: [string, string][] }) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-[0.18em] text-[#1A1F2E]/50 mb-4 font-bold">{heading}</div>
      <ul className="space-y-2">
        {links.map(([label, href]) => (
          <li key={label}>
            <Link href={href} className="text-[13px] text-[#1A1F2E]/70 hover:text-[#FF7A45] transition-colors">{label}</Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
