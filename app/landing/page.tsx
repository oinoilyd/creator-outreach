import Link from 'next/link'
import Image from 'next/image'
import { OperatorConsole } from '@/components/landing/OperatorConsole'
import { LandingTopNav } from '@/components/landing/LandingTopNav'
import { ScreenshotZoom } from '@/components/landing/ScreenshotZoom'
import { PLATFORM_MARKS } from '@/components/landing/PlatformBrandMarks'
import { StatBandSpotlight } from '@/components/landing/StatBandSpotlight'
import { createClient } from '@/lib/supabase/server'

/**
 * /landing — production marketing site.
 *
 * Style: Apollo-style premium B2B prospecting. Cream-white substrate,
 * navy primary (#0F1733), single warm accent (terracotta #E85D2F).
 *
 * Hero centerpiece is OperatorConsole — an anime.js-driven console
 * visual that runs an end-to-end loop of the product (search query
 * types itself, creator cards cascade in with spring physics, fit-
 * score bars fill, score numbers tick up, side panel ticks live
 * counters and a rotating activity feed).
 *
 * Page structure (all single page — was previously split across V1/
 * V2/V3 variants on the redesign branch; consolidated to one
 * Apollo-style design per Dylan's "ship one variant tonight" call):
 *   1. Top nav with 5 sections + dual CTA
 *   2. Hero — split layout: text + dual CTA on left, OperatorConsole on right
 *   3. Customer-proof persona band
 *   4. Solutions tiles (4 personas)
 *   5. Three product narratives (Sourcing / Outreach / Analytics)
 *      each with screenshot + bullet list, alternating layout
 *   6. Stat band (rep-time-saved framing)
 *   7. Customer testimonial grid (metric badges + outcome)
 *   8. Platforms grid (5 supported)
 *   9. Pricing tiers
 *   10. Resources teaser
 *   11. Final CTA (dark, with gradient)
 *   12. Multi-column footer
 */

export const metadata = {
  title: 'Creator Outreach — Search, score, and reach out in one queue',
  description: 'Click a niche bucket, search YouTube/IG/TikTok/X/LinkedIn in parallel, score every result against criteria you wrote in plain English, and reach out from one board. Free during beta.',
}

export default async function LandingPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const isAuthed = !!user

  return (
    <main
      className="min-h-screen overflow-x-clip text-[#0F1733] dark:text-white font-[family-name:var(--font-geist-sans)] bg-[#FCFAF6] dark:bg-[#0A0E15]"
    >
      <LandingTopNav isAuthed={isAuthed} />

      {/* HERO — split layout: copy + dual CTA on left, OperatorConsole on right */}
      <section className="px-6 pt-14 md:pt-20 pb-12 md:pb-16">
        <div className="max-w-[1320px] mx-auto grid md:grid-cols-12 gap-10 md:gap-12 items-center">
          <div className="md:col-span-5">
            {/* (Changelog link removed — it read as a fake release note
                rather than something useful for a brand-new visitor.) */}
            <h1
              className="font-semibold tracking-[-0.035em] leading-[0.97]"
              style={{ fontSize: 'clamp(2.5rem, 5.5vw, 5rem)' }}
            >
              The modern way to source and pitch creators.
            </h1>
            <p className="mt-7 max-w-[54ch] text-[17px] md:text-[18px] text-[#0F1733]/70 dark:text-white/70 leading-[1.55]">
              Lead sourcing by occupation with an AI fit score that
              ranks every result against your criteria. Email + social
              handles inline. Templated outreach for the platform you
              actually target. Follow-up reminders so nothing slips.
              All free while in beta.
            </p>
            <div className="mt-9 flex flex-wrap items-center gap-3">
              <Link
                href={isAuthed ? '/' : '/auth/signup'}
                className="inline-flex items-center gap-2 bg-[#0F1733] text-white hover:bg-[#1F2A52] px-7 py-3.5 rounded-md font-semibold text-[15px] transition-colors"
              >
                {isAuthed ? 'Open the app' : 'Start free — no card'}
                <span aria-hidden>→</span>
              </Link>
              <a
                href="mailto:dmeehanj@gmail.com?subject=Creator%20Outreach%20demo"
                className="inline-flex items-center gap-2 bg-white text-[#0F1733] hover:bg-[#0F1733] hover:text-white px-7 py-3.5 rounded-md font-semibold text-[15px] border border-[#0F1733]/15 dark:border-white/15 hover:border-[#0F1733] transition-colors"
              >
                Talk to the founder
              </a>
            </div>
            <div className="mt-10 pt-7 border-t border-[#0F1733]/10 dark:border-white/10">
              <div className="text-[11px] uppercase tracking-[0.18em] text-[#0F1733]/45 dark:text-white/45 mb-3 font-semibold">
                Built for anyone reaching out to creators
              </div>
              {/* Persona list — single paragraph with inline middle-
                  dot separators. Items can wrap naturally; only the
                  separator span has whitespace-nowrap so a "·" never
                  ends up alone at line-start. The whole list flows as
                  natural prose at any viewport width. */}
              <p className="text-[14px] text-[#0F1733]/60 dark:text-white/60 font-medium leading-[1.7]">
                {[
                  'Podcasters',
                  'Editors',
                  'Videographers',
                  'Marketing teams',
                  'Consultants',
                  'Talent managers',
                  'Solo agencies',
                  'Solo founders',
                  'Indie operators',
                ].map((label, i, arr) => (
                  <span key={label}>
                    {label}
                    {i < arr.length - 1 && (
                      <span aria-hidden className="mx-2 text-[#0F1733]/20 dark:text-white/20">
                        ·
                      </span>
                    )}
                  </span>
                ))}
              </p>
            </div>
          </div>

          <div className="md:col-span-7">
            <ScreenshotZoom caption="Live Results table — click anywhere to zoom out, ESC to close.">
              <OperatorConsole />
            </ScreenshotZoom>
          </div>
        </div>
      </section>

      {/* SOLUTIONS — restructured 2026-05-08 to match the original
          site's 4-step funnel framing per Dylan: Results → Fit Score
          → Outreach → Follow-ups. Each tile is a real step in the
          operator's workflow. The KPI/analytics callouts that lived
          here previously moved into the Analytics product narrative
          (#analytics) where they belong. */}
      <section id="solutions" className="px-6 py-20 md:py-28 bg-white dark:bg-[#131826] border-y border-[#0F1733]/8 dark:border-white/10">
        <div className="max-w-[1280px] mx-auto">
          <div className="max-w-[680px] mb-12 md:mb-16">
            <div className="text-[12px] uppercase tracking-[0.2em] text-[#E85D2F] mb-4 font-semibold">The four-step loop</div>
            <h2 className="font-semibold tracking-[-0.025em]" style={{ fontSize: 'clamp(2rem, 4.5vw, 3.5rem)' }}>
              Sourcing. Fit score. Outreach. Follow-ups.
            </h2>
            <p className="mt-5 text-[17px] text-[#0F1733]/65 dark:text-white/65 leading-[1.55]">
              Find leads by occupation. Score them with a customizable
              AI fit score. Reach out from a built-in CRM with
              templated messages for the platform you target. Stay on
              cadence with follow-up reminders.
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-5">
            <SolutionTile
              step="01"
              icon={
                /* Search — Step 1: lead sourcing */
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <circle cx="11" cy="11" r="7" />
                  <line x1="21" y1="21" x2="16.5" y2="16.5" />
                </svg>
              }
              title="Lead sourcing"
              body="Search by occupation, industry, or field — fitness coaches, financial advisors, podcast hosts, anything. Each result lands with email and social handles already attached. Filter by region, audience size, and last-posted recency."
            />
            <SolutionTile
              step="02"
              icon={
                /* Target — Step 2: AI fit score */
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <circle cx="12" cy="12" r="9" />
                  <circle cx="12" cy="12" r="5" />
                  <circle cx="12" cy="12" r="1.5" fill="currentColor" />
                </svg>
              }
              title="AI fit score"
              body="Describe your ideal creator in plain English and the AI scores every result against it. Fully customizable — any criteria you can name and measure becomes a weighted dimension. Strong / Possible / Weak labels per row, re-tunable per platform."
            />
            <SolutionTile
              step="03"
              icon={
                /* Inbox — Step 3: outreach */
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M22 12h-6l-2 3h-4l-2-3H2" />
                  <path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
                </svg>
              }
              title="Outreach"
              body="A built-in CRM tuned for creators. One row per contact: status, channel, notes. Click an Instagram handle and an opener template lands in your clipboard."
            />
            <SolutionTile
              step="04"
              icon={
                /* Clock — Step 4: follow-ups */
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <circle cx="12" cy="12" r="9" />
                  <polyline points="12 7 12 12 15.5 14" />
                </svg>
              }
              title="Follow-ups"
              body="Auto-cadence reminders so silence doesn&apos;t leak pipeline. Dedicated Follow-ups sub-tab to triage what needs a nudge today. Mark followed-up with a click and the cadence resets."
            />
          </div>
        </div>
      </section>

      {/* WHAT'S UNDER THE HOOD — AI fit score feature spotlight.
          Moved here (was after Product Narratives) so the dial reads
          as the proof point right after Solutions has named the four
          steps. Everything in this section is in the StatBandSpotlight
          client component (interactive chip-cloud → explanation
          panels). */}
      <StatBandSpotlight />

      {/* PRODUCT NARRATIVES (3 stages with screenshots).
          Each div has its own #anchor (sourcing/outreach/analytics)
          so the hamburger menu can deep-link directly to that
          stage. scroll-mt-24 leaves room for the sticky header. */}
      <section id="product" className="scroll-mt-24">
        {/* 1 — Sourcing */}
        <div id="sourcing" className="px-6 pt-20 md:pt-28 pb-12 md:pb-16 scroll-mt-24">
          <div className="max-w-[1280px] mx-auto grid md:grid-cols-2 gap-10 md:gap-16 items-center">
            <div>
              <div className="text-[12px] uppercase tracking-[0.2em] text-[#E85D2F] mb-4 font-semibold">01 / Sourcing</div>
              <h3 className="font-semibold tracking-[-0.02em] mb-5" style={{ fontSize: 'clamp(1.75rem, 3.5vw, 2.75rem)' }}>
                Lead sourcing by occupation, scored on fit.
              </h3>
              <p className="text-[16px] text-[#0F1733]/70 dark:text-white/70 leading-[1.6] mb-6">
                Search any occupation, industry, or field. Each result
                comes back with email + social handles attached and a
                fit score that explains itself in plain English (Strong
                / Possible / Weak), based on criteria you describe in
                a sentence.
              </p>
              <ul className="space-y-2.5 text-[15px] text-[#0F1733]/85 dark:text-white/85">
                <Bullet>Customizable AI fit score — any criteria you can name and measure</Bullet>
                <Bullet>Email + LinkedIn + Instagram handles inline per result</Bullet>
                <Bullet>Filter by region, audience size, last-posted recency, follower count</Bullet>
                <Bullet>Source from YouTube, Instagram, TikTok, X, and LinkedIn — focus on the platform you actually target</Bullet>
              </ul>
            </div>
            <ScreenshotZoom caption="Results — click to zoom; ESC to close.">
              <div
                className="relative rounded-xl overflow-hidden border border-[#0F1733]/10 dark:border-white/10 bg-[#0E121C]"
                style={{
                  // Aspect ratio of the actual screenshot file so it
                  // fits without cropping. results.png is 2472×1182.
                  aspectRatio: '2472 / 1182',
                  boxShadow: '0 30px 60px -25px rgba(15,23,51,0.20)',
                }}
              >
                <Image
                  src="/screenshots/results.png"
                  alt="Sourcing view"
                  fill
                  sizes="(min-width: 1280px) 600px, 100vw"
                  className="object-contain"
                />
              </div>
            </ScreenshotZoom>
          </div>
        </div>

        {/* 2 — Outreach */}
        <div id="outreach" className="px-6 py-12 md:py-16 scroll-mt-24">
          <div className="max-w-[1280px] mx-auto grid md:grid-cols-2 gap-10 md:gap-16 items-center">
            <div className="md:order-2">
              <div className="text-[12px] uppercase tracking-[0.2em] text-[#E85D2F] mb-4 font-semibold">02 / Outreach</div>
              <h3 className="font-semibold tracking-[-0.02em] mb-5" style={{ fontSize: 'clamp(1.75rem, 3.5vw, 2.75rem)' }}>
                Every conversation in one queue.
              </h3>
              <p className="text-[16px] text-[#0F1733]/70 dark:text-white/70 leading-[1.6] mb-6">
                The Outreach board collects every creator you&apos;ve pitched —
                channel, email, product, status, medium. Status pills track
                Successful / Open / Rejected. Sub-tabs split out Favorites,
                Follow-ups, and Analytics. The whole pipeline lives in one row
                per creator.
              </p>
              {/* Bullets aligned with what outreach.png literally shows:
                  the CRM-style outreach board (status pills, medium
                  selector, reached-out indicators, sub-tabs). */}
              <ul className="space-y-2.5 text-[15px] text-[#0F1733]/85 dark:text-white/85">
                <Bullet>Status pills: Successful · Open · Rejected · No Response</Bullet>
                <Bullet>Medium tracker per row (Email / LinkedIn / Other)</Bullet>
                <Bullet>Favorites + Follow-ups sub-tabs for fast triage</Bullet>
                <Bullet>Reached-out indicator + product + notes per creator</Bullet>
              </ul>
            </div>
            <ScreenshotZoom className="md:order-1" caption="Outreach board — click to zoom; ESC to close.">
              <div
                className="relative rounded-xl overflow-hidden border border-[#0F1733]/10 dark:border-white/10 bg-[#0E121C]"
                style={{
                  // outreach.png is 2784×1122 — aspect 2.48
                  aspectRatio: '2784 / 1122',
                  boxShadow: '0 30px 60px -25px rgba(15,23,51,0.20)',
                }}
              >
                <Image
                  src="/screenshots/outreach.png"
                  alt="Outreach view"
                  fill
                  sizes="(min-width: 1280px) 600px, 100vw"
                  className="object-contain"
                />
              </div>
            </ScreenshotZoom>
          </div>
        </div>

        {/* 3 — Analytics */}
        <div id="analytics" className="px-6 py-12 md:py-16 pb-20 md:pb-28 scroll-mt-24">
          <div className="max-w-[1280px] mx-auto grid md:grid-cols-2 gap-10 md:gap-16 items-center">
            <div>
              <div className="text-[12px] uppercase tracking-[0.2em] text-[#E85D2F] mb-4 font-semibold">03 / Analytics</div>
              <h3 className="font-semibold tracking-[-0.02em] mb-5" style={{ fontSize: 'clamp(1.75rem, 3.5vw, 2.75rem)' }}>
                Win rate, response rate, pipeline value.
              </h3>
              <p className="text-[16px] text-[#0F1733]/70 dark:text-white/70 leading-[1.6] mb-6">
                Seven default KPIs across the top — In Pipeline, Reached
                Out, Response Received, Response Rate, Win Rate, Pipeline $,
                Stale Follow-ups. Plus 30+ customizable metrics you can plug
                into the dashboard. Status breakdown bar, outreach-by-medium
                split, velocity card.
              </p>
              <ul className="space-y-2.5 text-[15px] text-[#0F1733]/85 dark:text-white/85">
                <Bullet>7 default KPI cards · 30+ customizable metrics, no formulas</Bullet>
                <Bullet>Status breakdown bar (Successful / Open / No Response / Rejected)</Bullet>
                <Bullet>Outreach-by-medium split (Email / LinkedIn / Other)</Bullet>
                <Bullet>Velocity card tracks the last 7 days</Bullet>
              </ul>
            </div>
            <ScreenshotZoom caption="Analytics — click to zoom; ESC to close.">
              <div
                className="relative rounded-xl overflow-hidden border border-[#0F1733]/10 dark:border-white/10 bg-[#0E121C]"
                style={{
                  // analytics.png is 2822×1088 — aspect 2.59
                  aspectRatio: '2822 / 1088',
                  boxShadow: '0 30px 60px -25px rgba(15,23,51,0.20)',
                }}
              >
                <Image
                  src="/screenshots/analytics.png"
                  alt="Analytics view"
                  fill
                  sizes="(min-width: 1280px) 600px, 100vw"
                  className="object-contain"
                />
              </div>
            </ScreenshotZoom>
          </div>
        </div>
      </section>

      {/* (Stat band moved up — was here, now appears between Solutions
          and Product Narratives via <StatBandSpotlight />.) */}

      {/* "WHY THIS EXISTS" — rewritten 2026-05-08. Previous copy was
          too marketing-y ("Three real pains. Three things in the app.
          Here's the receipts."). New voice: terse operator notes
          stating the workaround that wasn't working, then the
          built-in answer. No "pain → solution" arc-speak, no
          horizontal-rule receipts language. */}
      <section id="customers" className="px-6 pb-20 md:pb-28 scroll-mt-24 bg-white dark:bg-[#131826] border-y border-[#0F1733]/8 dark:border-white/10">
        <div className="max-w-[1280px] mx-auto pt-20 md:pt-28">
          <div className="text-center mb-12 md:mb-16">
            <div className="text-[12px] uppercase tracking-[0.2em] text-[#E85D2F] mb-4 font-semibold">Why this exists</div>
            <h2 className="font-semibold tracking-[-0.025em] mx-auto max-w-[26ch]" style={{ fontSize: 'clamp(2rem, 4.5vw, 3.5rem)' }}>
              I built this because I needed it.
            </h2>
            <p className="mt-5 max-w-[58ch] mx-auto text-[16px] text-[#0F1733]/65 dark:text-white/65 leading-[1.6]">
              Three things I was working around for months. Each one is
              now built in, because the workaround was the bottleneck.
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-x-10 md:gap-x-14 gap-y-12 max-w-[1180px] mx-auto">
            <BuiltBecauseNote
              pain="Four tabs to source one creator."
              note="YouTube to find them. LinkedIn for a work email. Twitter to check if they&apos;re still active. A Google Sheet to remember who I&apos;d already messaged."
              becameFeature="One query, five platforms, scored. Email and social handles surface inline. Four tabs become one row."
              tag="Sourcing"
            />
            <BuiltBecauseNote
              pain="Off-the-shelf creator scoring is useless."
              note="Subs + engagement + vertical doesn&apos;t describe fit. None of it knew that I wanted US-based, weekly posters who talk about value investing under 100K subs."
              becameFeature="Write what you actually want. The AI scores against that — fully customizable, weighted per platform."
              tag="Fit score"
            />
            <BuiltBecauseNote
              pain="Every CRM ignored Instagram."
              note="HubSpot is $400/mo. Two influencer-CRMs were $300+/mo behind a sales call. None of them recognized an IG handle, much less helped me open a DM."
              becameFeature="Built-in CRM tuned for creators. Click an IG handle, get a DM template. Email, LinkedIn, and other channels tracked per row."
              tag="Outreach"
            />
          </div>
        </div>
      </section>

      {/* PLATFORMS — eyebrow ("Platforms supported") removed; the
          headline ("Five platforms, in one queue") already does that
          job and one fewer uppercase orange chip helps the page rhythm. */}
      <section className="px-6 py-20 md:py-28">
        <div className="max-w-[1280px] mx-auto text-center">
          <h2 className="font-semibold tracking-[-0.025em] mb-5" style={{ fontSize: 'clamp(1.75rem, 3.5vw, 2.5rem)' }}>
            Five platforms, in one queue.
          </h2>
          <p className="max-w-[58ch] mx-auto text-[16px] text-[#0F1733]/65 dark:text-white/65 leading-[1.6] mb-12">
            All five major creator platforms are searched in parallel and ranked against the same criteria. No tab-juggling.
          </p>
          {/* Platform tiles — actual brand glyphs (YouTube/IG/TikTok/X/
              LinkedIn). Hovering raises the tile and reveals an
              accent stripe on the left edge so the hover state is a
              real affordance, not a generic 4px lift.
              YouTube + Instagram tiles get a subtle "primary" treatment
              (slightly stronger background tint matching their accent)
              since they're the highest-traffic platforms for most
              creator outreach. */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4 max-w-[900px] mx-auto">
            {PLATFORM_MARKS.map(({ name, Glyph, accent }) => {
              const isPrimary = name === 'YouTube' || name === 'Instagram'
              return (
              <div
                key={name}
                className={`group relative rounded-xl border bg-white dark:bg-[#131826] px-4 py-7 hover:-translate-y-1 transition-transform overflow-hidden ${
                  isPrimary
                    ? 'border-[#0F1733]/15 dark:border-white/15'
                    : 'border-[#0F1733]/10 dark:border-white/10'
                }`}
                style={{
                  boxShadow: isPrimary
                    ? `0 1px 3px rgba(15,23,51,0.05), inset 0 0 0 1px ${accent}10`
                    : '0 1px 3px rgba(15,23,51,0.05)',
                }}
              >
                {/* Left accent stripe — fades in on hover, colored to the
                    platform's brand accent. Subtle but reads as a designed
                    state, not a default hover lift. */}
                <span
                  aria-hidden
                  className="absolute inset-y-3 left-0 w-[3px] rounded-r-full opacity-0 group-hover:opacity-100 transition-opacity"
                  style={{ backgroundColor: accent }}
                />
                <div className="flex flex-col items-center justify-center gap-3">
                  {/* Dark-mode legibility: X's currentColor glyph reads
                      black-on-dark — flip it to white in dark mode. */}
                  <Glyph
                    size={32}
                    className={
                      name === 'X' || name === 'TikTok'
                        ? 'text-[#0F1733] dark:text-white'
                        : ''
                    }
                  />
                  <div className={`text-[14px] font-semibold ${isPrimary ? 'text-[#0F1733] dark:text-white' : ''}`}>{name}</div>
                </div>
              </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* PRICING — eyebrow ("Pricing") removed; the $0 in the card
          and the headline do the labelling, no need to also chip it. */}
      <section id="pricing" className="px-6 pb-20 md:pb-28 scroll-mt-24 bg-white dark:bg-[#131826] border-y border-[#0F1733]/8 dark:border-white/10">
        <div className="max-w-[1100px] mx-auto pt-20 md:pt-28">
          <div className="text-center mb-12">
            <h2 className="font-semibold tracking-[-0.025em] mb-5" style={{ fontSize: 'clamp(2rem, 4.5vw, 3.5rem)' }}>
              Free during beta. Grandfathered when it isn&apos;t.
            </h2>
            <p className="max-w-[58ch] mx-auto text-[17px] text-[#0F1733]/65 dark:text-white/65 leading-[1.55]">
              No card on file, no seat cap, no annual upsell. Beta users will be looked after when paid plans launch.
            </p>
          </div>
          <div className="grid md:grid-cols-2 gap-5 max-w-[820px] mx-auto">
            {/* Beta features — every bullet names a real, shipped
                app feature. Verified against the codebase: niche
                buckets in lib/format.ts, fit score in lib/scoring.ts,
                IG scraper in lib/hooks/useInstagramMetrics, cadence in
                CadencePopover, IG DM composer in app/page.tsx, export
                in app/api/export. No aspirational bullets here —
                those live in the Pro tier. */}
            <PricingCard
              tier="Beta"
              price="$0"
              priceSub="Free while in beta · no card · no seat cap"
              features={[
                '5-platform parallel search + 13 niche buckets',
                'Plain-English Lead Criteria + 5-dimension fit score',
                'Outreach board: status pills, medium tracker, follow-up cadence',
                'Instagram DM auto-composer + real follower data inline',
                'CSV / Excel export — your data, anytime',
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
                'Higher search + enrichment quotas',
                'Multi-seat workspaces',
                'Bulk email enrichment via Meta Graph API',
                'Priority support + custom guidance presets',
                'Beta users grandfathered into Pro pricing',
              ]}
              cta="Notify me"
              ctaHref="mailto:dmeehanj@gmail.com?subject=Notify%20me%20when%20Creator%20Outreach%20Pro%20is%20ready"
            />
          </div>
        </div>
      </section>

      {/* ROADMAP — replaces the previous "Resources / Writing in
          progress" section per Dylan. Real items in the build queue
          with a status chip per card (Shipping / Building /
          Researching). Honest framing — Creator Outreach is in beta,
          this is the actual queue. */}
      <section id="resources" className="px-6 py-20 md:py-28 scroll-mt-24">
        <div className="max-w-[1280px] mx-auto">
          <div className="flex flex-wrap items-end justify-between gap-4 mb-10">
            <div>
              <div className="text-[12px] uppercase tracking-[0.2em] text-[#E85D2F] mb-3 font-semibold">Roadmap</div>
              <h2 className="font-semibold tracking-[-0.025em]" style={{ fontSize: 'clamp(1.75rem, 3.5vw, 2.5rem)' }}>
                What&apos;s next, from the operator running it.
              </h2>
              <p className="mt-3 max-w-[60ch] text-[15px] text-[#0F1733]/65 dark:text-white/65 leading-[1.6]">
                The actual queue, in order. Each item ships when it stops
                being a workaround. Email me to vote on what comes next.
              </p>
            </div>
            <a href="mailto:dmeehanj@gmail.com?subject=Creator%20Outreach%20roadmap%20feedback" className="text-[14px] font-semibold text-[#E85D2F] hover:underline">
              Vote on the queue &rarr;
            </a>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
            <RoadmapCard
              status="Shipping"
              title="Real Instagram metrics in the queue"
              body="Inline follower counts and recent-post recency on every IG row. Three-strategy scraper handles profiles even when the public APIs deny."
            />
            <RoadmapCard
              status="Building"
              title="Meta Graph API + bulk email enrichment"
              body="Verified IG audience-quality signals via the Graph API. Bulk lookup that turns a list of handles into a reachability-scored sheet in one pass."
            />
            <RoadmapCard
              status="Building"
              title="Custom guidance presets"
              body="Save your fit-criteria recipe, share it across platforms, snapshot a per-niche scoring profile (e.g. 'Fitness IG sponsorship') and reuse in one click."
            />
            <RoadmapCard
              status="Next up"
              title="Multi-seat workspaces"
              body="Shared queues, per-user notes, per-seat outreach status without per-seat pricing punishments."
            />
            <RoadmapCard
              status="Researching"
              title="Browser extension"
              body="See a creator on YouTube or Instagram, hit a hotkey, drop them into the Outreach board with one keystroke. Skip the copy/paste."
            />
            <RoadmapCard
              status="Researching"
              title="Reply-rate analytics per template"
              body="Compare opener templates head-to-head. See which DM hooks produce replies on which platform. Auto-rotate the winner."
            />
          </div>
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="px-6 pb-20 md:pb-28">
        <div className="max-w-[1100px] mx-auto rounded-3xl bg-[#0F1733] text-white px-8 py-14 md:py-20 text-center relative overflow-hidden">
          <div
            aria-hidden
            className="absolute inset-0 pointer-events-none"
            style={{ background: 'radial-gradient(ellipse 60% 50% at 80% 30%, rgba(232,93,47,0.30) 0%, transparent 60%)' }}
          />
          <div className="relative">
            <h2 className="font-semibold tracking-[-0.025em] mx-auto max-w-[26ch] mb-6" style={{ fontSize: 'clamp(2rem, 4.5vw, 3.5rem)' }}>
              One query. Five platforms. <span className="text-[#F2A261]">One queue.</span>
            </h2>
            <p className="max-w-[52ch] mx-auto text-[16px] text-white/70 leading-[1.55] mb-9">
              Free while in beta. No card on file, no seat cap. The outreach work is the hard part — the tool shouldn&apos;t be.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3">
              <Link
                href={isAuthed ? '/' : '/auth/signup'}
                className="inline-flex items-center gap-2 bg-white text-[#0F1733] hover:bg-[#F2A261] px-7 py-3.5 rounded-md font-semibold text-[15px] transition-colors"
              >
                {isAuthed ? 'Open the app' : 'Start for free'}
                <span aria-hidden>→</span>
              </Link>
              <a
                href="mailto:dmeehanj@gmail.com?subject=Creator%20Outreach%20demo"
                className="inline-flex items-center gap-2 border border-white/30 hover:border-white px-7 py-3.5 rounded-md font-semibold text-[15px] transition-colors"
              >
                Talk to founder
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* FOOTER — wordmark only (the rounded "C" tile in the nav was
          already a generic Stripe-Notion-Linear placeholder; doubling
          it in the footer made the brand read as not-yet-designed).
          Footer keeps just the wordmark with a thin terracotta
          underscore that matches the section accent. */}
      <footer className="bg-white dark:bg-[#131826] border-t border-[#0F1733]/10 dark:border-white/10 px-6 py-14">
        <div className="max-w-[1280px] mx-auto grid md:grid-cols-6 gap-8">
          <div className="md:col-span-2">
            <Link href="/landing" className="inline-block mb-4">
              <span className="font-semibold tracking-[-0.01em] text-[18px] text-[#0F1733] dark:text-white border-b-2 border-[#E85D2F] pb-0.5">
                Creator Outreach
              </span>
            </Link>
            <p className="text-[13px] text-[#0F1733]/60 dark:text-white/60 leading-[1.55] max-w-[36ch]">
              The modern way to source, score, and pitch creators. Built for the operators who actually send the messages.
            </p>
            <div className="mt-6 text-[12px] text-[#0F1733]/50 dark:text-white/50">© 2026 Creator Outreach</div>
          </div>
          <FooterCol heading="Product"   links={[['Overview','#product'],['Solutions','#solutions'],['Pricing','#pricing'],['Customers','#customers']]} />
          {/* Resources column — every entry currently says "Coming
              soon" because none of the long-form content (guides,
              playbooks, changelog) is published yet. Honest framing
              beats four mailto: links pretending to be real pages. */}
          <FooterColPlaceholder heading="Resources" labels={['Guides', 'Playbooks', 'Changelog']} />
          <FooterCol heading="Company"   links={[['About','#'],['Contact','mailto:dmeehanj@gmail.com'],['Talk to us','mailto:dmeehanj@gmail.com?subject=Creator%20Outreach%20demo']]} />
          <FooterCol heading="Legal"     links={[['Privacy','/privacy'],['Terms','/terms']]} />
        </div>
      </footer>
    </main>
  )
}

/* ─── primitives ─── */


function SolutionTile({ icon, title, body, step }: { icon: React.ReactNode; title: string; body: string; step?: string }) {
  return (
    <div className="group relative rounded-xl border border-[#0F1733]/10 dark:border-white/10 bg-white dark:bg-[#1A2034] p-6 hover:-translate-y-1 transition-transform overflow-hidden" style={{ boxShadow: '0 1px 3px rgba(15,23,51,0.05)' }}>
      {/* Hover affordance — arrow appears top-right on hover. Different
          from the platform-tile left-stripe and the resource-card
          chevron-trail; each card type has its own hover reveal so the
          page doesn't read as one repeated -translate-y-1 lift. */}
      <span
        aria-hidden
        className="absolute top-4 right-4 text-[#E85D2F] opacity-0 group-hover:opacity-100 -translate-x-1 group-hover:translate-x-0 transition-all duration-200"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <line x1="7" y1="17" x2="17" y2="7" />
          <polyline points="7 7 17 7 17 17" />
        </svg>
      </span>
      <div className="flex items-center gap-3 mb-4">
        <span className="inline-flex items-center justify-center w-10 h-10 rounded-lg bg-[#E85D2F]/10 text-[#E85D2F] [&>svg]:w-5 [&>svg]:h-5">
          {icon}
        </span>
        {step && (
          <span className="text-[11px] uppercase tracking-[0.2em] text-[#0F1733]/40 dark:text-white/40 font-bold font-mono">
            Step {step}
          </span>
        )}
      </div>
      <h3 className="text-[18px] font-semibold tracking-[-0.01em] mb-2">{title}</h3>
      <p className="text-[14px] text-[#0F1733]/65 dark:text-white/65 leading-[1.55]">{body}</p>
    </div>
  )
}

function Bullet({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2.5">
      <span className="text-[#E85D2F] font-bold mt-0.5 shrink-0">✓</span>
      <span>{children}</span>
    </li>
  )
}

function Stat({ n, label }: { n: string; label: string }) {
  return (
    <div className="text-center">
      <div className="font-semibold tracking-[-0.025em] text-white mb-1.5" style={{ fontSize: 'clamp(2.25rem, 4vw, 3.5rem)' }}>{n}</div>
      <div className="text-[13px] text-white/60 leading-[1.4]">{label}</div>
    </div>
  )
}

function BuiltBecauseNote({
  pain,
  note,
  becameFeature,
  tag,
}: {
  /** Headline pain (the thing that broke). */
  pain: string
  /** Lived-in description of the pain in operator voice. */
  note: string
  /** What got built in the app to solve it. */
  becameFeature: string
  /** One-word section tag (Sourcing / Scoring / Outreach). */
  tag: string
}) {
  return (
    <figure className="flex flex-col">
      {/* Tag — small uppercase chip naming which part of the app this
          pain produced. */}
      <span className="text-[11px] uppercase tracking-[0.18em] text-[#E85D2F] font-bold mb-4">
        {tag}
      </span>
      <h3 className="text-[20px] md:text-[22px] font-semibold tracking-[-0.015em] leading-[1.25] mb-4 text-[#0F1733] dark:text-white">
        {pain}
      </h3>
      <p
        className="text-[15px] md:text-[16px] text-[#0F1733]/75 dark:text-white/75 leading-[1.6] mb-5 flex-1"
        dangerouslySetInnerHTML={{ __html: note }}
      />
      {/* Hairline rule + "what got built" block — connects the pain
          directly to the feature in the app. Reads as a real changelog
          entry, not marketing fluff. */}
      <div className="border-t border-[#0F1733]/12 dark:border-white/15 pt-4 flex gap-3">
        <span
          aria-hidden
          className="mt-0.5 inline-flex items-center justify-center w-5 h-5 rounded-full bg-[#E85D2F]/15 text-[#E85D2F] shrink-0"
        >
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="5 12 10 17 19 7" />
          </svg>
        </span>
        <p
          className="text-[13.5px] text-[#0F1733]/70 dark:text-white/70 leading-[1.55]"
          dangerouslySetInnerHTML={{ __html: becameFeature }}
        />
      </div>
    </figure>
  )
}

function PricingCard({ tier, price, priceSub, features, cta, ctaHref, featured = false }: { tier: string; price: string; priceSub: string; features: string[]; cta: string; ctaHref: string; featured?: boolean }) {
  return (
    <div className={`rounded-2xl p-7 md:p-8 ${featured ? 'bg-[#0F1733] text-white' : 'bg-white dark:bg-[#131826] border border-[#0F1733]/10 dark:border-white/10'}`} style={featured ? { boxShadow: '0 30px 60px -30px rgba(15,23,51,0.4)' } : undefined}>
      <div className={`text-[13px] uppercase tracking-[0.18em] mb-3 font-semibold ${featured ? 'text-[#F2A261]' : 'text-[#E85D2F]'}`}>{tier}</div>
      <div className="font-semibold tracking-[-0.025em] mb-1" style={{ fontSize: 'clamp(2.25rem, 4vw, 3rem)' }}>{price}</div>
      <div className={`text-[13px] mb-6 ${featured ? 'text-white/55' : 'text-[#0F1733]/55 dark:text-white/55'}`}>{priceSub}</div>
      <ul className="space-y-2.5 mb-7 text-[14px]">
        {features.map(f => (
          <li key={f} className="flex items-start gap-2.5">
            <span className={featured ? 'text-[#F2A261] font-bold mt-0.5 shrink-0' : 'text-[#E85D2F] font-bold mt-0.5 shrink-0'}>✓</span>
            <span className={featured ? 'text-white/90' : 'text-[#0F1733]/85 dark:text-white/85'}>{f}</span>
          </li>
        ))}
      </ul>
      <Link href={ctaHref} className={`block text-center px-5 py-3 rounded-md font-semibold text-[15px] transition-colors ${featured ? 'bg-white text-[#0F1733] hover:bg-[#F2A261]' : 'bg-[#0F1733] text-white hover:bg-[#E85D2F]'}`}>
        {cta} <span aria-hidden>→</span>
      </Link>
    </div>
  )
}

function RoadmapCard({
  status,
  title,
  body,
}: {
  status: 'Shipping' | 'Building' | 'Next up' | 'Researching'
  title: string
  body: string
}) {
  // Status-specific chip colour — green for shipping (almost there),
  // terracotta for building (active), amber for next up (queued),
  // blue for researching (exploration phase).
  const statusStyles: Record<string, string> = {
    Shipping: 'bg-[#16A34A]/10 text-[#16A34A] border-[#16A34A]/30 dark:bg-[#16A34A]/15 dark:text-[#4ADE80]',
    Building: 'bg-[#E85D2F]/10 text-[#9C3D1F] border-[#E85D2F]/30 dark:bg-[#E85D2F]/20 dark:text-[#F2A261]',
    'Next up': 'bg-[#F2A261]/15 text-[#9C5B22] border-[#F2A261]/30 dark:text-[#F2A261]',
    Researching: 'bg-[#1B6FB5]/10 text-[#1B6FB5] border-[#1B6FB5]/30 dark:bg-[#1B6FB5]/20 dark:text-[#60A5FA]',
  }
  return (
    <article className="rounded-xl border border-[#0F1733]/10 dark:border-white/10 bg-white dark:bg-[#131826] p-6 transition-colors hover:border-[#E85D2F]/40" style={{ boxShadow: '0 1px 3px rgba(15,23,51,0.05)' }}>
      <div className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] uppercase tracking-[0.16em] font-bold border mb-4 ${statusStyles[status]}`}>
        <span className="w-1.5 h-1.5 rounded-full bg-current" />
        {status}
      </div>
      <h3 className="text-[17px] font-semibold tracking-[-0.01em] mb-2.5 leading-[1.3]">{title}</h3>
      <p className="text-[14px] text-[#0F1733]/65 dark:text-white/65 leading-[1.55]">{body}</p>
    </article>
  )
}

function FooterCol({ heading, links }: { heading: string; links: [string, string][] }) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-[0.18em] text-[#0F1733]/50 dark:text-white/50 mb-4 font-semibold">{heading}</div>
      <ul className="space-y-2">
        {links.map(([label, href]) => (
          <li key={label}>
            <Link href={href} className="text-[13px] text-[#0F1733]/70 dark:text-white/70 hover:text-[#0F1733] transition-colors">{label}</Link>
          </li>
        ))}
      </ul>
    </div>
  )
}

/**
 * FooterColPlaceholder — same visual shape as FooterCol but each
 * entry is rendered as plain text with a "Coming soon" affix instead
 * of a hyperlink. Used for Resources where nothing is published yet.
 */
function FooterColPlaceholder({ heading, labels }: { heading: string; labels: string[] }) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-[0.18em] text-[#0F1733]/50 dark:text-white/50 mb-4 font-semibold">{heading}</div>
      <ul className="space-y-2">
        {labels.map(label => (
          <li key={label} className="text-[13px] text-[#0F1733]/55 dark:text-white/55">
            {label}
            <span className="ml-1.5 text-[11px] uppercase tracking-[0.14em] text-[#0F1733]/40 dark:text-white/40">— soon</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
