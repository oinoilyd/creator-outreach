import Link from 'next/link'
import Image from 'next/image'
import { OperatorConsole } from '@/components/landing/OperatorConsole'
import { LandingTopNav } from '@/components/landing/LandingTopNav'
import { ScreenshotZoom } from '@/components/landing/ScreenshotZoom'
import { PLATFORM_MARKS } from '@/components/landing/PlatformBrandMarks'
import { StatBandSpotlight } from '@/components/landing/StatBandSpotlight'
import { WhyThisExists } from '@/components/landing/WhyThisExists'
import { ContactForm } from '@/components/landing/ContactForm'
import { createClient } from '@/lib/supabase/server'

/**
 * /landing — production marketing site.
 *
 * Style: Apollo-style premium B2B prospecting. Built on the app's
 * semantic palette (bg-background substrate, text-foreground primary,
 * brand violet→teal gradient for CTAs/accents) so the pre-sign-in
 * marketing surface matches the signed-in app exactly.
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
  description: 'Click a niche bucket, search YouTube/IG/TikTok/X/LinkedIn in parallel, score every result against criteria you wrote in plain English, and reach out from one board. 7-day free trial — $50/mo or $500/yr.',
  // The middleware rewrites "/" → "/landing" server-side, but the
  // URL stays "/". Pin the canonical to "/" so Google never settles
  // on "/landing" if anything links there directly.
  alternates: { canonical: 'https://creatoroutreach.net/' },
  // Override the OG title so social unfurls show the page-specific
  // headline instead of inheriting the layout's generic brand line.
  openGraph: {
    title: 'Creator Outreach — Search, score, and reach out in one queue',
    description:
      'Click a niche bucket, search YouTube/IG/TikTok/X/LinkedIn in parallel, score every result against criteria you wrote in plain English, and reach out from one board. 7-day free trial — $50/mo or $500/yr.',
    url: 'https://creatoroutreach.net/',
  },
}

export default async function LandingPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const isAuthed = !!user

  // SoftwareApplication structured data — eligible for rich results
  // in Google's app/software search. Server-rendered as inline JSON
  // so the crawler sees it on first request, no client JS needed.
  const softwareJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'Creator Outreach',
    applicationCategory: 'BusinessApplication',
    operatingSystem: 'Web',
    url: 'https://creatoroutreach.net/',
    description:
      'Search YouTube, Instagram, TikTok, X, and LinkedIn in parallel. Score every result against criteria you write in plain English. Reach out from one queue.',
    offers: {
      '@type': 'Offer',
      price: '50',
      priceCurrency: 'USD',
      availability: 'https://schema.org/InStock',
      // SaaS subscription pricing — $50/mo recurring with a 7-day
      // free trial. Schema.org doesn't have a clean way to express
      // "subscription with trial" so we surface the headline price
      // and signal trial availability via the description.
      priceSpecification: {
        '@type': 'UnitPriceSpecification',
        price: '50',
        priceCurrency: 'USD',
        referenceQuantity: {
          '@type': 'QuantitativeValue',
          value: '1',
          unitCode: 'MON',
        },
      },
    },
    aggregateRating: undefined, // omit until we have real reviews
  }

  return (
    <main
      className="min-h-screen overflow-x-clip text-foreground bg-background font-[family-name:var(--font-geist-sans)]"
    >
      <script
        type="application/ld+json"
        // eslint-disable-next-line react/no-danger -- structured-data
        // by design; payload built server-side from a literal object.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareJsonLd) }}
      />
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
            <p className="mt-7 max-w-[54ch] text-[17px] md:text-[18px] text-muted-foreground leading-[1.55]">
              Lead sourcing by occupation with an AI fit score that
              ranks every result against your criteria. Email + social
              handles inline. Templated outreach for the platform you
              actually target. Follow-up reminders so nothing slips.
              7-day free trial — no charges until your trial ends.
            </p>
            <div className="mt-9 flex flex-wrap items-center gap-3">
              <Link
                href={isAuthed ? '/' : '/auth/signup'}
                className="inline-flex items-center gap-2 bg-gradient-to-br from-brand to-brand-2 text-primary-foreground hover:opacity-90 transition-opacity shadow-sm shadow-brand/20 px-7 py-3.5 rounded-md font-semibold text-[15px]"
              >
                {isAuthed ? 'Open the app' : 'Start 7-day free trial'}
                <span aria-hidden>→</span>
              </Link>
              <a
                href="#contact"
                className="inline-flex items-center gap-2 bg-card text-foreground border border-border hover:border-foreground hover:bg-card px-7 py-3.5 rounded-md font-semibold text-[15px] transition-colors"
              >
                Book a demo
              </a>
            </div>
            <div className="mt-10 pt-7 border-t border-border">
              <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground mb-3 font-semibold">
                Built for anyone reaching out to creators
              </div>
              {/* Persona list — single paragraph with inline middle-
                  dot separators. Items can wrap naturally; only the
                  separator span has whitespace-nowrap so a "·" never
                  ends up alone at line-start. The whole list flows as
                  natural prose at any viewport width. */}
              <p className="text-[14px] text-muted-foreground font-medium leading-[1.7]">
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
                      <span aria-hidden className="mx-2 text-muted-foreground/40">
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
      <section id="solutions" className="px-6 py-20 md:py-28 bg-card border-y border-border">
        <div className="max-w-[1280px] mx-auto">
          <div className="max-w-[680px] mb-12 md:mb-16">
            <div className="text-[12px] uppercase tracking-[0.2em] text-brand mb-4 font-semibold">The four-step loop</div>
            <h2 className="font-semibold tracking-[-0.025em] text-foreground" style={{ fontSize: 'clamp(2rem, 4.5vw, 3.5rem)' }}>
              Sourcing. Fit score. Outreach. Follow-ups.
            </h2>
            <p className="mt-5 text-[17px] text-muted-foreground leading-[1.55]">
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
              <div className="text-[12px] uppercase tracking-[0.2em] text-brand mb-4 font-semibold">01 / Sourcing</div>
              <h2 className="font-semibold tracking-[-0.02em] mb-5 text-foreground" style={{ fontSize: 'clamp(1.75rem, 3.5vw, 2.75rem)' }}>
                Lead sourcing by occupation, scored on fit.
              </h2>
              <p className="text-[16px] text-muted-foreground leading-[1.6] mb-6">
                Search any occupation, industry, or field. Each result
                comes back with email + social handles attached and a
                fit score that explains itself in plain English (Strong
                / Possible / Weak), based on criteria you describe in
                a sentence.
              </p>
              <CustomizableChip />
              <ul className="space-y-2.5 text-[15px] text-foreground/85">
                <Bullet>Customizable AI fit score — any criteria you can name and measure</Bullet>
                <Bullet>Email + LinkedIn + Instagram handles inline per result</Bullet>
                <Bullet>Filter by region, audience size, last-posted recency, follower count</Bullet>
                <Bullet>Source from YouTube, Instagram, TikTok, X, and LinkedIn — focus on the platform you actually target</Bullet>
              </ul>
            </div>
            <ScreenshotZoom caption="Results — click to zoom; ESC to close.">
              <div
                className="relative rounded-xl overflow-hidden border border-border bg-card shadow-lg shadow-foreground/[0.08]"
                style={{
                  // Aspect ratio of the actual screenshot file so it
                  // fits without cropping. results.png is 2472×1182.
                  aspectRatio: '2472 / 1182',
                }}
              >
                <Image
                  src="/screenshots/results.png"
                  alt="Creator Outreach lead sourcing — results table with AI fit scores, inline emails, and per-creator social handles"
                  fill
                  sizes="(min-width: 1280px) 600px, 100vw"
                  className="object-contain screenshot-light-flip"
                />
              </div>
            </ScreenshotZoom>
          </div>
        </div>

        {/* 2 — Outreach */}
        <div id="outreach" className="px-6 py-12 md:py-16 scroll-mt-24">
          <div className="max-w-[1280px] mx-auto grid md:grid-cols-2 gap-10 md:gap-16 items-center">
            <div className="md:order-2">
              <div className="text-[12px] uppercase tracking-[0.2em] text-brand mb-4 font-semibold">02 / Outreach</div>
              <h2 className="font-semibold tracking-[-0.02em] mb-5 text-foreground" style={{ fontSize: 'clamp(1.75rem, 3.5vw, 2.75rem)' }}>
                Every conversation in one queue.
              </h2>
              <p className="text-[16px] text-muted-foreground leading-[1.6] mb-6">
                The Outreach board collects every creator you&apos;ve pitched —
                channel, email, product, status, medium. Status pills track
                Successful / Open / Rejected. Sub-tabs split out Favorites,
                Follow-ups, and Analytics. The whole pipeline lives in one row
                per creator.
              </p>
              <CustomizableChip />
              <ul className="space-y-2.5 text-[15px] text-foreground/85">
                <Bullet>Customizable status pills, mediums, and pipeline stages</Bullet>
                <Bullet>Status: Successful · Open · Rejected · No Response (rename or add your own)</Bullet>
                <Bullet>Medium tracker per row (Email / LinkedIn / Other — add your own channel)</Bullet>
                <Bullet>Favorites + Follow-ups sub-tabs · reached-out indicator · product + notes per creator</Bullet>
              </ul>
            </div>
            <ScreenshotZoom className="md:order-1" caption="Outreach board — click to zoom; ESC to close.">
              <div
                className="relative rounded-xl overflow-hidden border border-border bg-card shadow-lg shadow-foreground/[0.08]"
                style={{
                  // outreach.png is 2784×1122 — aspect 2.48
                  aspectRatio: '2784 / 1122',
                }}
              >
                <Image
                  src="/screenshots/outreach.png"
                  alt="Outreach board — every pitched creator in one queue with status pills, medium tracker, and follow-up cadence per row"
                  fill
                  sizes="(min-width: 1280px) 600px, 100vw"
                  className="object-contain screenshot-light-flip"
                />
              </div>
            </ScreenshotZoom>
          </div>
        </div>

        {/* 3 — Analytics */}
        <div id="analytics" className="px-6 py-12 md:py-16 scroll-mt-24">
          <div className="max-w-[1280px] mx-auto grid md:grid-cols-2 gap-10 md:gap-16 items-center">
            <div>
              <div className="text-[12px] uppercase tracking-[0.2em] text-brand mb-4 font-semibold">03 / Analytics</div>
              <h2 className="font-semibold tracking-[-0.02em] mb-5 text-foreground" style={{ fontSize: 'clamp(1.75rem, 3.5vw, 2.75rem)' }}>
                Win rate, response rate, pipeline value.
              </h2>
              <p className="text-[16px] text-muted-foreground leading-[1.6] mb-6">
                Seven default KPIs across the top — In Pipeline, Reached
                Out, Response Received, Response Rate, Win Rate, Pipeline $,
                Stale Follow-ups. Plus 30+ customizable metrics you can plug
                into the dashboard. Status breakdown bar, outreach-by-medium
                split, velocity card.
              </p>
              <CustomizableChip />
              <ul className="space-y-2.5 text-[15px] text-foreground/85">
                <Bullet>7 default KPI cards · 30+ customizable metrics — pin whichever ones matter to you</Bullet>
                <Bullet>Status breakdown bar (Successful / Open / No Response / Rejected)</Bullet>
                <Bullet>Outreach-by-medium split (Email / LinkedIn / Other)</Bullet>
                <Bullet>Velocity card tracks the last 7 days · build your own custom metric, no formulas</Bullet>
              </ul>
            </div>
            <ScreenshotZoom caption="Analytics — click to zoom; ESC to close.">
              <div
                className="relative rounded-xl overflow-hidden border border-border bg-card shadow-lg shadow-foreground/[0.08]"
                style={{
                  // analytics.png is 2822×1088 — aspect 2.59
                  aspectRatio: '2822 / 1088',
                }}
              >
                <Image
                  src="/screenshots/analytics.png"
                  alt="Outreach analytics dashboard — win rate, response rate, pipeline value KPIs with status breakdown and outreach-by-medium split"
                  fill
                  sizes="(min-width: 1280px) 600px, 100vw"
                  className="object-contain screenshot-light-flip"
                />
              </div>
            </ScreenshotZoom>
          </div>
        </div>

        {/* 4 — Follow-ups */}
        <div id="followups" className="px-6 py-12 md:py-16 pb-20 md:pb-28 scroll-mt-24">
          <div className="max-w-[1280px] mx-auto grid md:grid-cols-2 gap-10 md:gap-16 items-center">
            <div className="md:order-2">
              <div className="text-[12px] uppercase tracking-[0.2em] text-brand mb-4 font-semibold">04 / Follow-ups</div>
              <h2 className="font-semibold tracking-[-0.02em] mb-5 text-foreground" style={{ fontSize: 'clamp(1.75rem, 3.5vw, 2.75rem)' }}>
                Cadenced reminders so silence doesn&apos;t leak pipeline.
              </h2>
              <p className="text-[16px] text-muted-foreground leading-[1.6] mb-6">
                Set a reminder cadence per creator the moment you reach out.
                The Follow-ups tab surfaces every contact that&apos;s due
                today, sorted by who&apos;s gone cold longest. Mark
                followed-up with a click and the cadence resets — no spreadsheet
                of dates, no calendar manual entry.
              </p>
              <CustomizableChip />
              <ul className="space-y-2.5 text-[15px] text-foreground/85">
                <Bullet>Customizable cadence per creator (3 / 7 / 14 / 30 days, or your own interval)</Bullet>
                <Bullet>Dedicated Follow-ups sub-tab — only what&apos;s due today / overdue</Bullet>
                <Bullet>Reset on click — marks the contact as followed-up + restarts the cadence</Bullet>
                <Bullet>Stale Follow-ups KPI in Analytics shows where pipeline is leaking</Bullet>
              </ul>
            </div>
            {/* Real followups.png screenshot, rendered at its natural
                aspect ratio (2810x1234 → 2.28) inside a dark frame
                with object-contain so nothing is distorted or
                cropped. The earlier 'looks weird' issue was a
                wrong aspect ratio. Verified pixel-correct here. */}
            <ScreenshotZoom className="md:order-1" caption="Follow-ups view — click to zoom; ESC to close.">
              <div
                className="relative rounded-xl overflow-hidden border border-border bg-card shadow-lg shadow-foreground/[0.08]"
                style={{
                  aspectRatio: '2810 / 1234',
                }}
              >
                <Image
                  src="/screenshots/followups.png"
                  alt="Follow-ups queue — overdue and due-today creator contacts sorted by days since last reach-out, with one-click cadence reset"
                  fill
                  sizes="(min-width: 1280px) 600px, 100vw"
                  className="object-contain screenshot-light-flip"
                />
              </div>
            </ScreenshotZoom>
          </div>
        </div>
      </section>

      {/* (Stat band moved up — was here, now appears between Solutions
          and Product Narratives via <StatBandSpotlight />.) */}

      {/* "WHY THIS EXISTS" — rebuilt as a graphic feature spotlight
          per Dylan ('greater bigger better graphic exciting and
          aligned/fitted'). Each card now has an inline-SVG before/
          after visual: 4 chaotic browser-tabs collapsing into one
          row, generic gauge → custom-criteria fit score, crossed-out
          CRMs → unified outreach row. Lives in the WhyThisExists
          client component (intersection-observed reveal animations). */}
      <WhyThisExists />

      {/* (Platform tiles section removed 2026-05-08 — felt redundant
          after the niche/parallel deemphasis pass; the supported
          platforms are already named in the Hero subhead and the
          Sourcing narrative.) */}

      {/* PRICING — Monthly + Annual paid plans, both with a 7-day
          free trial. Annual is the featured/highlighted card since
          it's the recommended plan (2 months free vs monthly).
          CTAs route through /pricing so the actual subscribe action
          flows through the auth-aware checkout there. */}
      <section id="pricing" className="px-6 pb-20 md:pb-28 scroll-mt-24 bg-card border-y border-border">
        <div className="max-w-[1100px] mx-auto pt-20 md:pt-28">
          <div className="text-center mb-12">
            <h2 className="font-semibold tracking-[-0.025em] mb-5 text-foreground" style={{ fontSize: 'clamp(2rem, 4.5vw, 3.5rem)' }}>
              Start with a 7-day free trial.
            </h2>
            <p className="max-w-[58ch] mx-auto text-[17px] text-muted-foreground leading-[1.55]">
              No charges until your trial ends. Cancel anytime from the customer portal.
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-5 max-w-[1180px] mx-auto items-stretch">
            <PricingCard
              tier="Monthly"
              price="$50"
              priceSub="per month · 7-day free trial · cancel anytime"
              features={[
                'Unlimited creator search across YouTube, Instagram, TikTok, X, LinkedIn',
                'Customizable AI fit score — any criteria you can name and measure',
                'Built-in CRM: status pills, medium tracker, follow-up cadence',
                'Templated outreach per channel + Instagram DM auto-composer',
                'Customizable analytics — 7 default KPIs, 30+ custom metrics',
                'Live in-app support — message the team without leaving the app',
                'Integrations: native Airtable sync + open API (Zapier-ready)',
                'CSV / Excel export — your data, anytime',
              ]}
              cta={isAuthed ? 'Open the app' : 'Start 7-day free trial'}
              ctaHref={isAuthed ? '/' : '/pricing'}
            />
            <PricingCard
              tier="Annual · Save 17%"
              price="$500"
              priceSub="per year · 7-day free trial · 2 months free"
              features={[
                'Everything in Monthly',
                'Two months free (paid annually)',
                'Priority support',
                'Early access to new features',
                'Custom scoring presets',
                'CSV / Excel export — your data, anytime',
              ]}
              cta={isAuthed ? 'Open the app' : 'Start 7-day free trial'}
              ctaHref={isAuthed ? '/' : '/pricing'}
              featured
            />
            <PricingCard
              tier="Teams"
              price="Custom"
              priceSub="for teams & agencies · request a demo"
              features={[
                'Everything in Annual',
                'Seats for your whole team',
                'Shared pipeline — assign leads to teammates',
                'Centralized billing',
                'Hands-on onboarding',
              ]}
              cta="Request a demo"
              ctaHref="#contact"
            />
          </div>
        </div>
      </section>

      {/* CONTACT / DEMO — public, Gmail-free. Form posts to /api/contact
          (rate-limited by IP) and lands in the admin inbox. Doubles as
          the "request a demo" destination for the Teams card + nav, so no
          personal email is exposed anywhere on the marketing site. */}
      <section id="contact" className="px-6 py-20 md:py-28 scroll-mt-24 border-t border-border">
        <div className="max-w-[640px] mx-auto">
          <div className="text-center mb-10">
            <div className="text-[12px] uppercase tracking-[0.2em] text-brand mb-4 font-semibold">Talk to us</div>
            <h2 className="font-semibold tracking-[-0.025em] text-foreground" style={{ fontSize: 'clamp(2rem, 4.5vw, 3.25rem)' }}>
              Questions, or want a team demo?
            </h2>
            <p className="mt-5 text-[17px] text-muted-foreground leading-[1.55]">
              Send a note and we&apos;ll get right back to you. Already a member? You also get live support inside the app.
            </p>
          </div>
          <div className="rounded-2xl border border-border bg-card p-6 md:p-8 shadow-sm shadow-foreground/[0.04]">
            <ContactForm />
          </div>
        </div>
      </section>

      {/* (Roadmap moved to its own dedicated page at /roadmap and
          surfaced via the hamburger menu only — was an inline
          section here, but Dylan wanted it lifted off the landing
          flow so the page reads tighter.) */}

      {/* (Final CTA section removed 2026-05-08 — the dark
          'One query. Five platforms. One queue.' banner felt like a
          tacked-on second pricing section. The Beta pricing card
          above already carries the primary CTA.) */}

      {/* FOOTER — wordmark only (the rounded "C" tile in the nav was
          already a generic Stripe-Notion-Linear placeholder; doubling
          it in the footer made the brand read as not-yet-designed).
          Footer keeps just the wordmark with a thin brand-violet
          underscore that matches the in-app brand mark. */}
      <footer className="bg-card border-t border-border px-6 py-14">
        <div className="max-w-[1280px] mx-auto grid md:grid-cols-6 gap-8">
          <div className="md:col-span-2">
            <Link href="/landing" className="inline-block mb-4">
              <span className="font-semibold tracking-[-0.01em] text-[18px] text-foreground border-b-2 border-brand pb-0.5">
                Creator Outreach
              </span>
            </Link>
            <p className="text-[13px] text-muted-foreground leading-[1.55] max-w-[36ch]">
              The modern way to source, score, and pitch creators. Built for the operators who actually send the messages.
            </p>
            <div className="mt-6 text-[12px] text-muted-foreground">© 2026 Creator Outreach</div>
          </div>
          {/* "Customers" anchor was removed — there's no #customers
              section on the page, and footer links into nowhere are
              an SEO/UX dead-link. */}
          <FooterCol heading="Product"   links={[['Overview','#product'],['Solutions','#solutions'],['Pricing','#pricing'],['Plans & checkout','/pricing']]} />
          {/* Resources column — every entry currently says "Coming
              soon" because none of the long-form content (guides,
              playbooks, changelog) is published yet. Honest framing
              beats four mailto: links pretending to be real pages. */}
          <FooterColPlaceholder heading="Resources" labels={['Guides', 'Playbooks', 'Changelog']} />
          <FooterCol heading="Company"   links={[['Why Creator Outreach','#customers'],['Contact','#contact'],['Request a demo','#contact']]} />
          <FooterCol heading="Legal"     links={[['Privacy','/privacy'],['Terms','/terms'],['Refunds','/refunds'],['Security','/security'],['Subprocessors & DPAs','/subprocessors'],['Support','/support'],['Cookies','/cookies']]} />
        </div>
      </footer>
    </main>
  )
}

/* ─── primitives ─── */


function SolutionTile({ icon, title, body, step }: { icon: React.ReactNode; title: string; body: string; step?: string }) {
  return (
    <div className="group relative rounded-xl border border-border bg-card p-6 hover:-translate-y-1 transition-transform overflow-hidden shadow-sm shadow-foreground/[0.03]">
      {/* Hover affordance — arrow appears top-right on hover. Different
          from the platform-tile left-stripe and the resource-card
          chevron-trail; each card type has its own hover reveal so the
          page doesn't read as one repeated -translate-y-1 lift. */}
      <span
        aria-hidden
        className="absolute top-4 right-4 text-brand opacity-0 group-hover:opacity-100 -translate-x-1 group-hover:translate-x-0 transition-all duration-200"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <line x1="7" y1="17" x2="17" y2="7" />
          <polyline points="7 7 17 7 17 17" />
        </svg>
      </span>
      <div className="flex items-center gap-3 mb-4">
        <span className="inline-flex items-center justify-center w-10 h-10 rounded-lg bg-brand/10 text-brand [&>svg]:w-5 [&>svg]:h-5">
          {icon}
        </span>
        {step && (
          <span className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground/70 font-bold font-mono">
            Step {step}
          </span>
        )}
      </div>
      <h3 className="text-[18px] font-semibold tracking-[-0.01em] mb-2 text-foreground">{title}</h3>
      <p className="text-[14px] text-muted-foreground leading-[1.55]">{body}</p>
    </div>
  )
}

/**
 * CustomizableChip — small "Fully customizable" pill chip used in
 * each product narrative to call out that the feature isn't fixed.
 * Sits above the bullet list so the customizability story reads at
 * a glance without burying it inside copy.
 */
function CustomizableChip() {
  return (
    <div className="inline-flex items-center gap-1.5 mb-5 px-2.5 py-1 rounded-full bg-brand/10 border border-brand/30 text-[10px] uppercase tracking-[0.18em] font-bold text-brand dark:text-brand-2">
      <svg width="9" height="9" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
        <path d="M12 2 L14.5 9.5 L22 12 L14.5 14.5 L12 22 L9.5 14.5 L2 12 L9.5 9.5 Z" />
      </svg>
      Fully customizable
    </div>
  )
}

function Bullet({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2.5">
      <span className="text-brand font-bold mt-0.5 shrink-0">✓</span>
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

function PricingCard({ tier, price, priceSub, features, cta, ctaHref, featured = false }: { tier: string; price: string; priceSub: string; features: string[]; cta: string; ctaHref: string; featured?: boolean }) {
  // flex column with the features ul flex-1 ensures the CTA button
  // sits at the bottom of every card regardless of bullet count —
  // the Beta and Coming-soon cards have different feature counts,
  // and the CTAs need to align horizontally across both.
  //
  // Featured variant rides the brand violet→teal gradient (same gradient
  // as the "C" tile mark and the hero CTA) so the recommended-plan card
  // visually ties back to the brand. Non-featured sits on bg-card.
  return (
    <div
      // Both variants get a 1px border so the inner content area (and
      // therefore the bottom CTA inside) renders at the EXACT same
      // width across both cards. Featured uses border-transparent;
      // non-featured uses a visible faint border. Without this the
      // featured card was 2px wider on the inside, leaving the
      // CTAs 2px apart in width.
      className={`rounded-2xl p-7 md:p-8 flex flex-col border ${
        featured
          ? 'bg-gradient-to-br from-brand to-brand-2 text-primary-foreground border-transparent shadow-lg shadow-brand/30'
          : 'bg-card text-foreground border-border'
      }`}
    >
      <div className={`text-[13px] uppercase tracking-[0.18em] mb-3 font-semibold ${featured ? 'text-primary-foreground/80' : 'text-brand'}`}>{tier}</div>
      <div className="font-semibold tracking-[-0.025em] mb-1" style={{ fontSize: 'clamp(2.25rem, 4vw, 3rem)' }}>{price}</div>
      <div className={`text-[13px] mb-6 ${featured ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>{priceSub}</div>
      <ul className="space-y-2.5 mb-7 text-[14px] flex-1">
        {features.map(f => (
          <li key={f} className="flex items-start gap-2.5">
            <span className={featured ? 'text-primary-foreground font-bold mt-0.5 shrink-0' : 'text-brand font-bold mt-0.5 shrink-0'}>✓</span>
            <span className={featured ? 'text-primary-foreground/90' : 'text-foreground/85'}>{f}</span>
          </li>
        ))}
      </ul>
      <Link href={ctaHref} className={`mt-auto flex w-full items-center justify-center gap-1.5 px-5 py-3 rounded-md font-semibold text-[15px] whitespace-nowrap transition-opacity ${featured ? 'bg-background text-foreground hover:opacity-90' : 'bg-gradient-to-br from-brand to-brand-2 text-primary-foreground hover:opacity-90 shadow-sm shadow-brand/20'}`}>
        {cta} <span aria-hidden>→</span>
      </Link>
    </div>
  )
}


function FooterCol({ heading, links }: { heading: string; links: [string, string][] }) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground mb-4 font-semibold">{heading}</div>
      <ul className="space-y-2">
        {links.map(([label, href]) => (
          <li key={label}>
            <Link href={href} className="text-[13px] text-muted-foreground hover:text-foreground transition-colors">{label}</Link>
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
      <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground mb-4 font-semibold">{heading}</div>
      <ul className="space-y-2">
        {labels.map(label => (
          <li key={label} className="text-[13px] text-muted-foreground">
            {label}
            <span className="ml-1.5 text-[11px] uppercase tracking-[0.14em] text-muted-foreground/70">— soon</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
